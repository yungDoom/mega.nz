/* Bundle Includes:
 *   js/authring.js
 *   html/js/login.js
 *   js/ui/export.js
 *   html/js/key.js
 *   js/ui/simpletip.js
 *   js/useravatar.js
 *   html/js/bottompage.js
 *   js/filedrag.js
 *   js/thumbnail.js
 *   js/vendor/exif.js
 *   js/vendor/smartcrop.js
 *   js/vendor/jquery.qrcode.js
 *   js/vendor/qrcode.js
 *   js/ui/password-revert.js
 *   js/ui/publicServiceAnnouncement.js
 *   js/ui/megaInputs.js
 *   js/ui/megaInputs-underlinedText.js
 *   js/ui/megaInputs-textArea.js
 *   js/ui/megaInputs-currencyField.js
 *   html/js/developersettings.js
 *   html/js/repay.js
 *   js/ui/passwordReminderDialog.js
 *   js/metatags.js
 *   js/vendor/verge.js
 */

/**
 * @fileOverview
 * Storage of authenticated contacts.
 */

var u_authring = { 'Ed25519': undefined,
                   'Cu25519': undefined,
                   'RSA': undefined };

var authring = (function () {
    "use strict";

    /**
     * @description
     * <p>Storage of authenticated contacts.</p>
     *
     * <p>
     * A container (key ring) that keeps information of the authentication state
     * for all authenticated contacts. Each record is indicated by the contact's
     * userhandle as an attribute. The associated value is an object containing
     * the authenticated `fingerprint` of the public key, the authentication
     * `method` (e. g. `authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON`)
     * and the key `confidence` (e. g. `authring.KEY_CONFIDENCE.UNSURE`).</p>
     *
     * <p>
     * The records are stored in a concatenated fashion, with each user handle
     * represented in its compact 8 byte form followed by a the fingerprint as a
     * byte string and a "trust indicator" byte containing the authentication and
     * confidence information. Therefore each authenticated user "consumes"
     * 29 bytes of storage.</p>
     *
     * <p>
     * Load contacts' authentication info with `authring.getContacts()` and save
     * with `authring.setContacts()`.</p>
     */
    var ns = {};
    var logger = MegaLogger.getLogger('authring');
    ns._logger = logger;

    ns._initialisingPromise = false;

    /**
     * "Enumeration" of authentication methods. The values in here must fit
     * into 4 bits of a byte.
     *
     * @property SEEN {integer}
     *     To record a "seen" fingerprint, to be able to check for future changes.
     * @property FINGERPRINT_COMPARISON {integer}
     *     Direct/full fingerprint comparison.
     * @property SIGNATURE_VERIFIED {integer}
     *     Verified key's signature.
     */
    ns.AUTHENTICATION_METHOD = {
        SEEN: 0x00,
        FINGERPRINT_COMPARISON: 0x01,
        SIGNATURE_VERIFIED: 0x02
    };
    var _ALLOWED_AUTHENTICATION_METHODS = [0x00, 0x01, 0x02];

    const isUserHandle = tryCatch((userHandle) => {
        return typeof userHandle === 'string' && base64urldecode(userHandle).length === 8;
    });

    const safeStateAssert = (promise, cond) => {
        if (cond === '$keyring') {
            cond = u_keyring && window.u_attr && window.u_attr.keyring === u_keyring;
        }
        if (cond === undefined || cond) {
            cond = window.u_attr && isUserHandle(window.u_handle)
                && typeof u_attr === 'object' && u_attr.u === u_handle;
        }

        if (!cond) {
            const msg = 'The system went into an invalid state for ongoing auth-ring operations :skull:';

            onIdle(() => {
                throw new Error(msg);
            });
            console.error(msg, window.u_attr);

            if (promise) {
                promise.reject(EINTERNAL);
            }
        }

        return !!cond;
    };

    /**
     * "Enumeration" of confidence in contact's key. The values in here must fit
     * into 4 bits of a byte.
     *
     * @property UNSURE {integer}
     *     Direct fingerprint comparison.
     */
    ns.KEY_CONFIDENCE = {
        UNSURE: 0x00
    };
    var _ALLOWED_KEY_CONFIDENCES = [0x00];

    // User property names used for different key types.
    ns._PROPERTIES = { 'Ed25519': 'authring',
                       'Cu25519': 'authCu255',
                       'RSA': 'authRSA' };

    /**
     * Serialises a single authentication record.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param fingerprint {string}
     *     Fingerprint to authenticate as a byte or hex string.
     * @param method {byte}
     *     Indicator used for authentication method. One of
     *     authring.AUTHENTICATION_METHOD (e. g. FINGERPRINT_COMPARISON).
     * @param confidence {byte}
     *     Indicator used for confidence. One of authring.KEY_CONFIDENCE
     *     (e. g. UNSURE).
     * @returns {string}
     *     Single binary encoded authentication record.
     * @private
     */
    ns._serialiseRecord = function(userhandle, fingerprint, method, confidence) {
        var fingerprintString = fingerprint;
        if (fingerprint.length !== 20) {
            // Assuming a hex fingerprint has been passed.
            fingerprintString = asmCrypto.bytes_to_string(asmCrypto.hex_to_bytes(fingerprint));
        }
        return base64urldecode(userhandle)
               + fingerprintString
               + String.fromCharCode((confidence << 4) | method);
    };


    /**
     * Generates a binary encoded serialisation of an authentication ring
     * object.
     *
     * @param authring {Object}
     *     Object containing (non-nested) authentication records for Mega user
     *     handles (as keys) and `fingerprint`, `method` and `confidence` as
     *     attributes of the `value` object.
     * @returns {String}
     *     Single binary encoded serialisation of authentication ring.
     */
    ns.serialise = function(authring) {

        var result = '';
        var record;
        for (var userhandle in authring) {
            if (!authring.hasOwnProperty(userhandle)) {
                continue;
            }
            record = authring[userhandle];

            // Skip obviously faulty records.
            if ((record.fingerprint.length % 20 !== 0)
                    || _ALLOWED_AUTHENTICATION_METHODS.indexOf(record.method) === -1
                    || _ALLOWED_KEY_CONFIDENCES.indexOf(record.confidence) === -1) {
                continue;
            }

            /* (refer to commit history if you ever want to uncomment this)

            // Skip non-contact's fingerprints
            if (!(userhandle in M.u && M.u[userhandle].c >= 0 && M.u[userhandle].c < 2)) {
                continue;
            }

            /***/

            result += this._serialiseRecord(userhandle, record.fingerprint,
                                            record.method, record.confidence);
        }

        return result;
    };


    /**
     * Splits and decodes an authentication record off of a binary keyring
     * serialisation and returns the record and the rest.
     *
     * @param serialisedRing {String}
     *     Single binary encoded container of authentication records.
     * @returns {Object}
     *     Object containing three elements: `userhandle` contains the Mega
     *     user handle, `value` contains an object (with the `fingerprint` in a
     *     byte string, authentication `method` and key `confidence`) and `rest`
     *     containing the remainder of the serialisedRing still to decode.
     * @private
     */
    ns._deserialiseRecord = function(serialisedRing) {

        var userhandle = base64urlencode(serialisedRing.substring(0, 8));
        var fingerprint =  serialisedRing.substring(8, 28);
        var authAttributes = serialisedRing.charCodeAt(28);
        var rest = serialisedRing.substring(29);
        var confidence = (authAttributes >>> 4) & 0x0f;
        var method = authAttributes & 0x0f;

        return { userhandle: userhandle,
                 value: { fingerprint: fingerprint,
                          method: method,
                          confidence: confidence },
                 rest: rest };
    };


    /**
     * Decodes a binary encoded serialisation to an authentication ring object.
     *
     * @param serialisedRing {String}
     *     Single binary encoded serialisation of authentication records.
     * @returns {Object}
     *     Object containing (non-nested) authentication records for Mega user
     *     handles (as keys) and `fingerprint`, `method` and `confidence` as
     *     attributes of the `value` object.
     */
    ns.deserialise = function(serialisedRing) {

        var rest = serialisedRing;
        var container = {};

        while (rest.length > 0) {
            var result = ns._deserialiseRecord(rest);
            rest = result.rest;

            // Skip obviously faulty records.
            if ((result.value.fingerprint.length % 20 !== 0)
                    || _ALLOWED_AUTHENTICATION_METHODS.indexOf(result.value.method) === -1
                    || _ALLOWED_KEY_CONFIDENCES.indexOf(result.value.confidence) === -1) {
                continue;
            }

            container[result.userhandle] = result.value;
        }

        return container;
    };


    /**
     * Loads the ring for all authenticated contacts into `u_authring`.
     *
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519',
     *     'Cu25519'  or 'RSA'.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     */
    ns.getContacts = function(keyType) {
        if (ns._PROPERTIES[keyType] === undefined) {
            logger.error('Unsupported authentication key type: ' + keyType);

            return MegaPromise.reject(EARGS);
        }

        // This promise will be the one which is going to be returned.
        var masterPromise = new MegaPromise();
        let attributePromise, fromKeys;

        if (!mega.keyMgr.generation || keyType === 'RSA') {
            attributePromise = mega.attr.get(u_handle, ns._PROPERTIES[keyType], false, true);
        }
        else {
            attributePromise = new MegaPromise((resolve) => {
                fromKeys = true;
                resolve(mega.keyMgr.authrings[keyType] || ENOENT);
            });
        }

        attributePromise.always(tryCatch((result) => {

            if (typeof result !== 'number') {
                // Authring is in the empty-name record.
                u_authring[keyType] = fromKeys === true ? result : ns.deserialise(result['']);
                logger.debug(`Got authentication ring for key type ${keyType}.`);
                masterPromise.resolve(u_authring[keyType]);
            }
            else if (result === ENOENT) {
                // This authring is missing. Let's make it.
                logger.debug(`No authentication ring for key type ${keyType}, making one.`);
                u_authring[keyType] = {};

                if (!mega.keyMgr.secure || keyType !== 'RSA') {
                    ns.setContacts(keyType);
                }
                masterPromise.resolve(u_authring[keyType]);
            }
            else {
                logger.error(`Error retrieving authentication ring for key type ${keyType}: ${result}`);
                masterPromise.reject(result);
            }
        }, (ex) => {
            logger.error(ex);
            masterPromise.reject(ex);
        }));

        return masterPromise;
    };

    /**
     * Enqueue key-management commit, upon established authenticated users.
     * @returns {Promise<*>} none
     */
    ns.enqueueKeyMgrCommit = function() {

        if (!this.pendingKeyMgrCommit) {

            this.pendingKeyMgrCommit = mega.promise;

            // @todo debounce longer if no side-effects..
            onIdle(() => {
                const {resolve, reject} = this.pendingKeyMgrCommit;

                this.pendingKeyMgrCommit = null;
                mega.keyMgr.commit().then(resolve).catch(reject);
            });
        }

        return this.pendingKeyMgrCommit;
    };

    /**
     * Try to complete pending out/in-shares based on the new situation.
     * @returns {Promise<*>}
     */
    ns.enqueueKeyMgrSharesCompletion = function() {

        if (!this.pendingKeyMgrSharesCompletion) {

            this.pendingKeyMgrSharesCompletion = mega.promise;

            onIdle(() => {
                const {resolve, reject} = this.pendingKeyMgrSharesCompletion;

                mega.keyMgr.completePendingOutShares()
                    .then(() => mega.keyMgr.acceptPendingInShares())
                    .then(resolve)
                    .catch(reject);

                this.pendingKeyMgrSharesCompletion = null;
            });
        }

        return this.pendingKeyMgrSharesCompletion;
    };

    /**
     * Saves the ring for all authenticated contacts from `u_authring`.
     *
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519',
     *     'Cu25519' or 'RSA'.
     *
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     */
    ns.setContacts = function(keyType) {

        if (ns._PROPERTIES[keyType] === undefined) {
            logger.error('Unsupported authentication key type: ' + keyType);
            return MegaPromise.reject(EARGS);
        }

        return this.onAuthringReady('setContacts').then(() => {
            const promises = [];

            if (!mega.keyMgr.secure) {

                promises.push(
                    Promise.resolve(
                        mega.attr.set(ns._PROPERTIES[keyType], {'': ns.serialise(u_authring[keyType])}, false, true)
                    )
                );
            }
            promises.push(this.enqueueKeyMgrCommit());
            return Promise.all(promises);
        });
    };


    /**
     * Gets the authentication state of a certain contact for a particular key type.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519',
     *     'Cu25519' or 'RSA'.
     * @return {object}
     *     An object describing the authenticated `fingerprint`, the
     *     authentication `method` and the key `confidence`. `false` in case
     *     of an unauthorised contact.
     */
    ns.getContactAuthenticated = function(userhandle, keyType) {
        assertUserHandle(userhandle);
        if (ns._PROPERTIES[keyType] === undefined) {
            logger.error('Unsupported key type: ' + keyType);

            return false;
        }

        if (u_authring[keyType] === undefined) {
            logger.error('First initialise u_authring by calling authring.getContacts()');

            return false;
        }

        if (u_authring[keyType].hasOwnProperty(userhandle)) {
            return u_authring[keyType][userhandle];
        }

        return false;
    };


    /**
     * Stores a contact authentication for a particular key type.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param fingerprint {string}
     *     Fingerprint to authenticate as a byte or hex string.
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519' or 'RSA'.
     * @param method {byte}
     *     Indicator used for authentication method. One of
     *     authring.AUTHENTICATION_METHOD (e. g. FINGERPRINT_COMPARISON).
     * @param confidence {byte}
     *     Indicator used for confidence. One of authring.KEY_CONFIDENCE
     *     (e. g. UNSURE).
     */
    ns.setContactAuthenticated = function(userhandle, fingerprint, keyType,
                                          method, confidence) {

        assertUserHandle(userhandle);

        if (ns._PROPERTIES[keyType] === undefined) {
            logger.error('Unsupported key type: ' + keyType);

            return;
        }
        if (typeof u_authring[keyType] === 'undefined') {
            logger.error('First initialise u_authring by calling authring.getContacts()');

            return;
        }
        if (userhandle === u_handle) {
            // We don't want to track ourself. Let's get out of here.
            return;
        }

        var oldRecord = u_authring[keyType][userhandle];
        if (!oldRecord
                || !ns.equalFingerprints(oldRecord.fingerprint, fingerprint)
                || (oldRecord.method !== method)
                || (oldRecord.confidence !== confidence)) {

            // Need to update the record.
            u_authring[keyType][userhandle] = {
                fingerprint: fingerprint,
                method: method,
                confidence: confidence
            };

            return ns.setContacts(keyType)
                .then(() => {
                    return this.enqueueKeyMgrSharesCompletion();
                });
        }
    };


    /**
     * Computes the given public key's cryptographic fingerprint. On RSA keys,
     * the modulo (index 0 of key array) and exponent (index 1) are first
     * concatenated.
     *
     * @param key {(String|Array)}
     *     Public key in the form of a byte string or array (RSA keys).
     * @param keyType {String}
     *     Type of key for authentication records. Values are 'Ed25519',
     *     'Cu25519' or 'RSA'.
     * @param format {String}
     *     Format in which to return the fingerprint. Valid values: "string"
     *     and "hex" (default: "hex").
     * @return {String}
     *     Fingerprint value in the requested format.
     */
    ns.computeFingerprint = function(key, keyType, format) {
        if (ns._PROPERTIES[keyType] === undefined) {
            logger.error('Unsupported key type: ' + keyType);

            return '';
        }
        if (!key) {
            logger.error('Invalid key for: ' + keyType);

            return '';
        }
        format = format || 'hex';
        keyType = keyType || 'Ed25519';

        var value = key;
        if (keyType === 'Ed25519' || keyType === 'Cu25519') {
            if (key.length !== 32) {
                logger.error('Unexpected key length for type ' + keyType
                             + ': ' + key.length);

                return '';
            }
        }
        else if (keyType === 'RSA') {
            value = key[0] + key[1];
        }
        else {
            logger.error('Unexpected key type for fingerprinting: ' + keyType);

            return '';
        }

        if (format === "string") {
            return asmCrypto.bytes_to_string(asmCrypto.SHA256.bytes(value)).substring(0, 20);
        }
        else if (format === "hex") {
            return asmCrypto.SHA256.hex(value).substring(0, 40);
        }
    };


    /**
     * Signs the given public key using our own Ed25519 key. On RSA pub keys,
     * the modulo (index 0 of key array) and exponent (index 1) are first
     * concatenated before signing.
     *
     * @param pubKey {array}
     *     The public key to sign.
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519',
     *     'Cu25519' or 'RSA'.
     * @return {string}
     *     EdDSA signature of the key as a byte string.
     */
    ns.signKey = function(pubKey, keyType) {
        if (!pubKey) {
            logger.error('No key to sign.');

            return;
        }
        if (ns._PROPERTIES[keyType] === undefined) {
            logger.error('Unsupported key type: ' + keyType);

            return;
        }
        var timeStamp = ns._longToByteString(Math.round(Date.now() / 1000));
        var value = pubKey;
        if (keyType === 'RSA') {
            value = pubKey[0] + pubKey[1];
        }
        var keyString = 'keyauth' + timeStamp + value;
        var detachedSignature = nacl.sign.detached(asmCrypto.string_to_bytes(keyString),
                                                   asmCrypto.string_to_bytes(u_privEd25519 + u_pubEd25519));
        return timeStamp + asmCrypto.bytes_to_string(detachedSignature);
    };


    /**
     * Verifies the signature of the given public key's against the
     * contact's Ed25519 key.
     *
     * @param signature {string}
     *     EdDSA signature in byte string format.
     * @param pubKey {array}
     *     The public key to verify.
     * @param keyType {string}
     *     Type of key for authentication records. Values are 'Ed25519',
     *     'Cu25519' or 'RSA'.
     * @param signPubKey {string}
     *     Contact's Ed25519 public key to verify the signature.
     * @return {MegaPromise}
     *     True on a good signature verification, false otherwise.
     */
    ns.verifyKey = function(signature, pubKey, keyType, signPubKey) {
        // Bail out if nothing to do.
        if (ns._PROPERTIES[keyType] === undefined) {
            logger.error('Unsupported key type: ' + keyType);

            return MegaPromise.resolve(null);
        }
        if (!signature) {
            logger.warn('Cannot verify an empty signature.');

            return MegaPromise.resolve(null);
        }

        var signatureValue = signature.substring(8);
        var timestamp = signature.substring(0, 8);
        var timestampValue = ns._byteStringToLong(timestamp);
        if (timestampValue > Math.round(Date.now() / 1000)) {
            logger.error('Bad timestamp: In the future!');

            return MegaPromise.resolve(null);
        }
        var value = pubKey;
        if (keyType === 'RSA') {
            value = pubKey[0] + pubKey[1];
        }
        var keyString = 'keyauth' + timestamp + value;
        return backgroundNacl.sign.detached.verify(asmCrypto.string_to_bytes(keyString),
                                         asmCrypto.string_to_bytes(signatureValue),
                                         asmCrypto.string_to_bytes(signPubKey));
    };


    /**
     * Compare two fingerprints.
     *
     * @param fp1 {string}
     *     First fingerprint in byte or hex string format.
     * @param fp2 {string}
     *     Second fingerprint. in byte or hex string format
     * @return {bool}
     *     True on equality, `undefined` if one fingerprint is undefined,
     *     false otherwise.
     */
    ns.equalFingerprints = function(fp1, fp2) {
        if (fp1 === undefined || fp2 === undefined) {
            return undefined;
        }
        if (fp1.length !== 20) {
            fp1 = asmCrypto.bytes_to_string(asmCrypto.hex_to_bytes(fp1));
        }
        if (fp2.length !== 20) {
            fp2 = asmCrypto.bytes_to_string(asmCrypto.hex_to_bytes(fp2));
        }
        return fp1 === fp2;
    };


    /**
     * Convert a long integer (> 32-bit) to an 8-byte bit-endian string.
     *
     * @param value {integer}
     *     Integer input.
     * @return {string}
     *     Big-endian byte string representation.
     */
    ns._longToByteString = function(value) {
        if (value > 9007199254740991) {
            // Check for value > Number.MAX_SAFE_INTEGER (not available in all JS).
            logger.error('Integer not suitable for lossless conversion in JavaScript.');

            return '';
        }
        var result = '';

        for (var i = 0; i < 8; i++ ) {
            result = String.fromCharCode(value & 0xff) + result;
            value = Math.floor(value / 0x100);
        }

        return result;
    };


    /**
     * Convert an 8-byte bit-endian string to a long integer (> 32-bit).
     *
     * @param sequence {string}
     *     Big-endian byte string representation.
     * @return {intenger}
     *     Integer representation.
     */
    ns._byteStringToLong = function(sequence) {
        var value = 0;
        for (var i = 0; i < 8; i++) {
            value = (value * 256) + sequence.charCodeAt(i);
        }
        // Check for value > Number.MAX_SAFE_INTEGER (not available in all JS).
        if (value > 9007199254740991) {
            logger.error('Integer not suitable for lossless conversion in JavaScript.');

            return;
        }

        return value;
    };


    /**
     * Purges all fingerprints from the authentication rings.
     *
     * @return
     *     void
     */
    ns.scrubAuthRing = function() {
        u_authring.Ed25519 = {};
        ns.setContacts('Ed25519');
        u_authring.Cu25519 = {};
        ns.setContacts('Cu25519');
        u_authring.RSA = {};
        ns.setContacts('RSA');
    };


    /**
     * Resets the seen or verified fingerprints for a particular user.
     * @param {string} userHandle The user handle e.g. EWh7LzU3Zf0
     */
    ns.resetFingerprintsForUser = async function(userHandle) {
        assert(userHandle !== u_handle);

        if (!u_authring.Ed25519) {
            logger.warn('Auth-ring is not initialized, yet.');
            return false;
        }

        const ring = u_authring.Ed25519[userHandle];
        if (!ring) {
            logger.warn('Failed to reset credentials for user %s: Ed25519 key is not tracked yet.', userHandle);
            return false;
        }

        if (ring.method === this.AUTHENTICATION_METHOD.SEEN) {
            logger.warn('Failed to reset credentials for user %s: Ed25519 key is not verified.', userHandle);
            return false;
        }
        assert(ring.method === this.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON, 'Invalid Ed25519 method.');

        if (d) {
            logger.info('Resetting credentials for user %s...', userHandle);
        }
        const fingerprint = await crypt.getFingerprintEd25519(userHandle, 'string');

        return this.setContactAuthenticated(
            userHandle,
            fingerprint,
            'Ed25519',
            this.AUTHENTICATION_METHOD.SEEN,
            this.KEY_CONFIDENCE.UNSURE
        );
    };


    /**
     * Checks if the authring was initialised (initialised = true, not initialised OR initialising = false)
     *
     * @returns {boolean}
     */
    ns.hadInitialised = function() {
        return ns._initialisingPromise === true;
    };

    /**
     * Invoke authring-operation once initialization has succeed.
     *
     * @returns {MegaPromise}
     */
    ns.onAuthringReady = async function(debugTag) {

        if (d > 1) {
            logger.log('authring.onAuthringReady', debugTag);
        }

        if (this.hadInitialised() === false) {
            if (d) {
                logger.debug('Will wait for Authring to initialize...', debugTag);
            }

            await Promise.resolve(this.initAuthenticationSystem());
        }

        assert(u_authring.Ed25519, `Unexpected auth-ring failure... (${debugTag})`);
    };

    // wait for auth-ring and strongvelope
    ns.waitForARSVLP = function(id) {
        return new Promise((resolve, reject) => {

            this.onAuthringReady(id)
                .then(() => {
                    if (is_mobile || megaChatIsReady) {
                        return resolve();
                    }
                    mBroadcaster.once('chat_initialized', resolve);
                })
                .catch(reject);
        });
    };

    /**
     * Initialises the authentication system.
     *
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     */
    ns.initAuthenticationSystem = function() {

        if (pfid) {
            console.error('Do not initialize the authentication system on folder-links.');
            return MegaPromise.reject(EACCESS);
        }

        // Make sure we're initialising only once.
        if (ns._initialisingPromise !== false) {
            if (ns._initialisingPromise === true) {
                // Already initialised.
                return MegaPromise.resolve();
            }
            else if (ns._initialisingPromise instanceof MegaPromise) {
                // Initialisation is in progress.
                // (Don't initialise more than once, return the master promise.)
                return ns._initialisingPromise;
            }
            else {
                logger.error(
                    "Failed to initAuthSystem because of invalid _initialisingPromise state of: ",
                    ns._initialisingPromise
                );

                return MegaPromise.reject();
            }
        }

        if (d) {
            console.time('authring.initAuthenticationSystem');
        }

        // The promise to return.
        var masterPromise = ns._initialisingPromise = new MegaPromise();

        // Initialise basic authentication system with Ed25519 keys first.
        var keyringPromise = ns._initKeyringAndEd25519();

        keyringPromise.done(function __baseAuthSystemDone() {
            var rsaPromise = window.u_privk ? ns._initKeyPair('RSA') : MegaPromise.resolve();
            var cu25519Promise = ns._initKeyPair('Cu25519');
            var comboPromise = MegaPromise.all([rsaPromise, cu25519Promise]);

            masterPromise.linkDoneAndFailTo(comboPromise);
        });
        keyringPromise.fail(function __baseAuthSystemFail() {
            masterPromise.reject();
        });

        masterPromise
            .done(function() {
                ns._initialisingPromise = true;
            })
            .fail(function() {
                ns._initialisingPromise = false;
            })
            .always(function() {
                if (d) {
                    console.timeEnd('authring.initAuthenticationSystem');
                }
            });

        return masterPromise;
    };

    /**
     * Initialises the key ring for private keys and the authentication key
     * (Ed25519).
     *
     * @private
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     */
    ns._initKeyringAndEd25519 = function() {
        // The promise to return.
        var masterPromise = new MegaPromise();

        // XXX: u_attr.u is read-only, BUT this is a weak protection unless we make the whole object
        // read-only as well..tricky, however we may want to still allow this for testing purposes..
        if (!is_karma && (typeof u_attr !== 'object' || u_attr.u !== window.u_handle || u_attr.keyring)) {
            logger.error('Doh! Tampering attempt...', u_handle, [u_attr]);

            if (location.host === 'mega.nz' || is_extension) {
                return masterPromise.reject(EACCESS);
            }

            // eslint-disable-next-line no-alert
            if (!confirm('You are about to overwrite your own account keys - is this intended?')) {
                location.reload(true);
                return masterPromise;
            }

            logger.warn('Good luck!..');
        }
        let attributePromise;

        // Load private keys (or use the ones deserialised from ^!keys).
        if (mega.keyMgr.generation) {
            attributePromise = new MegaPromise((resolve) => resolve(mega.keyMgr.keyring));
        }
        else {
            attributePromise = mega.attr.get(u_handle, 'keyring', false, false);
        }

        attributePromise.done(function __attributePromiseResolve(result) {
            // Ensure we're in a safe-state.
            if (!safeStateAssert(masterPromise, result && typeof result === 'object')) {
                return;
            }
            // Set local values.
            u_keyring = result;
            u_attr.keyring = u_keyring;

            // Ed25519 signing/authentication key.
            u_privEd25519 = u_keyring.prEd255;
            u_attr.prEd255 = u_privEd25519;
            u_pubEd25519 = asmCrypto.bytes_to_string(nacl.sign.keyPair.fromSeed(
                asmCrypto.string_to_bytes(u_privEd25519)).publicKey);
            u_attr.puEd255 = u_pubEd25519;
            pubEd25519[u_handle] = u_pubEd25519;

            // Run on the side a sanity check on the stored pub key.
            ns._checkPubKey(u_pubEd25519, 'Ed25519');
            crypt.setPubKey(u_pubEd25519, 'Ed25519');

            // Load authring and we're done.

            // @todo migrate getContacts() to native Promise.
            Promise.all([
                Promise.resolve(authring.getContacts('Ed25519')),
                Promise.resolve(authring.getContacts('Cu25519'))
            ]).then((res) => {
                masterPromise.resolve(res);
            }).catch((ex) => {
                logger.error(ex);
                masterPromise.reject(ex);
            });
        });
        attributePromise.fail(function __attributePromiseReject(result) {
            if (result === ENOENT) {
                // We don't have it set up, yet. Let's do so now.
                logger.warn('Authentication system seems non-existent. Setting up ...');

                // Ensure we're in a safe-state.
                if (!safeStateAssert(masterPromise)) {
                    return;
                }

                // Make a new key pair.
                var keyPair = nacl.sign.keyPair();
                u_privEd25519 = asmCrypto.bytes_to_string(keyPair.secretKey.subarray(0, 32));
                u_attr.prEd255 = u_privEd25519;
                u_pubEd25519 = asmCrypto.bytes_to_string(keyPair.publicKey);
                u_attr.puEd255 = u_pubEd25519;
                u_keyring = {
                    prEd255: u_privEd25519
                };
                u_attr.keyring = u_keyring;
                pubEd25519[u_handle] = u_pubEd25519;

                // Store private keyring and public key.
                var keyringPromise = mega.attr.set('keyring', u_keyring,
                                                      false, false);
                var pubkeyPromise = mega.attr.set('puEd255',
                                                     base64urlencode(u_pubEd25519),
                                                     true, false);
                var authringPromise = authring.getContacts('Ed25519');

                var comboPromise = MegaPromise.all([keyringPromise,
                                                    pubkeyPromise,
                                                    authringPromise]);
                masterPromise.linkDoneAndFailTo(comboPromise);
            }
            else {
                var message = 'Error retrieving key ring: ' + result;
                logger.error(message);
                // Let's pass a rejection upstream.
                masterPromise.reject(result);
            }
        });

        return masterPromise;
    };


    /**
     * Generates a key pair and sets up all required data structures for
     * insuring its authenticity.
     *
     * @private
     * @param keyType {string}
     *     Key type. Allowed values: 'Cu25519'.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     */
    ns._setupKeyPair = function(keyType) {
        var keyPair;
        var privKey;
        var pubKey;

        if (keyType === 'Cu25519') {
            keyPair = nacl.box.keyPair();
            privKey = asmCrypto.bytes_to_string(keyPair.secretKey);
            pubKey = asmCrypto.bytes_to_string(keyPair.publicKey);
        }
        else {
            logger.error('Unsupported key type for key generation: ' + keyType);
            return MegaPromise.reject(EARGS);
        }

        // Ensure we're in a safe-state.
        if (!safeStateAssert(null, '$keyring')) {
            return MegaPromise.reject(EACCESS);
        }

        window[crypt.PRIVKEY_VARIABLE_MAPPING[keyType]] = privKey;
        window[crypt.PUBKEY_VARIABLE_MAPPING[keyType]] = pubKey;
        u_keyring[crypt.PRIVKEY_ATTRIBUTE_MAPPING[keyType]] = privKey;
        u_attr.keyring[crypt.PRIVKEY_ATTRIBUTE_MAPPING[keyType]] = privKey;
        u_attr[crypt.PRIVKEY_ATTRIBUTE_MAPPING[keyType]] = privKey;
        u_attr[crypt.PUBKEY_ATTRIBUTE_MAPPING[keyType]] = pubKey;
        crypt.getPubKeyCacheMapping(keyType)[u_handle] = pubKey;
        var pubKeySignature = ns.signKey(pubKey, keyType);
        var keyringPromise = mega.attr.set('keyring', u_keyring, false, false);
        var pubkeyPromise = mega.attr.set(crypt.PUBKEY_ATTRIBUTE_MAPPING[keyType],
                                             base64urlencode(pubKey),
                                             true, false);
        var signaturePromise = mega.attr.set(crypt.PUBKEY_SIGNATURE_MAPPING[keyType],
                                                base64urlencode(pubKeySignature),
                                                true, false);
        var authringPromise = authring.getContacts(keyType);

        return MegaPromise.all([keyringPromise, pubkeyPromise,
                                authringPromise, signaturePromise]);
    };


    /**
     * Initialises a key pair for use in the client.
     *
     * Note: It is expected that the Ed25519 private and public keys are loaded
     *       already.
     *
     * @private
     * @param keyType {string}
     *     Key type to set. Allowed values: 'Cu25519', 'RSA'.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     */
    ns._initKeyPair = function(keyType) {
        // The promise to return.
        var masterPromise = new MegaPromise();

        if (keyType !== 'RSA' && keyType !== 'Cu25519') {
            logger.error('Unsupported key type for initialisation: ' + keyType);

            return MegaPromise.reject(EARGS);
        }

        if (keyType === 'RSA' && !window.u_privk) {
            logger.error('Unable to initialize RSA keypair...');
            return MegaPromise.reject(EARGS);
        }

        // Ensure we're in a safe-state.
        if (!safeStateAssert()) {
            return MegaPromise.reject(EACCESS);
        }

        var privKey = (keyType === 'RSA')
                    ? u_privk
                    : u_keyring[crypt.PRIVKEY_ATTRIBUTE_MAPPING[keyType]];

        if (privKey) {
            // Fire off various API calls we need downstream.
            var authringPromise = ns.getContacts(keyType);
            var signaturePromise = mega.attr.get(u_handle,
                                                    crypt.PUBKEY_SIGNATURE_MAPPING[keyType],
                                                    true, false);

            // Get the public key to the private key.
            var pubKey;
            var pubkeyPromise;
            if (keyType === 'RSA') {
                pubkeyPromise = crypt.getPubKeyAttribute(u_handle, 'RSA');
            }
            else {
                pubKey = crypt.getPubKeyFromPrivKey(privKey, keyType);
                pubkeyPromise = new MegaPromise();
                pubkeyPromise.resolve(pubKey);
            }

            pubkeyPromise.done(function __pubkeyResolve(result) {
                if (keyType === 'RSA') {
                    // Still need to fetch the RSA pub key.
                    pubKey = result;
                }
            });
            masterPromise.linkFailTo(pubkeyPromise);

            // Make sure we've got a signature.
            var gotSignaturePromise = new MegaPromise();
            signaturePromise.done(function __signatureResolve(result) {
                gotSignaturePromise.resolve(base64urldecode(result));
            });
            signaturePromise.fail(function __signatureReject(result) {
                if (result === ENOENT) {
                    // Signature undefined, let's pass to make one in the next step.
                    gotSignaturePromise.resolve(null);
                }
                else {
                    gotSignaturePromise.reject(result);
                }
            });

            // Check the signature, make one if we don't ahve one or it's inconsistent.
            var sigKeyComboPromise = MegaPromise.all([gotSignaturePromise,
                                                      pubkeyPromise]);
            sigKeyComboPromise.done(function __signatureComboResolve(result) {
                // Ensure we're in a safe-state.
                if (!safeStateAssert(masterPromise, !!result)) {
                    return;
                }
                var signature = result[0];
                if (signature) {
                    // Now check the key's signature.
                    ns.verifyKey(signature, pubKey, keyType, u_pubEd25519)
                        .done(function(isVerified) {
                            if (isVerified) {
                                masterPromise.resolve();
                            }
                            else {
                                // Signature fails, make a good one and save it.
                                var pubKeySignature = authring.signKey(pubKey, keyType);
                                var setSignaturePromise = mega.attr.set(crypt.PUBKEY_SIGNATURE_MAPPING[keyType],
                                    base64urlencode(pubKeySignature),
                                    true, false);
                                var comboPromise = MegaPromise.all([authringPromise,
                                    setSignaturePromise]);
                                masterPromise.linkDoneAndFailTo(comboPromise);
                            }
                        });
                }
                else {
                    // Signature undefined.
                    signature = authring.signKey(pubKey, keyType);
                    mega.attr.set(crypt.PUBKEY_SIGNATURE_MAPPING[keyType],
                                     base64urlencode(signature),
                                     true, false);
                    masterPromise.resolve();
                }

                if (keyType === 'RSA') {
                    // We don't need the rest for RSA keys.
                    return;
                }

                // Ensure we're in a safe-state.
                if (!safeStateAssert(masterPromise, '$keyring')) {
                    return;
                }

                // We're handling RSA keys in a legacy way, but all others like this.
                window[crypt.PRIVKEY_VARIABLE_MAPPING[keyType]] = privKey;
                window[crypt.PUBKEY_VARIABLE_MAPPING[keyType]] = pubKey;
                u_keyring[crypt.PRIVKEY_ATTRIBUTE_MAPPING[keyType]] = privKey;
                u_attr[crypt.PRIVKEY_ATTRIBUTE_MAPPING[keyType]] = privKey;
                u_attr[crypt.PUBKEY_ATTRIBUTE_MAPPING[keyType]] = pubKey;
                u_attr.keyring[crypt.PRIVKEY_ATTRIBUTE_MAPPING[keyType]] = privKey;
                crypt.getPubKeyCacheMapping(keyType)[u_handle] = pubKey;

                // Run on the side a sanity check on the stored pub key.
                ns._checkPubKey(pubKey, keyType);
                crypt.setPubKey(pubKey, keyType);
            });
            masterPromise.linkFailTo(sigKeyComboPromise);
        }
        else {
            // Set up what's needed for the key type.
            // This should never be hit for an RSA key pair!
            masterPromise.linkDoneAndFailTo(ns._setupKeyPair(keyType));
        }

        return masterPromise;
    };


    /**
     * This is a check to run on one's *own* pub key against the private key.
     *
     * @private
     * @param pubKey {string}
     *     Public key to check.
     * @param keyType {string}
     *     Key type to check. Allowed values: 'Ed25519', Cu25519'.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     */
    ns._checkPubKey = function(pubKey, keyType) {
        // The promise to return.
        var masterPromise = new MegaPromise();

        if (keyType !== 'Ed25519' && keyType !== 'Cu25519') {
            logger.error('Unsupported key type for pub key check: ' + keyType);

            return MegaPromise.reject(EARGS);
        }

        var attributePromise = mega.attr.get(u_handle,
                                                crypt.PUBKEY_ATTRIBUTE_MAPPING[keyType],
                                                true, false);

        attributePromise.done(function(result) {
            var storedPubKey = base64urldecode(result);
            if (storedPubKey === pubKey) {
                masterPromise.resolve(true);
            }
            else {
                logger.info('Need to update ' + keyType + ' pub key.');
                masterPromise.linkDoneAndFailTo(
                    mega.attr.set(crypt.PUBKEY_ATTRIBUTE_MAPPING[keyType],
                                     base64urlencode(pubKey),
                                     true, false));
            }
        });
        attributePromise.fail(function(result) {
            logger.warn('Could not get my ' + keyType + ' pub key, setting it now.');
            masterPromise.linkDoneAndFailTo(
                mega.attr.set(crypt.PUBKEY_ATTRIBUTE_MAPPING[keyType],
                                 base64urlencode(pubKey),
                                 true, false));
        });

        return masterPromise;
    };

    /**
     * Helper method to check whether a contact fingerprint is verified.
     * @param {String} aUserHandle The user's 11-chars long handle.
     * @returns {Promise} fulfilled with a Boolean indicating whether it's verified.
     */
    ns.isUserVerified = promisify(function(resolve, reject, aUserHandle) {
        ns.onAuthringReady('usr-v').then(function() {
            var ed25519 = u_authring.Ed25519;
            var verifyState = ed25519 && ed25519[aUserHandle] || false;

            resolve(verifyState.method >= ns.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON);
        }).catch(reject);
    });

    /**
     * Helper method to invoke whenever we do want to show crypto-specific warnings about mismatching keys etc
     * @param {String} aDialogType The dialog type we do want to show.
     * @param {String} aUserHandle The user's 11-chars long handle.
     * @param {String} aKeyType Type of the public key the signature failed for. e.g 'Cu25519' or 'RSA'
     * @param {*} optional arguments for the dialog constructor
     * @type {Promise} fulfilled on completion with whatever happened...
     */
    ns.showCryptoWarningDialog = promisify(function(resolve, reject, aDialogType, aUserHandle /* , ... */) {
        var args = toArray.apply(null, arguments).slice(3);

        if (localStorage.hideCryptoWarningDialogs) {
            logger.warn('Showing crypto warning dialogs is blocked...', aDialogType, args);
            return resolve(EBLOCKED);
        }

        var seenCryptoWarningDialog = JSON.parse(sessionStorage.scwd || '{}');
        var seenStoreKey = MurmurHash3(aDialogType + ':' + args, 0x7ff).toString(16);

        if (seenCryptoWarningDialog[seenStoreKey]) {
            logger.info('Crypto warning dialog already seen...', aDialogType, args);
            return resolve(EEXIST);
        }

        // Store a seen flag straight away, to prevent concurrent invocations..
        seenCryptoWarningDialog[seenStoreKey] = 1;
        sessionStorage.scwd = JSON.stringify(seenCryptoWarningDialog);

        var dialogConstructor;

        if (aDialogType === 'credentials') {
            eventlog(99606, JSON.stringify([1, aDialogType[0]].concat(args.slice(0,2))));
            dialogConstructor = mega.ui.CredentialsWarningDialog;
        }
        else if (aDialogType === 'signature') {
            eventlog(99607, JSON.stringify([1, aDialogType[0]].concat(args.slice(0,2))));
            dialogConstructor = mega.ui.KeySignatureWarningDialog;
        }
        else {
            logger.error('Invalid crypto warning dialog type...', aDialogType, args);
            return reject(EARGS);
        }

        // Only show this type of warning dialog if the user's fingerprint is verified.
        ns.isUserVerified(aUserHandle)
            .then(function(isVerified) {
                if (isVerified !== true) {
                    logger.debug('Not showing crypto dialog for unverified user...', aDialogType, args);
                    return resolve(EAGAIN);
                }

                M.onFileManagerReady(tryCatch(function() {
                    dialogConstructor.singleton.apply(dialogConstructor, args);
                    resolve(true);
                }, reject));
            })
            .catch(reject);
    });

    ns.bloat = async(iter = 3072) => {
        const types = Object.keys(u_authring);
        const users = [];

        console.group('auth-ring.bloat');

        while (iter--) {
            let uh;
            do {
                uh = `T35T-${makeUUID().slice(-6)}`;
            }
            while (uh in M.u);

            users.push(uh);
            process_u([{c: 1, u: uh, name: 'dc', m: `dc+${uh}@mega.nz`}], false);
        }

        for (let i = types.length; i--;) {
            const type = types[i];
            const store = u_authring[type];
            const [[, data]] = Object.entries(store);

            for (let x = users.length; x--;) {
                assert(!store[users[x]]);
                store[users[x]] = data;
            }
            await Promise.resolve(ns.setContacts(type).dump(`setContacts.${type}`)).catch(dump);
        }
        await tSleep(2);

        console.warn('bloat.done');
        console.groupEnd();
    };

    ns.debloat = async() => {
        console.group('auth-ring.de-bloat');

        const users = M.u.keys().filter(n => n.startsWith('T35T-'));
        if (users.length) {
            await api.screq(users.map(u => ({u, a: 'ur2', l: '0'}))).catch(dump);

            scparser.$helper.c({ou: u_handle, u: users.map(u => ({u, c: 0}))});

            for (let i = users.length; i--;) {
                const userHandle = users[i];
                delete u_authring.RSA[userHandle];
                delete u_authring.Ed25519[userHandle];
                delete u_authring.Cu25519[userHandle];
            }

            await ns.setContacts('Ed25519').dump('setContacts.Ed25519');
            await ns.setContacts('Cu25519').dump('setContacts.Cu25519');
            await ns.setContacts('RSA').dump('setContacts.RSA');
            await tSleep(2);

            for (let i = users.length; i--;) {
                fmdb.del('u', users[i]);
            }
        }
        console.warn('de-bloat.done');
        console.groupEnd();
    };

    return ns;
}());

/**
 * Desktop signin/login functions
 */
var signin = {

    /**
     * Old method functions
     */
    old: {

        /**
         * Starts the login proceedure for v1 accounts
         * @param {String} email The user's email address
         * @param {String} password The user's password
         * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if N/A
         * @param {Boolean} rememberMe Whether the user clicked the Remember me checkbox or not
         */
        startLogin: function(email, password, pinCode, rememberMe) {

            'use strict';

            postLogin(email, password, pinCode, rememberMe)
                .then((result) => {

                    signin.proceedWithLogin(result);
                })
                .catch(tell)
                .finally(() => loadingDialog.hide());
        }
    },

    /**
     * New secure method functions
     */
    new: {

        /**
         * Start the login process
         * @param {String} email The user's email addresss
         * @param {String} password The user's password as entered
         * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if N/A
         * @param {Boolean} rememberMe A boolean for if they checked the Remember Me checkbox on the login screen
         * @param {String} salt The user's salt as a Base64 URL encoded string
         */
        startLogin: function(email, password, pinCode, rememberMe, salt) {

            'use strict';

            // Start the login using the new process
            security.login.startLogin(email, password, pinCode, rememberMe, salt, function(result) {

                // Otherwise proceed with regular login
                signin.proceedWithLogin(result);
            });
        }
    },

    /**
     * Proceed to key generation step
     * @param {Number} result The result from the API, e.g. a negative error num or the user type
     */
    proceedWithKeyGeneration: function(result) {

        'use strict';

        u_type = result;
        loadSubPage('key');
    },

    /**
     * Proceed to the login step
     * @param {Number} result The result from the API, e.g. a negative error num or the user type
     */
    proceedWithLogin: function(result) {

        'use strict';

        // Remove loading spinner from 2FA dialog
        $('.mega-dialog.verify-two-factor-login.submit-button').removeClass('loading');

        // Check and handle the common login errors
        if (security.login.checkForCommonErrors(result, signin.old.startLogin, signin.new.startLogin)) {
            return false;
        }

        // If successful result
        if (result !== false && result >= 0) {

            // Otherwise if email confirm code is ok, proceed with RSA key generation
            if (confirmok) {
                signin.proceedWithKeyGeneration(result);
            }
            else {
                // Otherwise proceed with regular login
                u_type = result;

                if (login_next) {
                    loadSubPage(login_next);
                }
                else if (page !== 'login') {
                    init_page();
                }
                else {
                    loadSubPage('fm');
                }
                login_next = false;
            }
        }
        else {
            // Show a failed login
            $('#login-name2').megaInputsShowError().blur();
            $('#login-password2').megaInputsShowError(l[7431]).val('').blur();
            if (document.activeElement) {
                document.activeElement.blur();
            }

            msgDialog('warninga', l[135], l[7431], false, () => {
                $('#login-password2').select();
            });
        }
    }
};

var login_txt = false;
var login_email = false;


function postLogin(email, password, pinCode, remember) {
    'use strict';
    return new Promise((resolve) => {
        var ctx = {
            checkloginresult(ctx, result) {
                const {u_k} = window;

                // Check if we can upgrade the account to v2
                security.login.checkToUpgradeAccountVersion(result, u_k, password)
                    .catch(dump)
                    .finally(() => resolve(result));
            }
        };
        var passwordaes = new sjcl.cipher.aes(prepare_key_pw(password));
        var uh = stringhash(email.toLowerCase(), passwordaes);

        u_login(ctx, email, password, uh, pinCode, remember);
    });
}

function pagelogin() {
    'use strict';

    var $formWrapper = $('.main-mid-pad.login form');
    var $email = $formWrapper.find('#login-name2');
    var $password = $formWrapper.find('#login-password2');
    var $button = $('button.login-button', $formWrapper);

    var e = $email.val().trim();
    if (e === '' || !isValidEmail(e)) {
        $email.megaInputsShowError(l[141]);
        $email.focus();
    }
    else if ($('#login-password2').val() === '') {
        $('#login-password2').megaInputsShowError(l[1791]);
        $password.focus();
    }
    else if ($button.hasClass('disabled')) {
        if (d) {
            console.warn('Aborting login procedure, there is another ongoing...');
        }
    }
    else {
        $button.addClass('disabled');
        tSleep(9).then(() => $button.removeClass('disabled'));
        loadingDialog.show();

        $formWrapper.find('.top-dialog-login-button').addClass('loading');
        if ($formWrapper.find('.loginwarning-checkbox').hasClass('checkboxOn')) {
            localStorage.hideloginwarning = 1;
        }

        var email = e;
        var password = $password.val();
        var rememberMe = false;
        var twoFactorPin = null;

        // XXX: Set remember on by default if confirming a freshly created account
        if (confirmok || $formWrapper.find('.login-check').hasClass('checkboxOn')) {
            rememberMe = true;
        }

        // Checks if they have an old or new registration type, after this the flow will continue to login
        security.login.checkLoginMethod(email, password, twoFactorPin, rememberMe,
                                        signin.old.startLogin,
                                        signin.new.startLogin);
    }
}

function init_login() {
    'use strict';

    var $formWrapper = $('.main-mid-pad.login');
    var $inputs = $('#login-name2, #login-password2, .login-button', $formWrapper);
    var $button = $('button.login-button', $formWrapper);
    var $forgotPassLink = $('.top-login-forgot-pass', $formWrapper);

    if (is_extension) {
        $('.extension-advise').addClass('hidden');
    }
    else {
        $('.extension-advise').removeClass('hidden');
    }

    if (login_email) {
        $('#login-name2', $formWrapper).val(login_email);
    }

    if (confirmok) {
        $('.main-left-block').addClass('confirm');
        $('.main-right-block').addClass('hidden');
        $('.register-st2-txt-block').addClass('hidden');
        $('.account.small-header-txt').addClass('hidden');
        $forgotPassLink.addClass('hidden');
        $('.main-top-info-block').removeClass('hidden');
        $('span', $button).text(l[1131]);
        $('.account.top-header.login').text(l[1131]);
        $('.main-top-info-text').text(l[378]);
        $('.login-check').addClass('hidden').next().addClass('hidden');
    }
    else {
        if (login_txt) {
            $('.main-top-info-block').removeClass('hidden');
            $('.main-top-info-text').text(login_txt);
            login_txt = false;
        }
    }

    $forgotPassLink.rebind('click.forgotpasslink', function() {

        var email = document.getElementById('login-name2').value;

        if (isValidEmail(email)) {
            $.prefillEmail = email;
        }

        loadSubPage('recovery');
    });

    $inputs.rebind('keydown.initlogin', function(e) {

        $inputs.removeClass('errored').parent().removeClass('error');

        if (e.keyCode === 13) {
            pagelogin();
        }
    });

    $button.rebind('click.initlogin', function() {
        pagelogin();
        eventlog(99796);
    });

    if (self.InitFileDrag) {
        onIdle(InitFileDrag);
    }

    // Init inputs events
    accountinputs.init($formWrapper);
}

/**
 * Functionality for the Export Link password protection feature
 *
 * The first implementation will use PBKDF2-HMAC-SHA512 with 100,000 rounds and a 256 bit random salt to derive a 512
 * bit key. For folder links the key is 128 bits in length and for file links the actual key is 256 bits in length. The
 * first 128 or 256 bits of the derived key will be used to encrypt the actual folder/file key using a simple XOR for
 * encryption. The last 256 bits of the derived key will be used as the MAC Key. Using the Encrypt then MAC principle,
 * the MAC will be calculated using HMAC-SHA256.
 *
 * In constructing the protected link, the format is as follows:
 * algorithm || file/folder || public handle || salt || encrypted key || MAC tag
 *
 * algorithm = 1 byte - A byte to identify which algorithm was used (for future upgradability), initially is set to 0
 * file/folder = 1 byte - A byte to identify if the link is a file or folder link (0 = folder, 1 = file)
 * public handle = 6 bytes - The public folder/file handle
 * salt = 32 bytes - A 256 bit randomly generated salt
 * encrypted key = 16 or 32 bytes - The encrypted actual folder or file key
 * MAC tag = 32 bytes - The MAC of all the previous data to ensure integrity of the link i.e. calculated as:
 *                      HMAC-SHA256(MAC key, (algorithm || file/folder || public handle || salt || encrypted key))
 *
 * The link data is then Base64 encoded and then URL encoded to remove incompatible characters e.g.:
 * https://127.0.0.1/#P!AAA5TWTcNMs7aYZgtalahVxCffAF0JeZTKxOZQ_s2d...
 *
 * In receiving a protected link, the program will decode the URL, get the first byte to check which algorithm was used
 * to encrypt the data (useful if algorithm changes are made in future). Then it will use the password to derive the
 * same key using the same algorithm, provided salt and password. Then a MAC of the data can be calculated, if it's a
 * match then the link has not been tampered with or corrupted and the real folder/file key can be decrypted and the
 * original link reconstructed. If it doesn't match then an error will be shown which could mean tampering or that the
 * user entered an incorrect password.
 */
var exportPassword = {

    // List of algorithms
    algorithms: [
        {
            // Algorithm (0) for unit testing with low rounds
            name: 'PBKDF2',                     // Name for the Web Crypto primary PBKDF algorithm
            hash: 'SHA-512',                    // Hash algorithm for the Web Crypto primary PBKDF algorithm
            failsafeName: 'PBKDF2_HMAC_SHA512', // Name for the asmCrypto failsafe PBKDF algorithm
            macName: 'HMAC_SHA256',             // Name for the asmCrypto MAC algorithm
            saltLength: 256,                    // Salt length in bits
            macKeyLength: 256,                  // MAC key length in bits
            macLength: 256,                     // MAC computed digest length in bits
            derivedKeyLength: 512,              // Desired derived key length in bits
            iterations: 1000                    // Number of iterations to run
        },
        {
            // Old algorithm (1) which used incorrect parameter order: HMAC(password, data)
            name: 'PBKDF2',
            hash: 'SHA-512',
            failsafeName: 'PBKDF2_HMAC_SHA512',
            macName: 'HMAC_SHA256',
            saltLength: 256,
            macKeyLength: 256,
            macLength: 256,
            derivedKeyLength: 512,
            iterations: 100000
        },
        {
            // Current algorithm (2)
            name: 'PBKDF2',
            hash: 'SHA-512',
            failsafeName: 'PBKDF2_HMAC_SHA512',
            macName: 'HMAC_SHA256',
            saltLength: 256,
            macKeyLength: 256,
            macLength: 256,
            derivedKeyLength: 512,
            iterations: 100000
        }
        // Future tweaks or changes in algorithms e.g. Argon2
    ],

    // The current algorithm in use for production
    currentAlgorithm: 2,    // 1 byte (0x02)

    /**
     * Constants for folder or file type
     */
    LINK_TYPE_FOLDER: 0,    // 1 byte (0x00)
    LINK_TYPE_FILE: 1,      // 1 byte (0x01)


    /**
     * Functions for the encryption
     */
    encrypt: {

        // The jQuery selector for the Export dialog
        $dialog: null,

        /**
         * Initialise function
         */
        init: function() {

            "use strict";

            // Cache dialog selector
            this.$dialog = $('.mega-dialog.export-links-dialog', 'body');

            // Update protected/not protected components UI and update links/keys values
            this.updatePasswordComponentsUI();
            this.updateLinkInputValues();

            // If they are a Pro user, enable set password feature
            if (u_attr.p) {
                this.initPasswordToggleButton();
                this.loadPasswordEstimatorLibrary();
                this.initPasswordStrengthCheck();
                this.initPasswordVisibilityHandler();
                this.initConfirmPasswordButton();
            }
        },

        /**
         * Update protected/not protected components UI
         */
        updatePasswordComponentsUI: function() {

            "use strict";

            const $items = $('.item', this.$dialog);
            const $protectedItems = $items.filter('.password-protect-link');
            const $setPasswordBtn = $('.js-confirm-password', this.$dialog);
            const $removePasswordBtn = $('.js-reset-password', this.$dialog);

            // If password protected links
            if ($protectedItems.length) {

                // Hide the Confirm password button
                $setPasswordBtn.addClass('hidden');

                // Show Remove password button
                $removePasswordBtn.removeClass('hidden');
            }
            else {
                // Show Confirm password button
                $setPasswordBtn.removeClass('hidden');

                // Hide Remove password button
                $removePasswordBtn.addClass('hidden');
            }
        },

        /**
         * Update links/keys values
         */
        updateLinkInputValues: function() {

            "use strict";

            var isSeparateKeys = $('.js-export-keys-switch', this.$dialog).hasClass('toggle-on');
            var $items = $('.item:not(.password-protect-link)', this.$dialog);

            // Update not password protected Link input values
            $items.get().forEach(function(e) {

                var $this = $(e);
                var $linkInput = $('.item-link.link input', $this);
                var $keyInput = $('.item-link.key input', $this);
                var linkWithoutKey = $linkInput.data('link');
                var key = $linkInput.data('key');

                // Set key without # or !
                $keyInput.val($keyInput.data('key'));

                // Set link
                if (isSeparateKeys) {
                    $linkInput.val(linkWithoutKey);
                }
                else {
                    $linkInput.val(linkWithoutKey + key);
                }
            });
        },

        /**
         * Setup the password toggle
         */
        initPasswordToggleButton: function() {

            "use strict";

            const $exportKeysSwitch = $('.js-export-keys-switch', this.$dialog);
            const $linkAccessText = $('.js-link-access-text', this.$dialog);
            const $passwordContainer = $('.password-container', this.$dialog);
            const $passwordInput = $('.js-password-input', this.$dialog);
            const $passwordInputWrapper = $passwordInput.parent();
            const $passwordToggleSwitch = $('.js-password-switch', this.$dialog);
            const $passwordToggleIcon = $('.mega-feature-switch', $passwordToggleSwitch);
            const $passwordVisibilityToggle = $('.js-toggle-password-visible', this.$dialog);
            const $passwordStrengthText = $('.js-strength-indicator', this.$dialog);
            const $updateSuccessBanner = $('.js-update-success-banner', this.$dialog);

            // Init toggle to show/hide password section
            $passwordToggleSwitch.rebind('click.changePasswordView', () => {

                const passwordToggleIsOn = $passwordToggleSwitch.hasClass('toggle-on');

                // If toggle is currently on, we will turn it off
                if (passwordToggleIsOn) {

                    // If no password has been entered, no need to recreate links,
                    // so just reset the password UI elements to default off state
                    if ($passwordInput.val() === '') {
                        exportPassword.encrypt.turnOffPasswordUI();
                        return;
                    }
                    loadingDialog.show();

                    // Remove the existing links and re-add them
                    exportPassword.removeLinksAndReAdd($.itemExport)
                        .then(() => {

                            const $items = $('.item', this.$dialog);
                            const linkCount = $.itemExport.length;

                            // If a password has actually been set
                            if ($items.first().hasClass('password-protect-link')) {

                                // Show success banner telling them to re-copy the links
                                $updateSuccessBanner.text(mega.icu.format(l.links_updated_copy_again, linkCount));
                                $updateSuccessBanner.removeClass('hidden');

                                // Hide again after 3 seconds
                                setTimeout(() => {
                                    $updateSuccessBanner.addClass('hidden');
                                }, 3000);
                            }

                            // Reset the password UI elements to default off state
                            return exportPassword.encrypt.turnOffPasswordUI();
                        })
                        .catch(tell)
                        .finally(() => {
                            loadingDialog.hide();
                        });
                }
                else {
                    // The toggle is currently off, so we will turn it on
                    // First, turn off the separate keys toggle if it's on
                    if ($exportKeysSwitch.hasClass('toggle-on')) {
                        $exportKeysSwitch.trigger('click');
                    }

                    // Disable the separate keys toggle
                    $exportKeysSwitch.addClass('disabled');

                    // Turn on toggle and show the password section
                    $passwordToggleSwitch.addClass('toggle-on').removeClass('toggle-off');
                    $passwordToggleIcon.addClass('icon-check-after').removeClass('icon-minimise-after');
                    $passwordContainer.removeClass('hidden');

                    // Focus the input so they can immediately enter the password
                    $passwordInput.focus();
                }
            });
        },

        /**
         * Turns off the password related UI, used in initialisation of the dialog to reset the password elements,
         * also in turning off the toggle switch. It was useful to be able to reset the UI elements to the off state
         * without triggering the toggle switch to off (which has a side effect of recreating the password links).
         * @returns {undefined}
         */
        turnOffPasswordUI: function() {

            'use strict';

            const $exportKeysSwitch = $('.js-export-keys-switch', this.$dialog);
            const $linkAccessText = $('.js-link-access-text', this.$dialog);
            const $passwordContainer = $('.password-container', this.$dialog);
            const $passwordInput = $('.js-password-input', this.$dialog);
            const $passwordInputWrapper = $passwordInput.parent();
            const $passwordToggleSwitch = $('.js-password-switch', this.$dialog);
            const $passwordToggleIcon = $('.mega-feature-switch', $passwordToggleSwitch);
            const $passwordVisibilityToggle = $('.js-toggle-password-visible', this.$dialog);
            const $passwordStrengthText = $('.js-strength-indicator', this.$dialog);
            const $items = $('.item', this.$dialog);
            const linkCount = $.itemExport.length;

            // Set links and keys into text boxes
            $items.removeClass('password-protect-link');

            // Update Password buttons and links UI
            exportPassword.encrypt.updatePasswordComponentsUI();

            // Update Link input values
            exportPassword.encrypt.updateLinkInputValues();

            // Turn off toggle and hide the password section
            $passwordToggleSwitch.addClass('toggle-off').removeClass('toggle-on');
            $passwordToggleIcon.addClass('icon-minimise-after').removeClass('icon-check-after');
            $passwordContainer.addClass('hidden');

            // Re-enable the separate link/key toggle
            $exportKeysSwitch.removeClass('disabled');

            // Reset password input to default state
            $passwordInput.val('');
            $passwordInput.prop('readonly', false);
            $passwordStrengthText.text('');
            $passwordInputWrapper.removeClass('good1 good2 good3 good4 good5');

            // Prepare MegaInput field and hide previous errors
            mega.ui.MegaInputs($passwordInput);
            $passwordInput.data('MegaInputs').hideError();

            // Revert to default state for the password visibility 'eye' icon
            if ($passwordVisibilityToggle.hasClass('icon-eye-hidden')) {
                $passwordVisibilityToggle.trigger('click');
            }

            // Change link access description back to 'Anyone with this link can view and download your data'
            $linkAccessText.text(mega.icu.format(l.link_access_explainer, linkCount));
        },

        /**
         * Setup Set remove password button
         */
        initResetPasswordButton: function() {

            "use strict";

            const $removePasswordBtn = $('.js-reset-password', this.$dialog);
            const $linkAccessText = $('.js-link-access-text', this.$dialog);
            const $passwordVisibilityToggle = $('.js-toggle-password-visible', this.$dialog);
            const $passwordInput = $('.js-password-input', this.$dialog);
            const $passwordInputWrapper = $passwordInput.parent();
            const $passwordStrengthText = $('.js-strength-indicator', this.$dialog);

            // On Remove password click
            $removePasswordBtn.rebind('click.removePass', () => {
                loadingDialog.show();

                // Remove the existing links and re-add them
                exportPassword.removeLinksAndReAdd($.itemExport)
                    .then(() => {
                        const $items = $('.item', this.$dialog);
                        const linkCount = $.itemExport.length;

                        // Set links and keys into text boxes
                        $items.removeClass('password-protect-link');

                        // Update Password buttons and links UI
                        exportPassword.encrypt.updatePasswordComponentsUI();

                        // Update Link input values
                        exportPassword.encrypt.updateLinkInputValues();

                        // Change link access description back to 'Anyone with this link can view your data'
                        $linkAccessText.text(mega.icu.format(l.link_access_explainer, linkCount));

                        // Reset password input to default state
                        $passwordInput.val('');
                        $passwordInput.focus();
                        $passwordInput.prop('readonly', false);
                        $passwordStrengthText.text('');
                        $passwordInputWrapper.removeClass('good1 good2 good3 good4 good5');

                        // Revert to default state for the password visibility 'eye' icon
                        if ($passwordVisibilityToggle.hasClass('icon-eye-hidden')) {
                            $passwordVisibilityToggle.trigger('click');
                        }
                    })
                    .catch(tell)
                    .finally(() => {
                        loadingDialog.hide();
                    });

                return false;
            });
        },

        /**
         * Initialise the Confirm password button to set the link/s password
         */
        initConfirmPasswordButton: function() {

            'use strict';

            // Add click handler to the confirm button
            $('.js-confirm-password', this.$dialog).rebind('click.setPass', () => {
                loadingDialog.show();

                // Remove the existing links and re-add them
                exportPassword.removeLinksAndReAdd($.itemExport)
                    .then(() => {
                        // @todo revamp to get back the crypto promise
                        return exportPassword.encrypt.startEncryption();
                    })
                    .catch(tell)
                    .finally(() => {
                        loadingDialog.hide();
                    });
            });
        },

        /**
         * Add click handler on the eye icon inside the password field to toggle the password as text/dots
         */
        initPasswordVisibilityHandler: function() {

            'use strict';

            const $passwordInput = $('.js-password-input', this.$dialog);
            const $togglePasswordVisibileIcon = $('.js-toggle-password-visible', this.$dialog);

            $togglePasswordVisibileIcon.rebind('click.showPass', () => {

                // If the eye icon is showing, reveal the password using text field
                if ($togglePasswordVisibileIcon.hasClass('icon-eye-reveal')) {
                    $togglePasswordVisibileIcon.removeClass('icon-eye-reveal').addClass('icon-eye-hidden');
                    $passwordInput[0].type = 'text';
                }
                else {
                    // Otherwise revert back to dots
                    $togglePasswordVisibileIcon.removeClass('icon-eye-hidden').addClass('icon-eye-reveal');
                    $passwordInput[0].type = 'password';
                }
            });
        },

        /**
         * Load the ZXCVBN password strength estimator library
         */
        loadPasswordEstimatorLibrary: function() {

            "use strict";

            if (typeof zxcvbn === 'undefined') {

                // Show loading spinner
                const $loader = $('.estimator-loading-icon', this.$dialog).addClass('loading');

                // On completion of loading, hide the loading spinner
                M.require('zxcvbn_js')
                    .done(function() {
                        $loader.removeClass('loading');
                    });
            }
        },

        /**
         * Show what strength the currently entered password is on key up
         */
        initPasswordStrengthCheck: function() {

            "use strict";

            const $passwordStrengthField = $('.js-strength-indicator', this.$dialog);
            const $passwordInput = $('.js-password-input', this.$dialog);
            const $encryptButton = $('.js-confirm-password', this.$dialog);
            const $inputWrapper = $passwordInput.parent();

            // Add keyup event to the password text field
            $passwordInput.rebind('keyup', function(event) {

                // Don't attempt to do add any strength checker text if the field is disabled for typing
                if ($passwordInput.prop('readonly')) {
                    return false;
                }

                // Make sure the ZXCVBN password strength estimator library is loaded first
                if (typeof zxcvbn !== 'undefined') {

                    // Estimate the password strength
                    var password = $.trim($passwordInput.val());
                    var passwordScore = zxcvbn(password).score;
                    var passwordLength = password.length;

                    // Remove previous strength classes that were added
                    $inputWrapper.removeClass('good1 good2 good3 good4 good5');

                    // Add colour coding and text
                    if (password.length === 0) {
                        $passwordStrengthField.text('');   // No password entered, hide text
                    }
                    else if (passwordLength < 8) {
                        $inputWrapper.addClass('good1');
                        $passwordStrengthField.text(l[18700]);    // Too short
                    }
                    else if (passwordScore === 4) {
                        $inputWrapper.addClass('good5');
                        $passwordStrengthField.text(l[1128]);    // Strong
                    }
                    else if (passwordScore === 3) {
                        $inputWrapper.addClass('good4');
                        $passwordStrengthField.text(l[1127]);    // Good
                    }
                    else if (passwordScore === 2) {
                        $inputWrapper.addClass('good3');
                        $passwordStrengthField.text(l[1126]);    // Medium
                    }
                    else if (passwordScore === 1) {
                        $inputWrapper.addClass('good2');
                        $passwordStrengthField.text(l[1125]);    // Weak
                    }
                    else {
                        $inputWrapper.addClass('good1');
                        $passwordStrengthField.text(l[1124]);    // Very Weak
                    }
                }

                // If Enter key is pressed, trigger encryption button clicking
                if (event.keyCode === 13) {
                    $encryptButton.trigger('click');
                }
            });

            // Add keyup event to the password field
            $passwordInput.rebind('keyup.setPass', (event) => {

                // If Enter key is pressed, trigger encryption button clicking
                if (event.keyCode === 13) {
                    $encryptButton.trigger('click');
                }
            });
        },

        /**
         * Start key derivation of each link in the dialog
         */
        startEncryption: function() {

            "use strict";

            const $linkAccessText = $('.js-link-access-text', this.$dialog);
            const $passwordVisibilityToggle = $('.js-toggle-password-visible', this.$dialog);
            const $passwordInput = $('.js-password-input', this.$dialog);
            const $passwordInputWrapper = $passwordInput.parent();
            const $passwordStrengthText = $('.js-strength-indicator', this.$dialog);
            const $updateSuccessBanner = $('.js-update-success-banner', this.$dialog);

            // Prepare MegaInput field
            mega.ui.MegaInputs($passwordInput);

            // Hide previous errors
            $passwordInput.data('MegaInputs').hideError();

            // Get the password
            const password = $passwordInput.val();

            // Check if TextEncoder function is available for the stringToByteArray function
            if (!window.TextEncoder) {

                // This feature is not supported in your browser...
                $passwordInput.data('MegaInputs').showError(l[9065]);
                return false;
            }

            // Check zxcvbn library is loaded first or we can't check the strength of the password
            if (typeof zxcvbn === 'undefined') {

                // The password strength verifier is still initializing
                $passwordInput.data('MegaInputs').showError(l[1115]);
                return false;
            }

            // Check that the password length is sufficient and exclude very weak passwords
            if (password.length < security.minPasswordLength || $passwordInput.parent().hasClass('good1')) {

                // Please use a stronger password
                $passwordInput.data('MegaInputs').showError(l[9067]);
                return false;
            }

            // Get information for each selected link showing in the dialog and convert the password to bytes
            var links = exportPassword.encrypt.getLinkInfo();

            // An anonymous function to derive the key and on completion create the password protected link
            var processLinkInfo = function(linkInfo, algorithm, saltBytes, password) {
                exportPassword.deriveKey(algorithm, saltBytes, password, function(derivedKeyBytes) {
                    exportPassword.encrypt.encryptAndMakeLink(linkInfo, derivedKeyBytes);
                });
            };

            // For each selected link
            for (let i = 0; i < links.length; i++) {

                // Get the link information and random salt
                const link = links[i];
                const linkCount = links.length;
                const saltBytes = link.saltBytes;
                const algorithm = exportPassword.currentAlgorithm;

                // Derive the key and create the password protected link
                processLinkInfo(link, algorithm, saltBytes, password);

                // If this is the last link
                if (i === linkCount - 1) {

                    // Show a success banner telling them to re-copy the links
                    $updateSuccessBanner.text(mega.icu.format(l.links_updated_copy_again, linkCount));
                    $updateSuccessBanner.removeClass('hidden');

                    // Hide again after 3 seconds
                    setTimeout(() => {
                        $updateSuccessBanner.addClass('hidden');
                    }, 3000);

                    // Change link access description to 'Only people with the password can open the link/s'
                    $linkAccessText.text(mega.icu.format(l.password_link_access_explainer, linkCount));

                    // Set password input to read only and hide the strength display
                    $passwordInput.prop('readonly', true);
                    $passwordStrengthText.text('');
                    $passwordInputWrapper.removeClass('good1 good2 good3 good4 good5');

                    // Revert to default state for the password visibility 'eye' icon
                    if ($passwordVisibilityToggle.hasClass('icon-eye-hidden')) {
                        $passwordVisibilityToggle.trigger('click');
                    }
                }
            }
        },

        /**
         * Encrypt the link's key and format the password protected link
         * @param {Object} linkInfo The information about the link
         * @param {Uint8Array} derivedKeyBytes The derived key in bytes
         */
        encryptAndMakeLink: function(linkInfo, derivedKeyBytes) {

            "use strict";

            var encKeyBytes = null;
            var algorithm = exportPassword.currentAlgorithm;
            var saltBytes = linkInfo.saltBytes;

            // If folder link, use the first 16 bytes (128 bits) of the derived key as the encryption key
            if (linkInfo.type === exportPassword.LINK_TYPE_FOLDER) {
                encKeyBytes = new Uint8Array(derivedKeyBytes.buffer, 0, 16);
            }
            else {
                // Otherwise if it's a file link use the first 32 bytes (256 bits) as the encryption key
                encKeyBytes = new Uint8Array(derivedKeyBytes.buffer, 0, 32);
            }

            // Use the last 32 bytes (256 bits) of the derived key as the MAC key
            var macKeyLengthBytes = exportPassword.algorithms[algorithm].macKeyLength / 8;
            var macKeyBytes = new Uint8Array(derivedKeyBytes.buffer, macKeyLengthBytes, macKeyLengthBytes);

            // Encrypt the file/folder link key
            var encryptedKey = exportPassword.xorByteArrays(encKeyBytes, linkInfo.keyBytes);

            // Convert the public handle to bytes
            var publicHandleBytes = asmCrypto.base64_to_bytes(linkInfo.publicHandle);

            // 1 byte for alg + 1 byte if folder/file + 6 bytes for handle + 32 bytes salt + 16 or 32 bytes for key
            var dataToAuthenticateLength = 2 + publicHandleBytes.length + saltBytes.length + encryptedKey.length;
            var dataToAuthenticateBytes = new Uint8Array(dataToAuthenticateLength);

            // Set the algorithm and set the flag for type of link
            dataToAuthenticateBytes[0] = algorithm;
            dataToAuthenticateBytes[1] = linkInfo.type;

            // Set the handle, salt and encrypted key into the array to be authenticated using different array offsets
            dataToAuthenticateBytes.set(publicHandleBytes, 2);
            dataToAuthenticateBytes.set(saltBytes, 8);
            dataToAuthenticateBytes.set(encryptedKey, 40);

            // Create the MAC of the data
            var macAlgorithm = exportPassword.algorithms[algorithm].macName;

            // If using the old algorithm (1), use parameter order: HMAC(password, data)
            if (algorithm === 1) {
                var macBytes = asmCrypto[macAlgorithm].bytes(macKeyBytes, dataToAuthenticateBytes);
            }
            else {
                // Otherwise for newer links (algorithm >= 2) use the correct parameter order: HMAC(data, password)
                var macBytes = asmCrypto[macAlgorithm].bytes(dataToAuthenticateBytes, macKeyBytes);
            }

            // Create buffer for the data to be converted to Base64
            var numOfBytes = dataToAuthenticateBytes.length + macBytes.length;
            var dataToConvert = new Uint8Array(numOfBytes);

            // Fill the array using the different offsets
            dataToConvert.set(dataToAuthenticateBytes, 0);
            dataToConvert.set(macBytes, dataToAuthenticateBytes.length);

            // Convert the data to Base64, then make it URL safe
            var dataBase64UrlEncoded = exportPassword.base64UrlEncode(dataToConvert);

            // Construct URL: #P! for password link + encoded(alg + folder/file + handle + salt + encrypted key + mac)
            var protectedUrl = getBaseUrl() + '/#P!' + dataBase64UrlEncoded;

            if (is_mobile) {
                mobile.linkManagement.pwdProtectedLink = protectedUrl;
            }
            else {
                // Get the HTML block for this link by using the node handle
                var $item = $('.item[data-node-handle="' + linkInfo.handle + '"]', this.$dialog);

                // Set the password into the text box and add a class for styling this block
                $('.item-link.link input', $item).val(protectedUrl);
                $('.item-link.key input', $item).val('');
                $item.addClass('password-protect-link');

                // Update Password buttons and links UI
                exportPassword.encrypt.updatePasswordComponentsUI();
                exportPassword.encrypt.initResetPasswordButton();
            }

            // Log to see if encryption feature is used much
            eventlog(99618, JSON.stringify([1, linkInfo.type === exportPassword.LINK_TYPE_FOLDER ? 1 : 0]));
        },

        /**
         * Get the information for each selected link
         * @returns {Array} Returns an array of objects containing properties 'handle', 'type', 'key', 'keyBytes'
         */
        getLinkInfo: function() {

            "use strict";

            var links = [];
            var $links = $('.item', this.$dialog);
            var $selectedLink =  $links.filter('.selected');
            var handles = [];

            // Create array of available links handles
            if ($selectedLink.length) {
                handles.push($selectedLink.data('node-handle'));
            }
            else {
                $links.get().forEach(function(e) {
                    handles.push($(e).data('node-handle'));
                });
            }

            // Iterate through the selected handles
            for (var i in handles) {
                if (handles.hasOwnProperty(i)) {

                    // Get the node information
                    var node = M.d[handles[i]];
                    var linkInfo = {};

                    // Only nodes with public handle
                    if (node && node.ph) {

                        // Folder
                        if (node.t) {
                            linkInfo.type = exportPassword.LINK_TYPE_FOLDER;    // 0 byte for folder link
                            linkInfo.key = u_sharekeys[node.h][0];              // 128 bit key as array of 32 bit int
                        }
                        else {
                            // File
                            linkInfo.type = exportPassword.LINK_TYPE_FILE;      // 1 byte for file link
                            linkInfo.key = node.k;                              // 256 bit key as array of 32 bit int
                        }

                        // Convert the key to a byte array (big endian), also add the link's handle and public handle
                        linkInfo.keyBytes = a32_to_ab(linkInfo.key);
                        linkInfo.handle = node.h;
                        linkInfo.publicHandle = node.ph;

                        // Generate a random salt for encrypting this link
                        var algorithm = exportPassword.currentAlgorithm;
                        var saltLengthBytes = exportPassword.algorithms[algorithm].saltLength / 8;
                        linkInfo.saltBytes = crypto.getRandomValues(new Uint8Array(saltLengthBytes));

                        // Add object to array
                        links.push(linkInfo);
                    }
                }
            }

            return links;
        }
    },  // Encrypt functions


    /**
     * Functions for the decryption
     */
    decrypt: {

        // The jQuery selector for the Export dialog
        $dialog: null,

        /**
         * Initialise function
         * @param {String} page The current page's URL hash e.g. #P!AAA5TWTcNMtFlJ5A...
         */
        init: function(page) {

            "use strict";

            // Cache dialog selector
            this.$dialog = $('.mega-dialog.password-dialog', 'body');

            this.$megaInput = new mega.ui.MegaInputs($('#password-decrypt-input',this.$dialog));

            // Show the dialog
            this.showDialog(page);
        },

        /**
         * Shows the dialog to let the user decrypt the link using a password
         * @param {String} page The current page's URL hash e.g. #P!AAA5TWTcNMtFlJ5A...
         */
        showDialog: function(page) {

            "use strict";
            var $megaInput = this.$megaInput;
            var $closeButton = $('button.js-close', this.$dialog);
            var $decryptButton = $('.decrypt-link-button', this.$dialog);
            var $decryptButtonText = $('.decrypt-text', $decryptButton);

            // Show a background overlay
            fm_showoverlay();

            // Show the dialog
            $.dialog = 'passwordlink-dialog';
            this.$dialog.removeClass('hidden');

            // Reset state of dialog for future password link decryptions
            $decryptButtonText.text(l[1027]);   // Decrypt

            // Add a click handler for the close button to return to the home page (or cloud drive if logged in)
            $closeButton.rebind('click', function() {
                loadSubPage('');
                return false;
            });

            // Add click handler for Decrypt button
            $decryptButton.rebind('click', function() {
                exportPassword.decrypt.decryptLink(page);
            });

            // Listen for Enter key to fire decryption
            $megaInput.$input.rebind('keyup', (ev) => {
                if (ev.keyCode === 13) {
                    exportPassword.decrypt.decryptLink(page);
                }
            });
        },

        /**
         * Decrypts the password protected link and redirects to the real folder/file link
         * @param {String} page The current page's URL hash e.g. #P!AAA5TWTcNMtFlJ5A...
         */
        decryptLink: function(page) {

            "use strict";
            var $megaInput = this.$megaInput;
            var $decryptButton = $('.decrypt-link-button', this.$dialog);
            var $decryptButtonText = $('.decrypt-text', $decryptButton);
            var $decryptButtonProgress = $('.decryption-in-progress', $decryptButton);
            var $password = $megaInput.$input;


            // Get the password and the encoded information in the URL
            var password = $password.val();
            var urlEncodedInfo = page.replace('P!', '');
            var decodedBytes = null;

            // If no password given...
            if (!password) {
                $megaInput.showError(l[970]); // Please enter a valid password...
                return false;
            }

            // Decode the request
            try {
                decodedBytes = exportPassword.base64UrlDecode(urlEncodedInfo);
            }
            catch (exception) {

                // Show error and abort
                $megaInput.showError(l[9068]);  // The link could not be decoded...
                return false;
            }

            // Get the algorithm used
            var algorithm = decodedBytes[0];

            // Check if valid array index or will throw an exception
            if (typeof exportPassword.algorithms[algorithm] === 'undefined') {

                // Show error and abort
                $megaInput.showError(l[9069]);  // The algorithm this link was encrypted with is not supported
                return false;
            }

            // Get the salt bytes, start offset at 8 (1 byte for alg + 1 byte for file/folder + 6 for handle)
            var saltLength = exportPassword.algorithms[algorithm].saltLength / 8;
            var saltStartOffset = 8;
            var saltEndOffset = saltStartOffset + saltLength;
            var saltBytes = decodedBytes.subarray(saltStartOffset, saltEndOffset);

            // Show encryption loading animation and change text to 'Decrypting'
            $decryptButtonProgress.removeClass('hidden');
            $decryptButtonText.text(l[8579]);

            // Compute the PBKDF
            exportPassword.deriveKey(algorithm, saltBytes, password, function(derivedKeyBytes) {

                // Get the MAC from the decoded bytes
                var macLength = exportPassword.algorithms[algorithm].macLength / 8;
                var macStartOffset = decodedBytes.length - macLength;
                var macEndOffset = decodedBytes.length;
                var macToVerifyBytes = decodedBytes.subarray(macStartOffset, macEndOffset);

                // Get the data to verify
                var dataToVerify = decodedBytes.subarray(0, macStartOffset);

                // Get the MAC key
                var macKeyLength = exportPassword.algorithms[algorithm].macKeyLength / 8;
                var macKeyStartOffset = derivedKeyBytes.length - macKeyLength;
                var macKeyEndOffset = derivedKeyBytes.length;
                var macKeyBytes = derivedKeyBytes.subarray(macKeyStartOffset, macKeyEndOffset);

                // Compute the MAC over the data to verify
                var dataToVerifyBytes = decodedBytes.subarray(0, macStartOffset);
                var macAlgorithm = exportPassword.algorithms[algorithm].macName;

                // If the link was created with an old algorithm (1) which used parameter order: HMAC(password, data)
                if (algorithm === 1) {
                    var macBytes = asmCrypto[macAlgorithm].bytes(macKeyBytes, dataToVerifyBytes);
                }
                else {
                    // Otherwise for newer links (algorithm >= 2) use the correct parameter order: HMAC(data, password)
                    var macBytes = asmCrypto[macAlgorithm].bytes(dataToVerifyBytes, macKeyBytes);
                }

                // Convert the string to hex for simple string comparison
                var macString = asmCrypto.bytes_to_hex(macBytes);
                var macToVerifyString = asmCrypto.bytes_to_hex(macToVerifyBytes);

                // Compare the MAC in the URL to the computed MAC
                if (macString !== macToVerifyString) {

                    // Show error and abort
                    $megaInput.showError(l[9076]);  // The link could not be decrypted...
                    $decryptButtonProgress.addClass('hidden');
                    $decryptButtonText.text(l[1027]);
                    return false;
                }

                // Get the link type char code and set the default key length to 32 bytes
                var linkTypeByte = decodedBytes[1];
                var linkType = linkTypeByte;
                var keyLength = 32;

                // If folder link, set the key length to 16 bytes
                if (linkType === exportPassword.LINK_TYPE_FOLDER) {
                    keyLength = 16;
                }

                // Get the encryption key from the derived key
                var encKeyBytes = derivedKeyBytes.subarray(0, keyLength);

                // Get the encrypted key, start is (2 bytes for alg and type + 6 bytes for handle + salt)
                var saltLength = exportPassword.algorithms[algorithm].saltLength / 8;
                var startOffset = 2 + 6 + saltLength;
                var endOffset = startOffset + keyLength;
                var encryptedKeyBytes = dataToVerify.subarray(startOffset, endOffset);

                // Decrypt the file/folder link key
                var decryptedKey = exportPassword.xorByteArrays(encKeyBytes, encryptedKeyBytes);

                // Recreate the original file/folder link
                var handleBytes = dataToVerify.subarray(2, 8);
                var handleUrlEncoded = exportPassword.base64UrlEncode(handleBytes);
                var decryptedKeyUrlEncoded = exportPassword.base64UrlEncode(decryptedKey);
                var folderIdentifier = (linkType === exportPassword.LINK_TYPE_FOLDER) ? 'F' : '';
                var url = folderIdentifier + '!' + handleUrlEncoded + '!' + decryptedKeyUrlEncoded;


                if (mega.flags.nlfe) {
                    url = (folderIdentifier ? '/folder/' : '/file/') + handleUrlEncoded
                        + '#' + decryptedKeyUrlEncoded;
                }


                // Show completed briefly before redirecting
                $decryptButtonProgress.addClass('hidden');
                $decryptButtonText.text(l[9077]);   // Decrypted

                // Clear password field
                $password.val('');

                // Add a log to see if the feature is used often
                api_req({ a: 'log', e: 99633, m: 'Successfully decrypted password protected link on regular web' });

                // On success, redirect to actual file/folder link
                folderlink = false;
                loadSubPage(url);
            });
        }
    },  // Decrypt functions


    /**
     * Common functions for encryption and decryption
     */

    /**
     * Remove existing links and recreate them as a security measure. This is done when turning off the password
     * toggle, resetting the password and creating a new password. When we remove the existing links and recreate them
     * a new public handle is created. This makes the old links cease to work and only the new one will now work. NB:
     * when removing the links, the existing expiry dates will be removed and will need to be re-added so we keep a copy
     * of those before the operation.
     *
     * @param {Array} nodesToRecreate The node handles of the links to be removed and recreated
     * @param {Function} completeCallback The function to be called once done
     * @returns {Promise}
     */
    async removeLinksAndReAdd(nodesToRecreate) {
        'use strict';

        // Contains a backup of all the expiry dates for each node before we recreate links
        const nodeExpiryTimestamps =
            nodesToRecreate.map((h) => {
                // Get the node handle
                const node = M.d[h];
                const nodeHandle = node.h;
                const expiryTimestamp = M.getNodeShare(node).ets;

                // If it has an expiry time, add it to the array
                return expiryTimestamp && {nodeHandle, expiryTimestamp};
            }).filter(Boolean);

        // Disable sharing on links / perform the remove links operation
        const exportLink = new mega.Share.ExportLink({
            'updateUI': false,
            'nodesToProcess': nodesToRecreate
        });
        await exportLink.removeExportLink(true);

        // When all links are finished being recreated
        const res = await exportLink.getExportLink(true);

        if (nodeExpiryTimestamps.length) {
            // Update the link API side with the previous expiry timestamps for each node

            await Promise.all(
                nodeExpiryTimestamps.map(({nodeHandle, expiryTimestamp}) => {

                    return exportPassword.setExpiryOnNode(nodeHandle, expiryTimestamp);
                })
            );
        }

        // Go through each link handle
        for (let i = 0; i < nodesToRecreate.length; i++) {

            const nodeHandle = nodesToRecreate[i];
            const node = M.d[nodeHandle];
            const nodePubHandle = node.ph;
            const nodeType = node.t;

            // Create the links
            const newLink = getBaseUrl() + (nodeType ? '/folder/' : '/file/') + escapeHTML(nodePubHandle);

            // Update UI
            const $item = $(`.item[data-node-handle='${nodeHandle}']`, exportPassword.encrypt.$dialog);
            const $itemInputLink = $('.item-link.link input', $item);

            // Update data attribute - text input value is updated later
            $itemInputLink.data('link', newLink);
        }

        return res;
    },

    /**
     * Sets an expiry timestamp on a share link node
     * @param {String} n The node handle to set the expiry for
     * @param {Number} ets The expiry timestamp
     * @returns {Promise} The promise to be resolved/rejected once the API operation is complete
     */
    setExpiryOnNode(n, ets) {
        'use strict';
        return api.screq({a: 'l', n, ets});
    },

    /**
     * A wrapper function used for deriving a key from a password.
     * @param {Number} algorithm The index of the algorithms array describing which algorithm to use
     * @param {Uint8Array} saltBytes The salt as a byte array
     * @param {String} password The raw password as entered by the user e.g. in ASCII or UTF-8
     * @param {Function} callback A function to call when the operation is complete
     */
    deriveKey: function(algorithm, saltBytes, password, callback) {

        "use strict";

        // Trim the password and convert it from ASCII/UTF-8 to a byte array
        var passwordTrimmed = $.trim(password);
        var passwordBytes = this.stringToByteArray(passwordTrimmed);

        // If Web Crypto method supported, use that
        if (window.crypto && window.crypto.subtle) {
            this.deriveKeyWithWebCrypto(algorithm, saltBytes, passwordBytes, callback);
        }
        else {
            // Otherwise use asmCrypto which is the next fastest
            this.deriveKeyWithAsmCrypto(algorithm, saltBytes, passwordBytes, callback);
        }
    },

    /**
     * Derive the key using the Web Crypto API
     * @param {Number} algorithm The index of the algorithms array describing which algorithm to use
     * @param {Uint8Array} saltBytes The salt as a byte array
     * @param {Uint8Array} passwordBytes The password as a byte array
     * @param {Function} callback A function to call when the operation is complete
     */
    deriveKeyWithWebCrypto: function(algorithm, saltBytes, passwordBytes, callback) {

        "use strict";

        // Get algorithm details
        var name = this.algorithms[algorithm]['name'];
        var hash = this.algorithms[algorithm]['hash'];
        var iterations = this.algorithms[algorithm]['iterations'];
        var derivedKeyLength = this.algorithms[algorithm]['derivedKeyLength'];

        // Import the password as the key
        crypto.subtle.importKey(
            'raw', passwordBytes, name, false, ['deriveBits']
        )
        .then(function(key) {

            // Required PBKDF2 parameters
            var params = {
                name: name,
                hash: hash,
                salt: saltBytes,
                iterations: iterations
            };

            // Derive bits using the algorithm
            return crypto.subtle.deriveBits(params, key, derivedKeyLength);
        })
        .then(function(derivedKeyArrayBuffer) {

            // Convert to a byte array
            var derivedKeyBytes = new Uint8Array(derivedKeyArrayBuffer);

            // Pass the derived key to the callback
            callback(derivedKeyBytes);
        });
    },

    /**
     * Derive the key using asmCrypto
     * @param {Number} algorithm The index of the algorithms array describing which algorithm to use
     * @param {Uint8Array} saltBytes The salt as a byte array
     * @param {Uint8Array} passwordBytes The password as a byte array
     * @param {Function} callback A function to call when the operation is complete
     */
    deriveKeyWithAsmCrypto: function(algorithm, saltBytes, passwordBytes, callback) {

        "use strict";

        // Get algorithm details
        var name = this.algorithms[algorithm]['failsafeName'];
        var iterations = this.algorithms[algorithm]['iterations'];
        var keyLengthBits = this.algorithms[algorithm]['derivedKeyLength'];
        var keyLengthBytes = keyLengthBits / 8;

        // Give the UI some time to update on slower devices like iOS
        setTimeout(function() {

            // Derive the key
            var derivedKeyBytes = asmCrypto[name].bytes(passwordBytes, saltBytes, iterations, keyLengthBytes);

            // Pass the derived key to the callback
            callback(derivedKeyBytes);

        }, 500);
    },

    /**
     * This function encodes the data to Base64 then removes or replaces characters that will break
     * in the URL. It is similar to the base64urlencode function in crypto.js but works on a byte array.
     *
     * @param {Uint8Array} dataBytes The data as a byte array to be converted to Base64
     * @return {String} Returns a URL safe Base64 encoded string e.g. v9jVaZfyT_cuKEV-JviPAhvv
     */
    base64UrlEncode: function(dataBytes) {

        "use strict";

        // Convert the data to regular Base64
        var dataBase64 = asmCrypto.bytes_to_base64(dataBytes);

        // Remove plus signs, forward slashes and equals signs (padding)
        var dataBase64UrlEncoded = dataBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        return dataBase64UrlEncoded;
    },

    /**
     * This function decodes the data from a URL safe Base64 string back to regular Base64 then back to bytes.
     * It is similar to the base64urldecode function in crypto.js but converts the string back to a byte array.
     *
     * @param {String} dataText A URL safe Base64 encoded string e.g. v9jVaZfyT_cuKEV-JviPAhvv
     * @returns {Uint8Array} Returns the decoded data as a byte array
     */
    base64UrlDecode: function(dataText) {

        "use strict";

        // Restore the padding then replace the plus signs and forward slashes
        dataText += '=='.substr((2 - dataText.length * 3) & 3);
        dataText = dataText.replace(/\-/g, '+').replace(/_/g, '/');

        // Convert the data from regular Base 64 to bytes
        var dataBytes = asmCrypto.base64_to_bytes(dataText);

        return dataBytes;
    },

    /**
     * XOR two arrays of type Uint8Array together e.g. useful for encryption or decryption
     * @param {Uint8Array} array1 The first array e.g. the encryption key
     * @param {Uint8Array} array2 The second array e.g. the data to encrypt
     * @returns {Uint8Array}
     */
    xorByteArrays: function(array1, array2) {

        "use strict";

        var numOfBytes = array1.length;
        var result = new Uint8Array(numOfBytes);

        // XOR each byte in the array with the corresponding byte from the other
        for (var i = 0; i < numOfBytes; i++) {
            result[i] = array1[i] ^ array2[i];
        }

        return result;
    },

    /**
     * Converts a UTF-8 string to a byte array
     * @param {String} string A string of any character including UTF-8 chars e.g. password123
     * @returns {Uint8Array} Returns a byte array
     */
    stringToByteArray: function(string) {

        "use strict";

        var encoder = new TextEncoder('utf-8');

        return encoder.encode(string);
    }
};


/**
 * Functionality for the Export Link expiry feature
 */
var exportExpiry = {

    /**
     * The instantiated datepicker
     */
    datepicker: null,

    /**
     * Initialise function
     */
    init: function() {

        "use strict";

        this.$dialog = $('.mega-dialog.export-links-dialog');

        // If they are a pro user, load the datepicker library
        if (u_attr.p) {
            M.require('datepicker_js').done(() => {
                exportExpiry.initExpiryDatePicker();
                exportExpiry.initExpiryOptionToggle();
            });
        }
    },

    /**
     * Setup the datepicker
     */
    initExpiryDatePicker: function() {

        "use strict";

        const $setDateInput = $('.set-date', this.$dialog);
        const $setDateInputIcon = $('.js-datepicker-calendar-icon', this.$dialog);
        const $scroll = $('.links-scroll', this.$dialog);
        const minDate = new Date();
        const maxDate = new Date(2060, 11, 31);

        // Set Minimum date at least 1 day in the future
        minDate.setDate(minDate.getDate() + 1);

        // Initialise expiry date picker
        // Docs viewable at https://github.com/meganz/air-datepicker/tree/master/docs
        exportExpiry.datepicker = $setDateInput.datepicker({

            // Date format, @ - Unix timestamp
            dateFormat: '@',
            // Extra CSS class for datepicker
            classes: 'share-link-expiry-calendar',
            // Minimum date that can be selected
            minDate: minDate,
            // Maximum date that can be selected
            maxDate: maxDate,
            // Start date that should be displayed when datepicker is shown (we set this later)
            startDate: null,
            // Content of Previous button
            prevHtml: '<i class="sprite-fm-mono icon-arrow-right"></i>',
            // Content of Next button
            nextHtml: '<i class="sprite-fm-mono icon-arrow-right"></i>',
            // First day in the week. 0 - Sun
            firstDay: 0,
            // Auto close daticker is date is selected
            autoClose: true,
            // If true, then clicking on selected cell will remove selection
            toggleSelected: false,
            // Default position
            position: 'bottom left',
            // Cursom localization
            language: {
                // Sun - Sat
                daysMin: [l[8763], l[8764], l[8765], l[8766], l[8767], l[8768], l[8769]],
                months: [
                    l[408], l[409], l[410], l[411], l[412], l[413],     // January - June
                    l[414], l[415], l[416], l[417], l[418], l[419]      // July - December
                ],
                monthsShort: [
                    l[24035], l[24037], l[24036], l[24038], l[24047], l[24039],     // January - June
                    l[24040], l[24041], l[24042], l[24043], l[24044], l[24045]      // July - December
                ]
            },

            // Change Month select box width on showing the calendar (clicking the text input triggers this)
            onShow: (inst) => {

                // Get any dates set previously (in updateDatepickerAndTextInput function)
                const newDate = inst.selectedDates[0];

                // Set default position of the datepicker to be below the text input
                const newOptions = {
                    'position': 'bottom left',
                    'offset': 12
                };

                // If short height screen, show on top
                if (screen.height <= 1080) {
                    newOptions.position = 'top left';
                    newOptions.offset = 40;
                }

                // Show previously selected date in the selectedDates
                if (newDate) {

                    // Set selected date in picker (red circle)
                    newOptions.date = newDate;

                    // Update the datepicker calendar view (before setting input text, or text appears as timestamp ms)
                    inst.update(newOptions);

                    // Update the text input
                    exportExpiry.updateInputText(newDate);
                }
                else {
                    // Update the datepicker calendar view
                    inst.update(newOptions);
                }

                // Change position on resize
                $(window).rebind('resize.setDatepickerPosition', function() {
                    inst.setPosition();
                });

                // Disable scrolling
                delay('disableExportScroll', function() {
                    Ps.disable($scroll[0]);
                }, 100);

                // Close export dropdown
                $('.dropdown.export', this.$dialog).addClass('hidden');
            },

            onSelect: (dateText, date, inst) => {

                const $inputClicked = inst.$el;

                // Select link item
                $('.item.selected', this.$dialog).removeClass('selected');
                $inputClicked.closest('.item').addClass('selected');
                $inputClicked.trigger('change.logDateChange');

                // Update the link API side with the new expiry timestamp
                exportExpiry.updateLinksOnApi(dateText / 1000 || undefined);

                // Update the text input
                exportExpiry.updateInputText(date);
            },

            onHide: () => {

                // Enable scroll
                Ps.enable($scroll[0]);

                // Unbind dialog positioning
                $(window).unbind('resize.setDatepickerPosition');
            }
        }).data('datepicker');

        // Press Enter key if datepicker dropdown is opened
        $setDateInput.rebind('keydown.date', function(event) {

            // If Enter key is pressed
            if (event.keyCode === 13) {
                $(this).blur();

                // Trigger click If date is selected in datepicker
                if ($('.ui-datepicker .ui-state-active', 'body').length) {
                    $('.ui-datepicker .ui-state-active', 'body').trigger('click');
                }
            }
        });

        // Trigger the datepicker to open when clicking the icon inside the text input
        $setDateInputIcon.rebind('click.calendariconclick', () => {
            $setDateInput.trigger('focus');
        });
    },

    /**
     * Update the datepicker input text field with the readable text date
     * @param {Date} date
     */
    updateInputText: function(date) {

        'use strict';

        // Make sure the date is set
        if (date) {
            const $setDateInput = $('.set-date', self.$dialog);

            // Convert to readable date e.g. 3 August 2023
            const dateTimestamp = Math.round(date.getTime() / 1000);
            const inputText = time2date(dateTimestamp, 2);

            $setDateInput.val(inputText);
        }
    },

    /**
     * If reloading the dialog, check the local state of M.d nodes to ge the current expiry
     * @returns {Array} Returns an array of timestamps
     */
    getExpiryDates: function() {

        "use strict";

        // Get the selected files/folders
        const handles = $.selected;
        const expiryTimestamps = [];

        // For each selected file/folder
        for (var i in handles) {
            if (handles.hasOwnProperty(i)) {

                // Get the node handle
                var node = M.d[handles[i]];
                var expiryTimestamp = M.getNodeShare(node).ets;

                // If it has an expiry time, increment the count
                if (expiryTimestamp) {
                    expiryTimestamps.push(expiryTimestamp);
                }
            }
        }

        return expiryTimestamps;
    },

    /**
     * Turn off the expiry toggle and hide the datepicker block
     */
    disableToggleAndHideExpiry: function() {

        'use strict';

        const $expiryOptionToggle = $('.js-expiry-switch', this.$dialog);
        const $expiryContainer = $('.expiry-container', this.$dialog);
        const $expiryOptionToggleIcon = $('.mega-feature-switch', $expiryOptionToggle);

        $expiryOptionToggle.addClass('toggle-off').removeClass('toggle-on');
        $expiryOptionToggleIcon.addClass('icon-minimise-after').removeClass('icon-check-after');
        $expiryContainer.addClass('hidden');
    },

    /**
     * Initialise the expiry option toggle switch
     */
    initExpiryOptionToggle: function() {

        'use strict';

        const $linksTab = $('section .content-block.links-content', this.$dialog);
        const $expiryOptionToggle = $('.js-expiry-switch', this.$dialog);
        const $setDateInput = $('input.set-date', this.$dialog);
        const $expiryContainer = $('.expiry-container', this.$dialog);
        const $expiryOptionToggleIcon = $('.mega-feature-switch', $expiryOptionToggle);

        // Init toggle to show/hide Expiry picker
        $expiryOptionToggle.rebind('click.changeExpiryView', () => {

            const isChecked = $expiryOptionToggle.hasClass('toggle-on');
            const $selectedLink = $('.item.selected', $linksTab);

            // If checked
            if (isChecked) {

                // Turn off the toggle and hide the expiry block
                exportExpiry.disableToggleAndHideExpiry();

                // Update the selected links API side and remove the expiry timestamps
                exportExpiry.updateLinksOnApi(null);

                // Remove selected date from all items
                exportExpiry.datepicker.clear();

                // Set text to 'Set an expiry date' (probably won't be seen as turning on the toggle sets to min date)
                $setDateInput.val(l[8953]);
            }
            else {
                // Otherwise if not checked, turn on toggle
                $expiryOptionToggle.addClass('toggle-on').removeClass('toggle-off');
                $expiryOptionToggleIcon.addClass('icon-check-after').removeClass('icon-minimise-after');
                $expiryContainer.removeClass('hidden');

                // Update the datepicker and input
                exportExpiry.updateDatepickerAndTextInput();

                // Show the date picker dropdown when toggle is on
                $setDateInput.trigger('focus');

                // Log to see if "Set an expiry date" is clicked much
                logExportEvt(2, $selectedLink);
            }
        });

        // Get the current expiry dates for the selected items from local state in M.d
        const expiryTimestamps = exportExpiry.getExpiryDates();

        // If there are expiry dates set on at least one selected item and the toggle is currently off,
        //  turn it on and this will also trigger the current expiry date to be shown in the datepicker
        if (expiryTimestamps.length && $expiryOptionToggle.hasClass('toggle-off')) {
            $expiryOptionToggle.trigger('click');
            $setDateInput.trigger('blur');
        }
    },

    /**
     * Update datepicker and text input (button to trigger the datepicker)
     */
    updateDatepickerAndTextInput: function() {

        "use strict";

        const $setDateInput = $('input.set-date', this.$dialog);

        // Get all the expiry timestamps from the selected nodes in an array
        const expiryTimestamps = exportExpiry.getExpiryDates();

        let inputText = '';

        // Clear active dates
        exportExpiry.datepicker.selectedDates = [];

        // If there is at least one expiry date set
        if (expiryTimestamps.length) {

            // Check if all dates are the same
            for (let i = 0; i < expiryTimestamps.length; i++) {

                const timestamp = expiryTimestamps[i];

                // If timestamps are different, use "Multiple dates set" as input text
                if (inputText && inputText !== timestamp) {
                    $setDateInput.val(l[23674]);
                    return false;
                }

                inputText = timestamp;
            }

            // If it is Unixtimestamp, convert it to necessary formats and set active date to the datepicker
            if (Number(inputText)) {

                // Set active date in datepicker component
                exportExpiry.datepicker.selectDate(new Date(inputText * 1000));

                // Change input text
                inputText = time2date(inputText, 2);
            }

            // Set expiry date to text input
            $setDateInput.val(inputText);
        }
        else {
            // Otherwise set minimum date at least 1 day in the future
            const minDate = new Date();
            minDate.setDate(minDate.getDate() + 1);

            // Get minimum date timestamp
            const minDateTimestamp = Math.round(minDate.getTime() / 1000);

            // Set active date in datepicker component
            exportExpiry.datepicker.selectDate(minDate);

            // Save the result to API
            exportExpiry.updateLinksOnApi(minDateTimestamp);

            // Update input text
            exportExpiry.updateInputText(minDate);
        }
    },

    /**
     * Update selected links on the API with details about the expiry of the link
     * @param {Number} expiryTimestamp The expiry timestamp of the link. Set to null to remove the expiry time
     */
    updateLinksOnApi: function(expiryTimestamp) {

        "use strict";

        var $links = $('.item', this.$dialog);
        var $selectedLink =  $('.item.selected', this.$dialog);
        var handles = [];

        // Create array of available links handles
        if ($selectedLink.length) {
            handles.push($selectedLink.data('node-handle'));
        }
        else {
            $links.get().forEach(function(e) {
                handles.push($(e).data('node-handle'));
            });
        }

        // Iterate through the selected handles
        for (var i in handles) {
            if (handles.hasOwnProperty(i)) {

                // Get the node handle
                var node = M.d[handles[i]];
                var handle = node.h;

                // Update the link with the new expiry timestamp
                api.screq({a: 'l', n: handle, ets: expiryTimestamp}).catch(dump);
            }
        }
    }
};


/**
 * Log public-link dialog events:
 * 1: "Export link decryption key separately" click
 * 2: "Set an expiry date" buttons click
 * 3: Select expiry date in the calendar
 * 4: "Set password" buttons click
 * 5: "Cog" icon click to show context menu
 * 6: "Remove link" button click
 * @param {Number} type 1-6
 * @param {Object} target Target elem selector
 * @returns {void}
 */
function logExportEvt(type, target) {

    'use strict';

    const h = $(target).closest('.item').data('node-handle');
    let folders = 0;
    let files = 0;

    if (h && M.d[h].t) {
        folders++;
    }
    else if (h) {
        files++;
    }
    else {
        folders = $.exportFolderLinks;
        files = $.exportFileLinks;
    }

    eventlog(99790, JSON.stringify([1, type, folders, files]));
}


/**
 * Functionality for the Export Link dialog
 */
(function($, scope) {

    /**
     * Public Link Dialog
     * @param opts {Object}
     * @constructor
     */
    var ExportLinkDialog = function(opts) {

        "use strict";

        var self = this;

        var defaultOptions = {
        };

        self.options = $.extend(true, {}, defaultOptions, opts);

        self.logger = MegaLogger.getLogger('ExportLinkDialog');
    };

    /**
     * Render public link dialog and handle events
     * @param {Boolean} close To close or to show public link dialog
     */
    ExportLinkDialog.prototype.linksDialog = function(close) {

        "use strict";

        if (M.isInvalidUserStatus()) {
            return;
        }

        /* jshint -W074 */
        var self = this;
        var $linksDialog = $('.mega-dialog.export-links-dialog');
        var $linksTab = $('section .content-block.links-content', $linksDialog);
        var $linksHeader = $('header .get-link', $linksDialog);
        var $linkContent = $('.links-content.links', $linksDialog);
        const $separateKeysBlock = $('.export-keys-separately-block', $linksDialog);
        const $separateKeysToggle = $('.js-export-keys-switch', $linksTab);
        const $removeLinkButton = $('.js-remove-link-button', $linksDialog);
        const $removeLinkButtonText = $('.remove-link-text', $removeLinkButton);
        const $linkAccessText = $('.js-link-access-text', $linksDialog);
        const $updateSuccessBanner = $('.js-update-success-banner', $linksDialog);
        const $linksContainer = $('.links-content.links', $linksDialog);
        const $expiryOptionToggle = $('.js-expiry-switch', $linksDialog);
        const $passwordToggleSwitch = $('.js-password-switch ', $linksDialog);
        const $passwordVisibilityToggle = $('.js-toggle-password-visible', $linksDialog);
        const $passwordInput = $('.js-password-input', $linksDialog);
        const $passwordInputWrapper = $passwordInput.parent();
        const $passwordStrengthText = $('.js-strength-indicator', $linksDialog);
        const $linksFooter = $('.links-footer', $linksDialog);
        const $copyAllLinksButton = $('button.copy.links', $linksFooter);
        const $copyAllKeysButton = $('button.copy.keys', $linksFooter);
        var $embedHeader  = $('header .embed-header', $linksDialog);
        var $embedTab = $('.embed-content', $linksDialog);
        var $embedFooter = $('footer .embed-footer', $linksDialog);
        var $options = $('.options', $linksTab);
        var $proOptions = $('.pro', $options);
        var $proOnlyLink = $('.pro-only-feature', $proOptions);
        var $setExpiryItem = $('.link-button.set-exp-date', $linksTab);
        var $removeItem = $('.link-button.remove-item', $linksTab);
        var $bottomBar = $('.links-footer', $linksDialog);
        var $datepickerInputs = $('.set-date', $linksDialog);
        var html = '';
        var $scroll = $('.links-scroll', $linksTab);
        var links;
        var toastTxt;
        var linksNum;

        // Close dialog
        if (close) {

            closeDialog();

            if (window.onCopyEventHandler) {
                document.removeEventListener('copy', window.onCopyEventHandler, false);
                delete window.onCopyEventHandler;
            }

            // Remove Datepicker dialogs
            for (var i = $datepickerInputs.length; i--;) {

                var $datepicker = $($datepickerInputs[i]).data('datepicker');

                if ($datepicker && $datepicker.inited) {
                    $datepicker.destroy();
                }
            }

            $('.datepicker.share-link-expiry-calendar', '.datepickers-container').remove();

            return true;
        }

        // Delete old Export links scrolling
        if ($scroll.is('.ps')) {
            Ps.destroy($scroll[0]);
        }

        // Generate content
        html = itemExportLink();

        // Fill with content
        if (!html.length) { // some how we dont have a link
            msgDialog('warninga', l[17564], l[17565]);
            return true;
        }
        $scroll.safeHTML(html);

        // Hide embed tab
        $('header h2', $linksDialog).removeClass('active');
        $('.preview-embed', $linksDialog).addClass('hidden');
        $embedHeader.addClass('hidden');
        $embedTab.addClass('hidden');
        $embedFooter.addClass('hidden');

        // Show Export links tab
        $linksTab.removeClass('hidden');
        $linkContent.removeClass('hidden');
        $('.dropdown.export', $linksTab).addClass('hidden');

        // Set Export links default states
        $setExpiryItem.addClass('hidden');
        $removeItem.addClass('hidden');
        $options.addClass('hidden');
        $proOptions.addClass('hidden disabled');
        $proOnlyLink.unbind('click.openpro');
        $updateSuccessBanner.addClass('hidden');
        $linksContainer.removeClass('multiple-links');
        $passwordInput.val('');
        $passwordInput.prop('readonly', false);
        $passwordStrengthText.text('');
        $passwordInputWrapper.removeClass('good1 good2 good3 good4 good5');

        // Prepare MegaInput field and hide previous errors
        mega.ui.MegaInputs($passwordInput);
        $passwordInput.data('MegaInputs').hideError();

        // Revert to off state for separate decryption key and link view
        if ($separateKeysToggle.hasClass('toggle-on')) {
            $separateKeysToggle.trigger('click');
        }

        // Revert to off state for expiry date
        if ($expiryOptionToggle.hasClass('toggle-on')) {
            exportExpiry.disableToggleAndHideExpiry();
        }

        // Revert to off state for password feature
        if ($passwordToggleSwitch.hasClass('toggle-on')) {
            exportPassword.encrypt.turnOffPasswordUI();
        }

        // Revert to default state for the password visibility 'eye' icon
        if ($passwordVisibilityToggle.hasClass('icon-eye-hidden')) {
            $passwordVisibilityToggle.trigger('click');
        }

        // Embed code handling
        var n = Object($.itemExport).length === 1 && M.d[$.itemExport[0]];

        if ($.itemExportEmbed || is_video(n) === 1 && !folderlink) {

            var link;
            var iframe = '<iframe width="%w" height="%h" frameborder="0" src="%s" allowfullscreen %a></iframe>\n';

            // Add special class to dialog
            $linksDialog.addClass('embed');

            if (mega.flags.nlfe) {
                link = getBaseUrl() + '/embed/' + n.ph + '#' + a32_to_base64(n.k);
            }
            else {
                link = getBaseUrl() + '/embed#!' + n.ph + '!' + a32_to_base64(n.k);
            }

            var setCode = function() {

                var time = 0;
                var width = 0;
                var height = 0;
                var autoplay = false;
                var muted = false;
                var optionAdded = false;
                var $time = $('.start-video-at .embed-setting', $embedTab);
                var $vres = $('.change-video-resolution .embed-setting', $embedTab);
                var $enauto = $('.enable-autoplay .checkdiv', $embedTab);
                var $muted = $('.mute-video .checkdiv', $embedTab);

                var getValue = function(s, c) {

                    var $input = $(s, c);
                    var value = String($input.val() || '').replace(/\.\d*$/g, '').replace(/\D/g, '');

                    value = parseInt(value || $input.attr('min') || '0') | 0;
                    $input.val(value);
                    return value;
                };

                time = getValue('input', $time) ? getValue('input', $time) : 0;
                const timeString = mega.icu.format(l.start_video_at_embed, time);
                const timeArray = timeString.split(/\[A]|\[\/A]/);

                $('#embed_start_at_txt_1', $embedTab).text(timeArray[0]);
                $('#embed_start_at_txt_2', $time).text(timeArray[2]);

                if (!$time.hasClass('disabled')) {
                    time = getValue('input', $time);
                    optionAdded = true;
                    const timeStringD = mega.icu.format(l.start_video_at_embed, time);
                    const timeArrayD = timeStringD.split(/\[A]|\[\/A]/);

                    $('#embed_start_at_txt_1', $embedTab).text(timeArrayD[0]);
                    $('#embed_start_at_txt_2', $time).text(timeArrayD[2]);
                }

                if (!$vres.hasClass('disabled')) {
                    width = getValue('.width-video input', $vres);
                    height = getValue('.height-video input', $vres);
                }

                if ($enauto.hasClass('checkboxOn')) {
                    autoplay = true;
                    optionAdded = true;
                }

                if ($muted.hasClass('checkboxOn')) {
                    muted = true;
                    optionAdded = true;
                }

                var code = iframe
                    .replace('%w', width > 0 && height > 0 ? width : 640)
                    .replace('%h', width > 0 && height > 0 ? height : 360)
                    .replace('%s', link + (optionAdded ? '!' : '') + (time > 0 ? time + 's' : '') +
                        (autoplay ? '1a' : '') + (muted ? '1m' : ''))
                    .replace('%a', autoplay ? 'allow="autoplay;"' : '');

                $('.code-field .code', $embedTab).text(code);
            };

            uiCheckboxes($('.settings-container', $linksDialog), function(enabled) {

                var $row = $(this).closest('.settings-row');
                var $setting = $('.embed-setting', $row);

                if (enabled) {
                    $setting.removeClass('disabled').find('input').prop('readonly', false).rebind('input', setCode);
                }
                else {
                    $setting.addClass('disabled').find('input').prop('readonly', true).off('input');
                }
                setCode();
            });

            // Reset all numeric inputs under Share Options
            $('.settings-container .embed-setting', $embedTab).addClass('disabled');
            $('.settings-container input[type=number]', $embedTab).get().forEach(function(e) {

                var $this = $(e);

                $this.val($this.attr('value'));
                $this.prop('readonly', true);
            });
            $embedHeader.removeClass('hidden');

            (function _() {

                $('header .embed-header, header .get-link', $linksDialog)
                    .removeClass('active').rebind('click.switchTab', _);

                if (this === window || $(this).is('.embed-header')) {
                    $embedHeader.addClass('active');
                    $embedTab.removeClass('hidden');
                    $embedFooter.removeClass('hidden');

                    // Hide regular Export Links footer etc
                    $linksTab.addClass('hidden');
                    $linksFooter.addClass('hidden');
                }
                else {
                    $embedTab.addClass('hidden');
                    $embedFooter.addClass('hidden');

                    // Show regular Export Links footer etc
                    $linksHeader.addClass('active');
                    $linksTab.removeClass('hidden');
                    $linksFooter.removeClass('hidden');
                }

            }).call($.itemExportEmbed ? window : {});

            $.itemExportEmbed = null;

            $('.video-filename span', $embedTab).text(n.name);
            $('.video-attributes .size', $embedTab).text(bytesToSize(n.s));
            $('.video-attributes .duration', $embedTab)
                .text(secondsToTimeShort(MediaAttribute(n).data.playtime));

            var $thumb = $('.video-thumbnail img', $embedTab).attr('src', noThumbURI);

            getImage(n, 1).then((uri) => $thumb.attr('src', uri)).catch(dump);

            $('.code-field .code', $embedTab).rebind('click.selectTxt', function() {
                selectText('embed-code-field');
                return false;
            });

            $('.preview-embed', $embedTab).rebind('click.embed', function() {

                if ($(this).text() !== l[1899]) {
                    $(this).text(l[148]);
                    $('.video-thumbnail-container', $embedTab).addClass('hidden');
                    $('.video-player-container', $embedTab).removeClass('hidden')
                        .safeHTML(iframe.replace('%s', link));
                }
                else {
                    $(this).text(l[1899]);
                    $('.video-thumbnail-container', $embedTab).removeClass('hidden');
                    $('.video-player-container', $embedTab).addClass('hidden').text('');
                }
            });

            // Let's hide it for now...
            $('.preview-embed', $embedTab).addClass('hidden');

            setCode();
        }
        else {
            // Remove special Embed class
            $linksDialog.removeClass('embed');
        }

        if ($.dialog === 'onboardingDialog') {
            closeDialog();
        }

        // Show export dialog
        M.safeShowDialog('links', function() {

            // Show dialog
            fm_showoverlay();
            $linksDialog.removeClass('hidden');

            // Init Scrolling
            Ps.initialize($scroll[0]);
            $scroll.scrollTop(0);

            return $linksDialog;
        });

        // Close dialog button
        $('button.js-close', $linksDialog).rebind('click.closeDialog', function() {
            self.linksDialog(1);
        });

        // Pluralise dialog text
        const linkCount = $.itemExport.length;
        const hasMultipleLinks = linkCount > 1;

        // Pluralise button text if applicable
        $linksHeader.text(mega.icu.format(l.share_link, linkCount));
        $removeLinkButtonText.text(hasMultipleLinks ? l[8735] : l[6821]);
        $linkAccessText.text(mega.icu.format(l.link_access_explainer, linkCount));

        // If there are multiple links showing
        if (hasMultipleLinks) {

            // Add an extra class to restyle the buttons
            $linksContainer.addClass('multiple-links');

            // Show just the Copy All button for now (until the toggle is switched on)
            $copyAllLinksButton.removeClass('hidden');
            $copyAllKeysButton.addClass('hidden');
        }
        else {
            // Otherwise hide both Copy All Links and Copy All Keys buttons
            $copyAllLinksButton.addClass('hidden');
            $copyAllKeysButton.addClass('hidden');
        }

        // Change links view: w/o keys
        $separateKeysToggle.rebind('click.changeView', function() {

            const isToggleOn = $(this).hasClass('toggle-on');
            const $separateKeysToggleIcon = $('.mega-feature-switch', $separateKeysToggle);

            // Disable toggle (e.g. for when password is showing)
            if ($separateKeysToggle.hasClass('disabled') || $passwordToggleSwitch.hasClass('toggle-on')) {
                return false;
            }

            // If there are multiple links, show the Copy All Links and Copy All Keys buttons
            if (hasMultipleLinks) {
                $copyAllLinksButton.removeClass('hidden');
                $copyAllKeysButton.removeClass('hidden');
            }
            else {
                // Otherwise keep hidden if there's only one link
                $copyAllLinksButton.addClass('hidden');
                $copyAllKeysButton.addClass('hidden');
            }

            // If toggle is already on
            if (isToggleOn) {

                // Turn the toggle off and show links as normal
                $separateKeysToggle.addClass('toggle-off').removeClass('toggle-on');
                $separateKeysToggleIcon.addClass('icon-minimise-after').removeClass('icon-check-after');
                $linkContent.removeClass('separately');

                // Hide the Copy All Keys button
                $copyAllKeysButton.addClass('hidden');

                // Log to see if "export link decryption key separately" is used much
                logExportEvt(1);
            }
            else {
                // Turn the toggle on and show the links and keys separately
                $separateKeysToggle.addClass('toggle-on').removeClass('toggle-off');
                $separateKeysToggleIcon.addClass('icon-check-after').removeClass('icon-minimise-after');
                $linkContent.addClass('separately');
            }

            // Update Link input values
            exportPassword.encrypt.updateLinkInputValues();
        });

        // Remove link/s button functionality
        $removeLinkButton.rebind('click.removeLink', (evt) => {
            if ($(evt.target).is('a')) {
                evt.preventDefault();
            }

            // Pluralise dialog text
            const msg = mega.icu.format(l.remove_link_question, linkCount);
            const cancelButtonText = l.dont_remove;
            const confirmButtonText = l['83'];

            let folderCount = 0;
            let fileCount = 0;

            // Determine number of files and folders so the dialog wording is correct
            $.itemExport.forEach((value) => {

                const node = M.d[value];

                if (node.t) {
                    folderCount++;
                }
                else {
                    fileCount++;
                }
            });

            // Use message about removal of 'items' for when both files and folders are selected
            let subMsg = l.remove_link_confirmation_mix_items;

            // Change message to folder/s or file/s depending on number of files and folders
            if (folderCount === 0) {
                subMsg = mega.icu.format(l.remove_link_confirmation_files_only, fileCount);
            }
            else if (fileCount === 0) {
                subMsg = mega.icu.format(l.remove_link_confirmation_folders_only, folderCount);
            }

            // The confirm remove link/s function
            const confirmFunction = () => {

                // Remove in "quiet" mode without overlay
                const exportLink = new mega.Share.ExportLink({ 'updateUI': true, 'nodesToProcess': $.itemExport });
                exportLink.removeExportLink(true);

                // Close the dialog as there are no more link items
                self.linksDialog(1);
            };

            // If they have already checked the Don't show this again checkbox, just remove the link/s
            if (mega.config.get('nowarnpl')) {
                confirmFunction();
                return false;
            }

            // Show confirmation dialog
            msgDialog(`*confirmation:!^${confirmButtonText}!${cancelButtonText}`, null, msg, subMsg, (res) => {
                if (res) {
                    confirmFunction();
                }
            }, 'nowarnpl');
        });

        // Copy all links/keys to clipboard
        $('button.copy', $linksDialog).rebind('click.copyToClipboard', function() {

            var $this = $(this);
            var $links = $('.item', $linksDialog);
            var $item = $this.hasClass('current') ? $this.closest('.item') : undefined;
            var pwProtectedNum = $links.filter('.password-protect-link').length;
            var mode = $this.hasClass('keys') ? 'keys' : undefined;
            var data;

            if ($this.is('.disabled')) {
                return false;
            }

            // If Copy  button locates in Embed tab
            if ($('.embed-header', $linksDialog).hasClass('active')) {
                toastTxt = l[371];
                data =  $('.code-field .code', $linksDialog).text();
            }
            else {
                // If the button copies Keys only
                if (mode) {
                    linksNum = $item ? 1 : $links.length - pwProtectedNum;
                    toastTxt = mega.icu.format(l.toast_copy_key, linksNum);
                }
                else {
                    linksNum = $item ? 1 : $links.length;
                    toastTxt = mega.icu.format(l.toast_copy_link, linksNum);
                }

                // Set toast notification and data to copy
                data = $.trim(getClipboardLinks($item, mode));
            }

            // Copy to clipboard
            copyToClipboard(data, toastTxt, null, 2000);

            return false;
        });

        // Init FREE export links events
        const initFreeEvents = () => {

            // Add click event to Remove link dropdown item
            $removeItem.rebind('click.removeLink', (e) => {

                const $bottomBar = $('footer', this.$dialog);
                const $selectedLink = $('.item.selected', $linksTab);
                const handle = $selectedLink.data('node-handle');
                let $items;
                let itemsLength;

                // Create Remove link function
                var removeLink = function() {

                    // New export link
                    var exportLink = new mega.Share.ExportLink({'updateUI': true, 'nodesToProcess': [handle]});

                    // Remove link in "quite" mode without overlay
                    exportLink.removeExportLink(true);

                    // Remove Link item from DOM
                    $selectedLink.remove();

                    if (M.d[handle].t) {
                        $.exportFolderLinks--;
                    }
                    else {
                        $.exportFileLinks--;
                    }

                    // Update Export links scrolling
                    if ($scroll.is('.ps')) {
                        Ps.update($scroll[0]);
                    }

                    // Get link items length
                    $items = $('.item', $linksTab);
                    itemsLength = $items.length;

                    // Close the dialog If there is no link items
                    if (itemsLength < 1) {
                        self.linksDialog(1);
                        return false;
                    }

                    // Update Password buttons and links UI
                    exportPassword.encrypt.updatePasswordComponentsUI();

                    // Update common Set Expiry Date button
                    exportExpiry.updateDatepickerAndTextInput();
                };

                // Show confirmartion dialog if handle is media
                if (is_video(M.d[handle]) === 1) {
                    msgDialog('confirmation', l[882], l[17824], 0, function(e) {
                        if (e) {
                            removeLink();
                        }
                    });
                }
                else {
                    removeLink();
                }

                // Log to see if Remove link is used much
                logExportEvt(6, e.currentTarget);
            });

            // Click anywhere in Export link dialog to hide dropdown
            $linksDialog.rebind('click.closeDropdown', function(e) {

                var $target = $(e.target);
                var $dropdown = $('.dropdown.export', $linksTab);

                if (!$target.is('.dropdown.export') && !$target.is('.cog')
                    && !$dropdown.is('.hidden')) {

                    // Enable scrolling
                    Ps.enable($scroll[0]);

                    // Close dropdown
                    $dropdown.addClass('hidden');
                }
            });

            // Set buttons default states, init events if available
            exportExpiry.init();
            exportPassword.encrypt.init();
        };

        // Init PRO events links events
        const initProEvents = () => {

            const $calendarInputs = $('.set-date', $linksDialog);

            // Log to see if "Set an expiry date" is clicked much
            $calendarInputs.rebind('mousedown.logClickEvt', (e) => logExportEvt(2, e.currentTarget));

            // Log to see if Expiry date is set much
            $calendarInputs.rebind('change.logDateChange', (e) => logExportEvt(3, e.currentTarget));

            // Log to see if "Set password" is clicked much
            $('button.password', $linksTab).rebind('click.logClickEvt', (e) => logExportEvt(4, e.currentTarget));
        };

        // Show and init options
        if (page === 'download') {

            // Show options/features
            $options.removeClass('hidden');

            // Hide certain blocks not applicable for download page
            $separateKeysBlock.addClass('hidden');
            $removeLinkButton.addClass('hidden');

            return false;
        }
        else if (folderlink) {

            // Show options/features
            $options.removeClass('hidden');

            // Hide certain blocks not applicable for download page
            $removeLinkButton.addClass('hidden');
        }
        // Init FREE options
        else if (!u_attr.p) {

            // Show options/features
            $options.removeClass('hidden');
            $proOptions.removeClass('hidden');
            $removeItem.removeClass('hidden');

            // On PRO options click, go to the Pro page
            $proOnlyLink.rebind('click.openpro', () => {
                open(getAppBaseUrl() + '#pro');
            });

            // Init FREE events
            initFreeEvents();
        }
        // Init PRO options
        else if (u_attr.p) {

            // Enable PRO options
            $options.removeClass('hidden');
            $proOptions.removeClass('hidden disabled');

            // Show PRO menu items
            $removeItem.removeClass('hidden');
            $setExpiryItem.removeClass('hidden');

            // Init FREE and PRO events
            initFreeEvents();
            initProEvents();
        }

        // If not on the embed dialog
        if (!$('.embed-header', $linksDialog).hasClass('active')) {

            // Set data and toast message 'Link/s created and copied to your clipboard'
            const $items = $('.item', $linksDialog);
            const data = $.trim(getClipboardLinks($items));
            const toastText = mega.icu.format(l.toast_link_created_and_copied, $items.length);

            // Copy to clipboard
            copyToClipboard(data, toastText, null, 2000);
        }
    };


    // ------------------------------------
    // ----- PRIVATE FUNCTIONS FOLLOW -----
    // ------------------------------------


    /**
     * getClipboardLinks
     *
     * Gether all available public links for selected items (files/folders).
     * @returns {String} links URLs or decryption keys for selected items separated with newline '\n'.
     * @param {Object} $items Links selector
     * @param {String} mode Contains View mode name: Show links w/o keys
     */
    function getClipboardLinks($items, mode) {

        "use strict";

        var links = [];
        var $dialog = $('.mega-dialog.export-links-dialog', 'body');

        if (!$items) {
            $items = $('.item', $dialog);
        }

        // Otherwise add all regular links
        $items.get().forEach(function(e) {

            var nodeUrlWithPublicHandle = $('.link input', e).val();
            var nodeDecryptionKey = $('.key input', e).val();

            // Check export/public link dialog drop down list selected option
            if (mode === 'keys' && !$(this).hasClass('password')) {
                if (nodeDecryptionKey) {
                    links.push(nodeDecryptionKey);
                }
            }
            else {
                links.push(nodeUrlWithPublicHandle);
            }
        });

        return links.join("\n");
    }

    /**
     * itemExportLinkHtml
     *
     * @param {Object} item
     * @returns {String}
     * @private
     */
    function itemExportLinkHtml(item) {
        "use strict";
        var key;
        var type;
        var fileSize;
        var html = '';
        var nodeHandle = item.h;
        var fileUrlKey;
        var fileUrlWithoutKey;
        var fileUrlNodeHandle = '';
        let hideSeparatorClass = '';
        let folderContents = '';

        if (folderlink) {
            if (item.foreign) {
                if (item.pfid) {
                    fileUrlWithoutKey = `${getBaseUrl()}/folder/${item.pfid}`;
                    fileUrlKey = `#${item.pfkey}`;
                    fileUrlNodeHandle = (item.t ? '/folder/' : '/file/') + item.h;
                }
                key = item.k;
            }
            else if (mega.flags.nlfe) {
                fileUrlWithoutKey = getBaseUrl() + '/folder/' + pfid;
                fileUrlKey = '#' + pfkey;
                fileUrlNodeHandle = (item.t ? '/folder/' : '/file/') + item.h;
            }
            else {
                fileUrlWithoutKey = getBaseUrl() + '/#F!' + pfid;
                fileUrlKey = '!' + pfkey;
                fileUrlNodeHandle = (item.t ? '!' : '?') + item.h;
            }
            fileSize = item.s && bytesToSize(item.s) || '';

            // Hide the | separator after the folder name
            hideSeparatorClass = ' hide-separator';
        }
        else if (item.t) {
            // Shared item type is folder
            key = u_sharekeys[item.h] && u_sharekeys[item.h][0];

            // folder key must exit, otherwise skip
            if (!key) {
                return '';
            }

            type = 'F';
            fileSize = '';

            const numFolders = M.d[nodeHandle].td;
            const numFiles = M.d[nodeHandle].tf;

            // If there are at least a file or subfolder
            if (numFolders > 0 || numFiles > 0) {
                const folderWording = mega.icu.format(l.folder_count, numFolders);
                const fileWording = mega.icu.format(l.file_count, numFiles);

                // Set wording to x folder/s . x file/s
                folderContents = folderWording + ' \u22C5 ' + fileWording;
            }
            else {
                // Hide the | separator after the folder name because there are no subfolders or files
                hideSeparatorClass = ' hide-separator';
            }
        }
        else {
            // Shared item type is file
            type = '';
            key = item.k;
            fileSize = bytesToSize(item.s);
        }

        if (!fileUrlWithoutKey) {
            if (mega.flags.nlfe) {
                fileUrlWithoutKey = (getBaseUrl() + (type ? '/folder/' : '/file/') + htmlentities(item.ph));
            }
            else {
                fileUrlWithoutKey = (getBaseUrl() + '/#' + type + '!' + htmlentities(item.ph));
            }
        }

        if (!fileUrlKey) {
            if (mega.flags.nlfe) {
                fileUrlKey = (key ? '#' + a32_to_base64(key) : '');
            }
            else {
                fileUrlKey = (key ? '!' + a32_to_base64(key) : '');
            }
        }

        html = '<div class="item" data-node-handle="' + nodeHandle + '">'
             +      '<div class="icons">'
             +          '<i class="sprite-fm-theme icon-settings cog"></i>'
             +          '<i class="sprite-fm-uni icon-lock lock hidden"></i>'
             +          '<i class="sprite-fm-uni icon-calendar calendar vo-hidden">'
             +              '<input type="text" data-node-handle="' + nodeHandle + '">'
             +          '</i>'
             +      '</div>'
             +      '<div class="item-type-icon icon-' + fileIcon(item) + '-24" ></div>'
             +      '<div class="item-title selectable-txt">' + htmlentities(item.name) + '</div>'
             +      '<div class="item-size' + hideSeparatorClass + '">'
             +          htmlentities(fileSize) + htmlentities(folderContents)
             +      '</div>'
             +      '<div class="clear"></div>'
             +      '<div class="item-link link">'
             +          '<div class="input-wrap">'
             +              '<i class="sprite-fm-mono icon-link chain"></i>'
             +              '<input type="text" data-link="' + fileUrlWithoutKey + '" data-key="'
             +                  fileUrlKey + fileUrlNodeHandle + '" '
             +                  'value="' + fileUrlWithoutKey + fileUrlKey + fileUrlNodeHandle + '" readonly>'
             +          '</div>'
             +          '<button class="mega-button positive copy current">'
             +              '<span>'
             +                  l[1394]
             +              '</span>'
             +          '</button>'
             +      '</div>'
             +      '<div class="item-link key">'
             +          '<div class="input-wrap">'
             +              '<i class="sprite-fm-mono icon-key key"></i>'
             +              '<input type="text" data-key="' + fileUrlKey.substring(1) + fileUrlNodeHandle + '" value="'
             +              fileUrlKey.substring(1) + fileUrlNodeHandle + '" readonly>'
             +          '</div>'
             +          '<button class="mega-button positive copy current keys">'
             +              '<span>'
             +                  l[17386]
             +              '</span>'
             +          '</button>'
             +      '</div>'
             +      '<div class="clear"></div>'
             +  '</div>';

        return html;
    }

    /**
     * generates file url for shared item
     *
     * @returns {String} html
     * @private
     */
    function itemExportLink() {

        "use strict";

        var html = '';

        $.exportFolderLinks = 0;
        $.exportFileLinks = 0;

        $.each($.itemExport, function(index, value) {

            var node = M.d[value];

            if (node && (folderlink || node.ph)) {
                html += itemExportLinkHtml(node);
            }

            if (node.t) {
                $.exportFolderLinks++;
            }
            else {
                $.exportFileLinks++;
            }
        });

        return html;
    }

    // export
    scope.mega = scope.mega || {};
    scope.mega.Dialog = scope.mega.Dialog || {};
    scope.mega.Dialog.ExportLink = ExportLinkDialog;

})(jQuery, window);


(function($, scope) {
    'use strict';

    const broadcast = (handle) => {
        console.assert($.getExportLinkInProgress === 'ongoing');

        if ($.getExportLinkOngoing
            && $.getExportLinkOngoing.length) {

            $.getExportLinkOngoing.pop().resolve(handle);
        }
        else {
            queueMicrotask(() => {
                mBroadcaster.sendMessage('export-link:completed', handle);
            });
            $.getExportLinkOngoing = false;
            $.getExportLinkInProgress = false;
        }
    };

    // hold concurrent/ongoing share-link operations.
    const ongoing = async() => {
        const {promise} = mega;

        assert($.getExportLinkInProgress);

        if ($.getExportLinkOngoing) {
            $.getExportLinkOngoing.push(promise);
        }
        else {
            $.getExportLinkOngoing = [promise];
        }

        return promise;
    };

    /**
     * ExportLink related operations.
     *
     * @param opts {Object}
     *
     * @constructor
     */
    var ExportLink = function(opts) {

        var self = this;

        var defaultOptions = {
            'updateUI': false,
            'nodesToProcess': [],
            'showExportLinkDialog': false
        };

        self.options = $.extend(true, {}, defaultOptions, opts);

        // Number of nodes left to process
        self.nodesLeft = self.options.nodesToProcess.length;
        self.logger = MegaLogger.getLogger('ExportLink');
    };

    /**
     * Get public link for file or folder.
     */
    ExportLink.prototype.getExportLink = async function(quiet) {

        var nodes = this.options.nodesToProcess || false;

        if (!nodes.length) {
            return this.logger.warn('No nodes provided to export...', this);
        }

        // @todo FIXME those events must be fired when the operation actually succeed.
        const eventlog = quiet ? nop : SoonFc(888, (eid) => window.eventlog(eid));

        // Add some logging for usage comparisons
        if (page === 'download') {
            eventlog(99683); // Share public link on downloads page.
        }
        else if (folderlink) {
            eventlog(99715); // Share public link from folder-link.

            // Return nothing for mobile as the link overlay will be shown
            if (is_mobile) {
                return;
            }

            var exportLinkDialog = new mega.Dialog.ExportLink();
            return exportLinkDialog.linksDialog();
        }
        else if (is_mobile) {
            eventlog(99634); // Created public link on mobile webclient
        }
        else {
            eventlog(99635); // Created public link on regular webclient
        }

        if ($.getExportLinkInProgress) {
            if (d) {
                this.logger.warn('Ongoing link-export, holding...', nodes);
            }

            await ongoing();
        }

        if (d) {
            console.group('--- get export link', nodes);
        }

        console.assert(!$.getExportLinkInProgress || $.getExportLinkInProgress === 'ongoing');

        $.getExportLinkInProgress = nodes;

        const promises = [];
        for (var i = 0; i < nodes.length; i++) {
            var h = nodes[i];
            var n = M.d[h];

            if (n) {
                if (n.t) {
                    promises.push(this._getFolderExportLinkRequest(h));
                }
                else {
                    promises.push(this._getExportLinkRequest(h));
                }
            }
            else {
                this.logger.warn('Invalid node to export...', h);
            }
        }

        return Promise.all(promises)
            .finally(() => {

                return d && console.groupEnd();
            });
    };

    /**
     * Removes public link for file or folder.
     * @param {Boolean} [quiet] No loading overlay
     * @param {String} handle The node handle which to remove
     * @returns {MegaPromise}
     */
    ExportLink.prototype.removeExportLink = function(quiet, handle) {

        if (M.isInvalidUserStatus()) {
            return Promise.reject(EINTERNAL);
        }

        var self = this;
        var promises = [];
        var handles = self.options.nodesToProcess || handle || [];

        if (handles.length) {
            self.logger.debug('removeExportLink');

            for (let i = handles.length; i--;) {
                const h = handles[i];
                const n = M.d[h];

                if (n) {
                    if (n.t) {
                        promises.push(self._removeFolderExportLinkRequest(h, quiet));
                    }
                    else {
                        promises.push(self._removeFileExportLinkRequest(h, quiet));
                    }
                }
                else if (d) {
                    console.warn('removeExportLink: node not found.', h);
                }
            }
        }

        if (!promises.length) {
            return Promise.reject(EARGS);
        }

        return Promise.allSettled(promises);
    };

    /**
     * A 'Private' function, send folder public link delete request.
     * @param {String} nodeId The node ID.
     */
    ExportLink.prototype._getFolderExportLinkRequest = function(nodeId) {
        var share = M.getNodeShare(nodeId);

        // No need to perform an API call if this folder was already exported (Ie, we're updating)
        if (share.h === nodeId) {
            if (!M.d[nodeId].t || u_sharekeys[nodeId]) {
                return this._getExportLinkRequest(nodeId);
            }

            if (d) {
                console.warn('Missing sharekey for "%s" - relying on s2 to obtain it...', nodeId);
            }
        }

        // Get all child nodes of root folder with nodeId
        return api_setshare(nodeId, [{u: 'EXP', r: 0}])
            .then((result) => {
                if (!result.r || result.r[0] !== 0) {
                    throw result;
                }

                return this._getExportLinkRequest(nodeId);

            })
            .catch((ex) => {
                this.logger.warn(`Get folder link failed: ${ex}`, ex);
                throw ex;
            });
    };

    /**
     * A 'Private' function, send public get-link request.
     * @param {String} nodeId The node ID.
     */
    ExportLink.prototype._getExportLinkRequest = async function(nodeId) {

        const done = (handle) => {
            this.logger.warn('share-link progress...', this.nodesLeft, handle);

            if (!--this.nodesLeft) {
                if (this.options.showExportLinkDialog) {
                    var exportLinkDialog = new mega.Dialog.ExportLink();
                    exportLinkDialog.linksDialog();
                }

                console.assert($.getExportLinkInProgress);
                if ($.getExportLinkInProgress) {
                    $.getExportLinkInProgress = 'ongoing';

                    broadcast(handle);
                }
            }

            // A hook for the mobile web to show the link icon
            if (is_mobile) {
                mobile.cloud.updateLinkIcon(nodeId);
            }

            return handle;
        };
        var share = M.getNodeShare(nodeId);
        var request = { a: 'l', n: nodeId, i: requesti };

        if (d) {
            console.debug('_getExportLinkRequest', share.ph, Object(M.d[nodeId]).ph, share);
        }

        // No need to perform an API call if this file was already exported (Ie, we're updating)
        if (share.h === nodeId && Object(M.d[nodeId]).ph) {
            return done(nodeId);
        }

        // If the Expiry Timestamp (ets) is already set locally, resend in the request or it gets removed
        if (share.ets) {
            request.ets = share.ets;
        }

        return api.screq(request)
            .then(({handle}) => done(handle))
            .catch((ex) => {
                done(null);
                throw ex;
            });
    };

    /**
     * A 'Private' function, send folder delete public link request.
     * @param {String} nodeId The node ID.
     * @param {Boolean} [quiet] No loading overlay
     * @returns {MegaPromise}
     */
    ExportLink.prototype._removeFolderExportLinkRequest = function(nodeId, quiet) {

        return api.screq({a: 's2', n: nodeId, s: [{u: 'EXP', r: ''}], ha: ''})
            .then(({result}) => {
                if (!result.r || result.r[0] !== 0) {
                    if (d) {
                        this.logger.error('removeFolderExportLinkRequest failed for node %s', nodeId, result);
                    }
                    throw result;
                }
                console.assert(!M.su || !M.su.EXP || !M.su.EXP[nodeId], 'Invalid state..');
            });
    };

    /**
     * A 'Private' function, send file delete public link request.
     * @param {String} nodeId The node IDs.
     * @param {Boolean} [quiet] No loading overlay
     * @returns {MegaPromise}
     */
    ExportLink.prototype._removeFileExportLinkRequest = function(nodeId, quiet) {

        return api.screq({a: 'l', n: nodeId, d: 1})
            .then(({result}) => {
                if (result !== 0) {
                    if (d) {
                        this.logger.warn('removeFileExportLinkRequest failed for node %s', nodeId, result);
                    }
                    throw result;
                }
            });
    };

    /**
     * Returns true in case that any of checked items is taken down, otherwise false
     * @param {Array|String} [nodes] Array of nodes (handles/objects)
     * @returns {Boolean}
     */
    ExportLink.prototype.isTakenDown = function(nodes) {

        if (nodes) {
            if (!Array.isArray(nodes)) {
                nodes = [nodes];
            }
        }
        else {
            nodes = self.options.nodesToProcess;
        }

        for (var i = nodes.length; i--;) {
            var node = nodes[i];

            if (typeof node !== 'object') {
                node = M.getNodeByHandle(node);
            }

            if (node.t & M.IS_TAKENDOWN || M.getNodeShare(node).down === 1) {
                return true;
            }
        }

        return false;
    };

    /**
     * Shows the copyright warning dialog.
     *
     * @param {Array} nodesToProcess Array of strings, node ids
     * @param {*} [isEmbed] Whether we're opening the dialog with the embed-code tab focused.
     * @param {Function} [openFn] Custom callback to invoke instead of the default one
     */
    const initCopyrightsDialog = function(nodesToProcess, isEmbed, openFn) {

        if (M.isInvalidUserStatus()) {
            return;
        }

        $.itemExportEmbed = isEmbed;
        $.itemExport = nodesToProcess;

        const openGetLinkDialog = openFn || (() => {

            var exportLink = new mega.Share.ExportLink({
                'showExportLinkDialog': true,
                'updateUI': true,
                'nodesToProcess': nodesToProcess
            });

            exportLink.getExportLink();
        });

        // If they've already agreed to the copyright warning (cws = copyright warning shown)
        if (M.agreedToCopyrightWarning()) {
            // Go straight to Get Link dialog
            openGetLinkDialog();
            return false;
        }

        // Cache selector
        var $copyrightDialog = $('.copyrights-dialog');

        if ($.dialog === 'onboardingDialog') {
            closeDialog();
        }
        // Otherwise show the copyright warning dialog
        M.safeShowDialog('copyrights', function() {

            $.copyrightsDialog = 'copyrights';

            return $copyrightDialog;
        });

        // Init click handler for 'I disagree' button: User disagrees with copyright warning
        $('button.cancel', $copyrightDialog).rebind('click.disagreeAction', closeDialog);

        // Init click handler for 'I agree'
        $('button.accept', $copyrightDialog).rebind('click.agreeAction', function() {
            closeDialog();

            // User agrees, store flag so they don't see it again
            mega.config.set('cws', 1);

            // Go straight to Get Link dialog
            openGetLinkDialog();
        });

        // Init click handler for 'Close' button
        $('button.js-close', $copyrightDialog).rebind('click.closeDialog', closeDialog);
    };

    Object.defineProperty(ExportLink, 'pullShareLink', {
        value(handles, quiet, options) {

            if (typeof quiet === 'object') {
                options = quiet;
                quiet = false;
            }

            const exportLink = new ExportLink({
                nodesToProcess: Array.isArray(handles) ? handles : [handles],
                ...options
            });
            return exportLink.getExportLink(quiet);
        }
    });

    // export
    scope.mega = scope.mega || {};
    scope.mega.Share = scope.mega.Share || {};
    scope.mega.Share.ExportLink = ExportLink;
    scope.mega.Share.initCopyrightsDialog = initCopyrightsDialog;
})(jQuery, window);


(function($, scope) {
    /**
     * UI Public Link Icon related operations.
     *
     * @param opts {Object}
     *
     * @constructor
     */
    var UiExportLink = function(opts) {

        "use strict";

        this.logger = MegaLogger.getLogger('UiExportLink');
    };

    /**
     * addExportLinkIcon
     *
     * Add public link icon to file or folder
     * @param {String} nodeId
     */
    UiExportLink.prototype.addExportLinkIcon = function(nodeId) {

        "use strict";

        var self = this;
        var $nodeId = $('#' + nodeId);
        var $tree = $('#treea_' + nodeId).add('#treea_os_' + nodeId).add('#treea_pl_' + nodeId);

        // eslint-disable-next-line sonarjs/no-collapsible-if
        if ($nodeId.length === 0 && !String(M.currentdirid).includes('chat')) {

            // not inserted in the DOM, retrieve the nodeMap cache and update that DOM node instead.
            if (M.megaRender && M.megaRender.hasDOMNode(nodeId)) {
                $nodeId = $(M.megaRender.getDOMNode(nodeId));
            }
        }

        if (!$nodeId.length && !$tree.length) {
            self.logger.warn('No DOM Node matching "%s"', nodeId);

            return false;
        }

        if (d) {
            this.logger.debug('addExportLinkIcon', nodeId);
        }

        $nodeId.addClass('linked');

        if ($tree.length) {

            // Add link-icon to left panel
            $tree.addClass('linked');
        }
    };

    /**
     * Remove public link icon to file or folder
     * @param {String} nodeId
     */
    UiExportLink.prototype.removeExportLinkIcon = function(nodeId) {

        "use strict";

        var $node = $('#' + nodeId);

        if ($node.length === 0) {
            // not inserted in the DOM, retrieve the nodeMap cache and update that DOM node instead.
            if (M.megaRender && M.megaRender.hasDOMNode(nodeId)) {
                $node = $(M.megaRender.getDOMNode(nodeId));
            }
        }

        // Remove link icon from list view
        $node.removeClass('linked').find('.own-data').removeClass('linked');

        // Remove link icon from grid view
        $node.filter('.data-block-view').removeClass('linked');

        // Remove link icon from left panel
        $('#treeli_' + nodeId + ' > span').removeClass('linked');
    };

    /**
     * Updates grid and block (file) view, removes favorite icon if exists and adds .taken-down class.
     * @param {String} nodeId
     * @param {Boolean} isTakenDown
     */
    UiExportLink.prototype.updateTakenDownItem = function(nodeId, isTakenDown) {

        "use strict";

        var self = this;

        if (isTakenDown) {
            if (M.d[nodeId].fav === 1) {

                // Remove favourite (star)
                M.favourite(nodeId, 0);
            }
            self.addTakenDownIcon(nodeId);
        }
        else {
            self.removeTakenDownIcon(nodeId);
        }
    };

    /**
     * Add taken-down icon to file or folder
     * @param {String} nodeId
     */
    UiExportLink.prototype.addTakenDownIcon = function(nodeId) {

        "use strict";

        var titleTooltip = '';
        var $element;

        // Add taken-down to list view
        $element = $('.grid-table.fm #' + nodeId).addClass('taken-down');
        $('.grid-status-icon', $element).removeClass('icon-dot icon-favourite-filled').addClass('icon-takedown');

        // Add taken-down to block view
        $element = $('#' + nodeId + '.data-block-view').addClass('taken-down');
        $('.file-status-icon', $element).removeClass('icon-favourite-filled').addClass('icon-takedown');

        if (M.megaRender && M.megaRender.nodeMap && M.megaRender.nodeMap[nodeId]) {
            $(M.megaRender.nodeMap[nodeId]).addClass('take-down');
        }
        // Add taken-down to left panel
        $element = $('#treea_' + nodeId).addClass('taken-down');
        $('.file-status-ico', $element).removeClass('icon-link-small').addClass('icon-takedown');

        // Add title, mouse popup
        if (M.d[nodeId].t === 1) {// Item is folder

            titleTooltip = l[7705];

            // Undecryptable node indicators
            if (missingkeys[nodeId]) {
                titleTooltip += '\n' + M.getUndecryptedLabel(M.d[nodeId]);
            }

            $('.grid-table.fm #' + nodeId).attr('title', titleTooltip);
            $('#' + nodeId + '.data-block-view').attr('title', titleTooltip);
        }
        else {// Item is file

            titleTooltip = l[7704];

            // Undecryptable node indicators
            if (missingkeys[nodeId]) {
                titleTooltip += '\n' + M.getUndecryptedLabel(M.d[nodeId]);
            }

            $('.grid-table.fm #' + nodeId).attr('title', titleTooltip);
            $('#' + nodeId + '.data-block-view').attr('title', titleTooltip);
        }
    };

    /**
     * Remove taken-down icon from file or folder
     * @param {String} nodeId
     */
    UiExportLink.prototype.removeTakenDownIcon = function(nodeId) {

        "use strict";

        if (M.megaRender && M.megaRender.hasDOMNode(nodeId)) {
            $(M.megaRender.getDOMNode(nodeId)).removeClass('take-down');
        }

        var $element;

        // Add taken-down to list view
        $element = $('.grid-table.fm #' + nodeId).removeClass('taken-down');
        $('.grid-status-icon', $element).removeClass('icon-takedown');

        // Add taken-down to block view
        $element = $('#' + nodeId + '.data-block-view').removeClass('taken-down');
        $('.file-status-icon', $element).removeClass('icon-takedown');

        // Add taken-down to left panel
        $element = $('#treea_' + nodeId).removeClass('taken-down');
        $('.file-status-ico', $element).removeClass('icon-takedown');

        // Remove title, mouse popup
        $('.grid-table.fm #' + nodeId).attr('title', '');
        $('#' + nodeId + '.data-block-view').attr('title', '');
    };

    // export
    scope.mega = scope.mega || {};
    scope.mega.UI = scope.mega.UI || {};
    scope.mega.UI.Share = scope.mega.UI.Share || {};
    scope.mega.UI.Share.ExportLink = UiExportLink;
})(jQuery, window);

/** Export Link as string **/
(function($, scope) {
    'use strict';

    scope.getPublicNodeExportLink = function(node) {

        var fileUrlWithoutKey;
        var type;

        if (folderlink) {
            fileUrlWithoutKey = getBaseUrl() + '/#F!' + pfid + (node.t ? '!' : '?') + node.h;
        }
        else if (node.t) {
            type = 'F';
        }
        else {
            // Shared item type is file
            type = '';
        }

        return fileUrlWithoutKey || (getBaseUrl() + '/#' + type + '!' + htmlentities(node.ph));
    };

})(jQuery, mega);

/** Initialise they keys required for operation. */
function init_key() {
    if (typeof u_k_aes === 'undefined') {
        return loadSubPage('start');
    }
    $('.key1').addClass('hidden');
    $('.key2').removeClass('hidden');

    if (typeof u_privk === 'undefined') {
        crypto_rsagenkey();
    }
    else {
        ui_keycomplete();
    }
}

/** Callback called on completion. */
function ui_keycomplete() {
    $('.key1').addClass('hidden');
    $('.key2').addClass('hidden');
    $('.key3').removeClass('hidden');

    // Sets the "Hide Recent Activity" toggle in Settings to `OFF` by default
    mBroadcaster.once('fm:initialized', () => {
        // The value for `showRecents` is `undefined` when toggle is `ON`
        mega.config.set('showRecents', 1);
    });

    if ((typeof (u_attr.p) !== 'undefined') && (u_attr.p >= 1 && u_attr.p <= 4)) {
        loadSubPage('fm');
    }
    else {
        localStorage.keycomplete = true;
        sessionStorage.signinorup = 2;

        // If mobile, log to see how many registrations are completed on mobile and load the cloud drive
        if (is_mobile) {

            // Check if they actually started the registration process on mobile web
            if (localStorage.signUpStartedInMobileWeb) {

                // Remove the flag as it's no longer needed and send a stats log
                localStorage.removeItem('signUpStartedInMobileWeb');
                api_req({ a: 'log', e: 99639, m: 'Started and completed registration on mobile webclient' });
            }
            else {
                // Otherwise they just completed sign up on the mobile web and may have started it on a mobile app
                api_req({ a: 'log', e: 99627, m: 'Completed registration on mobile webclient' });
            }
        }
        else {
            // Otherwise log to see how many registrations are completed on regular webclient
            api_req({ a: 'log', e: 99628, m: 'Completed registration on regular webclient' });
        }

        // if this is a sub-user in a business account.
        // either This is the master  --> wont get the confirmation link until we receive successful payment
        // or, this is a sub-user --> no need to ask them anything after this point
        if (u_attr && u_attr.b) {
            if (page === 'fm') {
                loadSubPage('start');
            }
            else {
                loadSubPage('fm');
            }
        }
        else {
            onIdle(function() {
                authring.initAuthenticationSystem();
            });
            // Load the Pro page to choose plan, or the redeem page if a pending voucher is found.
            loadSubPage(localStorage.voucher ? 'redeem' : 'pro');
        }
    }
}

(function($) {
    'use strict';

    /**
     * Super simple, performance-wise and minimal tooltip utility.
     * This "tooltip tool" saves on DOM nodes and event handlers, since it:
     * 1) Uses delegates, so 1 event handler for unlimited amount of dynamically added tooltips in the UI. #performance
     * 2) Does not require extra DOM elements (e.g. total # of DOM elements < low = performance improvement)
     * 3) Its clever enough to reposition tooltips properly, w/o adding extra dependencies (except for jQuery UI, which
     * we already have), e.g. better then CSS :hover + .tooltip { display: block; }
     * 4) It supports dynamic content updates, based on the current state of the control -- for example, when
     * interacting with given control, the tooltip content may automatically re-render, e.g. `Mute` -> `Unmute`.
     * 5) Its minimal. < 200 lines of code.
     *
     * Note: Uses jQuery UI's position() to position the tooltip on top or bottom, if out of viewport. By default -
     * would, try to position below the target element.
     */

    /**
     * How to use:
     * 1) Add "simpletip" class name to any element in the DOM
     * 2) To set the content of the tooltip, pass an attribute w/ the text named `data-simpletip`
     * Example:
     * ```<a href="#" class="simpletip" data-simpletip="Hello world!">Mouse over me</a>```
     * or setting optional classname `simpletip-tc` on the element without data attribute to simply using text contents
     * ```<a href="#" class="simpletip simpletip-tc">Mouse over me</a>```
     *
     * Optionally, you can control:
     * A) The wrapper in which the tooltip should try to fit in (and position on top/bottom, depending on whether there
     * is enough space) by passing a selector that matches a parent of the element in attribute named
     * `data-simpletipwrapper`
     * Example:
     * ```<a href="#" class="simpletip" data-simpletip="Hey!" data-simpletipwrapper="#call-block">Mouse over me</a>```
     *
     * B) Change the default position to be "above" (top) of the element, instead of bottom/below by passing attribute
     * `data-simpletipposition="top"`
     * Example:
     * ```<a href="#" class="simpletip" data-simpletip="Hey! Show on top, if I fit"
     *      data-simpletipposition="top">Mouse over me</a>```
     * The tooltip can also be placed to the "left", "right", or can detect the direction using "start" and "end".
     *
     * C) Manually add extra top/bottom offset by passing `data-simpletipoffset="10"`
     * Example:
     * ```<a href="#" data-simpletip="Hey! +/-20px offset for this tip." data-simpletipoffset="20">Mouse over me</a>```
     *
     * D) Add any custom styling to tooltip by adding style class e.g. .medium-width for max-width: 220px;,
     * .center-align for text-align: center;
     * Example:
     * ```
     *    <a href="#" data-simpletip="Hey! custom style." data-simpletip-class="medium-width center-align">
     *        Mouse over me
     *    </a>
     * ```
     *
     * E) Add any custom class to tooltip by `data-simpletip-class='custom-class'`
     * Example:
     * ```<a href="#" data-simpletip="Hey! custom class" data-simpletip-class='small-tip'>Mouse over me</a>```
     *
     * How to trigger content update:
     * 1) Create new instance of the simpletip that contains conditional `data-simpletip` attribute.
     * ```<a href="#" data-simpletip={condition ? 'Mute' : 'Unmute' }></a>```
     * 2) On state update, invoke `simpletipUpdated` event trigger on the `.simpletip` element.
     * ```$('.simpletip').trigger('simpletipUpdated');```
     *
     * How to trigger manual unmount:
     * On state update, invoke `simpletipClose` event trigger on the `.simpletip` element.
     * ```$('.simpletip').trigger('simpletipClose');```
     */

    var $template = $(
        '<div class="dark-direct-tooltip simpletip-tooltip">' +
        '<i class="sprite-fm-mono icon-tooltip-arrow tooltip-arrow"></i>' +
        '<span></span>' +
        '</div>'
    );

    const $breadcrumbs = $(
        '<div class="fm-breadcrumbs-wrapper info">' +
            '<div class="crumb-overflow-link dropdown">' +
                '<a class="breadcrumb-dropdown-link info-dlg">' +
                    '<i class="menu-icon sprite-fm-mono icon-options icon24"></i>' +
                '</a>' +
                '<i class="sprite-fm-mono icon-arrow-right icon16"></i>' +
            '</div>' +
            '<div class="fm-breadcrumbs-block"></div>' +
            '<div class="breadcrumb-dropdown"></div>' +
        '</div>'
    );

    var $currentNode;
    var $currentTriggerer;
    var SIMPLETIP_UPDATED_EVENT = 'simpletipUpdated.internal';
    var SIMPLETIP_CLOSE_EVENT = 'simpletipClose.internal';

    var sanitize = function(contents) {
        return escapeHTML(contents).replace(/\[BR\]/g, '<br>')
            .replace(/\[I class=&quot;([\w- ]*)&quot;]/g, `<i class="$1">`)
            .replace(/\[I]/g, '<i>').replace(/\[\/I]/g, '</i>')
            .replace(/\[B\]/g, '<b>').replace(/\[\/B\]/g, '</b>')
            .replace(/\[U]/g, '<u>').replace(/\[\/U]/g, '</u>')
            .replace(/\[G]/g, '<span class="gray-text">')
            .replace(/\[\/G]/g, '</span>')
            .replace(/\[A]/g, '<a>')
            .replace(/\[\/A]/g, '</a>');
    };

    var unmount = function() {
        if ($currentNode) {
            $currentNode.remove();
            $currentNode = null;
            $currentTriggerer.unbind(SIMPLETIP_UPDATED_EVENT);
            $currentTriggerer.unbind(SIMPLETIP_CLOSE_EVENT);
            $currentTriggerer = null;
        }
    };

    const calculateOffset = (info, $this) => {
        let topOffset = 0;
        let leftOffset = 0;
        let offset = 7;      // 7px === height of arrow glyph
        if ($this.attr('data-simpletipoffset')) {
            offset = parseInt($this.attr('data-simpletipoffset'), 10) + 7;
        }

        if (info.vertical === 'top') {
            topOffset = offset;
        }
        else if (info.vertical === 'bottom') {
            topOffset = -offset;
        }
        else if (info.horizontal === 'left') {
            leftOffset = offset;
        }
        else if (info.horizontal === 'right') {
            leftOffset = -offset;
        }

        return { leftOffset, topOffset };
    };


    /**
     * Converts relative start/end positioning to absolute left/right positioning
     *
     * @param {string} tipPosition the specified position of the tooltip
     * @returns {string} the absolute direction of the tooltip
     */
    const getTipLRPosition = tipPosition => {
        if ($('body').hasClass('rtl')) {
            if (tipPosition === 'start') {
                tipPosition = 'right';
            }
            else if (tipPosition === 'end') {
                tipPosition = 'left';
            }
        }
        else if (tipPosition === 'start') {
            tipPosition = 'left';
        }
        else if (tipPosition === 'end') {
            tipPosition = 'right';
        }

        return tipPosition;
    };

    $(document.body).rebind('mouseenter.simpletip', '.simpletip', function() {
        var $this = $(this);
        if ($currentNode) {
            unmount();
        }

        if ($this.is('.deactivated') || $this.parent().is('.deactivated')) {
            return false;
        }

        var contents = $this.hasClass('simpletip-tc') ? $this.text() : $this.attr('data-simpletip');
        const isBreadcrumb = $this.hasClass('simpletip-breadcrumb');
        if (contents || isBreadcrumb) {
            const $node = $template.clone();
            const $textContainer = $('span', $node);
            $textContainer.safeHTML(sanitize(contents));
            // Handle the tooltip's text content updates based on the current control state,
            // e.g. "Mute" -> "Unmute"
            $this.rebind(SIMPLETIP_UPDATED_EVENT, () => {
                $textContainer.safeHTML(
                    sanitize($this.attr('data-simpletip'))
                );
            });
            $this.rebind(SIMPLETIP_CLOSE_EVENT, () => {
                unmount();
            });
            $('body').append($node);

            if (isBreadcrumb) {
                $node.addClass('breadcrumb-tip theme-dark-forced');
                $textContainer.replaceWith($breadcrumbs);
                M.renderPathBreadcrumbs($this.parent().parent().get(0).id, false, true);
            }

            $currentNode = $node;
            $currentTriggerer = $this;
            let wrapper = $this.attr('data-simpletipwrapper') || '';
            if (wrapper) {
                wrapper += ",";
            }

            const customClass = $this.attr('data-simpletip-class');
            if (customClass) {
                $currentNode.addClass(customClass);
            }

            /*
             * There are four main positions of the tooltip:
             * A) The default position is below the hovered el and horizontally centered.
             *      The tooltip may be flipped vertically or moved along the horizontal axis
             *      if there is not enough space in container
             * B) "top" data-simpletipposition value places the tooltip above the hovered el.
             *      The tooltip may be flipped vertically back or moved along the horizontal axis
             *      if there is not enough space in container
             * C) "left" data-simpletipposition value places the tooltip to the left of the target.
             *      The tooltip is centered  vertically and may be flipped horizontally
             *      if there is not enough space in container
             * D) "right" data-simpletipposition value places the tooltip to the right of the target.
             *      The tooltip is centered  vertically and may be flipped horizontally
             *      if there is not enough space in container
            */

            /* Default bottom position (case A) */
            let my = 'center top';
            let at = 'center bottom';
            let arrowRotation = 180;
            const tipPosition = getTipLRPosition($this.attr('data-simpletipposition'));

            switch (tipPosition) {
                /* Top position (case B) */
                case 'top':
                    my = 'center bottom';
                    at = 'center top';
                    break;
                /* Top position (case C) */
                case 'left':
                    my = 'right center';
                    at = 'left center';
                    break;
                /* Top position (case D) */
                case 'right':
                    my = 'left center';
                    at = 'right center';
                    break;
            }

            $node.position({
                of: $this,
                my: my,
                at: at,
                collision: 'flipfit',
                within: $this.hasClass('simpletip-breadcrumb') ? $this.parents('body').first()
                    : $this.parents(wrapper ? `${wrapper} body` : '.ps, body').first(),
                using: function(obj, info) {

                    /*
                     * Defines the positions on the tooltip Arrow and target.
                     * Delault position on the tooltip Arrow is left top.
                     * Delault position on the target is right bottom.
                     * We don't use centering to avoid special conditions after flipping.
                    */
                    let myH = 'left';
                    let myV = 'top';
                    let atH = 'right';
                    let atV = 'bottom';

                    /*
                     * The condition when tooltip is placed to the left of the target (case C),
                     * For condition C to be met, the tooltip must be vertically centered.
                     * Otherwise, it will mean that we have case A or B, and the tooltip
                     * just moves along the horizontal ("arrowRotation" val will be changed then).
                     * The position on the arrow is right and the position on target is left.
                    */
                    if (info.horizontal === 'right') {
                        myH = 'right';
                        atH = 'left';
                        arrowRotation = 270;
                    }
                    // Case D, or case A or B, and the tooltip  just moves along the horizontal.
                    else if (info.horizontal === 'left') {
                        myH = 'left';
                        atH = 'right';
                        arrowRotation = 90;
                    }

                    // Case A, tooltip is placed below the target. "arrowRotation" value is replaced.
                    if (info.vertical === 'top') {
                        myV = 'top';
                        atV = 'bottom';
                        arrowRotation = 180;
                    }
                    // Case B, tooltip is placed above the target. "arrowRotation" value is replaced.
                    else if (info.vertical === 'bottom') {
                        myV = 'bottom';
                        atV = 'top';
                        arrowRotation = 0;
                    }
                    // Case C or D, tooltip is placed to the left/right and vertically centered.
                    else {
                        myV = 'center';
                        atV = 'center';
                    }

                    // Set new positions on the tooltip Arrow and target.
                    my = myH + ' ' + myV;
                    at = atH + ' ' + atV;

                    this.classList.add('visible');

                    const { leftOffset, topOffset} = calculateOffset(info, $this);

                    $(this).css({
                        left: `${obj.left + leftOffset}px`,
                        top: `${obj.top + topOffset}px`
                    });
                }
            });

            // Calculate Arrow position
            var $tooltipArrow = $('.tooltip-arrow', $node);

            $tooltipArrow.position({
                of: $this,
                my: my,
                at: at,
                collision: 'none',
                using: function(obj, info) {
                    let { top, left } = obj;

                    /*
                     * If Case A or B (ie tooltip is placed to the top/bottom), then
                     * we need to take into account the horizontal centering of the arrow
                     * in relation to the target, depending on the width of the arrow
                    */
                    const horizontalOffset = info.vertical === 'middle' ? 0 : $this[0].offsetWidth / 2;

                    // Horizontal positioning of the arrow in relation to the target
                    if (info.horizontal === 'left') {
                        left -= $tooltipArrow[0].offsetWidth / 2 + horizontalOffset;
                    }
                    else if (info.horizontal === 'right') {
                        left += $tooltipArrow[0].offsetWidth / 2 + horizontalOffset;
                    }

                    // Vertical positioning of the arrow in relation to the target
                    if (info.vertical === 'bottom') {
                        top += $tooltipArrow[0].offsetHeight / 2;
                    }
                    else if (info.vertical === 'top') {
                        top -= $tooltipArrow[0].offsetHeight / 2;
                    }

                    // Add special offset if set in options
                    const { leftOffset, topOffset} = calculateOffset(info, $this);

                    $(this).css({
                        left: `${left + leftOffset}px`,
                        top: `${top + topOffset}px`,
                        transform: `rotate(${arrowRotation}deg)`
                    });
                }
            });
        }
    });

    $(document.body).rebind('mouseover.simpletip touchmove.simpletip', function(e) {
        if ($currentNode && !e.target.classList.contains('simpletip')
            && !$(e.target).closest('.simpletip, .simpletip-tooltip').length > 0
            && !e.target.classList.contains('tooltip-arrow')
            && !e.target.classList.contains('simpletip-tooltip')
            && !$currentTriggerer.hasClass('manual-tip')) {
            unmount();
        }
    });
})(jQuery);

/**
 * Handle all logic for rendering for users' avatar
 */
var useravatar = (function() {

    'use strict';

    var _colors = [
        "#55D2F0",
        "#BC2086",
        "#FFD200",
        "#5FDB00",
        "#00BDB2",
        "#FFA700",
        "#E4269B",
        "#FF626C",
        "#FF8989",
        "#9AEAFF",
        "#00D5E2",
        "#FFEB00"
    ];

    const DEBUG = window.d > 3;
    const logger = DEBUG && MegaLogger.getLogger('useravatar');

    /**
     * List of TWO-letters avatars that we ever generated. It's useful to replace
     * the moment we discover the real avatar associate with that avatar
     */
    var _watching = {};

    /**
     *  Public methods
     */
    var ns = {};

    /**
     * Return a SVG image representing the Letter avatar
     * @param {Object} user The user object or email
     * @returns {String}
     * @private
     */
    function _getAvatarSVGDataURI(user) {

        var s = _getAvatarProperties(user);
        var $template = $('#avatar-svg').clone().removeClass('hidden')
            .find('svg').addClass('color' + s.colorIndex).end()
            .find('text').text(s.letters).end();

        $template = window.btoa(to8($template.html()));

        return 'data:image/svg+xml;base64,' + $template;
    }

    /**
     * Return two letters and the color for a given string.
     * @param {Object|String} user The user object or email
     * @returns {Object}
     * @private
     */
    function _getAvatarProperties(user) {
        user = String(user.u || user);
        var name  = M.getNameByHandle(user) || user;
        if (name === user && M.suba[user] && M.suba[user].firstname) {
            // Acquire the avatar matches the first letter for pending accounts in business account
            name = from8(base64urldecode(M.suba[user].firstname)).trim();
        }
        var color = UH64(user).mod(_colors.length);

        if (color === false) {
            color = user.charCodeAt(0) % _colors.length;
        }

        let ch = name.codePointAt(0);
        ch = ch && String.fromCodePoint(ch) || '';

        return {letters: ch.toUpperCase(), color: _colors[color], colorIndex: color + 1};
    }

    /**
     * Return the HTML to represent a two letter avatar.
     *
     * @param {Object} user The user object or email
     * @param {String} className Any extra CSS classes that we want to append to the HTML
     * @param {String} element The HTML tag
     * @returns {String} Returns the HTML
     * @returns {Boolean} Adds addition blured background block
     * @private
     */
    function _getAvatarContent(user, className, element, bg) {
        var id = user.u || user;
        var bgBlock = '';

        if (element === 'ximg') {
            return _getAvatarSVGDataURI(user);
        }

        var s = _getAvatarProperties(user);

        if (!_watching[id]) {
            _watching[id] = {};
        }

        if (bg) {
            bgBlock = '<div class="avatar-bg colorized">' +
                '<span class="colorized color' + s.colorIndex + '"></span></div>';
        }

        _watching[id][className] = true;

        id        = escapeHTML(id);
        element   = escapeHTML(element);

        if (className && className !== '') {
            className = 'avatar-wrapper ' + escapeHTML(className);
        }
        else {
            className = 'avatar-wrapper small-rounded-avatar';
        }

        return  bgBlock +
            '<' + element + ' data-color="color' + s.colorIndex + '" class="' +
                id + ' color' + s.colorIndex + ' ' + className + '">' +
                '<div class="verified_icon"><i class="verified-user-icon"></i></div>' +
            s.letters + '</' + element + '>';
    }

    /**
     * Return an image HTML from an URL.
     *
     * @param {String} url The image URL
     * @param {String} id The ID associated with the avatar (uid)
     * @param {String} className Any extra CSS classes that we want to append to the HTML
     * @param {String} type The HTML tag type
     * @returns {String} The image HTML
     * @returns {Boolean} Adds addition blured background block
     * @private
     */
    function _getAvatarImageContent(url, id, className, type, bg) {
        var bgBlock = '';
        id        = escapeHTML(id);
        url       = escapeHTML(url);
        type      = escapeHTML(type);

        if (className && className !== '') {
            className = 'avatar-wrapper ' + escapeHTML(className);
        }
        else {
            className = 'avatar-wrapper small-rounded-avatar';
        }

        if (bg) {
            bgBlock = '<div class="avatar-bg colorized">' +
                    '<span class="colorized"></span>' +
                '</div>';
        }

        return bgBlock +
            '<' + type + ' data-color="" class="' + id + ' ' + className + '">' +
                '<div class="verified_icon"><i class="verified-user-icon"></i></div>' +
                '<img src="' + url + '">' +
            '</' + type + '>';
    }

    /**
     * Check if the current user is verified by the current user. It
     * is asynchronous and waits for `u_authring.Ed25519` is ready.
     * @param {String} userHandle The user handle
     * @private
     */
    var pendingVerifyQuery = {};
    function isUserVerified(userHandle) {
        if (u_type !== 3 || userHandle === u_handle || pendingVerifyQuery[userHandle]) {
            return;
        }
        pendingVerifyQuery[userHandle] = Date.now();

        if (DEBUG) {
            logger.log('isUserVerified', userHandle);
        }

        authring.onAuthringReady('avatar-v').then(function isUserVerified_Callback() {
            var ed25519 = u_authring.Ed25519;
            var verifyState = ed25519 && ed25519[userHandle] || {};
            var isVerified = (verifyState.method >= authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON);

            if (isVerified) {
                $('.avatar-wrapper.' + userHandle.replace(/[^\w-]/g, '')).addClass('verified');
            }
        }).finally(() => {
            delete pendingVerifyQuery[userHandle];
        });
    }

    /**
     * Like the `contact` method but instead of returning a
     * div with the avatar inside it returns an image URL.
     * @param {String} contact The contact's user handle
     * @returns {String} The HTML to be rendered
     */
    ns.imgUrl = function(contact) {

        if (avatars[contact]) {
            return avatars[contact].url;
        }

        return ns.contact(contact, '', 'ximg');
    };

    /**
     * Return the current user's avatar in image URL.
     */
    ns.mine = function() {

        if (!u_handle) {
            /* No user */
            return '';
        }

        try {
            return ns.imgUrl(u_handle);
        }
        catch (ex) {
            if (DEBUG) {
                logger.error(ex);
            }
            return '';
        }
    };

    /**
     * Refresh contact's avatar(s)
     * @param {Array|String} [userPurgeList] list to invalidate user's avatars for
     * @returns {Promise}
     */
    ns.refresh = async function(userPurgeList) {
        if (u_type !== 3) {
            return false;
        }
        if (!M.c.contacts) {
            M.c.contacts = Object.create(null);
        }
        M.c.contacts[u_handle] = 1;

        if (userPurgeList) {
            // if provided, invalidate the pointed user avatars.
            if (!Array.isArray(userPurgeList)) {
                userPurgeList = [userPurgeList];
            }
            if (DEBUG) {
                logger.debug('Invalidating user-avatar(s)...', userPurgeList);
            }
            for (let i = userPurgeList.length; i--;) {
                this.invalidateAvatar(userPurgeList[i]);
            }
        }

        const pending = [];
        const users = M.u.keys();

        for (let i = users.length; i--;) {
            const usr = M.u[users[i]];
            const uh = usr.h || usr.u;

            if (!avatars[uh] && usr.c >= 0 && usr.c < 3) {

                pending.push(this.loadAvatar(uh));
            }
        }

        delete M.c.contacts[u_handle];
        return pending.length && Promise.allSettled(pending);
    };

    /**
     * A new contact has been loaded, let's see if they have any two-letters avatars, if
     * that is the case we replace that old avatar *everywhere* with their proper avatar.
     * @param {String} user The user handle
     */
    ns.loaded = function(user) {

        if (typeof user !== "string") {
            if (DEBUG) {
                logger.warn('Invalid user-handle provided!', user);
            }
            return false;
        }
        if (DEBUG) {
            logger.debug('Processing loaded user-avatar', user);
        }

        if (user === u_handle) {
            var myavatar = ns.mine();

            $('.fm-avatar img,.fm-account-avatar img, .top-menu-popup .avatar-block img', 'body')
                .attr('src', myavatar);
            $('.fm-account-avatar .avatar-bg span').css('background-image', 'url(' + myavatar + ')');
            $('.fm-avatar').show();

            // we recreate the top-menu on each navigation, so...
            ns.my = myavatar;
        }

        if (M.u[user]) {
            // .trackDataChange() will trigger some parts in the Chat UI to re-render.
            M.u[user].trackDataChange(M.u[user], "avatar");
        }

        var $avatar = null;
        var updateAvatar = function() {
            if ($avatar === null) {
                // only do a $(....) call IF .updateAvatar is called.
                $avatar = $(ns.contact(user));
            }

            var $this = $(this);
            if (this.classList.contains("chat-avatar")) {
                // don't touch chat avatars. they update on their own.
                return;
            }

            $this.removeClass($this.data('color'))
                .addClass($avatar.data('color'))
                .data('color', $avatar.data('color'))
                .safeHTML($avatar.html());
        };

        $('.avatar-wrapper.' + user.replace(/[^\w-]/g, '') + ':not(.in-chat)').each(updateAvatar);

        if ((M.u[user] || {}).m) {
            var eem = String(M.u[user].m).replace(/[^\w@.,+-]/g, '').replace(/\W/g, '\\$&');
            $('.avatar-wrapper.' + eem).each(updateAvatar);
        }
    };

    ns.generateContactAvatarMeta = function(user) {
        user = M.getUser(user) || String(user);

        if (user.avatar) {
            return user.avatar;
        }

        if (user.u) {
            isUserVerified(user.u);

            if (avatars[user.u]) {
                user.avatar = {
                    'type': 'image',
                    'avatar': avatars[user.u].url
                };
            }
            else {
                user.avatar = {
                    'type': 'text',
                    'avatar': _getAvatarProperties(user)
                };
            }

            return user.avatar;
        }

        return {
            'type': 'text',
            'avatar': _getAvatarProperties(user)
        };
    };
    /**
     * Returns a contact avatar
     * @param {String|Object} user
     * @param {String} className
     * @param {String} element
     * @returns {String}
     * @returns {Boolean} Adds addition blured background block
     */
    ns.contact = function(user, className, element, bg) {
        user = M.getUser(user) || String(user);

        element   = element || 'div';
        className = className || 'small-rounded-avatar';

        if (user.u) {
            isUserVerified(user.u);
        }

        if (avatars[user.u]) {
            return _getAvatarImageContent(avatars[user.u].url, user.u, className, element, bg);
        }

        return _getAvatarContent(user, className, element, bg);
    };

    // Generic logic to retrieve and process user-avatars
    // from either server-side or local-cache
    (function loadAvatarStub(ns) {
        // hold pending promises waiting for avatar data
        var pendingGetters = {};
        // hold user-avatar handle who failed to retrieve
        var missingAvatars = {};

        /**
         * Load the avatar associated with an user handle
         * @param {String} handle The user handle
         * @param {String} chathandle The chat handle
         * @return {MegaPromise}
         */
        ns.loadAvatar = function(handle, chathandle) {
            // Ensure this is a sane call...
            if (typeof handle !== 'string' || handle.length !== 11) {
                if (DEBUG) {
                    logger.error('Unable to retrieve user-avatar, invalid handle!', handle);
                }
                return MegaPromise.reject(EARGS);
            }
            if (missingAvatars[handle]) {
                // If the retrieval already failed for the current session
                if (DEBUG) {
                    logger.warn('User-avatar retrieval for "%s" had failed...', handle, missingAvatars[handle]);
                }
                return MegaPromise.reject(missingAvatars[handle]);
            }
            if (pendingGetters[handle]) {
                // It's already pending, return associated promise
                if (DEBUG) {
                    logger.warn('User-avatar retrieval for "%s" already pending...', handle);
                }
                return pendingGetters[handle];
            }
            if (avatars[handle]) {
                if (DEBUG) {
                    logger.warn('User-avatar for "%s" is already loaded...', handle, avatars[handle]);
                }
                return MegaPromise.resolve(EEXIST);
            }

            var promise = new MegaPromise();
            pendingGetters[handle] = promise;

            var reject = function(error) {
                if (DEBUG) {
                    logger.warn('User-avatar retrieval for "%s" failed...', handle, error);
                }

                missingAvatars[handle] = error;
                promise.reject.apply(promise, arguments);
            };

            if (DEBUG) {
                logger.debug('Initiating user-avatar retrieval for "%s"...', handle);
            }

            mega.attr.get(handle, 'a', true, false, undefined, undefined, chathandle)
                .fail(reject)
                .done(function(res) {
                    var error = res;

                    if (typeof res !== 'number' && res.length > 5) {
                        try {
                            var ab = base64_to_ab(res);
                            ns.setUserAvatar(handle, ab);

                            if (DEBUG) {
                                logger.info('User-avatar retrieval for "%s" successful.', handle, ab, avatars[handle]);
                            }

                            return promise.resolve();
                        }
                        catch (ex) {
                            error = ex;
                        }
                    }

                    reject(error);
                })
                .always(function() {
                    delete pendingGetters[handle];
                    ns.loaded(handle);
                });

            return promise;
        };

        /**
         * Set user-avatar based on its handle
         * @param {String} handle The user handle
         * @param {String} ab     ArrayBuffer with the avatar data
         * @param {String} mime   mime-type (optional)
         */
        ns.setUserAvatar = function(handle, ab, mime) {
            // deal with typedarrays
            ab = ab.buffer || ab;

            if (ab instanceof ArrayBuffer) {
                // check if overwritting and cleanup
                if (avatars[handle]) {
                    try {
                        myURL.revokeObjectURL(avatars[handle].url);
                    }
                    catch (ex) {
                        if (DEBUG) {
                            logger.warn(ex);
                        }
                    }
                }

                var blob = new Blob([ab], {type: mime || 'image/jpeg'});

                avatars[handle] = {
                    data: blob,
                    url: myURL.createObjectURL(blob)
                };
                if (M.u[handle]) {
                    M.u[handle].avatar = false;
                }
            }
            else if (DEBUG) {
                logger.warn('setUserAvatar: Provided data is not an ArrayBuffer.', ab);
            }
        };

        /**
         * Invalidate user-avatar cache, if any
         * @param {String} handle The user handle
         */
        ns.invalidateAvatar = function(handle) {
            if (DEBUG) {
                logger.debug('Invalidating user-avatar for "%s"...', handle);
            }

            if (DEBUG && pendingGetters[handle]) {
                // this could indicate an out-of-sync flow, or calling M.avatars() twice...
                logger.error('Invalidating user-avatar which is being retrieved!', handle);
            }

            avatars[handle] = missingAvatars[handle] = undefined;

            if (M.u[handle]) {
                M.u[handle].avatar = false;
            }

            attribCache.removeItem(`${handle}_+a`);
        };

        if (d) {
            ns._pendingGetters = pendingGetters;
            ns._missingAvatars = missingAvatars;
        }

    })(ns);

    return ns;
})();

/* region mega.io */

class ExpandableComponent {
    constructor($expandableElement) {
        this.$expandable = $expandableElement;
    }

    isExpanded() {
        return this.$expandable.hasClass('expanded');
    }

    expand() {
        this.$expandable.addClass('expanded');
    }

    contract() {
        this.$expandable.removeClass('expanded');
    }

    toggle() {
        if (this.isExpanded()) {
            this.contract();
        }
        else {
            this.expand();
        }
    }
}

class AccordionComponent extends ExpandableComponent {
    constructor($accordionElement) {
        super($accordionElement);

        this.transitionOptions = {
            easing: 'swing',
            duration: 200,
            complete: () => {
                // Reset to automatic height for resize responsiveness
                this.$drawer.height('auto');
            },
        };

        this.$expandable.data('js-object', this);

        this.$drawer = $('.accordion-content', this.$expandable);
        this.$drawer.slideUp(0);

        $('.accordion-toggle', this.$expandable).rebind('click.accordion-toggle', () => {
            this.$expandable.siblings('.accordion').each((i, element) => {
                const accordion = $(element).data('js-object');
                if (accordion.isExpanded()) {
                    accordion.contract();
                }
            });

            this.toggle();
        });
    }

    setTransitionOptions(newOptions) {
        this.transitionOptions = Object.assign(this.transitionOptions, newOptions);
    }

    expand() {
        super.expand();
        this.$drawer.stop().animate({
            height: 'show',
            opacity: 'show',
        }, this.transitionOptions);
    }

    contract() {
        super.contract();
        this.$drawer.stop().animate({
            height: 'hide',
            opacity: 'hide',
        }, this.transitionOptions);
    }
}

/* endregion */

/**
 * Bottom pages functionality
 */
var bottompage = {

    /**
     * Initialise the page
     */
    init: function() {

        "use strict";

        var $content = $('.bottom-page.scroll-block', '.fmholder');
        bottompage.$footer = $('.bottom-page footer.bottom-menu', '.fmholder');

        // Unbind sliders events
        $(window).unbind('resize.sliderResize');

        // Init animations
        if ($content.hasClass('animated-page')) {
            bottompage.initAnimations($content);
        }

        // Insert variables with replaced browser names
        if (page === 'bird') {
            $('.top-bl .bottom-page.top-dark-button.rounded span.label', $content)
                .safeHTML(l[20923].replace('%1', 'Thunderbird'));
        }

        // Init Video resizing on security page
        if (page === 'security' && !is_mobile) {
            bottompage.videoResizing();

            $(window).rebind('resize.security', function (e) {
                bottompage.videoResizing();
            });
        }

        if (!is_mobile) {

            // Init floating top menu
            bottompage.initFloatingTop();

            bottompage.initNavButtons($content);
        }
        else {
            bottompage.initMobileNavButtons($content);
        }

        const $cs = $('.cookies-settings', $content).off('click.csp').addClass('hidden');
        if ('csp' in window) {
            $cs.removeClass('hidden').rebind('click.csp', function() {
                if (!this.classList.contains('top-menu-item')) {
                    csp.trigger().dump('csp.trigger');
                    return false;
                }
            });
        }
        else {
            // cookie-dialog not available, replace links with text nodes.
            document.querySelectorAll('a.cookies-settings').forEach(e => e.replaceWith(e.textContent));
        }

        // Init scroll button
        bottompage.initBackToScroll();
        bottompage.initScrollToContent();

        // Show/hide Referral Program and Pricing menu items for different account types
        bottompage.changeMenuItemsList($content);
        localeImages($content);

        bottompage.mobileAccordions = [];
        for (const element of $('.accordion', bottompage.$footer)) {
            bottompage.mobileAccordions.push(new AccordionComponent($(element)));
        }
    },

    /**
     * Show/hide necessary menu items for different acctount types
     */
    changeMenuItemsList: function($content) {
        "use strict";

        var $pagesMenu = $('.pages-menu.body', $content);

        // Show/Hide Affiliate program link in bottom menu
        if (mega.flags.refpr) {
            $('a.link.affiliate', bottompage.$footer).removeClass('hidden');
        }
        else {
            $('a.link.affiliate', bottompage.$footer).addClass('hidden');
        }

        // Hide Pricing link for current Business or Pro Flexi accounts
        if ((u_attr && u_attr.b && u_attr.b.s !== pro.ACCOUNT_STATUS_EXPIRED) ||
            (u_attr && u_attr.pf && u_attr.pf.s !== pro.ACCOUNT_STATUS_EXPIRED)) {
            $('a.link.pro', bottompage.$footer).addClass('hidden');
            $('.pages-menu.link.pro', $pagesMenu).addClass('hidden');
        }
        else {
            $('a.link.pro', bottompage.$footer).removeClass('hidden');
            $('.pages-menu.link.pro', $pagesMenu).removeClass('hidden');
        }

        if (u_type && (!mega.flags.ach || Object(window.u_attr).b)) {
            // Hide Achievements link for an non-achievement account and business account
            $('a.link.achievements', bottompage.$footer).addClass('hidden');
        }
        else {
            $('a.link.achievements', bottompage.$footer).removeClass('hidden');
        }
    },

    /**
     * Init Animated blocks
     * @param {Object} $content The jQuery selector for the current page
     * @returns {void}
     */
    initAnimations: function($content) {
        "use strict";

        var $scrollableBlock = is_mobile ? $('body.mobile .fmholder') : $('.fmholder', 'body');

        // Init top-block animations
        setTimeout(function() {
            $content.addClass('start-animation');
        }, 700);

        var isVisibleBlock = function($row) {
            if ($row.length === 0) {
                return false;
            }

            var $window = $(window);
            var elementTop = $row.offset().top;
            var elementBottom = elementTop + $row.outerHeight();
            var viewportTop = $window.scrollTop();
            var viewportBottom = viewportTop + $window.outerHeight();

            return elementBottom - 80 > viewportTop && elementTop < viewportBottom;
        };

        var showAnimated = function($content) {
            // add circular-spread here later
            var $blocks = $('.animated, .fadein, .circular-spread, .text-focus-contract', $content);

            for (var i = $blocks.length - 1; i >= 0; i--) {

                var $block = $($blocks[i]);

                if (isVisibleBlock($block)) {
                    if (!$block.hasClass('start-animation')) {
                        $block.addClass('start-animation');
                    }
                }
                else if ($block.hasClass('start-animation')) {
                    // dont reset circular spread animation
                    if ($block.hasClass('circular-spread') || $block.hasClass('text-focus-contract')) {
                        return;
                    }
                    $block.removeClass('start-animation');
                }
            }
        };

        showAnimated($content);

        $scrollableBlock.add(window).rebind('scroll.startpage', function() {
            var $scrollTop = $('.scroll-to-top', $content);
            showAnimated();

            if (isVisibleBlock($('.bottom-page.light-blue.top, .bottom-page.top-bl', $content))) {
                $scrollTop.removeClass('up');
            }
            else {
                $scrollTop.addClass('up');
            }
        });

        // Init Scroll to Top button event
        $('.scroll-to-top:visible', $content).rebind('click.scroll', function() {

            if ($(this).hasClass('up')) {
                $scrollableBlock.animate({
                    scrollTop: 0
                }, 1600);
            }
            else {
                $scrollableBlock.animate({
                    scrollTop: $('.bottom-page.content', $content).outerHeight()
                }, 1600);
            }
        });
    },

    initBackToScroll: function() {
        "use strict";

        var $body = $('body');

        $('#startholder').rebind('scroll.bottompage', function() {
            sessionStorage.setItem('scrpos' + MurmurHash3(page).toString(16), $(this).scrollTop() | 0);
            if (page === 'download') {
                $(window).unbind('resize.download-bar');
            }
        });

        window.onpopstate = function() {

            var sessionData = sessionStorage['scrpos' + MurmurHash3(page).toString(16)];

            if ($body.hasClass('bottom-pages') && sessionData) {

                // Scroll to saved position and reset previous focus
                $('#startholder', $body).scrollTop(sessionData).trigger('mouseover');

            }
        };
    },

    initScrollToContent: function() {
        "use strict";

        // Init Scroll to Content event
        $('.bottom-page.scroll-button', '.top-bl').rebind('click.scrolltocontent', function() {

            $('.fmholder, html, body').animate({
                scrollTop: $('.full-block', 'body').position().top
            }, 1600);
        });
    },

    initNavButtons: function($content) {
        "use strict";

        var $topMenu = $('.pages-menu.body', $content);

        // No  pages  menu in DOM
        if ($topMenu.length === 0) {
            return false;
        }

        // Close  submenu function
        function closePagesSubMenu() {
            $('.submenu.active, .submenu-item.active', $topMenu).removeClass('active');
            $(window).unbind('resize.pagesmenu');
            $content.unbind('mousedown.closepmenu');
        }

        // Close previously opened sub menu
        closePagesSubMenu();

        // Open submenu
        $('.submenu-item', $topMenu).rebind('click.openpmenu', function() {
            var $this = $(this);
            var $submenu = $this.next('.submenu');

            if ($this.is('.active')) {
                closePagesSubMenu();

                return false;
            }

            const subMenuPos = tryCatch(() => {
                var $this = $('.submenu-item.active', $topMenu);
                var $submenu = $this.next('.submenu');

                $submenu.position({
                    of: $this,
                    my: "center top",
                    at: "center bottom",
                    collision: "fit"
                });
            });

            closePagesSubMenu();
            $this.addClass('active');
            $submenu.addClass('active');
            subMenuPos();

            $(window).rebind('resize.pagesmenu', SoonFc(90, subMenuPos));

            // Close pages submenu by click outside of submenu
            $content.rebind('mousedown.closepmenu', function(e) {
                var $target = $(e.target);

                if (!$target.is('.submenu.active') && !$target.closest('.submenu-item.active').length
                    && !$target.closest('.submenu.active').length) {
                    closePagesSubMenu();
                }
            });
        });
    },

    initMobileNavButtons: function($content) {
        "use strict";

        var $overlay = $('.nav-overlay', 'body');
        var $header = $('.fm-header', $content);
        var $topMenu = $('.pages-menu.body', $content);
        var $menuDropdown;

        $overlay.addClass('hidden');

        // No  pages menu in DOM
        if ($topMenu.length === 0) {
            $header.unbind('click.closepmenu');

            return false;
        }

        $menuDropdown = $('.mobile.pages-menu-dropdown', $content);

        // Close pages menu function
        function closePagesMenu() {
            $overlay.addClass('hidden');
            $('html').removeClass('overlayed');
            $topMenu.removeClass('active');
            $menuDropdown.removeClass('active');
            $overlay.unbind('click.closepmenu');
            $header.unbind('click.closepmenu');
        }

        // Close previously opened menu
        closePagesMenu();

        // Open menu
        $menuDropdown.rebind('click.openpmenu', function() {
            var $this = $(this);

            if ($this.is('.active')) {
                closePagesMenu();

                return false;
            }

            $overlay.removeClass('hidden');
            $('html').addClass('overlayed');
            $this.addClass('active');
            $topMenu.addClass('active');

            // Close previously opened menu by click on overlay or menu icon
            $overlay.add($header).rebind('click.closepmenu', function(e) {
                if ($(e.target).closest('.pages-menu-dropdown').length === 0) {
                    closePagesMenu();
                }
            });
        });

        // Expand submenu
        $('.submenu-item', $topMenu).rebind('click.opensubmenu', function() {
            var $this = $(this);
            var $submenu = $this.next('.submenu');

            if ($this.is('.active')) {
                $this.removeClass('active');
                $submenu.removeClass('active');
            }
            else {
                $this.addClass('active');
                $submenu.addClass('active');
            }
        });
    },

    /**
     * Init Common scrollable sliders for mobile devices.
     * @param {Object} $sliderSection The jQuery selector for the current page or subsection
     * @param {Object} $scrollBlock The jQuery selector for the scrollable block
     * @param {Object} $slides The jQuery selector for the slides
     * @param {Boolean} passing TRUE if we need to show slides withhout scrolling animation
     * @returns {void}
     */
    initSliderEvents: function($sliderSection, $scrollBlock, $slides, passing) {

        'use strict';

        // The box which gets scroll and contains all the child content.
        const $scrollContent = $scrollBlock.children();
        const $controls = $('.default-controls', $sliderSection);
        const $specialControls = $('.sp-control', $sliderSection);
        const $dots = $('.nav', $controls).add($specialControls);
        let isRunningAnimation = false;

        // Scroll to first block
        $scrollBlock.scrollLeft(0);
        $dots.removeClass('active');
        $dots.filter('[data-slide="0"]').addClass('active');

        $slides.removeClass('active');
        $($slides[0]).addClass('active');

        // Scroll to necessary plan block
        const scrollToPlan = (slideNum) => {
            let $previousPlan = 0;
            let planPosition = 0;

            // Prevent scroll event
            isRunningAnimation = true;

            // Get plan position related to previous plan to include border-spacing
            $previousPlan = $($slides[slideNum - 1]);
            planPosition = $previousPlan.length ? $previousPlan.position().left
                + $scrollBlock.scrollLeft() + $previousPlan.outerWidth() : 0;

            // Set controls dot active state
            $dots.removeClass('active');
            $dots.filter(`[data-slide="${slideNum}"]`).addClass('active');

            $slides.removeClass('active');
            $($slides[slideNum]).addClass('active');

            // Scroll to plan block
            $scrollBlock.stop().animate({
                scrollLeft: planPosition
            }, passing ? 0 : 600, 'swing', () => {

                // Enable on scroll event after auto scrolling
                isRunningAnimation = false;
            });
        };

        // Init scroll event
        $scrollBlock.rebind('scroll.scrollToPlan', function() {
            const scrollVal = $(this).scrollLeft();
            const contentWidth = $scrollContent.outerWidth();
            const scrollAreaWidth = $scrollBlock.outerWidth();
            let closestIndex = 0;

            // Prevent on scroll event during auto scrolling or slider
            if (isRunningAnimation || contentWidth === scrollAreaWidth) {
                return false;
            }

            // If block is scrolled
            if (scrollVal > 0) {
                closestIndex = Math.round(scrollVal /
                    (contentWidth - scrollAreaWidth) * $slides.length);
            }

            // Get closest plan index
            closestIndex = closestIndex - 1 >= 0 ? closestIndex - 1 : 0;

            // Set controls dot active state
            $dots.removeClass('active');
            $dots.filter(`[data-slide="${closestIndex}"]`).addClass('active');

            $slides.removeClass('active');
            $($slides[closestIndex]).addClass('active');
        });

        // Init controls dot click
        $dots.rebind('click.scrollToPlan', function() {

            // Scroll to selected plan
            scrollToPlan($(this).data('slide'));
        });

        // Init Previous/Next controls click
        $('.nav-button', $controls).rebind('click.scrollToPlan', function() {
            const $this = $(this);
            let slideNum;

            // Get current plan index
            slideNum = $('.nav.active', $controls).data('slide');

            // Get prev/next plan index
            if ($this.is('.prev')) {
                slideNum = slideNum - 1 > 0 ? slideNum - 1 : 0;
            }
            else if (slideNum !== $slides.length - 1) {
                slideNum += 1;
            }

            // Scroll to selected plan
            scrollToPlan(slideNum);
        });

        $(window).rebind('resize.sliderResize', () => {
            this.initSliderEvents($sliderSection, $scrollBlock, $slides, passing);
        });
    },

    initTabs: function() {
        $('.bottom-page.tab').rebind('click', function() {
            var $this = $(this);
            var tabTitle = $this.attr('data-tab');

            if (!$this.hasClass('active')) {
                $('.bottom-page.tab').removeClass('active');
                $('.bottom-page.tab-content:visible').addClass('hidden');
                $('.bottom-page.tab-content.' + tabTitle).removeClass('hidden');
                $this.addClass('active');
            }
        });
    },

    // Init floating  top bar, product pages menu or help center navigation bar
    initFloatingTop: function() {

        const $fmHolder = $('.fmholder', 'body.bottom-pages');
        const $topHeader = $('.bottom-page .top-head, .pages-menu-wrap .pages-menu.body', $fmHolder);
        const $productPagesMenu = $('.pages-menu.body', $fmHolder);

        // Resize top menu / produc pages menu or help center navigation bar
        // Required to avoid "jumpng" effect when we change "position" property
        const topResize = function() {

            if ($topHeader.hasClass('floating')) {
                if ($topHeader.parent().outerWidth() === 0 && $topHeader.parent().length > 1) {
                    $topHeader.outerWidth($($topHeader.parent()[1]).outerWidth());
                }
                else {
                    $topHeader.outerWidth($topHeader.parent().outerWidth());
                }
            }
            else {
                $topHeader.css('width',  '');
            }
        }

        if (!$topHeader.length) {

            return $(window).unbind('resize.topheader');
        }

        // Init menus resizing
        topResize();

        $(window).rebind('resize.topheader', function() {
            topResize();
        });

        // Select bottom pages scrolling block or window for mobile
        $fmHolder.rebind('scroll.topmenu', () => {

            const topPos = $fmHolder.scrollTop();

            if (topPos > 400) {

                // Make menus floating but not visible
                $topHeader.addClass('floating');
                $('.submenu.active, .submenu-item.active', $productPagesMenu).removeClass('active');

                // Show floating menus
                if (topPos > 600) {
                    $topHeader.addClass('activated');
                }
                else {

                    // Hide floating menus
                    $topHeader.removeClass('activated');

                    // Hide all popup as top bar not visisble for this part
                    notify.closePopup();
                    alarm.hideAllWarningPopups(true);
                }
            }
            else if (topPos <= 200) {

                // Return menus static positions
                $topHeader.removeClass('floating activated').css('width',  '');
            }
        });
    },

    videoResizing: function() {
        "use strict";

        var $videoWrapper = $('.security-page-video-block');
        var videoWidth = $videoWrapper.outerWidth();

        if ($videoWrapper.length > 0 && videoWidth < 640) {
            $videoWrapper.height(Math.round(videoWidth * 0.54));
        }
        else {
            $videoWrapper.removeAttr('style');
        }
    }
};

(function(scope) {
    'use strict';

    var dir_inflight = 0;
    var filedrag_u = [];
    var filedrag_paths = Object.create(null);

    const optionReference = {
        touchedElement: 0,
        fileRequestEnabled: false,
        addOverlay: addOverlay,
        removeOverlay: removeOverlay
    };

    function addOverlay() {
        $('body', document).addClass('overlayed');

        if (optionReference.fileRequestEnabled) {
            $('body', document).addClass('file-request-drag');
            return;
        }

        $('.drag-n-drop.overlay').removeClass('hidden');
    }

    function removeOverlay() {
        $('body', document).removeClass('overlayed');

        if (optionReference.fileRequestEnabled) {
            $('body', document).removeClass('file-request-drag');
            return;
        }

        $('.drag-n-drop.overlay').addClass('hidden');
    }

    function addUpload(files, emptyFolders) {
        var straight = $.doStraightUpload || Object(window.fmconfig).ulddd || M.currentrootid === M.RubbishID;

        console.assert(M.isFileDragPage(page) || window.fminitialized, 'check this...');

        if (M.InboxID && M.currentrootid && (M.currentrootid === M.InboxID
            || M.getNodeRoot(M.currentdirid.split('/').pop()) === M.InboxID)) {

            msgDialog('error', l[882], l.upload_to_restricted_folder, l.upload_to_backup_info);
            return false;
        }

        if (M.isFileDragPage(page) || straight) {
            M.addUpload(files, false, emptyFolders);
        }
        else {
            openCopyUploadDialog(files, emptyFolders);
        }
    }

    function pushUpload() {
        if (!--dir_inflight && $.dostart) {
            var emptyFolders = Object.keys(filedrag_paths)
                .filter(function(p) {
                    return filedrag_paths[p] < 1;
                });

            addUpload(filedrag_u, emptyFolders);
            filedrag_u = [];
            filedrag_paths = Object.create(null);

            if (M.isFileDragPage(page)) {
                start_upload();
            }
        }
    }

    function pushFile(file, path) {
        if (d > 1) {
            console.warn('Adding file %s', file.name, file);
        }
        if (file) {
            file.path = path;
            filedrag_u.push(file);
        }
        pushUpload();
    }

    function getFile(entry) {
        return new Promise(function(resolve, reject) {
            entry.file(resolve, reject);
        });
    }

    function traverseFileTree(item, path, symlink) {
        path = path || "";

        if (item.isFile) {
            dir_inflight++;
            getFile(item).then(function(file) {
                pushFile(file, path);
            }).catch(function(error) {
                if (d) {
                    var fn = symlink ? 'debug' : 'warn';

                    console[fn]('Failed to get File from FileEntry for "%s", %s',
                        item.name, Object(error).name, error, item);
                }
                pushFile(symlink, path);
            });
        }
        else if (item.isDirectory) {
            var newPath = path + item.name + "/";
            filedrag_paths[newPath] = 0;
            dir_inflight++;
            var dirReader = item.createReader();
            var dirReaderIterator = function() {
                dirReader.readEntries(function(entries) {
                    if (entries.length) {
                        var i = entries.length;
                        while (i--) {
                            traverseFileTree(entries[i], newPath);
                        }
                        filedrag_paths[newPath] += entries.length;

                        dirReaderIterator();
                    }
                    else {
                        pushUpload();
                    }
                }, function(error) {
                    console.warn('Unable to traverse folder "%s", %s',
                        item.name, Object(error).name, error, item);

                    pushUpload();
                });
            };
            dirReaderIterator();
        }
        if (d && dir_inflight == 0) {
            console.log('end');
        }
    }

    function start_upload() {
        if (u_type && u_attr) { // logged in user landing on start-page
            loadSubPage('fm');
            return;
        }
        if (u_wasloggedin()) {
            msgDialog('confirmation', l[1193], l[2001], l[2002], function(e) {
                if (e) {
                    start_anoupload();
                }
                else {
                    tooltiplogin.init();
                    $.awaitingLoginToUpload = true;

                    mBroadcaster.once('fm:initialized', function() {
                        ulQueue.resume();
                        uldl_hold = false;

                        if (ul_queue.length > 0) {
                            M.showTransferToast('u', ul_queue.length);
                        }
                    });
                }
            });
        }
        else {
            start_anoupload();
        }
    }

    function start_anoupload() {
        u_storage = init_storage(localStorage);
        loadingDialog.show();
        u_checklogin({
            checkloginresult: function(u_ctx, r) {
                u_type = r;
                u_checked = true;
                loadingDialog.hide();
                loadSubPage('fm');
            }
        }, true);
    }

    function FileDragEnter(e) {
        if (d) {
            console.log('DragEnter', optionReference.touchedElement);
        }
        e.preventDefault();
        if ($.dialog === 'avatar') {
            return;
        }
        e.stopPropagation();
        if (!isFileDragAllowed()) {
            return;
        }
        if (d > 1) {
            console.info('----- ENTER event :' + e.target.className);
        }
        optionReference.touchedElement++;
        if (optionReference.touchedElement === 1) {
            addOverlay();
        }

    }

    function FileDragHover(e) {
        if (d) {
            console.log('DragOver');
        }
        e.preventDefault();
        e.stopPropagation();
    }
    var useMegaSync = -1;
    var usageMegaSync = 0;


    function FileSelectHandlerMegaSyncClick(e) {

        if (M.isInvalidUserStatus()) {
            e.preventDefault();
            return false;
        }

        if (page === "chat" || page.indexOf('/chat/') > -1) {
            return true;
        }
        if (window.useMegaSync === 2) {
            e.preventDefault();
            e.stopPropagation();

            if (M.InboxID && M.currentrootid && (M.currentrootid === M.InboxID
                || M.getNodeRoot(M.currentdirid.split('/').pop()) === M.InboxID)) {

                msgDialog('error', l[882], l.upload_to_restricted_folder, l.upload_to_backup_info);
                return false;
            }

            var target;
            if ($.onDroppedTreeFolder) {
                target = $.onDroppedTreeFolder;
                delete $.onDroppedTreeFolder;
            }
            else if (M.currentCustomView) {
                target = M.currentCustomView.nodeID;
            }
            else if (String(M.currentdirid).length !== 8) {
                target = M.lastSeenCloudFolder || M.RootID;
            }
            else {
                target = M.currentdirid;
            }

            var uploadCmdIsFine = function _uploadCmdIsFine(error, response) {
                if (error) {
                    window.useMegaSync = 3;
                }
            };

            //var elem = $('#' + e.toElement.id)[0];
            var elem = e.target;
            if (elem.hasAttribute('webkitdirectory') || elem.hasAttribute('mozdirectory')
                || elem.hasAttribute('msdirectory') || elem.hasAttribute('odirectory')
                || elem.hasAttribute('directory')) {
                megasync.uploadFolder(target, uploadCmdIsFine);
            }
            else {
                megasync.uploadFile(target, uploadCmdIsFine);
            }
            return false;
        }
        else {
            return true;
        }
    }

    function FileDragLeave(e) {
        if (d) {
            console.log('DragLeave', optionReference.touchedElement);
        }
        e.preventDefault();
        if ($.dialog === 'avatar') {
            return;
        }
        e.stopPropagation();

        if (d > 1) {
            console.warn('----- LEAVE event :' + e.target.className + '   ' + e.type);
        }
        optionReference.touchedElement--;
        // below condition is due to firefox bug. https://developer.mozilla.org/en-US/docs/Web/Events/dragenter
        if (
            optionReference.touchedElement <= 0 ||
            optionReference.touchedElement === 1 && ua.details.browser === 'Firefox'
        ) {
            removeOverlay();
            optionReference.touchedElement = 0;
        }
    }

    // on Drop event or Click to file select event
    function FileSelectHandler(e) {

        if (e.preventDefault) {
            e.preventDefault();
        }

        // Clear drag element
        optionReference.touchedElement = 0;

        removeOverlay();

        if (M.isInvalidUserStatus()) {
            return false;
        }

        if ($.dialog === 'avatar') {
            return;
        }
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (e.type === 'drop' && !isFileDragAllowed()) {
            return;
        }

        useMegaSync = -1;

        const elem = e.target;
        const isFolderUpload = elem.hasAttribute('webkitdirectory') || elem.hasAttribute('mozdirectory')
            || elem.hasAttribute('msdirectory') || elem.hasAttribute('odirectory') || elem.hasAttribute('directory');

        // Log that User selected a folder (or file) for upload from the file explorer
        eventlog(isFolderUpload ? 500010 : 500012);

        var currentDir = M.currentCustomView ? M.currentCustomView.nodeID : M.currentdirid;

        if ($.awaitingLoginToUpload) {
            return tooltiplogin.init();
        }

        if (
            (
                folderlink || currentDir &&
                (
                    currentDir !== 'dashboard' &&
                    currentDir !== 'transfers' &&
                    (M.getNodeRights(currentDir) | 0) < 1
                )
            ) &&
            String(currentDir).indexOf("chat/") === -1
        ) {
            msgDialog('warningb', l[1676], l[1023]);
            return true;
        }

        if (M.InboxID && M.currentrootid && (M.currentrootid === M.InboxID
            || M.getNodeRoot(M.currentdirid.split('/').pop()) === M.InboxID)) {

            msgDialog('error', l[882], l.upload_to_restricted_folder, l.upload_to_backup_info);
            return false;
        }

        if (M.isFileDragPage(page) && !is_mobile) {
            console.assert(typeof fm_addhtml === 'function');
            if (typeof fm_addhtml === 'function') {
                fm_addhtml();
            }
        }

        var dataTransfer = Object(e.dataTransfer);
        var files = e.target.files || dataTransfer.files;
        if (!files || !files.length) {
            return false;
        }

        if (localStorage.testWebGL) {
            return WebGLMEGAContext.test(...files);
        }

        if (localStorage.testDCRaw) {
            (function _rawNext(files) {
                var file = files.pop();
                if (!file) {
                    return console.info('No more files.');
                }
                var id = Math.random() * 9999 | 0;
                var img = is_image(file.name);
                var raw = typeof img === 'string' && img;

                if (!img || !raw) {
                    console.warn('This is not a RAW image...', file.name, [file], img);
                    return _rawNext(files);
                }

                createthumbnail(file, false, id, null, null, {raw: raw})
                    .then((res) => {
                        console.info('testDCRaw result', res);
                        onIdle(_rawNext.bind(null, files));
                        M.saveAs(res.preview, `${file.name}.png`);
                    })
                    .dump(id);

            })(toArray.apply(null, files));
            return;
        }
        if (localStorage.testMediaInfo) {
            return MediaInfoLib.test(files);
        }
        if (localStorage.testGetID3CoverArt) {
            return getID3CoverArt(files[0]).then(function(ab) {
                console.info('getID3CovertArt result', mObjectURL([ab], 'image/jpeg'));
            }).catch(console.debug.bind(console));
        }
        if (localStorage.testStreamerThumbnail) {
            return M.require('videostream').tryCatch(function() {
                Streamer.getThumbnail(files[0])
                    .then(function(ab) {
                        console.info('Streamer.getThumbnail result', mObjectURL([ab], 'image/jpeg'));
                    })
                    .catch(console.debug.bind(console));
            });
        }

        if (window.d && (e.ctrlKey || e.metaKey) && /^mega-dbexport/.test(files[0].name)) {
            return MegaDexie.import(files[0]).dump();
        }

        if ((e.ctrlKey || e.metaKey) && MediaInfoLib.isFileSupported(files[0])) {
            window.d = 2;
            document.body.textContent = 'Local videostream.js Test...';
            const video = mCreateElement('video', {width: 1280, height: 720, controls: true}, 'body');
            return M.require('videostream').then(() => Streamer(files[0], video)).catch(dump);
        }

        if (e.dataTransfer
                && e.dataTransfer.items
                && e.dataTransfer.items.length > 0 && e.dataTransfer.items[0].webkitGetAsEntry) {
            var items = e.dataTransfer.items;
            for (var i = 0; i < items.length; i++) {
                if (items[i].webkitGetAsEntry) {
                    var item = items[i].webkitGetAsEntry();
                    if (item) {
                        filedrag_u = [];
                        if (i == items.length - 1) {
                            $.dostart = true;
                        }
                        traverseFileTree(item, '', item.isFile && items[i].getAsFile());
                    }
                }
            }
        }
        else {
            var u = [];
            var gecko = dataTransfer && ("mozItemCount" in dataTransfer) || Object(ua.details).browser === 'Firefox';
            if (gecko && parseFloat(Object(ua.details).version) > 51) {
                // No need to check for folder upload attempts through zero-bytes on latest Firefox versions
                gecko = false;
            }
            for (var i = 0, f; f = files[i]; i++) {
                if (f.webkitRelativePath) {
                    f.path = String(f.webkitRelativePath).replace(RegExp("[\\/]"
                            + String(f.name).replace(/([^\w])/g,'\\$1') + "$"), '');
                }
                if (gecko) {
                    f.gecko = true;
                }
                if (f.name != '.') {
                    u.push(f);
                    if (Math.floor(f.lastModified / 1000) === Math.floor(Date.now() / 1000)) {
                        api_req({a: 'log', e: 99659, m: 'file modification time uses current time for uploading.'});
                    }
                }
            }
            M.addUpload(u);
            if (M.isFileDragPage(page)) {
                start_upload();
            }
            if (!window.InitFileDrag) {
                return;
            }

            var $fileAndFolderUploadWrap = $('.fm-file-upload').parent();

            $('input', $fileAndFolderUploadWrap).remove();
            $fileAndFolderUploadWrap.safeAppend('<input type="file" class="hidden" id="fileselect1" title="' +
                l[99] + '" multiple="">' + // File input
                '<input type="file" class="hidden" id="fileselect2" webkitdirectory="" title="' +
                l[98] + '" multiple="">'); // Folder input
            $('input#fileselect3').remove();
            $('.files-menu .fileupload-item')
                .after('<input type="file" id="fileselect3" class="hidden" name="fileselect3" multiple="">');
            $('input#fileselect4').remove();
            $('.files-menu .folderupload-item').after('<input type="file" id="fileselect4"' +
                ' name="fileselect4" webkitdirectory="" multiple="" class="hidden">');
            InitFileDrag();
        }
        return true;
    }

    function onDragStartHandler(e) {
        if ((e.target && e.target.toString && e.target.toString() === '[object Text]')
            || page.indexOf('/fm/') === -1) {
            e.stopPropagation();
            e.preventDefault();
            return false;
        }
    }

    /**
     * Check current page is allowed on drag and drop to upload file
     *
     * @return {Boolean} Is allowed or not
     */
    function isFileDragAllowed() {
        if (M.isFileDragPage(page)) {
            return true;
        }
        return !(is_fm() && // if page is fm,
            (window.slideshowid || !$('.feedback-dialog').hasClass('hidden') || // preview and feedback dialog show
                !$('.mega-dialog.duplicate-conflict', 'body').hasClass('hidden') || // conflict dialog show
                M.currentdirid === 'shares' || // Share root page
                M.currentdirid === 'out-shares' || // Out-share root page
                M.currentdirid === 'public-links' || // Public-link root page
                M.currentdirid === 'file-requests' || // File request page
                String(M.currentdirid).startsWith('chat/contacts') || // Contacts pages
                M.currentrootid === M.RubbishID || // Rubbish bin
                (M.currentrootid === undefined && M.currentdirid !== 'transfers') // Dashboard and Settings pages
            ));
    }

    // initialize
    scope.InitFileDrag = function() {
        var i = 5;
        while (i--) {
            var o = document.getElementById(i ? 'fileselect' + i : 'start-upload');
            if (o) {
                o.addEventListener("change", FileSelectHandler, false);
                if (!is_mobile && i) {
                    o.addEventListener("click", FileSelectHandlerMegaSyncClick, true);
                }
            }
        }

        // dran&drop overlay click handler, to allow closing if stuck
        $('.drag-n-drop.overlay')
            .rebind('click.dnd', function dragDropLayoutClickHndler() {
                removeOverlay();
            });

        var fnHandler = FileSelectHandler;
        var fnEnter = FileDragEnter;
        var fnHover = FileDragHover;
        var fnLeave = FileDragLeave;

        optionReference.touchedElement = 0;

        // FileRequest upload
        const fileSelect = document.getElementById('fileselect5');
        if (fileSelect) {
            optionReference.fileRequestEnabled = true;
            fnHandler = mega.fileRequestUpload.getAndSetUploadHandler(optionReference);
            fnEnter = mega.fileRequestUpload.checkUploadDragHandler(fnEnter);
            fnHover = mega.fileRequestUpload.checkUploadDragHandler(fnHover);
            fnLeave = mega.fileRequestUpload.checkUploadDragHandler(fnLeave);
        }

        document.getElementsByTagName("body")[0].addEventListener("dragenter", fnEnter, false);
        document.getElementsByTagName("body")[0].addEventListener("dragover", fnHover, false);
        document.getElementsByTagName("body")[0].addEventListener("dragleave", fnLeave, false);
        document.getElementsByTagName("body")[0].addEventListener("drop", fnHandler, false);
        document.getElementsByTagName("body")[0].addEventListener("dragstart", onDragStartHandler, false);

        if (is_mobile &&
            (ua.details.engine === 'Gecko' && parseInt(ua.details.version) < 83
            || is_ios && is_ios < 13)) {
            // https://bugzilla.mozilla.org/show_bug.cgi?id=1456557
            $('input[multiple]').removeAttr('multiple');
        }
    };

})(this);

// Selenium helper to fake a drop event
function fakeDropEvent(target) {
    // hash: "MTIzNAAAAAAAAAAAAAAAAAOLqRY"
    var file = new File(['1234'], 'test\u202Efdp.exe', {
        type: "application/octet-stream",
        lastModified: 1485195382
    });

    var ev = document.createEvent("HTMLEvents");
    ev.initEvent("drop", true, true);
    ev.dataTransfer = {
        files: [file]
    };

    target = target || document.getElementById("startholder");
    target.dispatchEvent(ev);
}

function ulDummyFiles(count, len) {
    'use strict';

    var ul = [];
    var ts = 1e8;
    for (var n = M.v.length; n--;) {
        ts = Math.max(ts, M.v[n].mtime | 0);
    }

    for (var i = count || 6e3; i--;) {
        var now = Date.now();
        var rnd = Math.random();
        var nam = (rnd * now).toString(36);
        var buf = asmCrypto.getRandomValues(new Uint8Array(rnd * (len || 512)));

        ul.push(new File([buf], nam, {type: 'application/octet-stream', lastModified: ++ts * 1e3}));
    }

    M.addUpload(ul, true);
}

async function ulDummyImages(count, type) {
    'use strict';

    const ul = [];
    const ext = (type = type || 'image/jpeg').split('/').pop();

    eventlog = dump;
    for (let i = count || 210; i--;) {
        const rnd = Math.random();
        const wdh = 320 + rnd * 2345 | 0;
        const buf = await webgl.createImage(i % 2 ? rnd * Date.now() : null, wdh, wdh / 1.777 | 0, type)
            .catch((ex) => {
                console.error(i, wdh, ex.message || ex, ex.data, [ex]);
            });

        if (buf) {
            ul.push(new File([buf], `${makeUUID().slice(-17)}.${ext}`, {type, lastModified: 9e11}));
        }

        if (!(i % 48)) {
            M.addUpload([...ul], true);
            ul.length = 0;
        }
    }
}

/* jshint -W003 */// 'noThumbURI' was used before it was defined.

function createnodethumbnail(node, aes, id, imagedata, opt, ph, file) {
    'use strict';
    storedattr[id] = Object.assign(Object.create(null), {'$ph': ph, target: node});
    createthumbnail(file || false, aes, id, imagedata, node, opt).catch(nop);

    var uled = ulmanager.getEventDataByHandle(node);
    if (uled && !uled.thumb) {
        // XXX: prevent this from being reached twice, e.g. an mp4 renamed as avi and containing covert art ...
        uled.thumb = 1;

        if (d) {
            console.log('Increasing the number of expected file attributes for the chat to be aware.', uled);
        }
        uled.efa += 2;
    }
}

function createthumbnail(file, aes, id, imagedata, node, opt) {
    'use strict';

    var isVideo;
    var isRawImage;
    var thumbHandler;
    var onPreviewRetry;

    if (!M.shouldCreateThumbnail(file && file.target || node && node.p)) {
        console.warn('Omitting thumb creation on purpose...', arguments);
        mBroadcaster.sendMessage('fa:error', id, 'omitthumb', false, 2);
        return Promise.resolve();
    }

    if (typeof opt === 'object') {
        isRawImage = opt.raw;
        isVideo = opt.isVideo;
        onPreviewRetry = opt.onPreviewRetry;

        if (typeof isRawImage === 'function') {
            thumbHandler = isRawImage;
            isRawImage = false;
        }
        else if (typeof isRawImage !== 'string') {
            if (d) {
                console.debug('Not really a raw..', isRawImage);
            }
            isRawImage = false;
        }

        if (d && isRawImage) {
            console.log('Processing RAW Image: ' + isRawImage);
        }
        if (d && thumbHandler) {
            console.log('ThumbHandler: ' + thumbHandler.name);
        }
    }
    else {
        onPreviewRetry = !!opt;
    }

    const tag = `createthumbnail(${file && file.name || Math.random().toString(26).slice(-6)}).${id}`;
    const debug = (m, ...a) => console.warn(`[${tag}] ${m}`, ...a);

    const n = M.getNodeByHandle(node);
    const fa = String(n && n.fa);
    const ph = Object(storedattr[id]).$ph;
    const createThumbnail = !fa.includes(':0*') || $.funkyThumbRegen;
    const createPreview = !fa.includes(':1*') || onPreviewRetry || $.funkyThumbRegen;
    const canStoreAttr = !n || !n.u || n.u === u_handle && n.f !== u_handle;

    if (!createThumbnail && !createPreview) {
        debug('Neither thumbnail nor preview needs to be created.', n);
        return Promise.resolve(EEXIST);
    }

    if (d) {
        console.time(tag);
    }

    var sendToPreview = function(h, ab) {
        var n = h && M.getNodeByHandle(h);

        if (n && fileext(n.name, 0, 1) !== 'pdf' && !is_video(n)) {
            previewimg(h, ab || dataURLToAB(noThumbURI));
        }
    };

    const getSourceImage = async(source) => {
        const buffer = await webgl.readAsArrayBuffer(source);

        if (thumbHandler) {
            const res = await thumbHandler(buffer);
            if (!res) {
                throw new Error(`Thumbnail-handler failed for ${(n || file || !1).name}`);
            }
            source = res.buffer || res;
        }
        else if (isRawImage) {
            if (typeof dcraw === 'undefined') {
                await Promise.resolve(M.require('dcrawjs')).catch(dump);
            }
            const {data, orientation} = webgl.decodeRAWImage(isRawImage, buffer);
            if (data) {
                source = data;
                source.orientation = orientation;
            }
        }
        return source;
    };

    const store = ({thumbnail, preview}) => {
        if (canStoreAttr) {
            // FIXME hack into cipher and extract key
            const key = aes._key[0].slice(0, 4);

            if (thumbnail) {
                api_storefileattr(id, 0, key, thumbnail, n.h, ph);
            }

            // only store preview when the user is the file owner, and when it's not a
            // retry (because then there is already a preview image, it's just unavailable)
            if (preview && !onPreviewRetry) {
                api_storefileattr(id, 1, key, preview, n.h, ph);
            }

            // @todo make async and hold until api_storefileattr() completes (SC-ack)
        }

        if (node) {
            thumbnails.decouple(node);
        }
        sendToPreview(node, preview);

        return {thumbnail, preview};
    };

    let timer;
    let typeGuess;
    const ext = fileext(file && file.name || n.name);
    return (async() => {
        const exifFromImage = !!exifImageRotation.fromImage;

        // @todo move all this to a reusable helper across upload/download
        isVideo = isVideo || MediaInfoLib.isFileSupported(n);

        if (isVideo && (file || imagedata && n.s >= imagedata.byteLength)) {
            file = file || new File([imagedata], n.name, {type: filemime(n)});

            // @todo FIXME mp3 may be wrongly detected as MLP (?!)
            if (is_audio(n) || ext === 'mp3') {
                const buffer = imagedata && imagedata.buffer;
                imagedata = await getID3CoverArt(buffer || imagedata || file).catch(nop) || imagedata;
            }
            else {
                await Promise.resolve(M.require('videostream'));
                imagedata = await Streamer.getThumbnail(file).catch(nop) || imagedata;
            }
        }
        else if (isRawImage && exifFromImage && webgl.doesSupport('worker')) {
            // We don't need to rotate images ourselves, so we will decode it into a worker.
            if (d) {
                debug('Leaving %s image decoding to worker...', isRawImage);
            }
            isRawImage = false;
        }

        let source = imagedata || file;

        if (thumbHandler || isRawImage) {
            source = await getSourceImage(source);
        }

        if (!(source instanceof ImageData) && !exifFromImage) {
            source = await webgl.getRotatedImageData(source);
        }

        typeGuess = source.type || (await webgl.identify(source)).type || 'unknown';
        if (d) {
            debug(`Source guessed to be ${typeGuess}...`, [source]);
        }

        (timer = tSleep(120))
            .then(() => webgl.sendTimeoutError())
            .catch(dump);

        const res = store(await webgl.worker('scissor', {source, createPreview, createThumbnail}));

        if (d) {
            console.timeEnd(tag);
        }
        return res;
    })().catch(ex => {
        if (d) {
            console.timeEnd(tag);
            debug('Failed to create thumbnail', ex);
        }

        sendToPreview(node);
        mBroadcaster.sendMessage('fa:error', id, ex, false, 2);

        if (String(ex && ex.message || ex).includes('Thumbnail-handler')) {
            // @todo mute above debug() if too noisy..
            return;
        }
        webgl.gLastError = ex;

        if (!window.pfid && canStoreAttr && String(typeGuess).startsWith('image/')) {
            eventlog(99665, JSON.stringify([
                3,
                ext,
                typeGuess,
                String(ex && ex.message || ex).split('\n')[0].substr(0, 98),
                fa.includes(':8*') && String(MediaAttribute.getCodecStrings(n)) || 'na'
            ]));
        }
        throw new MEGAException(ex, imagedata || file);
    }).finally(() => {
        if (timer) {
            tryCatch(() => timer.abort())();
            timer = null;
        }
    });
}

mBroadcaster.once('startMega', function() {
    'use strict';
    exifImageRotation.fromImage = getComputedStyle(document.documentElement).imageOrientation === 'from-image';

    if (exifImageRotation.fromImage) {
        if (d) {
            console.info('This browser automatically rotates images based on the EXIF metadata.', [ua]);
        }

        if (window.safari || ua.details.engine === 'Gecko') {
            exifImageRotation.fromImage = -1;
        }
    }
});

/**
 * Rotate images as per the extracted EXIF orientation
 * @param {ArrayBuffer} source The image file data
 * @param {Number} orientation The EXIF rotation value
 */
async function exifImageRotation(source, orientation) {
    'use strict';

    orientation |= 0;
    if (orientation < 2 || exifImageRotation.fromImage < 0) {
        // No rotation needed.
        return source;
    }

    return new Promise((resolve, reject) => {
        var img = new Image();
        var canvas = document.createElement('canvas');
        const cleanup = () => {
            if (exifImageRotation.fromImage) {
                document.body.removeChild(img);
                document.body.removeChild(canvas);
            }
            URL.revokeObjectURL(img.src);
        };
        var signalError = function() {
            reject();
            cleanup();
        };

        if (exifImageRotation.fromImage) {
            img.style.imageOrientation = 'none';
            canvas.style.imageOrientation = 'none';
            document.body.appendChild(img);
            document.body.appendChild(canvas);
        }

        img.onload = tryCatch(function() {
            var width = this.naturalWidth;
            var height = this.naturalHeight;

            if (!width || !height) {
                if (d) {
                    console.error('exifImageRotation found invalid width/height values...', width, height);
                }

                return signalError();
            }

            if (d) {
                console.debug('exifImageRotation: %d x %d', width, height);
            }
            var ctx = canvas.getContext('2d');

            ctx.save();
            switch (orientation) {
                case 5:
                case 6:
                case 7:
                case 8:
                    canvas.width = height;
                    canvas.height = width;
                    break;
                default:
                    canvas.width = width;
                    canvas.height = height;
            }

            switch (orientation) {
                case 2:
                    // horizontal flip
                    ctx.translate(width, 0);
                    ctx.scale(-1, 1);
                    break;
                case 3:
                    // 180 rotate left
                    ctx.translate(width, height);
                    ctx.rotate(Math.PI);
                    break;
                case 4:
                    // vertical flip
                    ctx.translate(0, height);
                    ctx.scale(1, -1);
                    break;
                case 5:
                    // vertical flip + 90 rotate right
                    ctx.rotate(0.5 * Math.PI);
                    ctx.scale(1, -1);
                    break;
                case 6:
                    // 90 rotate right
                    ctx.rotate(0.5 * Math.PI);
                    ctx.translate(0, -height);
                    break;
                case 7:
                    // horizontal flip + 90 rotate right
                    ctx.rotate(0.5 * Math.PI);
                    ctx.translate(width, -height);
                    ctx.scale(-1, 1);
                    break;
                case 8:
                    // 90 rotate left
                    ctx.rotate(-0.5 * Math.PI);
                    ctx.translate(-width, 0);
                    break;
                default:
                    break;
            }

            ctx.drawImage(img, 0, 0);
            ctx.restore();

            queueMicrotask(cleanup);
            resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));

        }, img.onerror = function(ev) {
            if (d) {
                console.error('exifImageRotation failed...', ev);
            }
            signalError();
        });

        img.src = source instanceof Blob
            ? URL.createObjectURL(source)
            : mObjectURL([source], source.type || 'image/jpeg');
    });
}

// ----------------------------------------------------------------------------------

/**
 * Creates a new thumbnails' manager.
 * @param {Number} capacity for LRU
 * @param {String} [dbname] optional database name
 * @returns {LRUMap}
 */
class ThumbManager extends LRUMap {
    constructor(capacity, dbname) {
        super(capacity || 200, (value, key, store, rep) => store.remove(key, value, rep));

        Object.defineProperty(this, 'evict', {value: []});
        Object.defineProperty(this, 'debug', {value: self.d > 4});

        Object.defineProperty(this, 'loaded', {value: 0, writable: true});
        Object.defineProperty(this, 'pending', {value: Object.create(null)});

        Object.defineProperty(this, 'requested', {value: new Map()});
        Object.defineProperty(this, 'duplicates', {value: new MapSet(this.capacity << 2, d && nop)});

        Object.defineProperty(this, '__ident_0', {value: `thumb-manager.${makeUUID()}`});

        if (dbname) {
            this.loading = LRUMegaDexie.create(dbname, this.capacity << 4)
                .then(db => {
                    if (db instanceof LRUMegaDexie) {
                        Object.defineProperty(this, 'db', {value: db, writable: true});

                        this.db.add = (h, data) => {
                            webgl.readAsArrayBuffer(data)
                                .then(buf => this.db.set(h, buf))
                                .catch((ex) => {
                                    if (d) {
                                        console.assert(this.db.error, `Unexpected error... ${ex}`, ex);
                                    }
                                    this.db = false;
                                });
                        };
                    }
                })
                .catch(dump)
                .finally(() => {
                    delete this.loading;
                });
        }
    }

    get [Symbol.toStringTag]() {
        return 'ThumbManager';
    }

    revoke(h, url, stay) {

        if (this.debug) {
            console.warn(`Revoking thumbnail ${h}, ${url}`);
        }
        this.delete(h);

        if (!stay) {
            this.decouple(h);
        }
        URL.revokeObjectURL(url);
    }

    dispose(single) {
        let threshold = single ? 0 : this.capacity / 10 | 1;

        if (this.debug) {
            console.group('thumbnails:lru');
        }

        for (let i = this.evict.length; i--;) {
            this.revoke(...this.evict[i]);
        }
        this.evict.length = 0;

        while (--threshold > 0) {
            const [[k, v]] = this;
            this.revoke(k, v);
        }

        if (this.debug) {
            console.groupEnd();
        }

        delay.cancel(this.__ident_0);
    }

    remove(...args) {
        this.evict.push(args);
        return args[2] ? this.dispose(true) : delay(this.__ident_0, () => this.dispose(), 400);
    }

    cleanup() {
        this.loaded = 0;
        this.duplicates.clear();
    }

    decouple(key) {
        const fa = (M.getNodeByHandle(key) || key).fa || key;

        this.each(fa, (n) => {
            n.seen = null;

            if (M.megaRender) {
                M.megaRender.revokeDOMNode(n.h);
            }
        });

        this.duplicates.delete(fa);
        this.requested.delete(fa);
    }

    each(fa, cb) {
        if (this.duplicates.size(fa)) {
            const hs = [...this.duplicates.get(fa)];

            for (let i = hs.length; i--;) {
                const n = M.getNodeByHandle(hs[i]);

                if (n && cb(n)) {
                    return true;
                }
            }
        }
    }

    queued(n, type) {
        let res = false;

        const rv = this.requested.get(n.fa) | 0;
        if (!super.has(n.fa) && !rv || rv !== type + 1 && rv < 2) {

            if (!this.pending[n.fa]) {
                this.pending[n.fa] = [];
            }

            res = true;
            this.requested.set(n.fa, 1 + type);
        }

        this.duplicates.set(n.fa, n.h);
        return res;
    }

    add(key, value, each) {
        if (d) {
            console.assert(super.get(key) !== value);
        }
        super.set(key, value);

        if (this.pending[key]) {
            for (let i = this.pending[key].length; i--;) {
                queueMicrotask(this.pending[key][i]);
            }
            delete this.pending[key];
        }

        if (each) {
            this.each(key, each);
        }
    }

    replace(h, value) {
        const n = M.getNodeByHandle(h);

        this.add(n.fa, value || self.noThumbURI);

        if (M.megaRender) {
            const domNode = M.megaRender.revokeDOMNode(n.h);
            if (domNode) {
                const img = domNode.querySelector('img');
                if (img) {
                    img.src = super.get(n.fa);
                }
            }
        }
    }

    async query(handles, each, loadend) {
        if (this.loading) {
            await this.loading;
        }

        if (this.db && handles.length) {
            const send = async(h, ab) => loadend(h, ab);
            const found = await this.db.bulkGet(handles).catch(dump) || false;

            for (const h in found) {

                if (each(h)) {
                    send(h, found[h]).catch(dump);
                }
            }
        }
    }
}

Object.defineProperties(ThumbManager, {
    rebuildThumbnails: {
        value: async(nodes) => {
            'use strict';
            let max = 1e9;
            const gen = (h) => {
                const n = M.getNodeByHandle(h);

                if (n.t || n.u !== u_handle || (max -= n.s) < 0) {
                    return Promise.reject('Access denied.');
                }

                return M.gfsfetch(h, 0, -1).then(res => setImage(n, res));
            };
            const fmt = (res) => {
                const output = {};
                for (let i = res.length; i--;) {
                    output[nodes[i]] = {name: M.getNameByHandle(nodes[i]), ...res[i]};
                }
                return output;
            };

            nodes = [...nodes];
            $.funkyThumbRegen = 1;

            const res = await Promise.allSettled(nodes.map(gen)).then(fmt).catch(dump);
            console.table(res);

            delete $.funkyThumbRegen;
        }
    }
});

// ----------------------------------------------------------------------------------

function dataURLToAB(dataURL) {
    if (dataURL.indexOf(';base64,') == -1) {
        var parts = dataURL.split(',');
        var contentType = parts[0].split(':')[1];
        var raw = parts[1];
    }
    else {
        var parts = dataURL.split(';base64,');
        var contentType = parts[0].split(':')[1];
        var raw = window.atob(parts[1]);
    }
    var rawLength = raw.length;
    var uInt8Array = new Uint8Array(((rawLength + 15) & -16));
    for (var i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }

    return uInt8Array;
}

var ba_images = [],
    ba_time = 0,
    ba_id = 0,
    ba_result = [];

function benchmarki() {
    var a = 0;
    ba_images = [];
    for (var i in M.d) {
        if (M.d[i].name && is_image(M.d[i].name) && M.d[i].fa) {
            ba_images.push(M.d[i]);
        }
        else {
            a++;
        }
    }
    console.log('found ' + ba_images.length + ' images with file attr (' + a + ' don\'t have file attributes)');

    ba_images = shuffle(ba_images);

    ba_result['success'] = 0;
    ba_result['error'] = 0;

    benchmarkireq();
}

function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function benchmarkireq() {
    ba_time = new Date().getTime();

    function eot(id, err) {
        for (var i in ba_images) {
            if (ba_images[i].h == id) {
                ba_result['error']++;
                console.log('error', new Date().getTime() - ba_time, err);
                console.log(ba_images[i].fa);
                ba_id++;
                benchmarkireq();
            }
        }
    }

    eot.timeout = 5100;

    var n = ba_images[ba_id];
    if (n) {
        var treq = {};
        treq[n.h] = {
            fa: n.fa,
            k: n.k
        };
        preqs[slideshowid = n.h] = 1;
        api_getfileattr(treq, 1, function(ctx, id, uint8arr) {
            for (var i in ba_images) {
                if (ba_images[i].h == id) {
                    ba_result['success']++;
                    console.log('success', uint8arr.length, new Date().getTime() - ba_time);
                    ba_id++;
                    benchmarkireq();

                    previewsrc(myURL.createObjectURL(new Blob([uint8arr], {
                        type: 'image/jpeg'
                    })));
                }
            }
        }, eot);
    }
    else {
        console.log('ready');
        slideshowid = undefined;
        preqs = {};
    }

}

// Do not change this to a remote URL since it'll cause a CORS issue (tainted canvas)
// Neither change it to base64, just a URL-encoded Data URI
var noThumbURI =
    'data:image/svg+xml;charset-utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22240' +
    'pt%22%20height%3D%22240pt%22%20viewBox%3D%220%200%20240%20240%22%3E%3Cpath%20fill%3D%22rgb(80%25,79.607843%25' +
    ',79.607843%25)%22%20fill-rule%3D%22evenodd%22%20d%3D%22M120%20132c6.63%200%2012-5.37%2012-12%200-2.3-.65-4.42' +
    '-1.76-6.24l-16.48%2016.48c1.82%201.1%203.95%201.76%206.24%201.76zm-21.7%205.7c-3.93-4.83-6.3-11-6.3-17.7%200-' +
    '15.47%2012.54-28%2028-28%206.7%200%2012.87%202.37%2017.7%206.3l10.48-10.48C140%2083.18%20130.65%2080%20120%20' +
    '80c-32%200-52.37%2028.57-64%2040%206.96%206.84%2017.05%2019.8%2030.88%2029.13zm54.83-46.82L141.7%20102.3c3.93' +
    '%204.83%206.3%2011%206.3%2017.7%200%2015.47-12.54%2028-28%2028-6.7%200-12.87-2.37-17.7-6.3l-10.48%2010.48C100' +
    '%20156.82%20109.35%20160%20120%20160c32%200%2052.37-28.57%2064-40-6.96-6.84-17.05-19.8-30.88-29.13zM120%20108' +
    'c-6.63%200-12%205.37-12%2012%200%202.3.65%204.42%201.76%206.24l16.48-16.48c-1.82-1.1-3.95-1.76-6.24-1.76zm0%2' +
    '00%22%2F%3E%3C%2Fsvg%3E';

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MIT/X11 License
 *
 * JavaScript library for reading EXIF image metadata.
 * Copyright (c) 2008 Jacob Seidelin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 * ** THIS IS A FORK ** @origin: https://github.com/diegocr/exif-js
 *
 * ***** END LICENSE BLOCK ***** */

(function(root, factory){
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = factory();
        } else {
            exports.EXIF = factory();
        }
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.EXIF = factory();
    }
}(this, function() {

    var debug = Boolean(this.d) || 0;

    var EXIF = function(obj) {
        if (obj instanceof EXIF) return obj;
        if (!(this instanceof EXIF)) return new EXIF(obj);
        this.EXIFwrapped = obj;
    };

    var ExifTags = EXIF.Tags = {

        // version tags
        0x9000 : "ExifVersion",             // EXIF version
        0xA000 : "FlashpixVersion",         // Flashpix format version

        // colorspace tags
        0xA001 : "ColorSpace",              // Color space information tag

        // image configuration
        0xA002 : "PixelXDimension",         // Valid width of meaningful image
        0xA003 : "PixelYDimension",         // Valid height of meaningful image
        0x9101 : "ComponentsConfiguration", // Information about channels
        0x9102 : "CompressedBitsPerPixel",  // Compressed bits per pixel

        // user information
        0x927C : "MakerNote",               // Any desired information written by the manufacturer
        0x9286 : "UserComment",             // Comments by user

        // related file
        0xA004 : "RelatedSoundFile",        // Name of related sound file

        // date and time
        0x9003 : "DateTimeOriginal",        // Date and time when the original image was generated
        0x9004 : "DateTimeDigitized",       // Date and time when the image was stored digitally
        0x9290 : "SubsecTime",              // Fractions of seconds for DateTime
        0x9291 : "SubsecTimeOriginal",      // Fractions of seconds for DateTimeOriginal
        0x9292 : "SubsecTimeDigitized",     // Fractions of seconds for DateTimeDigitized

        // picture-taking conditions
        0x829A : "ExposureTime",            // Exposure time (in seconds)
        0x829D : "FNumber",                 // F number
        0x8822 : "ExposureProgram",         // Exposure program
        0x8824 : "SpectralSensitivity",     // Spectral sensitivity
        0x8827 : "ISOSpeedRatings",         // ISO speed rating
        0x8828 : "OECF",                    // Optoelectric conversion factor
        0x9201 : "ShutterSpeedValue",       // Shutter speed
        0x9202 : "ApertureValue",           // Lens aperture
        0x9203 : "BrightnessValue",         // Value of brightness
        0x9204 : "ExposureBias",            // Exposure bias
        0x9205 : "MaxApertureValue",        // Smallest F number of lens
        0x9206 : "SubjectDistance",         // Distance to subject in meters
        0x9207 : "MeteringMode",            // Metering mode
        0x9208 : "LightSource",             // Kind of light source
        0x9209 : "Flash",                   // Flash status
        0x9214 : "SubjectArea",             // Location and area of main subject
        0x920A : "FocalLength",             // Focal length of the lens in mm
        0xA20B : "FlashEnergy",             // Strobe energy in BCPS
        0xA20C : "SpatialFrequencyResponse",    //
        0xA20E : "FocalPlaneXResolution",   // Number of pixels in width direction per FocalPlaneResolutionUnit
        0xA20F : "FocalPlaneYResolution",   // Number of pixels in height direction per FocalPlaneResolutionUnit
        0xA210 : "FocalPlaneResolutionUnit",    // Unit for measuring FocalPlaneXResolution and FocalPlaneYResolution
        0xA214 : "SubjectLocation",         // Location of subject in image
        0xA215 : "ExposureIndex",           // Exposure index selected on camera
        0xA217 : "SensingMethod",           // Image sensor type
        0xA300 : "FileSource",              // Image source (3 == DSC)
        0xA301 : "SceneType",               // Scene type (1 == directly photographed)
        0xA302 : "CFAPattern",              // Color filter array geometric pattern
        0xA401 : "CustomRendered",          // Special processing
        0xA402 : "ExposureMode",            // Exposure mode
        0xA403 : "WhiteBalance",            // 1 = auto white balance, 2 = manual
        0xA404 : "DigitalZoomRation",       // Digital zoom ratio
        0xA405 : "FocalLengthIn35mmFilm",   // Equivalent foacl length assuming 35mm film camera (in mm)
        0xA406 : "SceneCaptureType",        // Type of scene
        0xA407 : "GainControl",             // Degree of overall image gain adjustment
        0xA408 : "Contrast",                // Direction of contrast processing applied by camera
        0xA409 : "Saturation",              // Direction of saturation processing applied by camera
        0xA40A : "Sharpness",               // Direction of sharpness processing applied by camera
        0xA40B : "DeviceSettingDescription",    //
        0xA40C : "SubjectDistanceRange",    // Distance to subject

        // other tags
        0xA005 : "InteroperabilityIFDPointer",
        0xA420 : "ImageUniqueID"            // Identifier assigned uniquely to each image
    };

    var TiffTags = EXIF.TiffTags = {
        0x0100 : "ImageWidth",
        0x0101 : "ImageHeight",
        0x8769 : "ExifIFDPointer",
        0x8825 : "GPSInfoIFDPointer",
        0xA005 : "InteroperabilityIFDPointer",
        0x0102 : "BitsPerSample",
        0x0103 : "Compression",
        0x0106 : "PhotometricInterpretation",
        0x0112 : "Orientation",
        0x0115 : "SamplesPerPixel",
        0x011C : "PlanarConfiguration",
        0x0212 : "YCbCrSubSampling",
        0x0213 : "YCbCrPositioning",
        0x011A : "XResolution",
        0x011B : "YResolution",
        0x0128 : "ResolutionUnit",
        0x0111 : "StripOffsets",
        0x0116 : "RowsPerStrip",
        0x0117 : "StripByteCounts",
        0x0201 : "JPEGInterchangeFormat",
        0x0202 : "JPEGInterchangeFormatLength",
        0x012D : "TransferFunction",
        0x013E : "WhitePoint",
        0x013F : "PrimaryChromaticities",
        0x0211 : "YCbCrCoefficients",
        0x0214 : "ReferenceBlackWhite",
        0x0132 : "DateTime",
        0x010E : "ImageDescription",
        0x010F : "Make",
        0x0110 : "Model",
        0x0131 : "Software",
        0x013B : "Artist",
        0x8298 : "Copyright",
        0x9c9b : "XPTitle",
        0x9c9c : "XPComment",
        0x9c9d : "XPAuthor",
        0x9c9e : "XPKeywords",
        0x9c9f : "XPSubject"
    };

    var GPSTags = EXIF.GPSTags = {
        0x0000 : "GPSVersionID",
        0x0001 : "GPSLatitudeRef",
        0x0002 : "GPSLatitude",
        0x0003 : "GPSLongitudeRef",
        0x0004 : "GPSLongitude",
        0x0005 : "GPSAltitudeRef",
        0x0006 : "GPSAltitude",
        0x0007 : "GPSTimeStamp",
        0x0008 : "GPSSatellites",
        0x0009 : "GPSStatus",
        0x000A : "GPSMeasureMode",
        0x000B : "GPSDOP",
        0x000C : "GPSSpeedRef",
        0x000D : "GPSSpeed",
        0x000E : "GPSTrackRef",
        0x000F : "GPSTrack",
        0x0010 : "GPSImgDirectionRef",
        0x0011 : "GPSImgDirection",
        0x0012 : "GPSMapDatum",
        0x0013 : "GPSDestLatitudeRef",
        0x0014 : "GPSDestLatitude",
        0x0015 : "GPSDestLongitudeRef",
        0x0016 : "GPSDestLongitude",
        0x0017 : "GPSDestBearingRef",
        0x0018 : "GPSDestBearing",
        0x0019 : "GPSDestDistanceRef",
        0x001A : "GPSDestDistance",
        0x001B : "GPSProcessingMethod",
        0x001C : "GPSAreaInformation",
        0x001D : "GPSDateStamp",
        0x001E : "GPSDifferential"
    };

    var StringValues = EXIF.StringValues = {
        ExposureProgram : {
            0 : "Not defined",
            1 : "Manual",
            2 : "Normal program",
            3 : "Aperture priority",
            4 : "Shutter priority",
            5 : "Creative program",
            6 : "Action program",
            7 : "Portrait mode",
            8 : "Landscape mode"
        },
        MeteringMode : {
            0 : "Unknown",
            1 : "Average",
            2 : "CenterWeightedAverage",
            3 : "Spot",
            4 : "MultiSpot",
            5 : "Pattern",
            6 : "Partial",
            255 : "Other"
        },
        LightSource : {
            0 : "Unknown",
            1 : "Daylight",
            2 : "Fluorescent",
            3 : "Tungsten (incandescent light)",
            4 : "Flash",
            9 : "Fine weather",
            10 : "Cloudy weather",
            11 : "Shade",
            12 : "Daylight fluorescent (D 5700 - 7100K)",
            13 : "Day white fluorescent (N 4600 - 5400K)",
            14 : "Cool white fluorescent (W 3900 - 4500K)",
            15 : "White fluorescent (WW 3200 - 3700K)",
            17 : "Standard light A",
            18 : "Standard light B",
            19 : "Standard light C",
            20 : "D55",
            21 : "D65",
            22 : "D75",
            23 : "D50",
            24 : "ISO studio tungsten",
            255 : "Other"
        },
        Flash : {
            0x0000 : "Flash did not fire",
            0x0001 : "Flash fired",
            0x0005 : "Strobe return light not detected",
            0x0007 : "Strobe return light detected",
            0x0009 : "Flash fired, compulsory flash mode",
            0x000D : "Flash fired, compulsory flash mode, return light not detected",
            0x000F : "Flash fired, compulsory flash mode, return light detected",
            0x0010 : "Flash did not fire, compulsory flash mode",
            0x0018 : "Flash did not fire, auto mode",
            0x0019 : "Flash fired, auto mode",
            0x001D : "Flash fired, auto mode, return light not detected",
            0x001F : "Flash fired, auto mode, return light detected",
            0x0020 : "No flash function",
            0x0041 : "Flash fired, red-eye reduction mode",
            0x0045 : "Flash fired, red-eye reduction mode, return light not detected",
            0x0047 : "Flash fired, red-eye reduction mode, return light detected",
            0x0049 : "Flash fired, compulsory flash mode, red-eye reduction mode",
            0x004D : "Flash fired, compulsory flash mode, red-eye reduction mode, return light not detected",
            0x004F : "Flash fired, compulsory flash mode, red-eye reduction mode, return light detected",
            0x0059 : "Flash fired, auto mode, red-eye reduction mode",
            0x005D : "Flash fired, auto mode, return light not detected, red-eye reduction mode",
            0x005F : "Flash fired, auto mode, return light detected, red-eye reduction mode"
        },
        SensingMethod : {
            1 : "Not defined",
            2 : "One-chip color area sensor",
            3 : "Two-chip color area sensor",
            4 : "Three-chip color area sensor",
            5 : "Color sequential area sensor",
            7 : "Trilinear sensor",
            8 : "Color sequential linear sensor"
        },
        SceneCaptureType : {
            0 : "Standard",
            1 : "Landscape",
            2 : "Portrait",
            3 : "Night scene"
        },
        SceneType : {
            1 : "Directly photographed"
        },
        CustomRendered : {
            0 : "Normal process",
            1 : "Custom process"
        },
        WhiteBalance : {
            0 : "Auto white balance",
            1 : "Manual white balance"
        },
        GainControl : {
            0 : "None",
            1 : "Low gain up",
            2 : "High gain up",
            3 : "Low gain down",
            4 : "High gain down"
        },
        Contrast : {
            0 : "Normal",
            1 : "Soft",
            2 : "Hard"
        },
        Saturation : {
            0 : "Normal",
            1 : "Low saturation",
            2 : "High saturation"
        },
        Sharpness : {
            0 : "Normal",
            1 : "Soft",
            2 : "Hard"
        },
        SubjectDistanceRange : {
            0 : "Unknown",
            1 : "Macro",
            2 : "Close view",
            3 : "Distant view"
        },
        FileSource : {
            3 : "DSC"
        },

        Components : {
            0 : "",
            1 : "Y",
            2 : "Cb",
            3 : "Cr",
            4 : "R",
            5 : "G",
            6 : "B"
        }
    };

    function imageHasData(img) {
        return !!(img.exifdata);
    }

    function getImageData(img, callback) {
        function handleBinaryFile(binFile) {
            var data = findEXIFinJPEG(binFile);
            var iptcdata = findIPTCinJPEG(binFile);
            img.exifdata = data || {};
            img.iptcdata = iptcdata || {};
            if (callback) {
                callback.call(img);
            }
        }

        if (img.src) {
            var http = new XMLHttpRequest();
            http.onloadend = function() {
                if (this.status === 200 || this.status === 0) {
                    handleBinaryFile(http.response);
                } else {
                    callback(new Error("Could not load image"));
                }
                http = null;
            };
            http.open("GET", img.src, true);
            http.responseType = "arraybuffer";
            http.send(null);
        } else if (window.FileReader && (img instanceof window.Blob || img instanceof window.File)) {
            var fileReader = new FileReader();
            fileReader.onload = function(e) {
                if (debug) console.log("Got file of length " + e.target.result.byteLength);
                handleBinaryFile(e.target.result);
            };

            fileReader.readAsArrayBuffer(img);
        }
    }

    function findEXIFinJPEG(file, deepSearch) {
        var dataView = new DataView(file);

        var offset = 2,
            length = file.byteLength,
            marker;

        if (debug) console.log("Got file of length " + file.byteLength);
        if ((dataView.getUint8(0) != 0xFF) || (dataView.getUint8(1) != 0xD8)) {
            switch(dataView.getUint16(0)) {
                case 0x4949:
                case 0x4D4D:
                    if ((marker = readEXIFData(dataView, 0, -1)))
                        return marker;
            }
            if (!deepSearch) {
                if (debug) console.log("Not a valid JPEG");
                return false; // not a valid jpeg
            }
            var pos = 0;
            var data = new Uint8Array(file);
            while (pos < length) {
                if (data[pos] === 0xff && data[pos+1] === 0xd8) break;
                ++pos;
            }
            if (pos == length) return false; // no embed image
            offset += pos;
        }

        while (offset < length) {
            if (dataView.getUint8(offset) != 0xFF) {
                if (debug) console.log("Not a valid marker at offset " + offset + ", found: " + dataView.getUint8(offset));
                return false; // not a valid marker, something is wrong
            }

            marker = dataView.getUint8(offset + 1);
            if (debug) console.log(marker);

            // we could implement handling for other markers here,
            // but we're only looking for 0xFFE1 for EXIF data

            if (marker == 225) {
                if (debug) console.log("Found 0xFFE1 marker");

                return readEXIFData(dataView, offset + 4);

                // offset += 2 + file.getShortAt(offset+2, true);

            } else {
                offset += 2 + dataView.getUint16(offset+2);
            }

        }

    }

    function findIPTCinJPEG(file) {
        var dataView = new DataView(file);

        if (debug) console.log("Got file of length " + file.byteLength);
        if ((dataView.getUint8(0) != 0xFF) || (dataView.getUint8(1) != 0xD8)) {
            if (debug) console.log("Not a valid JPEG");
            return false; // not a valid jpeg
        }

        var offset = 2,
            length = file.byteLength;


        var isFieldSegmentStart = function(dataView, offset){
            return (
                dataView.getUint8(offset) === 0x38 &&
                dataView.getUint8(offset+1) === 0x42 &&
                dataView.getUint8(offset+2) === 0x49 &&
                dataView.getUint8(offset+3) === 0x4D &&
                dataView.getUint8(offset+4) === 0x04 &&
                dataView.getUint8(offset+5) === 0x04
            );
        };

        while (offset < length) {

            if ( isFieldSegmentStart(dataView, offset )){

                // Get the length of the name header (which is padded to an even number of bytes)
                var nameHeaderLength = dataView.getUint8(offset+7);
                if(nameHeaderLength % 2 !== 0) nameHeaderLength += 1;
                // Check for pre photoshop 6 format
                if(nameHeaderLength === 0) {
                    // Always 4
                    nameHeaderLength = 4;
                }

                var startOffset = offset + 8 + nameHeaderLength;
                var sectionLength = dataView.getUint16(offset + 6 + nameHeaderLength);

                return readIPTCData(file, startOffset, sectionLength);

                break;

            }


            // Not the marker, continue searching
            offset++;

        }

    }
    var IptcFieldMap = {
        0x78 : 'caption',
        0x6E : 'credit',
        0x19 : 'keywords',
        0x37 : 'dateCreated',
        0x50 : 'byline',
        0x55 : 'bylineTitle',
        0x7A : 'captionWriter',
        0x69 : 'headline',
        0x74 : 'copyright',
        0x0F : 'category',
        0x10 : 'imageRank',
        0x65 : 'country',
        0x73 : 'source',
        0x5C : 'venue',
        0x5a : 'city',
        0x05 : 'objectName',
        0x07 : 'editStatus',
        0x14 : 'supplementalCategories',
        0x64 : 'countryCode',
        0x5f : 'state',
        0x28 : 'specialInstructions',
        0x65 : 'composition',
        0x4b : 'objectCycle'
    };
    function readIPTCData(file, startOffset, sectionLength){
        var dataView = new DataView(file);
        var data = {};
        var fieldValue, fieldName, dataSize, segmentType, segmentSize;
        var segmentStartPos = startOffset;
        while(segmentStartPos < startOffset+sectionLength) {
            if(dataView.getUint8(segmentStartPos) === 0x1C && dataView.getUint8(segmentStartPos+1) === 0x02){
                segmentType = dataView.getUint8(segmentStartPos+2);
                if(segmentType in IptcFieldMap) {
                    dataSize = dataView.getInt16(segmentStartPos+3);
                    segmentSize = dataSize + 5;
                    fieldName = IptcFieldMap[segmentType];
                    fieldValue = getStringFromDB(dataView, segmentStartPos+5, dataSize);
                    // Check if we already stored a value with this name
                    if(data.hasOwnProperty(fieldName)) {
                        // Value already stored with this name, create multivalue field
                        if(data[fieldName] instanceof Array) {
                            data[fieldName].push(fieldValue);
                        }
                        else {
                            data[fieldName] = [data[fieldName], fieldValue];
                        }
                    }
                    else {
                        data[fieldName] = fieldValue;
                    }
                }

            }
            segmentStartPos++;
        }
        return data;
    }



    function readTags(file, tiffStart, dirStart, strings, bigEnd) {
        var entries = file.getUint16(dirStart, !bigEnd),
            tags = {},
            entryOffset, tag,
            i;

        for (i=0;i<entries;i++) {
            entryOffset = dirStart + i*12 + 2;
            tag = strings[file.getUint16(entryOffset, !bigEnd)];
            if (!tag && debug) console.log("Unknown tag: 0x" + file.getUint16(entryOffset, !bigEnd).toString(16));
            if (tag) tags[tag] = readTagValue(file, entryOffset, tiffStart, dirStart, bigEnd);
        }
        return tags;
    }


    function readTagValue(file, entryOffset, tiffStart, dirStart, bigEnd) {
        var type = file.getUint16(entryOffset+2, !bigEnd),
            numValues = file.getUint32(entryOffset+4, !bigEnd),
            valueOffset = file.getUint32(entryOffset+8, !bigEnd) + tiffStart,
            offset,
            vals, val, n,
            numerator, denominator;

        switch (type) {
            case 1: // byte, 8-bit unsigned int
            case 7: // undefined, 8-bit byte, value depending on field
                if (numValues == 1) {
                    return file.getUint8(entryOffset + 8, !bigEnd);
                } else {
                    offset = numValues > 4 ? valueOffset : (entryOffset + 8);
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        vals[n] = file.getUint8(offset + n);
                    }
                    return vals;
                }

            case 2: // ascii, 8-bit byte
                offset = numValues > 4 ? valueOffset : (entryOffset + 8);
                return getStringFromDB(file, offset, numValues-1);

            case 3: // short, 16 bit int
                if (numValues == 1) {
                    return file.getUint16(entryOffset + 8, !bigEnd);
                } else {
                    offset = numValues > 2 ? valueOffset : (entryOffset + 8);
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        vals[n] = file.getUint16(offset + 2*n, !bigEnd);
                    }
                    return vals;
                }

            case 4: // long, 32 bit int
                if (numValues == 1) {
                    return file.getUint32(entryOffset + 8, !bigEnd);
                } else {
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        vals[n] = file.getUint32(valueOffset + 4*n, !bigEnd);
                    }
                    return vals;
                }

            case 5:    // rational = two long values, first is numerator, second is denominator
                if (numValues == 1) {
                    numerator = file.getUint32(valueOffset, !bigEnd);
                    denominator = file.getUint32(valueOffset+4, !bigEnd);
                    val = new Number(numerator / denominator);
                    val.numerator = numerator;
                    val.denominator = denominator;
                    return val;
                } else {
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        numerator = file.getUint32(valueOffset + 8*n, !bigEnd);
                        denominator = file.getUint32(valueOffset+4 + 8*n, !bigEnd);
                        vals[n] = new Number(numerator / denominator);
                        vals[n].numerator = numerator;
                        vals[n].denominator = denominator;
                    }
                    return vals;
                }

            case 9: // slong, 32 bit signed int
                if (numValues == 1) {
                    return file.getInt32(entryOffset + 8, !bigEnd);
                } else {
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        vals[n] = file.getInt32(valueOffset + 4*n, !bigEnd);
                    }
                    return vals;
                }

            case 10: // signed rational, two slongs, first is numerator, second is denominator
                if (numValues == 1) {
                    return file.getInt32(valueOffset, !bigEnd) / file.getInt32(valueOffset+4, !bigEnd);
                } else {
                    vals = [];
                    for (n=0;n<numValues;n++) {
                        vals[n] = file.getInt32(valueOffset + 8*n, !bigEnd) / file.getInt32(valueOffset+4 + 8*n, !bigEnd);
                    }
                    return vals;
                }
        }
    }

    function getStringFromDB(buffer, start, length) {
        var outstr = "";
        for (var n = start; n < start+length; n++) {
            outstr += String.fromCharCode(buffer.getUint8(n));
        }
        return outstr;
    }

    function readEXIFData(file, start, ignoreHeader) {
        if (!ignoreHeader && getStringFromDB(file, start, 4) != "Exif") {
            if (debug) console.log("Not valid EXIF data! " + getStringFromDB(file, start, 4));
            return false;
        }

        var bigEnd,
            tags, tag, tmp,
            exifData, gpsData,
            tiffOffset = ignoreHeader ? 0 : (start + 6);

        // test for TIFF validity and endianness
        tmp = file.getUint16(tiffOffset);
        if (tmp == 0x4949) {
            bigEnd = false;
        } else if (tmp == 0x4D4D) {
            bigEnd = true;
        } else {
            if (debug) console.log("Not valid TIFF data! (no 0x4949 or 0x4D4D)");
            return false;
        }

        tmp = file.getUint16(tiffOffset+2, !bigEnd);
        switch(tmp) {
            case 0x002A:
            case 0x5253: // Olympus ORF
            case 0x5352: // Olympus ORF (sp350)
            case 0x4f52: // Olympus ORF (e410)
            case 0x0055: // Panasonic DMC-x
                break;
            default:
                if (debug) console.log("Not valid TIFF data! - got 0x" + tmp.toString(16));
                return false;
        }

        var firstIFDOffset = file.getUint32(tiffOffset+4, !bigEnd);

        if (firstIFDOffset === 0xe48000) {
            /* Sony DSC/DSLR */
            firstIFDOffset = 8;
        }
        else if (firstIFDOffset < 0x00000008) {
            if (debug) console.log("Not valid TIFF data! -- First offset was 0x" + tmp.toString(16));
            return false;
        }

        tags = readTags(file, tiffOffset, tiffOffset + firstIFDOffset, TiffTags, bigEnd);

        if (tags.ExifIFDPointer) {
            exifData = readTags(file, tiffOffset, tiffOffset + tags.ExifIFDPointer, ExifTags, bigEnd);
            for (tag in exifData) {
                if (!exifData[tag]) {
                    continue;
                }
                switch (tag) {
                    case "LightSource" :
                    case "Flash" :
                    case "MeteringMode" :
                    case "ExposureProgram" :
                    case "SensingMethod" :
                    case "SceneCaptureType" :
                    case "SceneType" :
                    case "CustomRendered" :
                    case "WhiteBalance" :
                    case "GainControl" :
                    case "Contrast" :
                    case "Saturation" :
                    case "Sharpness" :
                    case "SubjectDistanceRange" :
                    case "FileSource" :
                        exifData[tag] = StringValues[tag][exifData[tag]];
                        break;

                    case "ExposureTime" :
                        exifData[tag] = exifData[tag].numerator + "/" + exifData[tag].denominator;
                        break;

                    case "ExifVersion" :
                    case "FlashpixVersion" :
                        exifData[tag] = String.fromCharCode(exifData[tag][0], exifData[tag][1], exifData[tag][2], exifData[tag][3]);
                        break;

                    case "ComponentsConfiguration" :
                        exifData[tag] =
                            StringValues.Components[exifData[tag][0]] +
                            StringValues.Components[exifData[tag][1]] +
                            StringValues.Components[exifData[tag][2]] +
                            StringValues.Components[exifData[tag][3]];
                        break;
                }
                tags[tag] = exifData[tag];
            }
        }

        if (tags.GPSInfoIFDPointer) {
            gpsData = readTags(file, tiffOffset, tiffOffset + tags.GPSInfoIFDPointer, GPSTags, bigEnd);
            for (tag in gpsData) {
                switch (tag) {
                    case "GPSVersionID" :
                        gpsData[tag] = gpsData[tag][0] +
                            "." + gpsData[tag][1] +
                            "." + gpsData[tag][2] +
                            "." + gpsData[tag][3];
                        break;
                }
                tags[tag] = gpsData[tag];
            }
        }

        return tags;
    }

    EXIF.getData = function(img, callback) {
        if ((img instanceof Image || img instanceof HTMLImageElement) && !img.complete) return false;

        if (!imageHasData(img)) {
            getImageData(img, callback);
        } else {
            if (callback) {
                callback.call(img);
            }
        }
        return true;
    }

    EXIF.getTag = function(img, tag) {
        if (!imageHasData(img)) return;
        return img.exifdata[tag];
    }

    EXIF.getAllTags = function(img) {
        if (!imageHasData(img)) return {};
        var a,
            data = img.exifdata,
            tags = {};
        for (a in data) {
            if (data.hasOwnProperty(a)) {
                tags[a] = data[a];
            }
        }
        return tags;
    }

    EXIF.pretty = function(img) {
        if (!imageHasData(img)) return "";
        var a,
            data = img.exifdata,
            strPretty = "";
        for (a in data) {
            if (data.hasOwnProperty(a)) {
                if (typeof data[a] == "object") {
                    if (data[a] instanceof Number) {
                        strPretty += a + " : " + data[a] + " [" + data[a].numerator + "/" + data[a].denominator + "]\r\n";
                    } else {
                        strPretty += a + " : [" + data[a].length + " values]\r\n";
                    }
                } else {
                    strPretty += a + " : " + data[a] + "\r\n";
                }
            }
        }
        return strPretty;
    }

    EXIF.readFromBinaryFile =
    EXIF.readFromArrayBuffer = function(file, deepSearch, includeTags) {
        var tags;
        try {
            tags = findEXIFinJPEG(file.buffer || file, deepSearch);
        } catch(ex) {
            if (debug) console.error(ex);
        }
        if ((tags = Object(tags)) && includeTags) {
            if (typeof includeTags === 'string') {
                tags = tags[includeTags];
            } else {
                tags = includeTags.reduce(function(out, tag) {
                    if (tag in tags) {
                        out[tag] = tags[tag];
                    }
                    return out;
                }, Object.create(null));
            }
        }
        return Object.freeze(tags);
    };

    return EXIF;
}));

/** smart-crop.js
 * A javascript library implementing content aware image cropping
 *
 * Copyright (C) 2014 Jonas Wagner
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

(function(){
"use strict";

function SmartCrop(options){
   this.options = Object.assign({}, SmartCrop.DEFAULTS, options);
}
SmartCrop.DEFAULTS = {
    width: 0,
    height: 0,
    aspect: 0,
    cropWidth: 0,
    cropHeight: 0,
    detailWeight: 0.2,
    skinColor: [0.78, 0.57, 0.44],
    skinBias: 0.01,
    skinBrightnessMin: 0.2,
    skinBrightnessMax: 1.0,
    skinThreshold: 0.8,
    skinWeight: 1.8,
    saturationBrightnessMin: 0.05,
    saturationBrightnessMax: 0.9,
    saturationThreshold: 0.4,
    saturationBias: 0.2,
    saturationWeight: 0.3,
    // step * minscale rounded down to the next power of two should be good
    scoreDownSample: 8,
    step: 8,
    scaleStep: 0.1,
    minScale: 0.9,
    maxScale: 1.0,
    edgeRadius: 0.4,
    edgeWeight: -20.0,
    outsideImportance: -0.5,
    ruleOfThirds: true,
    prescale: true,
    antialias: false,
    canvasFactory: null,
    resampleWithImageBitmap: false,
    debug: false
};
SmartCrop.crop = async function(image, options, callback){
    if(options.aspect){
        options.width = options.aspect;
        options.height = 1;
    }

    // work around images scaled in css by drawing them onto a canvas
    if(image.naturalWidth && (image.naturalWidth != image.width || image.naturalHeight != image.height)){
        var c = new SmartCrop(options).canvas(image.naturalWidth, image.naturalHeight),
            cctx = c.getContext('2d');
        c.width = image.naturalWidth;
        c.height = image.naturalHeight;
        cctx.drawImage(image, 0, 0);
        image = c;
    }

    var scale = 1,
        prescale = 1;
    if(options.width && options.height) {
        scale = min(image.width/options.width, image.height/options.height);
        options.cropWidth = ~~(options.width * scale);
        options.cropHeight = ~~(options.height * scale);
        // img = 100x100, width = 95x95, scale = 100/95, 1/scale > min
        // don't set minscale smaller than 1/scale
        // -> don't pick crops that need upscaling
        options.minScale = min(options.maxScale || SmartCrop.DEFAULTS.maxScale, max(1/scale, (options.minScale||SmartCrop.DEFAULTS.minScale)));
    }
    var smartCrop = new SmartCrop(options);
    if(options.width && options.height) {
        if(options.prescale !== false){
            prescale = 1/scale/options.minScale;
            if(prescale < 1) {
                image = await smartCrop.resample(image, image.width*prescale, image.height*prescale);
                smartCrop.options.cropWidth = ~~(options.cropWidth*prescale);
                smartCrop.options.cropHeight = ~~(options.cropHeight*prescale);
            }
            else {
                prescale = 1;
            }
        }
    }
    const result = await smartCrop.analyse(image);
    for(var i = 0, i_len = result.crops.length; i < i_len; i++) {
        var crop = result.crops[i];
        crop.x = ~~(crop.x/prescale);
        crop.y = ~~(crop.y/prescale);
        crop.width = ~~(crop.width/prescale);
        crop.height = ~~(crop.height/prescale);
    }
    if(callback) callback(result);
    return result;
};
// check if all the dependencies are there
SmartCrop.isAvailable = function(options){
    try {
        var s = new this(options),
            c = s.canvas(16, 16);
        return typeof c.getContext === 'function';
    }
    catch(e){
        return false;
    }
};
SmartCrop.prototype = {
    canvas: function(w, h){
        if(this.options.canvasFactory !== null){
            return this.options.canvasFactory(w, h);
        }
        var c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
    },
    edgeDetect: function(i, o){
        var id = i.data,
            od = o.data,
            w = i.width,
            h = i.height;
        for(var y = 0; y < h; y++) {
            for(var x = 0; x < w; x++) {
                var p = (y*w+x)*4,
                    lightness;
                if(x === 0 || x >= w-1 || y === 0 || y >= h-1){
                    lightness = sample(id, p);
                }
                else {
                    lightness = sample(id, p)*4 - sample(id, p-w*4) - sample(id, p-4) - sample(id, p+4) - sample(id, p+w*4);
                }
                od[p+1] = lightness;
            }
        }
    },
    skinDetect: function(i, o){
        var id = i.data,
            od = o.data,
            w = i.width,
            h = i.height,
            options = this.options;
        for(var y = 0; y < h; y++) {
            for(var x = 0; x < w; x++) {
                var p = (y*w+x)*4,
                    lightness = cie(id[p], id[p+1], id[p+2])/255,
                    skin = this.skinColor(id[p], id[p+1], id[p+2]);
                if(skin > options.skinThreshold && lightness >= options.skinBrightnessMin && lightness <= options.skinBrightnessMax){
                    od[p] = (skin-options.skinThreshold)*(255/(1-options.skinThreshold));
                }
                else {
                    od[p] = 0;
                }
            }
        }
    },
    saturationDetect: function(i, o){
        var id = i.data,
            od = o.data,
            w = i.width,
            h = i.height,
            options = this.options;
        for(var y = 0; y < h; y++) {
            for(var x = 0; x < w; x++) {
                var p = (y*w+x)*4,
                    lightness = cie(id[p], id[p+1], id[p+2])/255,
                    sat = saturation(id[p], id[p+1], id[p+2]);
                if(sat > options.saturationThreshold && lightness >= options.saturationBrightnessMin && lightness <= options.saturationBrightnessMax){
                    od[p+2] = (sat-options.saturationThreshold)*(255/(1-options.saturationThreshold));
                }
                else {
                    od[p+2] = 0;
                }
            }
        }
    },
    crops: function(image){
        var crops = [],
            width = image.width,
            height = image.height,
            options = this.options,
            minDimension = min(width, height),
            cropWidth = options.cropWidth || minDimension,
            cropHeight = options.cropHeight || minDimension;
        for(var scale = options.maxScale; scale >= options.minScale; scale -= options.scaleStep){
            for(var y = 0; y+cropHeight*scale <= height; y+=options.step) {
                for(var x = 0; x+cropWidth*scale <= width; x+=options.step) {
                    crops.push({
                        x: x,
                        y: y,
                        width: cropWidth*scale,
                        height: cropHeight*scale
                    });
                }
            }
        }
        return crops;
    },
    score: function(output, crop){
        var score = {
                detail: 0,
                saturation: 0,
                skin: 0,
                total: 0
            },
            options = this.options,
            od = output.data,
            downSample = options.scoreDownSample,
            invDownSample = 1/downSample,
            outputHeightDownSample = output.height*downSample,
            outputWidthDownSample = output.width*downSample,
            outputWidth = output.width;
        for(var y = 0; y < outputHeightDownSample; y+=downSample) {
            for(var x = 0; x < outputWidthDownSample; x+=downSample) {
                var p = (~~(y*invDownSample)*outputWidth+~~(x*invDownSample))*4,
                    importance = this.importance(crop, x, y),
                    detail = od[p+1]/255;
                score.skin += od[p]/255*(detail+options.skinBias)*importance;
                score.detail += detail*importance;
                score.saturation += od[p+2]/255*(detail+options.saturationBias)*importance;
            }

        }
        score.total = (score.detail*options.detailWeight + score.skin*options.skinWeight + score.saturation*options.saturationWeight)/crop.width/crop.height;
        return score;
    },
    importance: function(crop, x, y){
        var options = this.options;

        if (crop.x > x || x >= crop.x+crop.width || crop.y > y || y >= crop.y+crop.height) return options.outsideImportance;
        x = (x-crop.x)/crop.width;
        y = (y-crop.y)/crop.height;
        var px = abs(0.5-x)*2,
            py = abs(0.5-y)*2,
            // distance from edge
            dx = Math.max(px-1.0+options.edgeRadius, 0),
            dy = Math.max(py-1.0+options.edgeRadius, 0),
            d = (dx*dx+dy*dy)*options.edgeWeight;
        var s = 1.41-sqrt(px*px+py*py);
        if(options.ruleOfThirds){
            s += (Math.max(0, s+d+0.5)*1.2)*(thirds(px)+thirds(py));
        }
        return s+d;
    },
    skinColor: function(r, g, b){
        var mag = sqrt(r*r+g*g+b*b),
            options = this.options,
            rd = (r/mag-options.skinColor[0]),
            gd = (g/mag-options.skinColor[1]),
            bd = (b/mag-options.skinColor[2]),
            d = sqrt(rd*rd+gd*gd+bd*bd);
            return 1-d;
    },
    async resample(image, width, height){
        const canvas = this.canvas(width, height);
        const ctx = canvas.getContext('2d');
        if(this.options.resampleWithImageBitmap) {
            const options = {
                resizeWidth: width,
                resizeHeight: height,
                resizeQuality: 'high'
            };
            const bitmap = await createImageBitmap(image, options)
                .catch((ex) => {
                    SmartCrop.dump('createImageBitmap failed!', ex);
                });
            if (bitmap) {
                ctx.drawImage(bitmap, 0, 0);
                return canvas;
            }
        }
        if(image instanceof ImageData) {
            SmartCrop.dump('Got an ImageData, do use ImageBitmap which should be faster!');
            const canvas2 = this.canvas(image.width, image.height);
            canvas2.getContext('2d').putImageData(image, 0, 0);
            image = canvas2;
        }
        if(this.options.antialias && ctx.filter === 'none') {
            const cv = this.canvas(image.width, image.height);
            const cx = cv.getContext('2d');
            cx.filter = `blur(${(cv.width / canvas.width) >> 1}px)`;
            cx.drawImage(image, 0, 0);
            image = cv;
        }
        ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);
        return canvas;
    },
    async analyse(image){
        var result = {},
            options = this.options,
            canvas, ctx;
        if(self.OffscreenCanvas && image instanceof OffscreenCanvas || self.HTMLCanvasElement && image instanceof HTMLCanvasElement) {
            canvas = image;
            ctx = canvas.getContext('2d');
        }
        else {
            canvas = this.canvas(image.width, image.height);
            ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
        }
        var input = ctx.getImageData(0, 0, canvas.width, canvas.height),
            output = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.edgeDetect(input, output);
        this.skinDetect(input, output);
        this.saturationDetect(input, output);

        ctx.putImageData(output, 0, 0);
        const scoreCanvas = await this.resample(canvas, ceil(image.width / options.scoreDownSample), ceil(image.height / options.scoreDownSample)),
            scoreCtx = scoreCanvas.getContext('2d');

        var scoreOutput = scoreCtx.getImageData(0, 0, scoreCanvas.width, scoreCanvas.height);

        var topScore = -Infinity,
            topCrop = null,
            crops = this.crops(image);

        for(var i = 0, i_len = crops.length; i < i_len; i++) {
            var crop = crops[i];
            crop.score = this.score(scoreOutput, crop);
            if(crop.score.total > topScore){
                topCrop = crop;
                topScore = crop.score.total;
            }

        }

        result.crops = crops;
        result.topCrop = topCrop;

        if(options.debug && topCrop){
            ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
            ctx.fillRect(topCrop.x, topCrop.y, topCrop.width, topCrop.height);
            for (var y = 0; y < output.height; y++) {
                for (var x = 0; x < output.width; x++) {
                    var p = (y * output.width + x) * 4;
                    var importance = this.importance(topCrop, x, y);
                    if (importance > 0) {
                        output.data[p + 1] += importance * 32;
                    }

                    if (importance < 0) {
                        output.data[p] += importance * -64;
                    }
                    output.data[p + 3] = 255;
                }
            }
            ctx.putImageData(output, 0, 0);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.strokeRect(topCrop.x, topCrop.y, topCrop.width, topCrop.height);
            result.debugCanvas = canvas;
        }
        return result;
    }
};

// aliases and helpers
var min = Math.min,
    max = Math.max,
    abs = Math.abs,
    ceil = Math.ceil,
    sqrt = Math.sqrt;

// gets value in the range of [0, 1] where 0 is the center of the pictures
// returns weight of rule of thirds [0, 1]
function thirds(x){
    x = ((x-(1/3)+1.0)%2.0*0.5-0.5)*16;
    return Math.max(1.0-x*x, 0.0);
}

function cie(r, g, b){
    return 0.5126*b + 0.7152*g + 0.0722*r;
}
function sample(id, p) {
    return cie(id[p], id[p+1], id[p+2]);
}
function saturation(r, g, b){
    var maximum = max(r/255, g/255, b/255), minumum = min(r/255, g/255, b/255);
    if(maximum === minumum){
        return 0;
    }
    var l = (maximum + minumum) / 2,
        d = maximum-minumum;
    return l > 0.5 ? d/(2-maximum-minumum) : d/(maximum+minumum);
}

const warn = console.warn.bind(console, '[SmartCrop]');

if (typeof lazy === 'function') {
    lazy(SmartCrop, 'dump', () => self.dump || warn);
}
else {
    SmartCrop.dump = self.dump || warn;
}

// amd
if (typeof define !== 'undefined' && define.amd) define(function(){return SmartCrop;});
//common js
if (typeof exports !== 'undefined') exports.SmartCrop = SmartCrop;
// browser
else if (typeof navigator !== 'undefined') window.SmartCrop = SmartCrop;
// nodejs
if (typeof module !== 'undefined') {
    module.exports = SmartCrop;
}
})();

(function( $ ){
	$.fn.qrcode = function(options) {
		// if options is string, 
		if( typeof options === 'string' ){
			options	= { text: options };
		}

		// set default values
		// typeNumber < 1 for automatic calculation
		options	= $.extend( {}, {
			render		: "canvas",
			width		: 256,
			height		: 256,
			typeNumber	: -1,
			correctLevel	: QRErrorCorrectLevel.H,
                        background      : "#ffffff",
                        foreground      : "#000000"
		}, options);

		var createCanvas	= function(){
			// create the qrcode itself
			var qrcode	= new QRCode(options.typeNumber, options.correctLevel);
			qrcode.addData(options.text);
			qrcode.make();

			// create canvas element
			var canvas	= document.createElement('canvas');
			canvas.width	= options.width;
			canvas.height	= options.height;
			var ctx		= canvas.getContext('2d');

			// compute tileW/tileH based on options.width/options.height
			var tileW	= options.width  / qrcode.getModuleCount();
			var tileH	= options.height / qrcode.getModuleCount();

			// draw in the canvas
			for( var row = 0; row < qrcode.getModuleCount(); row++ ){
				for( var col = 0; col < qrcode.getModuleCount(); col++ ){
					ctx.fillStyle = qrcode.isDark(row, col) ? options.foreground : options.background;
					var w = (Math.ceil((col+1)*tileW) - Math.floor(col*tileW));
					var h = (Math.ceil((row+1)*tileH) - Math.floor(row*tileH));
					ctx.fillRect(Math.round(col*tileW),Math.round(row*tileH), w, h);  
				}	
			}
			// return just built canvas
			return canvas;
		}

		// from Jon-Carlos Rivera (https://github.com/imbcmdth)
		var createTable	= function(){
			// create the qrcode itself
			var qrcode	= new QRCode(options.typeNumber, options.correctLevel);
			qrcode.addData(options.text);
			qrcode.make();
			
			// create table element
			var $table	= $('<table></table>')
				.css("width", options.width+"px")
				.css("height", options.height+"px")
				.css("border", "0px")
				.css("border-collapse", "collapse")
				.css('background-color', options.background);
		  
			// compute tileS percentage
			var tileW	= options.width / qrcode.getModuleCount();
			var tileH	= options.height / qrcode.getModuleCount();

			// draw in the table
			for(var row = 0; row < qrcode.getModuleCount(); row++ ){
				var $row = $('<tr></tr>').css('height', tileH+"px").appendTo($table);
				
				for(var col = 0; col < qrcode.getModuleCount(); col++ ){
					$('<td></td>')
						.css('width', tileW+"px")
						.css('background-color', qrcode.isDark(row, col) ? options.foreground : options.background)
						.appendTo($row);
				}	
			}
			// return just built canvas
			return $table;
		}
  

		return this.each(function(){
			var element	= options.render == "canvas" ? createCanvas() : createTable();
			$(element).appendTo(this);
		});
	};
})( jQuery );

//---------------------------------------------------------------------
// QRCode for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//   http://www.opensource.org/licenses/mit-license.php
//
// The word "QR Code" is registered trademark of 
// DENSO WAVE INCORPORATED
//   http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// QR8bitByte
//---------------------------------------------------------------------

function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.data = data;
}

QR8bitByte.prototype = {

	getLength : function(buffer) {
		return this.data.length;
	},
	
	write : function(buffer) {
		for (var i = 0; i < this.data.length; i++) {
			// not JIS ...
			buffer.put(this.data.charCodeAt(i), 8);
		}
	}
};

//---------------------------------------------------------------------
// QRCode
//---------------------------------------------------------------------

function QRCode(typeNumber, errorCorrectLevel) {
	this.typeNumber = typeNumber;
	this.errorCorrectLevel = errorCorrectLevel;
	this.modules = null;
	this.moduleCount = 0;
	this.dataCache = null;
	this.dataList = new Array();
}

QRCode.prototype = {
	
	addData : function(data) {
		var newData = new QR8bitByte(data);
		this.dataList.push(newData);
		this.dataCache = null;
	},
	
	isDark : function(row, col) {
		if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
			throw new Error(row + "," + col);
		}
		return this.modules[row][col];
	},

	getModuleCount : function() {
		return this.moduleCount;
	},
	
	make : function() {
		// Calculate automatically typeNumber if provided is < 1
		if (this.typeNumber < 1 ){
			var typeNumber = 1;
			for (typeNumber = 1; typeNumber < 40; typeNumber++) {
				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);

				var buffer = new QRBitBuffer();
				var totalDataCount = 0;
				for (var i = 0; i < rsBlocks.length; i++) {
					totalDataCount += rsBlocks[i].dataCount;
				}

				for (var i = 0; i < this.dataList.length; i++) {
					var data = this.dataList[i];
					buffer.put(data.mode, 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
					data.write(buffer);
				}
				if (buffer.getLengthInBits() <= totalDataCount * 8)
					break;
			}
			this.typeNumber = typeNumber;
		}
		this.makeImpl(false, this.getBestMaskPattern() );
	},
	
	makeImpl : function(test, maskPattern) {
		
		this.moduleCount = this.typeNumber * 4 + 17;
		this.modules = new Array(this.moduleCount);
		
		for (var row = 0; row < this.moduleCount; row++) {
			
			this.modules[row] = new Array(this.moduleCount);
			
			for (var col = 0; col < this.moduleCount; col++) {
				this.modules[row][col] = null;//(col + row) % 3;
			}
		}
	
		this.setupPositionProbePattern(0, 0);
		this.setupPositionProbePattern(this.moduleCount - 7, 0);
		this.setupPositionProbePattern(0, this.moduleCount - 7);
		this.setupPositionAdjustPattern();
		this.setupTimingPattern();
		this.setupTypeInfo(test, maskPattern);
		
		if (this.typeNumber >= 7) {
			this.setupTypeNumber(test);
		}
	
		if (this.dataCache == null) {
			this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
		}
	
		this.mapData(this.dataCache, maskPattern);
	},

	setupPositionProbePattern : function(row, col)  {
		
		for (var r = -1; r <= 7; r++) {
			
			if (row + r <= -1 || this.moduleCount <= row + r) continue;
			
			for (var c = -1; c <= 7; c++) {
				
				if (col + c <= -1 || this.moduleCount <= col + c) continue;
				
				if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
						|| (0 <= c && c <= 6 && (r == 0 || r == 6) )
						|| (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
					this.modules[row + r][col + c] = true;
				} else {
					this.modules[row + r][col + c] = false;
				}
			}		
		}		
	},
	
	getBestMaskPattern : function() {
	
		var minLostPoint = 0;
		var pattern = 0;
	
		for (var i = 0; i < 8; i++) {
			
			this.makeImpl(true, i);
	
			var lostPoint = QRUtil.getLostPoint(this);
	
			if (i == 0 || minLostPoint >  lostPoint) {
				minLostPoint = lostPoint;
				pattern = i;
			}
		}
	
		return pattern;
	},
	
	createMovieClip : function(target_mc, instance_name, depth) {
	
		var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
		var cs = 1;
	
		this.make();

		for (var row = 0; row < this.modules.length; row++) {
			
			var y = row * cs;
			
			for (var col = 0; col < this.modules[row].length; col++) {
	
				var x = col * cs;
				var dark = this.modules[row][col];
			
				if (dark) {
					qr_mc.beginFill(0, 100);
					qr_mc.moveTo(x, y);
					qr_mc.lineTo(x + cs, y);
					qr_mc.lineTo(x + cs, y + cs);
					qr_mc.lineTo(x, y + cs);
					qr_mc.endFill();
				}
			}
		}
		
		return qr_mc;
	},

	setupTimingPattern : function() {
		
		for (var r = 8; r < this.moduleCount - 8; r++) {
			if (this.modules[r][6] != null) {
				continue;
			}
			this.modules[r][6] = (r % 2 == 0);
		}
	
		for (var c = 8; c < this.moduleCount - 8; c++) {
			if (this.modules[6][c] != null) {
				continue;
			}
			this.modules[6][c] = (c % 2 == 0);
		}
	},
	
	setupPositionAdjustPattern : function() {
	
		var pos = QRUtil.getPatternPosition(this.typeNumber);
		
		for (var i = 0; i < pos.length; i++) {
		
			for (var j = 0; j < pos.length; j++) {
			
				var row = pos[i];
				var col = pos[j];
				
				if (this.modules[row][col] != null) {
					continue;
				}
				
				for (var r = -2; r <= 2; r++) {
				
					for (var c = -2; c <= 2; c++) {
					
						if (r == -2 || r == 2 || c == -2 || c == 2 
								|| (r == 0 && c == 0) ) {
							this.modules[row + r][col + c] = true;
						} else {
							this.modules[row + r][col + c] = false;
						}
					}
				}
			}
		}
	},
	
	setupTypeNumber : function(test) {
	
		var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
	
		for (var i = 0; i < 18; i++) {
			var mod = (!test && ( (bits >> i) & 1) == 1);
			this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
		}
	
		for (var i = 0; i < 18; i++) {
			var mod = (!test && ( (bits >> i) & 1) == 1);
			this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
		}
	},
	
	setupTypeInfo : function(test, maskPattern) {
	
		var data = (this.errorCorrectLevel << 3) | maskPattern;
		var bits = QRUtil.getBCHTypeInfo(data);
	
		// vertical		
		for (var i = 0; i < 15; i++) {
	
			var mod = (!test && ( (bits >> i) & 1) == 1);
	
			if (i < 6) {
				this.modules[i][8] = mod;
			} else if (i < 8) {
				this.modules[i + 1][8] = mod;
			} else {
				this.modules[this.moduleCount - 15 + i][8] = mod;
			}
		}
	
		// horizontal
		for (var i = 0; i < 15; i++) {
	
			var mod = (!test && ( (bits >> i) & 1) == 1);
			
			if (i < 8) {
				this.modules[8][this.moduleCount - i - 1] = mod;
			} else if (i < 9) {
				this.modules[8][15 - i - 1 + 1] = mod;
			} else {
				this.modules[8][15 - i - 1] = mod;
			}
		}
	
		// fixed module
		this.modules[this.moduleCount - 8][8] = (!test);
	
	},
	
	mapData : function(data, maskPattern) {
		
		var inc = -1;
		var row = this.moduleCount - 1;
		var bitIndex = 7;
		var byteIndex = 0;
		
		for (var col = this.moduleCount - 1; col > 0; col -= 2) {
	
			if (col == 6) col--;
	
			while (true) {
	
				for (var c = 0; c < 2; c++) {
					
					if (this.modules[row][col - c] == null) {
						
						var dark = false;
	
						if (byteIndex < data.length) {
							dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
						}
	
						var mask = QRUtil.getMask(maskPattern, row, col - c);
	
						if (mask) {
							dark = !dark;
						}
						
						this.modules[row][col - c] = dark;
						bitIndex--;
	
						if (bitIndex == -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}
				}
								
				row += inc;
	
				if (row < 0 || this.moduleCount <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
		
	}

};

QRCode.PAD0 = 0xEC;
QRCode.PAD1 = 0x11;

QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
	
	var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
	
	var buffer = new QRBitBuffer();
	
	for (var i = 0; i < dataList.length; i++) {
		var data = dataList[i];
		buffer.put(data.mode, 4);
		buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
		data.write(buffer);
	}

	// calc num max data.
	var totalDataCount = 0;
	for (var i = 0; i < rsBlocks.length; i++) {
		totalDataCount += rsBlocks[i].dataCount;
	}

	if (buffer.getLengthInBits() > totalDataCount * 8) {
		throw new Error("code length overflow. ("
			+ buffer.getLengthInBits()
			+ ">"
			+  totalDataCount * 8
			+ ")");
	}

	// end code
	if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
		buffer.put(0, 4);
	}

	// padding
	while (buffer.getLengthInBits() % 8 != 0) {
		buffer.putBit(false);
	}

	// padding
	while (true) {
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD0, 8);
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD1, 8);
	}

	return QRCode.createBytes(buffer, rsBlocks);
}

QRCode.createBytes = function(buffer, rsBlocks) {

	var offset = 0;
	
	var maxDcCount = 0;
	var maxEcCount = 0;
	
	var dcdata = new Array(rsBlocks.length);
	var ecdata = new Array(rsBlocks.length);
	
	for (var r = 0; r < rsBlocks.length; r++) {

		var dcCount = rsBlocks[r].dataCount;
		var ecCount = rsBlocks[r].totalCount - dcCount;

		maxDcCount = Math.max(maxDcCount, dcCount);
		maxEcCount = Math.max(maxEcCount, ecCount);
		
		dcdata[r] = new Array(dcCount);
		
		for (var i = 0; i < dcdata[r].length; i++) {
			dcdata[r][i] = 0xff & buffer.buffer[i + offset];
		}
		offset += dcCount;
		
		var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
		var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);

		var modPoly = rawPoly.mod(rsPoly);
		ecdata[r] = new Array(rsPoly.getLength() - 1);
		for (var i = 0; i < ecdata[r].length; i++) {
            var modIndex = i + modPoly.getLength() - ecdata[r].length;
			ecdata[r][i] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
		}

	}
	
	var totalCodeCount = 0;
	for (var i = 0; i < rsBlocks.length; i++) {
		totalCodeCount += rsBlocks[i].totalCount;
	}

	var data = new Array(totalCodeCount);
	var index = 0;

	for (var i = 0; i < maxDcCount; i++) {
		for (var r = 0; r < rsBlocks.length; r++) {
			if (i < dcdata[r].length) {
				data[index++] = dcdata[r][i];
			}
		}
	}

	for (var i = 0; i < maxEcCount; i++) {
		for (var r = 0; r < rsBlocks.length; r++) {
			if (i < ecdata[r].length) {
				data[index++] = ecdata[r][i];
			}
		}
	}

	return data;

}

//---------------------------------------------------------------------
// QRMode
//---------------------------------------------------------------------

var QRMode = {
	MODE_NUMBER :		1 << 0,
	MODE_ALPHA_NUM : 	1 << 1,
	MODE_8BIT_BYTE : 	1 << 2,
	MODE_KANJI :		1 << 3
};

//---------------------------------------------------------------------
// QRErrorCorrectLevel
//---------------------------------------------------------------------
 
var QRErrorCorrectLevel = {
	L : 1,
	M : 0,
	Q : 3,
	H : 2
};

//---------------------------------------------------------------------
// QRMaskPattern
//---------------------------------------------------------------------

var QRMaskPattern = {
	PATTERN000 : 0,
	PATTERN001 : 1,
	PATTERN010 : 2,
	PATTERN011 : 3,
	PATTERN100 : 4,
	PATTERN101 : 5,
	PATTERN110 : 6,
	PATTERN111 : 7
};

//---------------------------------------------------------------------
// QRUtil
//---------------------------------------------------------------------
 
var QRUtil = {

    PATTERN_POSITION_TABLE : [
	    [],
	    [6, 18],
	    [6, 22],
	    [6, 26],
	    [6, 30],
	    [6, 34],
	    [6, 22, 38],
	    [6, 24, 42],
	    [6, 26, 46],
	    [6, 28, 50],
	    [6, 30, 54],		
	    [6, 32, 58],
	    [6, 34, 62],
	    [6, 26, 46, 66],
	    [6, 26, 48, 70],
	    [6, 26, 50, 74],
	    [6, 30, 54, 78],
	    [6, 30, 56, 82],
	    [6, 30, 58, 86],
	    [6, 34, 62, 90],
	    [6, 28, 50, 72, 94],
	    [6, 26, 50, 74, 98],
	    [6, 30, 54, 78, 102],
	    [6, 28, 54, 80, 106],
	    [6, 32, 58, 84, 110],
	    [6, 30, 58, 86, 114],
	    [6, 34, 62, 90, 118],
	    [6, 26, 50, 74, 98, 122],
	    [6, 30, 54, 78, 102, 126],
	    [6, 26, 52, 78, 104, 130],
	    [6, 30, 56, 82, 108, 134],
	    [6, 34, 60, 86, 112, 138],
	    [6, 30, 58, 86, 114, 142],
	    [6, 34, 62, 90, 118, 146],
	    [6, 30, 54, 78, 102, 126, 150],
	    [6, 24, 50, 76, 102, 128, 154],
	    [6, 28, 54, 80, 106, 132, 158],
	    [6, 32, 58, 84, 110, 136, 162],
	    [6, 26, 54, 82, 110, 138, 166],
	    [6, 30, 58, 86, 114, 142, 170]
    ],

    G15 : (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18 : (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK : (1 << 14) | (1 << 12) | (1 << 10)	| (1 << 4) | (1 << 1),

    getBCHTypeInfo : function(data) {
	    var d = data << 10;
	    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
		    d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) ) ); 	
	    }
	    return ( (data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber : function(data) {
	    var d = data << 12;
	    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
		    d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) ) ); 	
	    }
	    return (data << 12) | d;
    },

    getBCHDigit : function(data) {

	    var digit = 0;

	    while (data != 0) {
		    digit++;
		    data >>>= 1;
	    }

	    return digit;
    },

    getPatternPosition : function(typeNumber) {
	    return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask : function(maskPattern, i, j) {
	    
	    switch (maskPattern) {
		    
	    case QRMaskPattern.PATTERN000 : return (i + j) % 2 == 0;
	    case QRMaskPattern.PATTERN001 : return i % 2 == 0;
	    case QRMaskPattern.PATTERN010 : return j % 3 == 0;
	    case QRMaskPattern.PATTERN011 : return (i + j) % 3 == 0;
	    case QRMaskPattern.PATTERN100 : return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0;
	    case QRMaskPattern.PATTERN101 : return (i * j) % 2 + (i * j) % 3 == 0;
	    case QRMaskPattern.PATTERN110 : return ( (i * j) % 2 + (i * j) % 3) % 2 == 0;
	    case QRMaskPattern.PATTERN111 : return ( (i * j) % 3 + (i + j) % 2) % 2 == 0;

	    default :
		    throw new Error("bad maskPattern:" + maskPattern);
	    }
    },

    getErrorCorrectPolynomial : function(errorCorrectLength) {

	    var a = new QRPolynomial([1], 0);

	    for (var i = 0; i < errorCorrectLength; i++) {
		    a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0) );
	    }

	    return a;
    },

    getLengthInBits : function(mode, type) {

	    if (1 <= type && type < 10) {

		    // 1 - 9

		    switch(mode) {
		    case QRMode.MODE_NUMBER 	: return 10;
		    case QRMode.MODE_ALPHA_NUM 	: return 9;
		    case QRMode.MODE_8BIT_BYTE	: return 8;
		    case QRMode.MODE_KANJI  	: return 8;
		    default :
			    throw new Error("mode:" + mode);
		    }

	    } else if (type < 27) {

		    // 10 - 26

		    switch(mode) {
		    case QRMode.MODE_NUMBER 	: return 12;
		    case QRMode.MODE_ALPHA_NUM 	: return 11;
		    case QRMode.MODE_8BIT_BYTE	: return 16;
		    case QRMode.MODE_KANJI  	: return 10;
		    default :
			    throw new Error("mode:" + mode);
		    }

	    } else if (type < 41) {

		    // 27 - 40

		    switch(mode) {
		    case QRMode.MODE_NUMBER 	: return 14;
		    case QRMode.MODE_ALPHA_NUM	: return 13;
		    case QRMode.MODE_8BIT_BYTE	: return 16;
		    case QRMode.MODE_KANJI  	: return 12;
		    default :
			    throw new Error("mode:" + mode);
		    }

	    } else {
		    throw new Error("type:" + type);
	    }
    },

    getLostPoint : function(qrCode) {
	    
	    var moduleCount = qrCode.getModuleCount();
	    
	    var lostPoint = 0;
	    
	    // LEVEL1
	    
	    for (var row = 0; row < moduleCount; row++) {

		    for (var col = 0; col < moduleCount; col++) {

			    var sameCount = 0;
			    var dark = qrCode.isDark(row, col);

				for (var r = -1; r <= 1; r++) {

				    if (row + r < 0 || moduleCount <= row + r) {
					    continue;
				    }

				    for (var c = -1; c <= 1; c++) {

					    if (col + c < 0 || moduleCount <= col + c) {
						    continue;
					    }

					    if (r == 0 && c == 0) {
						    continue;
					    }

					    if (dark == qrCode.isDark(row + r, col + c) ) {
						    sameCount++;
					    }
				    }
			    }

			    if (sameCount > 5) {
				    lostPoint += (3 + sameCount - 5);
			    }
		    }
	    }

	    // LEVEL2

	    for (var row = 0; row < moduleCount - 1; row++) {
		    for (var col = 0; col < moduleCount - 1; col++) {
			    var count = 0;
			    if (qrCode.isDark(row,     col    ) ) count++;
			    if (qrCode.isDark(row + 1, col    ) ) count++;
			    if (qrCode.isDark(row,     col + 1) ) count++;
			    if (qrCode.isDark(row + 1, col + 1) ) count++;
			    if (count == 0 || count == 4) {
				    lostPoint += 3;
			    }
		    }
	    }

	    // LEVEL3

	    for (var row = 0; row < moduleCount; row++) {
		    for (var col = 0; col < moduleCount - 6; col++) {
			    if (qrCode.isDark(row, col)
					    && !qrCode.isDark(row, col + 1)
					    &&  qrCode.isDark(row, col + 2)
					    &&  qrCode.isDark(row, col + 3)
					    &&  qrCode.isDark(row, col + 4)
					    && !qrCode.isDark(row, col + 5)
					    &&  qrCode.isDark(row, col + 6) ) {
				    lostPoint += 40;
			    }
		    }
	    }

	    for (var col = 0; col < moduleCount; col++) {
		    for (var row = 0; row < moduleCount - 6; row++) {
			    if (qrCode.isDark(row, col)
					    && !qrCode.isDark(row + 1, col)
					    &&  qrCode.isDark(row + 2, col)
					    &&  qrCode.isDark(row + 3, col)
					    &&  qrCode.isDark(row + 4, col)
					    && !qrCode.isDark(row + 5, col)
					    &&  qrCode.isDark(row + 6, col) ) {
				    lostPoint += 40;
			    }
		    }
	    }

	    // LEVEL4
	    
	    var darkCount = 0;

	    for (var col = 0; col < moduleCount; col++) {
		    for (var row = 0; row < moduleCount; row++) {
			    if (qrCode.isDark(row, col) ) {
				    darkCount++;
			    }
		    }
	    }
	    
	    var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
	    lostPoint += ratio * 10;

	    return lostPoint;		
    }

};


//---------------------------------------------------------------------
// QRMath
//---------------------------------------------------------------------

var QRMath = {

	glog : function(n) {
	
		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}
		
		return QRMath.LOG_TABLE[n];
	},
	
	gexp : function(n) {
	
		while (n < 0) {
			n += 255;
		}
	
		while (n >= 256) {
			n -= 255;
		}
	
		return QRMath.EXP_TABLE[n];
	},
	
	EXP_TABLE : new Array(256),
	
	LOG_TABLE : new Array(256)

};
	
for (var i = 0; i < 8; i++) {
	QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
		^ QRMath.EXP_TABLE[i - 5]
		^ QRMath.EXP_TABLE[i - 6]
		^ QRMath.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	QRMath.LOG_TABLE[QRMath.EXP_TABLE[i] ] = i;
}

//---------------------------------------------------------------------
// QRPolynomial
//---------------------------------------------------------------------

function QRPolynomial(num, shift) {

	if (num.length == undefined) {
		throw new Error(num.length + "/" + shift);
	}

	var offset = 0;

	while (offset < num.length && num[offset] == 0) {
		offset++;
	}

	this.num = new Array(num.length - offset + shift);
	for (var i = 0; i < num.length - offset; i++) {
		this.num[i] = num[i + offset];
	}
}

QRPolynomial.prototype = {

	get : function(index) {
		return this.num[index];
	},
	
	getLength : function() {
		return this.num.length;
	},
	
	multiply : function(e) {
	
		var num = new Array(this.getLength() + e.getLength() - 1);
	
		for (var i = 0; i < this.getLength(); i++) {
			for (var j = 0; j < e.getLength(); j++) {
				num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i) ) + QRMath.glog(e.get(j) ) );
			}
		}
	
		return new QRPolynomial(num, 0);
	},
	
	mod : function(e) {
	
		if (this.getLength() - e.getLength() < 0) {
			return this;
		}
	
		var ratio = QRMath.glog(this.get(0) ) - QRMath.glog(e.get(0) );
	
		var num = new Array(this.getLength() );
		
		for (var i = 0; i < this.getLength(); i++) {
			num[i] = this.get(i);
		}
		
		for (var i = 0; i < e.getLength(); i++) {
			num[i] ^= QRMath.gexp(QRMath.glog(e.get(i) ) + ratio);
		}
	
		// recursive call
		return new QRPolynomial(num, 0).mod(e);
	}
};

//---------------------------------------------------------------------
// QRRSBlock
//---------------------------------------------------------------------

function QRRSBlock(totalCount, dataCount) {
	this.totalCount = totalCount;
	this.dataCount  = dataCount;
}

QRRSBlock.RS_BLOCK_TABLE = [

	// L
	// M
	// Q
	// H

	// 1
	[1, 26, 19],
	[1, 26, 16],
	[1, 26, 13],
	[1, 26, 9],
	
	// 2
	[1, 44, 34],
	[1, 44, 28],
	[1, 44, 22],
	[1, 44, 16],

	// 3
	[1, 70, 55],
	[1, 70, 44],
	[2, 35, 17],
	[2, 35, 13],

	// 4		
	[1, 100, 80],
	[2, 50, 32],
	[2, 50, 24],
	[4, 25, 9],
	
	// 5
	[1, 134, 108],
	[2, 67, 43],
	[2, 33, 15, 2, 34, 16],
	[2, 33, 11, 2, 34, 12],
	
	// 6
	[2, 86, 68],
	[4, 43, 27],
	[4, 43, 19],
	[4, 43, 15],
	
	// 7		
	[2, 98, 78],
	[4, 49, 31],
	[2, 32, 14, 4, 33, 15],
	[4, 39, 13, 1, 40, 14],
	
	// 8
	[2, 121, 97],
	[2, 60, 38, 2, 61, 39],
	[4, 40, 18, 2, 41, 19],
	[4, 40, 14, 2, 41, 15],
	
	// 9
	[2, 146, 116],
	[3, 58, 36, 2, 59, 37],
	[4, 36, 16, 4, 37, 17],
	[4, 36, 12, 4, 37, 13],
	
	// 10		
	[2, 86, 68, 2, 87, 69],
	[4, 69, 43, 1, 70, 44],
	[6, 43, 19, 2, 44, 20],
	[6, 43, 15, 2, 44, 16],

	// 11
	[4, 101, 81],
	[1, 80, 50, 4, 81, 51],
	[4, 50, 22, 4, 51, 23],
	[3, 36, 12, 8, 37, 13],

	// 12
	[2, 116, 92, 2, 117, 93],
	[6, 58, 36, 2, 59, 37],
	[4, 46, 20, 6, 47, 21],
	[7, 42, 14, 4, 43, 15],

	// 13
	[4, 133, 107],
	[8, 59, 37, 1, 60, 38],
	[8, 44, 20, 4, 45, 21],
	[12, 33, 11, 4, 34, 12],

	// 14
	[3, 145, 115, 1, 146, 116],
	[4, 64, 40, 5, 65, 41],
	[11, 36, 16, 5, 37, 17],
	[11, 36, 12, 5, 37, 13],

	// 15
	[5, 109, 87, 1, 110, 88],
	[5, 65, 41, 5, 66, 42],
	[5, 54, 24, 7, 55, 25],
	[11, 36, 12],

	// 16
	[5, 122, 98, 1, 123, 99],
	[7, 73, 45, 3, 74, 46],
	[15, 43, 19, 2, 44, 20],
	[3, 45, 15, 13, 46, 16],

	// 17
	[1, 135, 107, 5, 136, 108],
	[10, 74, 46, 1, 75, 47],
	[1, 50, 22, 15, 51, 23],
	[2, 42, 14, 17, 43, 15],

	// 18
	[5, 150, 120, 1, 151, 121],
	[9, 69, 43, 4, 70, 44],
	[17, 50, 22, 1, 51, 23],
	[2, 42, 14, 19, 43, 15],

	// 19
	[3, 141, 113, 4, 142, 114],
	[3, 70, 44, 11, 71, 45],
	[17, 47, 21, 4, 48, 22],
	[9, 39, 13, 16, 40, 14],

	// 20
	[3, 135, 107, 5, 136, 108],
	[3, 67, 41, 13, 68, 42],
	[15, 54, 24, 5, 55, 25],
	[15, 43, 15, 10, 44, 16],

	// 21
	[4, 144, 116, 4, 145, 117],
	[17, 68, 42],
	[17, 50, 22, 6, 51, 23],
	[19, 46, 16, 6, 47, 17],

	// 22
	[2, 139, 111, 7, 140, 112],
	[17, 74, 46],
	[7, 54, 24, 16, 55, 25],
	[34, 37, 13],

	// 23
	[4, 151, 121, 5, 152, 122],
	[4, 75, 47, 14, 76, 48],
	[11, 54, 24, 14, 55, 25],
	[16, 45, 15, 14, 46, 16],

	// 24
	[6, 147, 117, 4, 148, 118],
	[6, 73, 45, 14, 74, 46],
	[11, 54, 24, 16, 55, 25],
	[30, 46, 16, 2, 47, 17],

	// 25
	[8, 132, 106, 4, 133, 107],
	[8, 75, 47, 13, 76, 48],
	[7, 54, 24, 22, 55, 25],
	[22, 45, 15, 13, 46, 16],

	// 26
	[10, 142, 114, 2, 143, 115],
	[19, 74, 46, 4, 75, 47],
	[28, 50, 22, 6, 51, 23],
	[33, 46, 16, 4, 47, 17],

	// 27
	[8, 152, 122, 4, 153, 123],
	[22, 73, 45, 3, 74, 46],
	[8, 53, 23, 26, 54, 24],
	[12, 45, 15, 28, 46, 16],

	// 28
	[3, 147, 117, 10, 148, 118],
	[3, 73, 45, 23, 74, 46],
	[4, 54, 24, 31, 55, 25],
	[11, 45, 15, 31, 46, 16],

	// 29
	[7, 146, 116, 7, 147, 117],
	[21, 73, 45, 7, 74, 46],
	[1, 53, 23, 37, 54, 24],
	[19, 45, 15, 26, 46, 16],

	// 30
	[5, 145, 115, 10, 146, 116],
	[19, 75, 47, 10, 76, 48],
	[15, 54, 24, 25, 55, 25],
	[23, 45, 15, 25, 46, 16],

	// 31
	[13, 145, 115, 3, 146, 116],
	[2, 74, 46, 29, 75, 47],
	[42, 54, 24, 1, 55, 25],
	[23, 45, 15, 28, 46, 16],

	// 32
	[17, 145, 115],
	[10, 74, 46, 23, 75, 47],
	[10, 54, 24, 35, 55, 25],
	[19, 45, 15, 35, 46, 16],

	// 33
	[17, 145, 115, 1, 146, 116],
	[14, 74, 46, 21, 75, 47],
	[29, 54, 24, 19, 55, 25],
	[11, 45, 15, 46, 46, 16],

	// 34
	[13, 145, 115, 6, 146, 116],
	[14, 74, 46, 23, 75, 47],
	[44, 54, 24, 7, 55, 25],
	[59, 46, 16, 1, 47, 17],

	// 35
	[12, 151, 121, 7, 152, 122],
	[12, 75, 47, 26, 76, 48],
	[39, 54, 24, 14, 55, 25],
	[22, 45, 15, 41, 46, 16],

	// 36
	[6, 151, 121, 14, 152, 122],
	[6, 75, 47, 34, 76, 48],
	[46, 54, 24, 10, 55, 25],
	[2, 45, 15, 64, 46, 16],

	// 37
	[17, 152, 122, 4, 153, 123],
	[29, 74, 46, 14, 75, 47],
	[49, 54, 24, 10, 55, 25],
	[24, 45, 15, 46, 46, 16],

	// 38
	[4, 152, 122, 18, 153, 123],
	[13, 74, 46, 32, 75, 47],
	[48, 54, 24, 14, 55, 25],
	[42, 45, 15, 32, 46, 16],

	// 39
	[20, 147, 117, 4, 148, 118],
	[40, 75, 47, 7, 76, 48],
	[43, 54, 24, 22, 55, 25],
	[10, 45, 15, 67, 46, 16],

	// 40
	[19, 148, 118, 6, 149, 119],
	[18, 75, 47, 31, 76, 48],
	[34, 54, 24, 34, 55, 25],
	[20, 45, 15, 61, 46, 16]
];

QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
	
	var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
	
	if (rsBlock == undefined) {
		throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
	}

	var length = rsBlock.length / 3;
	
	var list = new Array();
	
	for (var i = 0; i < length; i++) {

		var count = rsBlock[i * 3 + 0];
		var totalCount = rsBlock[i * 3 + 1];
		var dataCount  = rsBlock[i * 3 + 2];

		for (var j = 0; j < count; j++) {
			list.push(new QRRSBlock(totalCount, dataCount) );	
		}
	}
	
	return list;
}

QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {

	switch(errorCorrectLevel) {
	case QRErrorCorrectLevel.L :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	case QRErrorCorrectLevel.M :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	case QRErrorCorrectLevel.Q :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	case QRErrorCorrectLevel.H :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	default :
		return undefined;
	}
}

//---------------------------------------------------------------------
// QRBitBuffer
//---------------------------------------------------------------------

function QRBitBuffer() {
	this.buffer = new Array();
	this.length = 0;
}

QRBitBuffer.prototype = {

	get : function(index) {
		var bufIndex = Math.floor(index / 8);
		return ( (this.buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	},
	
	put : function(num, length) {
		for (var i = 0; i < length; i++) {
			this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
		}
	},
	
	getLengthInBits : function() {
		return this.length;
	},
	
	putBit : function(bit) {
	
		var bufIndex = Math.floor(this.length / 8);
		if (this.buffer.length <= bufIndex) {
			this.buffer.push(0);
		}
	
		if (bit) {
			this.buffer[bufIndex] |= (0x80 >>> (this.length % 8) );
		}
	
		this.length++;
	}
};

/**
 * Functionality for the password revert page. This is reached when a user changes their password
 * and clicks a link in their email to revert the password back to their previous one.
 */
var passwordRevert = {

    /** The code that will be sent to the API to prove that they clicked the email link */
    revertPasswordCode: null,

    /**
     * Initialise the password revert page's functionality
     * @param {String} currentPage The current page e.g. #pwrevertmup1iayJmjRAHCxaKnBAmRaL
     */
    init: function(currentPage) {

        'use strict';

        // Cache the code
        this.revertPasswordCode = currentPage.replace('pwrevert', '');

        // Init functionality
        this.checkPasswordRevertCode();
    },

    /**
     * Validate the email code
     */
    checkPasswordRevertCode: function() {

        'use strict';

        loadingDialog.show();

        var self = this;

        // Make Revert Validation request
        api_req({ a: 'erv', c: this.revertPasswordCode }, {
            callback: function(result) {

                loadingDialog.hide();

                // The API can't inform us if the code is expired as it deletes used codes after use. So this does a
                // check to see if the code length is right, if it is then the code is expired, otherwise it's invalid
                if (result === ENOENT || result === EEXPIRED) {
                    var failureMessage = l[20857] + ' ' + l[20858];    // Your link is invalid. Please contact support

                    if (self.revertPasswordCode.length === 24) {
                        failureMessage = l[20856] + ' ' + l[20858];    // Your link has expired. Please contact support
                    }

                    msgDialog('warningb', l[135], failureMessage, '', self.cancelRevertPassword);
                }
                else if (result < 0) {

                    // Oops, something went wrong. Please contact support@mega.nz for assistance.
                    msgDialog('warningb', l[200], l[200] + ' ' + l[20858], '', self.cancelRevertPassword);
                }
                else {
                    // If the code is valid, get the email for the account to be reset
                    var email = result[1];
                    var successMessage = l[20859].replace('%1', email);

                    // Ask if they really want to revert the password
                    msgDialog('confirmation', l[870], successMessage, '', function(userConfirmed) {

                        // If the user clicks to confirm
                        if (userConfirmed) {
                            self.proceedRevertingPassword();
                        }
                        else {
                            self.cancelRevertPassword();
                        }
                    });
                }
            }
        });
    },

    /**
     * A callback function to return to the start/cloud drive page if there was an error or the user cancelled
     */
    cancelRevertPassword: function() {

        'use strict';

        loadSubPage(u_attr ? 'fm' : 'start');
    },

    /**
     * Proceed to revert the password to the previous one by sending the final API request
     */
    proceedRevertingPassword: function() {

        'use strict';

        loadingDialog.show();

        // Make Revert Password request
        api_req({ a: 'erx', c: this.revertPasswordCode }, {
            callback: function(result) {

                loadingDialog.hide();

                // Show generic error
                if (result < 0) {
                    msgDialog('warningb', l[200], l[200] + ' ' + l[20858], '', passwordRevert.cancelRevertPassword);
                }
                else {
                    // If it successfully reverted, show a success message and go back to the login page
                    msgDialog('info', l[18280], l[20860], '', function() {

                        // If already logged in, log out
                        if (u_attr) {
                            u_logout(true);
                        }

                        loadSubPage('login');
                    });
                }
            }
        });
    }
};

/**
 * This file handles the Public Service Announcements. One announcement will
 * appear at the bottom of the page in an overlay at a time. The announcements
 * come from a hard coded list initially. Once a user has seen an announcement
 * they will mark it as read on the API server. If a user is not logged in
 * then it will mark that announcement as seen in localStorage.
 */
var psa = {

    /** The id number of the last announcement that the user has seen */
    lastSeenPsaId: 0,

    /**
     * The current announcement object from the API e.g.
     * {
     *      id: integer psa id
     *      t: string psa title, already translated into user's known language if available
     *      d: string psa body/description, already translated if available
     *      img: string url to image on one of our static servers
     *      l: string link url for the positive flow button (this can be empty if not provided)
     *      b: string button label for positive flow button, can be empty if not provided
     * }
     */
    currentPsa: null,

    /** Whether the PSA has already been fetched this session */
    fetchedPsa: false,

    /** If the PSA is currently being shown */
    visible: false,

    /**
     * Show the dialog if they have not seen the announcement yet
     */
    async init() {
        'use strict';

        // Already tried fetching the announcement this session
        if (psa.fetchedPsa) {
            return false;
        }
        psa.fetchedPsa = true;

        // Get the last announcement number they have seen from localStorage
        const seen = await Promise.allSettled([
            M.getPersistentData('lastSeenPsaId'),
            u_handle && u_handle !== 'AAAAAAAAAAA' && mega.attr.get(u_handle, 'lastPsa', -2, true)
        ]);
        psa.lastSeenPsaId = parseInt(seen[1].value || seen[0].value) | 0;

        // Make Get PSA (gpsa) API request
        const {result} = await api.req({a: 'gpsa', n: psa.lastSeenPsaId});

        // If there is an announcement to be shown
        if (typeof result === 'object' && 'id' in result) {

            // Cache the current announcement
            psa.currentPsa = result;

            // Show the announcement
            psa.configureAndShowAnnouncement();
        }
    },

    /**
     * Wrapper function to configure the announcement details and show it
     */
    configureAndShowAnnouncement: function() {

        'use strict';

        // Only show the announcement if they have not seen the current announcement.
        // The localStorage.alwaysShowPsa is a test variable to force show the PSA
        if ((psa.lastSeenPsaId < psa.currentPsa.id || localStorage.alwaysShowPsa === '1')
            && psa.prefillAnnouncementDetails()) {

            psa.showAnnouncement();
        }
        else {
            // If they viewed the site while not logged in, then logged in with
            // an account that had already seen this PSA then this hides it
            psa.hideAnnouncement();
        }
    },

    /**
     * Update the details of the announcement depending on the current one
     * @returns {boolean} whether announcement integrity is ok or not
     */
    prefillAnnouncementDetails: function() {

        'use strict';

        // Determine image path
        var retina = (window.devicePixelRatio > 1) ? '@2x' : '';
        var imagePath = staticpath + 'images/mega/psa/' + psa.currentPsa.img + retina + '.png';

        // Decode the text from Base64 (there were some issues with some languages)
        var title = from8(base64urldecode(psa.currentPsa.t));
        var description = from8(base64urldecode(psa.currentPsa.d));
        var buttonLabel = from8(base64urldecode(psa.currentPsa.b));
        var wrapperNode = document.getElementById('mainlayout');
        var innerNode;

        if (!title || !description || !buttonLabel || !wrapperNode) {
            return false;
        }

        // PSA container
        innerNode = document.querySelector('.psa-holder') || mCreateElement('div', {
            'class': `psa-holder${is_mobile ? '' : ' theme-light-forced'}`// Light theme until design is ready
        }, wrapperNode);

        // Create PSA banner
        innerNode.textContent = '';
        wrapperNode = mCreateElement('div', {
            'class': 'mega-component banner anouncement hidden'
        }, innerNode);

        // Create PSA icon
        innerNode = mCreateElement('img', {'src': imagePath}, wrapperNode);
        innerNode.onerror = function() {
            var url =  `${psa.currentPsa.dsp + psa.currentPsa.img + retina}.png`;

            if (this.getAttribute('src') === url) {
                return this.removeAttribute('src');
            }
            // If the icon doesn't exist for new PSAs which is likely while in local development, use the one
            // on the default static path as they are added directly to the static servers now for each new PSA
            this.src = url;
        };

        // Create PSA details
        innerNode = mCreateElement('div', {'class': 'content-box'}, wrapperNode);
        mCreateElement('span', {'class': 'banner title-text'}, innerNode).textContent = title;
        mCreateElement('span', {'class': 'banner message-text'}, innerNode).textContent = description;

        // Create PSA details button
        if (psa.currentPsa.l) {
            innerNode = mCreateElement('button', {
                'class': `${is_mobile ? 'action-link nav-elem normal button' : 'mega-button'} js-more-info`,
                'data-continue-link': psa.currentPsa.l
            }, innerNode);
            mCreateElement('span', {'class': 'text'}, innerNode).textContent = buttonLabel;
        }

        // Create PSA close button
        innerNode = mCreateElement('div', {'class': 'banner end-box'}, wrapperNode);
        innerNode = mCreateElement('button', {
            'class': 'mega-component nav-elem mega-button action icon js-close'
        }, innerNode);
        mCreateElement('i', {
            'class': `sprite-${is_mobile ? 'mobile-' : ''}fm-mono icon-dialog-close`
        }, innerNode);

        return true;
    },

    /**
     * Adds the close button functionality
     */
    addCloseButtonHandler: function() {

        'use strict';

        // Use delegated event in case the HTML elements are not loaded yet
        $('body').rebind('click.closePsa', '.psa-holder .js-close', () => {

            // Hide the banner and store that they have seen this PSA
            psa.hideAnnouncement();
            psa.saveLastPsaSeen();
        });
    },

    /**
     * Adds the functionality for the view more info button
     */
    addMoreInfoButtonHandler: function() {

        'use strict';

        // Use delegated event in case the HTML elements are not loaded yet
        $('body').rebind('click.showPsaInfo', '.psa-holder .js-more-info', (e) => {

            // Get the page link for this announcement
            var pageLink = e.currentTarget.dataset.continueLink;

            // Hide the banner and save the PSA as seen
            psa.hideAnnouncement();
            psa.saveLastPsaSeen();

            if (!pageLink) {
                return;
            }

            // Open a new tab (and hopefully don't trigger popup blocker)
            window.open(pageLink, '_blank', 'noopener,noreferrer');
        });
    },

    /**
     * Shows the announcement
     */
    showAnnouncement: function() {

        'use strict';

        var bannerNode = document.querySelector('.psa-holder .banner');

        if (!bannerNode) {
            return false;
        }

        // Show the announcement
        document.body.classList.add('psa-notification');
        bannerNode.classList.remove('hidden');

        // Bind Learn more and Close button evts
        psa.addCloseButtonHandler();
        psa.addMoreInfoButtonHandler();

        // Currently being shown
        psa.visible = true;

        // Add a handler to fix the layout if the window is resized
        $(window).rebind('resize.bottomNotification', function() {
            psa.resizeFileManagerHeight();
            psa.repositionAccountLoadingBar();
        });

        // Trigger resize so that full content in the file manager is updated
        $(window).trigger('resize');
    },

    /**
     * Hides the announcement
     */
    hideAnnouncement: function() {

        'use strict';

        var bannerNode;

        // If already hidden, don't do anything (specially a window.trigger('resize')).
        if (!this.visible || !(bannerNode = document.querySelector('.psa-holder .banner'))) {
            return false;
        }

        // Hide the announcement
        document.body.classList.remove('psa-notification');
        bannerNode.classList.add('hidden');

        // Set to no longer visible
        psa.visible = false;

        // Save last seen announcement number for page changes
        psa.lastSeenPsaId = psa.currentPsa.id;

        // Trigger resize so that full content in the file manager is visible after closing
        $(window).trigger('resize');

        // Remove even listeners
        $(window).unbind('resize.bottomNotification');
    },

    /**
     * Saves the current announcement number they have seen to a user attribute if logged in, otherwise to localStorage
     */
    saveLastPsaSeen: function() {

        'use strict';

        // Always store that they have seen it in localStorage. This is useful if they
        // then log out, then the PSA should still stay hidden and not re-show itself
        M.setPersistentData('lastSeenPsaId', String(psa.currentPsa.id)).dump('psa');

        // If logged in and completed registration
        if (u_type === 3) {

            // Store that they have seen it on the API side
            // (should be stored as ^!lastPsa for a private non encrypted, non historic attribute)
            mega.attr.set('lastPsa', String(psa.currentPsa.id), -2, true);
        }
    },

    /**
     * When the user logs in, this updates the API with the last PSA they saw when they were logged out
     * @param {String|undefined} apiLastPsaSeen The last PSA that the user has seen that the API knows about
     */
    updateApiWithLastPsaSeen: function(apiLastPsaSeen) {
        'use strict';

        // Make sure they have seen a PSA and that the API seen PSA is older than the one in localStorage
        M.getPersistentData('lastSeenPsaId')
            .then(res => {
                if (apiLastPsaSeen < res) {

                    // Store that they have seen it on the API side
                    // (should be stored as ^!lastPsa for a private non encrypted, non historic attribute)
                    mega.attr.set('lastPsa', res, -2, true);
                }
            })
            .catch(nop);
    },

    /**
     * Resize the fmholder and startholder container heights, align loader bar
     * because they depend on the bottom notification height
     */
    resizeFileManagerHeight: function() {

        'use strict';

        if (is_mobile) {
            return false;
        }

        var bannerNode = document.querySelector('.psa-holder .banner');

        // If the PSA announcement is currently shown
        // @todo: Set display flex to ''.main-layout' and remove custom styling
        if (bannerNode && psa.visible) {
            var holderHeight = document.body.offsetHeight -
                bannerNode.offsetHeight || 0;

            document.getElementById('fmholder').style.height = `${holderHeight}px`;
            document.getElementById('startholder').style.height = `${holderHeight}px`;
        }
        else {
            document.getElementById('fmholder').style.removeProperty('height');
            document.getElementById('startholder').style.removeProperty('height');
        }
    },

    /**
     * Repositions the account loading bar so it is above the PSA if it is being shown
     */
    repositionAccountLoadingBar: function() {

        'use strict';

        if (is_mobile) {
            return false;
        }

        var bannerNode = document.querySelector('.psa-holder .banner');

        // If the PSA is visible
        if (bannerNode && psa.visible) {
            // Move the progress bar up above the PSA otherwise it's not visible
            document.querySelector('.loader-progressbar').style.bottom = `${bannerNode.offsetHeight}px`;
        }
        else {
            // Reset to the bottom
            document.querySelector('.loader-progressbar').style.removeProperty('bottom');
        }
    }
};

/**
 * MegaInput Core
 *
 * MegaInput is designed to unify inputs across the website give developer to an input with flexiblilty,
 * maintainability and easily control when they trying to create a new input.
 *
 * By doing this we can achieve,
 * - Design unification across the website
 * - Less hassle on maintenance for inputs
 * - Standise coding practice.
 * - Reduce amount of duplicate or similar code.
 *
 * MegaInput is planed to expand to cover all sorts of inputs on the Mega Webclient, such as text, textarea, radio,
 * checkbox, dropdown, buttons, numbers, etc.
 *
 * Class and prototype is located under `mega.ui`.
 *
 * Every original event binding on the input will not be revoke by MegaInput initialization,
 * it keeps original input element and just modify wrapper.
 * Devs please aware above when you start new extension.
 * So user do not need to worried about binding order, BUT need to be careful with parent selection in binded function,
 * due to it can be modified structually by MegaInputs.
 *
 * How to use:
 *
 * - How to create a new input
 *
 *   1. Create an input on html, adding classname for the custom styles as you required
 *
 *      e.g. `<input class="underlinedText" type="text" name="register-name" id="register-name" placeholder="[$195]"
 *            class="input-email " maxlength="190" />`
 *
 *   1.1 You can use extension for custom style by adding classname of the extension
 *
 *      e.g. `<input class="underlinedText strengthChecker" type="password" name="register-password"
 *            id="register-password" class="input-password" placeholder="[$909]" />`
 *
 *      For Devs, when code extension, please leave a comment about what is class name for it,
 *      and an example html to help other people to get info for your extension.
 *      To see an example for the comment please refer megaInputs-underlinedText.js.
 *
 *   2. Select eletment with jquery and call as following:
 *
 *      `var megaInput = new mega.ui.MegaInputs($input);`
 *
 *   $input can be array of inputs as well. This will return array of megaInput objects.
 *   megaInput object is the actually object controller for the megaInput.
 *
 *   3. If you can see `megaInputs` class added on the input, it is ready.
 *
 * - How to control MegaInputs already setup.
 *
 *   - First initialization returns the MegaInputs object. You can use it to control the item.
 *
 *     OR
 *
 *   - You can select dom element with jQuery selector and can call data attribute for it to get
 *     the MegaInput object for the element.
 *
 *       `var megaInput = $(elem).data('MegaInputs')`
 *
 *     With it you can modify/call function that is binded on it.
 *     But please do not forget about sanity check this to avoid exception.
 *     And vice versa is possible as well, with MegaInputs object you can find it's input and directly using it like:
 *
 *      `megaInputs.$input.rebind('focus', function(){ -do you thing here- })`
 *
 *   - By setup showMessage, hideMessage, showError, hideError, you can call it with MegaInputs object like:
 *
 *      `$input.data('MegaInputs').showError('-YOUR-MASSAGE-'')`
 *      `$input.data('MegaInputs').hideError()`
 *
 *      There is two way to setup these functions.
 *
 *          1. Pass it on options once MegaInput is inited by using options variable
 *
 *              `var megaInput = new mega.ui.MegaInputs($input, {
 *                  onShowError: function(msg) {
 *                      ---do your thing---
 *                  }
 *              });`
 *
 *          2. Setup on extension code and override original (Please refer underlinedText as example)
 *
 *   - Similar way as above, you can setup event binding on the input.
 *
 *          1. Pass it on options once MegaInput is inited by using options variable
 *
 *              `var megaInput = new mega.ui.MegaInputs($input, {
 *                  onFocus: function(e) {
 *                      ---do your thing---
 *                  }
 *              });`
 *
 *          2. Setup on extension code and override original (Please refer underlinedText as example)
 *
 *  - Mark input as required
 *      You can add `requried` class on input to mark it as required. Extension will handle required on it's own way.
 *
 * MegaInputs extensions:
 *  - TEXT: text input - megaInputs-underlinedText.js
 *  - CURRENCY: text/number input for localised currencies - megaInputs-currencyField.js
 */

(function($, scope) {

    'use strict';

    /**
     * MegaInputs
     * @constructor
     * @param {Object} $input - jQuery object of target input element.
     * @param {Object} [options] addon options upon initialization.
     *
     * @return {Object} megaInput - Created MegaInput object
     */
    var MegaInputs = function($input, options) {
        if (!(this instanceof MegaInputs)) {
            return new MegaInputs($input, options);
        }

        if (!$input || !$input.length) {
            if (d) {
                console.debug('MegaInputs: nothing to apply here...', $input);
            }
            return;
        }

        // Support if $input is multiple elements
        if ($input.length > 1) {
            var inputArray = [];
            for (var i = $input.length - 1; i >= 0; i--) {
                inputArray.push(new mega.ui.MegaInputs($($input[i]), options));
            }

            return inputArray;
        }

        this.$input = $input;
        this.type = $input.attr('type') || 'text';
        this.classes = this.$input.attr("class") ? this.$input.attr("class").split(/\s+/) : [];
        this.options = options || {};
        this.required = $input.hasClass('required');

        var self = this;

        // Bind class as a jQuery element's data attribute, so it can be called with the $ object
        this.$input.data('MegaInputs', this);

        this._bindEvent();

        // Class specified event bind
        self.classes.forEach(function(c) {
            if (typeof self[c] === 'function') {
                self[c]();
            }
        });

        // Add MegaInput class to show it is megaInput
        this.$input.addClass('megaInputs');
    };

    /*
     * General MegaInput Features
     */
    MegaInputs.prototype._bindEvent = function() {

        var self = this;

        // Bind option events
        if (typeof self.options.onFocus === 'function') {
            self.$input.rebind('focus.megaInputs', self.options.onFocus);
        }

        if (typeof self.options.onBlur === 'function') {
            self.$input.rebind('blur.megaInputs', self.options.onBlur);
        }

        if (typeof self.options.onClick === 'function') {
            self.$input.rebind('click.megaInputs', self.options.onClick);
        }
    };

    // Red colored Message
    MegaInputs.prototype.showError = function(msg) {

        if (typeof this.options.onShowError === 'function') {
            this.options.onShowError(msg);
        }
        else {
            if (d) {
                console.warn('MegaInputs: There is no onShowError options given.');
            }
        }
    };

    // Non-colored Message
    MegaInputs.prototype.showMessage = function(msg) {

        if (typeof this.options.onShowMessage === 'function') {
            this.options.onShowMessage(msg);
        }
        else {
            if (d) {
                console.warn('MegaInputs: There is no showMessage options given.');
            }
        }
    };

    // Non-colored Message
    MegaInputs.prototype.hideError = MegaInputs.prototype.hideMessage = function() {

        if (typeof this.options.onHideError === 'function') {
            this.options.onHideError();
        }
        else {
            if (d) {
                console.warn('MegaInputs: There is no onHideError options given.');
            }
        }
    };

    /**
     * Update value on all input elements and trigger change event
     *
     * @param {*} value New value to set on all affected input elements
     *
     * @returns {void}
     */
    MegaInputs.prototype.setValue = function(value) {
        if (!this.$input || !this.$input.length) {
            return;
        }

        this.$input.val(value).trigger('change').trigger('input');
    };

    // Export
    scope.mega = scope.mega || {};
    scope.mega.ui = scope.mega.ui || {};
    scope.mega.ui.MegaInputs = MegaInputs;

})(jQuery, window);

/*
 * MegaInputs related functions with sanity check with original functions to prevent exception
 */

/**
 * MegaInputs show error with sanity check.
 *
 * @param {String} msg - Massage to show.
 */
$.fn.megaInputsShowError = function(msg) {

    'use strict';

    var megaInput = $(this).data('MegaInputs');

    if (megaInput) {
        megaInput.showError(msg);
    }
    else {
        if (d) {
            console.warn('MegaInputs: Sorry this is not MegaInput or the MegaInput is not initialized.', this);
        }
    }

    return this;
};

/**
 * MegaInputs hide error with sanity check.
 *
 * @param {String} msg - Massage to show.
 */
$.fn.megaInputsShowMessage = function(msg) {

    'use strict';

    var megaInput = $(this).data('MegaInputs');

    if (megaInput) {
        megaInput.showMessage(msg);
    }
    else {
        if (d) {
            console.warn('MegaInputs: Sorry this is not MegaInput or the MegaInput is not initialized.', this);
        }
    }
};

/**
 * MegaInputs Hide message and error with sanity check.
 */
$.fn.megaInputsHideError = $.fn.megaInputsHideMessage = function() {

    'use strict';

    var megaInput = $(this).data('MegaInputs');

    if (megaInput) {
        megaInput.hideError();
    }
    else {
        if (d) {
            console.warn('MegaInputs: Sorry this is not MegaInput or the MegaInput is not initialized.', this);
        }
    }
};

/*
 * Text input
 *
 * Optionally, animate title/placeholder to top of input when it is focused/has value
 *
 * Please refer Megainput Core instruction to learn basic usage.
 *
 * Class: `underlinedText`
 * Example: `<input class="underlinedText" type="text" name="register-name" id="register-name"
 *          placeholder="[$195]" class="input-email " maxlength="190" />`
 *
 * Extension:
 * - Password Strength Checker - Show bottom bar that show strength of entered password
 *      Class: `strengthChecker`
 *      Example: `<input class="underlinedText strengthChecker" type="password" name="register-password"
 *            id="register-password" class="input-password" placeholder="[$909]" />`
 *
 * - Half size - Make title top half width and float positioning, may require manually place `clear <div>`.
 *      Class: `halfSize-l` for float left, `halfSize-r` for float right
 *      Example: `<input
 *                    class="underlinedText halfSize-l"
 *                    autocomplete="disabled"
 *                    type="text"
 *                    name="register-name2"
 *                    id="register-firstname-registerpage2"
 *                    placeholder="[$7342]"
 *                    maxlength="40" />
 *                <input
 *                    class="underlinedText halfSize-r"
 *                    autocomplete="disabled"
 *                    type="text"
 *                    name="register-familyname2"
 *                    id="register-lastname-registerpage2"
 *                    placeholder="[$7345]"
 *                    maxlength="40" />`
 * - Clear button - simple extension of adding clear button on right side of input
 *      Class: `clearButton`
 *      Example: `<input class="underlinedText clearButton"/>`
 *
 * - Copy to clipboard button - simple extension of adding Copy to clipboard button on right side of input
 *      Class: `copyButton`
 *      Example: `<input class="underlinedText copyButton"/>`
 *      Options once MegaInput init:
 *          Pass `copyToastText` on options once MegaInput if custom text in "Copied to clipboard" toast is required
 *
 *              `var megaInput = new mega.ui.MegaInputs($input, {
 *                  copyToastText: l.value_copied
 *              });`
 *
 * - Text area with automatic height. Increase/decrease the text area in height depending on the amount of text.
 *      wrapperClass: `textarea auto-height`
 *      Example: `<input class="underlinedText copyButton" data-wrapper-class="textarea auto-height"/>`
 *      Options once MegaInput init:
 *          Pass `autoHeight` on options once MegaInput init
 *          Pass `maxHeight` on options once MegaInput init if you need to stop increasing it by height at some point
 *
 *              `var megaInput = new mega.ui.MegaInputs($input, {
 *                  autoHeight: true,
 *                  maxHeight: 140,
 *              });`
 *
 * - Length Checker - Show number of characters entered below input field if it has a limit (no-of-chars / limit)
 *      Class: `lengthChecker`
 *      Example: `<input class="underlinedText lengthChecker" type="text" name="register-name" id="register-name"
 *          placeholder="[$195]" maxlength="1000" />`
 */
mega.ui.MegaInputs.prototype.underlinedText = function() {

    'use strict';

    if (!(this.type === 'text' || this.type === 'password' ||
        this.type === 'tel' || this.type === 'number' || this.type === 'email')) {
        console.error('Class binding and input type mismatch! ' +
            'classname: mega-input, input type: ' + this.type + ', Required type: text.');
        return;
    }

    var $input = this.$input;

    this.underlinedText._bindEvent.call(this);
    this.underlinedText._init.call(this);

    // Dedicate functions
    this.underlinedText._extendedFunctions.call(this);

    // Make sure title is always on top upon init when there is value.
    $input.trigger('blur');

    // And make sure password strength is cleared.
    if ($input.hasClass('strengthChecker')) {
        $input.trigger('input');
    }
};

mega.ui.MegaInputs.prototype.underlinedText._init = function() {

    'use strict';

    var $input = this.$input;

    // Overwrite hide/show for Message/Error
    this.underlinedText._updateShowHideErrorAndMessage.call(this);

    // If it is already a megaInput, html preparation does not required anymore.
    if (!$input.hasClass('megaInputs')) {

        const hasTitle = !$input.hasClass('no-title-top') && ($input.attr('title') || $input.attr('placeholder'));
        const wrapperClass = hasTitle ? 'title-ontop' : '';

        // Wrap it with another div for styling and animation
        $input.wrap(`<div class="mega-input ${wrapperClass}"></div>`);

        const $wrapper = this.$wrapper = $input.closest(`.mega-input`);

        // Hide wrapper if input has hidden class
        if ($input.hasClass('hidden')) {
            $wrapper.addClass('hidden');
            $input.removeClass('hidden');
        }

        if (hasTitle) {
            // Insert animatied title
            let title = escapeHTML($input.attr('title') || $input.attr('placeholder'));

            // Adding required sign
            title += this.required ? ' <span class="required-red">*</span>' : '';

            const titleBlock = '<div class="mega-input-title">' + title + '</div>';

            // Insert title block
            $wrapper.safePrepend(titleBlock);

            // Bind event for animation on title
            const $titleBlock = $('.title', $input.parent());
            $titleBlock.rebind('click.underlinedText', function() {

                const $this = $(this);

                if (!$this.parent().hasClass('active')) {
                    $this.next('input').trigger('focus');
                }
            });
        }

        // Insert error message block
        $wrapper.safeAppend('<div class="message-container mega-banner"></div>');

        // Add some class to wrapper
        if ($input.data('wrapper-class')) {
            $wrapper.addClass($input.data('wrapper-class'));
        }

        // Half size
        this.underlinedText._halfSize.call(this);

        // Insert password strength checker
        this.underlinedText._strengthChecker.call(this);

        // Insert input length checker
        this.textArea._lengthChecker.call(this);

        // With icon or prefix (e.g. currency)
        this.underlinedText._withIconOrPrefix.call(this);

        // Add special class for textarea with auto height
        if (this.options.autoHeight) {
            $wrapper.addClass('textarea auto-height');
        }
    }
};

mega.ui.MegaInputs.prototype.underlinedText._bindEvent = function() {

    'use strict';

    var $input = this.$input;

    $input.rebind('focus.underlinedText', function() {
        $(this).parent().addClass('active');

        if ($(this).hasClass('clearButton') && $(this).val()) {
            const $clearBtn = $('.clear-input', $(this).parent());
            $clearBtn.removeClass('hidden');
        }
    });

    $input.rebind('blur.underlinedText change.underlinedText', function() {

        var $this = $(this);

        if ($this.hasClass('clearButton')) {
            const $clearBtn = $('.clear-input', $this.parent());
            $clearBtn.addClass('hidden');
        }

        if ($this.val()) {
            $this.parent().addClass('valued');
        }
        else {
            $this.parent().removeClass('valued');
        }
        $this.parent().removeClass('active');
    });

    // Hide error upon input changes
    var self = this;

    // Textarea with auto height
    if (this.options.autoHeight) {
        $input.rebind('input.autoHeight', (e) => {
            e.target.style.height = 0;
            e.target.style.height = `${this.options.maxHeight && parseInt(this.options.maxHeight) <=
                e.target.scrollHeight ? this.options.maxHeight : e.target.scrollHeight}px`;
        });
    }

    if (!$input.hasClass('strengthChecker')) {
        $input.rebind('input.underlinedText', function() {
            self.hideError();
        });
    }

    if (is_mobile) {

        $(window).rebind('resize.megaInputs', () => {

            const $inputs = $('.megaInputs', '.mega-input.msg');

            for (let i = $inputs.length; i--;) {

                const megaInput = $($inputs[i]).data('MegaInputs');

                if (megaInput) {
                    self.underlinedText._botSpaceCalc.call(megaInput);
                }
            }
        });
    }
};

mega.ui.MegaInputs.prototype.underlinedText._updateShowHideErrorAndMessage = function() {

    'use strict';

    /**
     * Text input - show red colored error on bottom of the underline.
     *
     * @param {String} msg - Massage to show.
     */
    this.showError = function(msg) {

        if (typeof this.options.onShowError === 'function') {
            this.options.onShowError(msg);
        }
        else {
            var $wrapper = this.$input.parent();

            this.$input.addClass('errored');
            $wrapper.addClass('error');

            this.showMessage(msg);
        }
    };

    /**
     * Text input - show gray colored message on bottom of the underline.
     *
     * @param {String} msg - Massage to show.
     * @param {Boolean} fix - Fix message, the message will not disappear.
     * @returns {Void}
     */
    this.showMessage = function(msg, fix) {

        if (typeof this.options.onShowMessage === 'function') {
            this.options.onShowMessage(msg);
        }
        else if (msg) {
            var $wrapper = this.$input.parent();
            var $msgContainer = $wrapper.find('.message-container');

            if (fix) {
                $wrapper.addClass('fix-msg');
                this.fixMessage = msg;
            }

            $wrapper.addClass('msg');
            $msgContainer.safeHTML(msg);
            this.underlinedText._botSpaceCalc.call(this);
        }
    };

    /**
     * Text input - hide error or message.
     */
    this.hideError = this.hideMessage = function(force) {

        if (typeof this.options.onHideError === 'function') {
            this.options.onHideError();
        }
        else {
            var $wrapper = this.$input.parent();

            this.$input.removeClass('errored');
            $wrapper.removeClass('error');

            if ($wrapper.hasClass('fix-msg') && !force) {
                this.showMessage(this.fixMessage);
            }
            else {
                $wrapper.removeClass('msg').removeClass('fix-msg');
                $wrapper.css('margin-bottom', '');
            }
        }
    };

    // Hide all error upon reinitialize
    this.hideError();
};

mega.ui.MegaInputs.prototype.underlinedText._halfSize = function() {

    'use strict';

    var $input = this.$input;
    var $wrapper = this.$wrapper;

    if ($input.hasClass('halfSize-l')) {
        $wrapper.addClass('halfSize-l');
    }

    if ($input.hasClass('halfSize-r')) {
        $wrapper.addClass('halfSize-r');
    }
};

mega.ui.MegaInputs.prototype.underlinedText._withIconOrPrefix = function() {

    'use strict';

    var $input = this.$input;
    var $wrapper = this.$wrapper;

    // Copy to clipboard button
    if ($input.hasClass('copyButton')) {

        $wrapper.safeAppend(`<i class="${mega.ui.sprites.mono} icon-square-copy copy-input-value"></i>`);

        const $copyBtn = $('.copy-input-value', $wrapper);

        $copyBtn.rebind('click.copyInputValue tap.copyInputValue', () => {
            copyToClipboard(
                $input.val(),
                escapeHTML(this.options.copyToastText) ||  l[371]
            );
            return false;
        });
    }

    if ($input.hasClass('clearButton')) {

        $wrapper.safeAppend(
            `<i class="${mega.ui.sprites.mono} icon-close-component clear-input"></i>`
        );

        const $clearBtn = $('.clear-input', $wrapper);

        $clearBtn.rebind('click.clearInput tap.clearInput', () => {
            if ($input.hasClass('errored')) {
                this.hideError();
            }
            this.setValue('');
            $input.trigger('focus');
        });

        $input.rebind('keyup.clearInput input.clearInput change.clearInput', function() {
            $clearBtn[this.value.length ? 'removeClass' : 'addClass']('hidden');
        });

        if (!$input.val()) {
            $clearBtn.addClass('hidden');
        }
    }

    if (this.type === 'password') {

        const iconSprite = mega.ui.sprites.mono;
        const showTextIcon = 'icon-eye-reveal';
        const hideTextIcon = 'icon-eye-hidden';

        $wrapper.safeAppend(`<i class="${iconSprite} ${showTextIcon} pass-visible"></i>`);

        $('.pass-visible', $wrapper).rebind('click.togglePassV', function() {

            if (this.classList.contains(showTextIcon)) {
                $input.attr('type', 'text');
                this.classList.remove(showTextIcon);
                this.classList.add(hideTextIcon);
            }
            else {
                $input.attr('type', 'password');
                this.classList.add(showTextIcon);
                this.classList.remove(hideTextIcon);
            }
        });
    }

    if ($input.data('icon')) {
        $wrapper.addClass('with-icon');
        $wrapper.safePrepend(`<i class="${($input.data('icon') || '')}"></i>`);
    }
    else if ($input.data('prefix')) {
        $wrapper.addClass('with-icon');
        $wrapper.safePrepend(`<span class="prefix">${$input.data('prefix')}</span>`);
    }
};

mega.ui.MegaInputs.prototype.underlinedText._strengthChecker = function() {

    'use strict';

    var $input = this.$input;
    var $wrapper = this.$wrapper;
    var self = this;

    if (this.type === 'password' && $input.hasClass('strengthChecker')) {

        // Strength wording
        $wrapper.safeAppend('<div class="account password-status hidden"></div>');

        // Strength Bar
        if (is_mobile && $wrapper.hasClass('mobile')) {
            $wrapper.safeAppend('<div class="account-pass-lines">' +
                '<div class="register-pass-status-line1"></div>' +
                '<div class="register-pass-status-line2"></div>' +
                '<div class="register-pass-status-line3"></div>' +
                '<div class="register-pass-status-line4"></div>' +
                '<div class="register-pass-status-line5"></div>' +
            '</div>');
        }
        else {
            $wrapper.safeAppend('<div class="account-pass-lines">' +
                '<div class="register-pass-status-line"></div>' +
            '</div>');
        }

        // Loading icon for zxcvbn.
        $wrapper.safeAppend('<div class="register-loading-icon">' +
            '<img alt="" src="' + staticpath + 'images/mega/ajax-loader-gray.gif" />' +
            '</div>');

        var _bindStrengthChecker = function() {

            // Hide loading icon
            $wrapper.removeClass('loading');

            $input.rebind('keyup.strengthChecker input.strengthChecker change.strengthChecker', function(e) {

                if (e.keyCode === 13) {
                    return false;
                }

                self.hideError();

                var $passStatus = $wrapper.find('.password-status');
                var $passStatusBar = $wrapper.find('.account-pass-lines');
                var $messageContainer = $('.message-container', $wrapper);

                $passStatus
                    .add($passStatusBar)
                    .add($messageContainer)
                    .removeClass('good1 good2 good3 good4 good5 checked');

                var strength = classifyPassword($(this).val());

                if (typeof strength === 'object') {

                    $passStatus.addClass(strength.className + ' checked').text(strength.string1);
                    if (is_mobile) {
                        $messageContainer.addClass(strength.className);

                        let alert = '<i class="alert sprite-mobile-fm-mono icon-info-thin-outline"></i>';
                        if (strength.className === 'good3') {
                            alert = '<i class="alert sprite-mobile-fm-mono icon-alert-circle-thin-outline"></i>';
                        }
                        else if (strength.className === 'good4' || strength.className === 'good5') {
                            alert = '<i class="alert sprite-mobile-fm-mono icon-check-circle-thin-outline"></i>';
                        }
                        $input.data('MegaInputs').showMessage(
                            `${alert} <span>${strength.string2}</span>`
                        );
                    }
                    else {
                        $input.data('MegaInputs').showMessage(strength.string2);
                    }

                    $passStatusBar.addClass(strength.className);
                }
                else {
                    $input.data('MegaInputs').hideMessage();
                }
            });

            // Show strength upon zxcvbn loading is finished or Reset strength after re-rendering.
            $input.trigger('input.strengthChecker');
        };

        if (typeof zxcvbn === 'undefined') {

            // Show loading icon
            $wrapper.addClass('loading');
            M.require('zxcvbn_js').done(_bindStrengthChecker);
        }
        else {
            _bindStrengthChecker();
        }

        $wrapper.addClass('strengthChecker');
    }
};

mega.ui.MegaInputs.prototype.underlinedText._botSpaceCalc = function() {

    'use strict';

    var $wrapper = this.$input.parent();

    if ($wrapper.hasClass('msg')) {
        if (this.origBotSpace === undefined) {
            this.origBotSpace = parseInt($wrapper.css('margin-bottom'));
        }

        $wrapper.css('margin-bottom',
                     this.origBotSpace
                     + $('.message-container', $wrapper).outerHeight()
                     + ($wrapper.hasClass('fix-msg') ? 4 : 9));
    }
};

mega.ui.MegaInputs.prototype.underlinedText._lengthChecker = function() {

    'use strict';

    var $input = this.$input;
    var $wrapper = this.$wrapper;

    const maxLength = $input.attr('maxlength');

    if ($input.hasClass('lengthChecker') && maxLength) {

        // Length section
        $wrapper.safeAppend('<div class="length-check hidden">' +
            '<span class="chars-used"></span>' +
            `<span class="char-limit">/${maxLength}</span>` +
        '</div>');

        const $lengthCheck = $('.length-check', $wrapper);

        if ($input.val().length) {
            $lengthCheck.removeClass('hidden');
            $('.chars-used', $lengthCheck).text($input.val().length);
        }

        $input.rebind('keyup.lengthChecker input.lengthChecker change.lengthChecker', (e) => {

            if (e.keyCode === 13) {
                return false;
            }

            this.hideError();

            const inputSize = $input.val().length;

            $lengthCheck.toggleClass('hidden', !inputSize);

            const $charsUsed = $('.chars-used', $wrapper);
            $charsUsed.text(inputSize);
        });
    }
};

mega.ui.MegaInputs.prototype.underlinedText._extendedFunctions = function() {

    'use strict';

    /**
     * Update title after MegaInput is already inited, if a title exists.
     * The title can be passed as parameter
     * or simply update title or placeholder on the input and call this will update title.
     *
     * @param {String} [title] - New title.
     */
    this.updateTitle = function(title) {
        const $titleElem = $('.mega-input-title', this.$input.parent());

        if ($titleElem) {
            title = title || this.$input.attr('title') || this.$input.attr('placeholder');

            // Note: This should remain as text() as some place use third party pulling text as title.
            $titleElem.text(title);
        }
    };

    /**
     * Update value of the input, with or without titletop animation.
     *
     * @param {String} [value] - New value.
     * @param {Boolean} [noAnimation] - Show animation or not.
     */
    this.setValue = function(value, noAnimation) {

        var self = this;

        if (noAnimation) {
            this.$input.prev().addClass('no-trans');
        }

        mega.ui.MegaInputs.prototype.setValue.call(this, value);

        onIdle(function() {
            self.$input.prev().removeClass('no-trans');
        });
    };
};

/*
 * Textarea input
 *
 * Optionally, animate title/placeholder to top of input when it is focused/has value
 *
 * Please refer to the Megainput Core instructions to learn basic usage.
 *
 * Class: `textArea`
 * Example: `<textarea class="textArea input-name" name="register-name" id="register-name"
 *          placeholder="[$195]" maxlength="1000" />`
 *
 * Extensions:
 * - Length Checker - Show number of characters entered below textarea if it has a limit (no-of-chars / limit)
 *      Class: `lengthChecker`
 *      Example: `<textarea class="textArea lengthChecker input-name" name="register-name" id="register-name"
 *          placeholder="[$195]" maxlength="1000" />`
 *
 * - Clear button - Simple extension of adding clear button on right side of textarea
 *      Class: `clearButton`
 *      Example: `<textarea class="textArea clearButton"/>`
 */
mega.ui.MegaInputs.prototype.textArea = function() {

    'use strict';

    if (!this.$input.is('textarea')) {
        console.error('Not a textarea field.');
        return;
    }

    var $textarea = this.$input;

    this.textArea._bindEvent.call(this);
    this.textArea._init.call(this);

    // Dedicated functions
    this.textArea._extendedFunctions.call(this);

    // Make sure title is always on top upon init when there is value.
    $textarea.trigger('blur');
};

mega.ui.MegaInputs.prototype.textArea._init = function() {

    'use strict';

    var $input = this.$input;

    // Overwrite hide/show for Message/Error
    this.textArea._showHideErrorAndMsg.call(this);

    // If it is already a megaInput, html preparation does not required anymore.
    if (!$input.hasClass('megaInputs')) {

        const hasTitle = !$input.hasClass('no-title-top') && ($input.attr('title') || $input.attr('placeholder'));
        const wrapperClass = hasTitle ? 'title-ontop' : '';

        // Wrap it with another div for styling and animation
        $input.wrap(`<div class="mega-input ${wrapperClass}"></div>`);

        const $wrapper = this.$wrapper = $input.closest(`.mega-input`);
        $wrapper.addClass('textarea');

        // Hide wrapper if input has hidden class
        if ($input.hasClass('hidden')) {
            $wrapper.addClass('hidden');
            $input.removeClass('hidden');
        }

        if (hasTitle) {
            // Insert animatied title
            let title = escapeHTML($input.attr('title') || $input.attr('placeholder'));

            // Adding required sign
            title += this.required ? ' <span class="required-red">*</span>' : '';

            if ($input.hasClass('optional')) {
                title += `<span class="optional">${l[7347]}</span>`;
            }

            const titleBlock = '<div class="mega-input-title">' + title + '</div>';

            // Insert title block
            $wrapper.safePrepend(titleBlock);

            // Bind event for animation on title
            const $titleBlock = $('.title', $input.parent());
            $titleBlock.rebind('click.textArea', function() {

                const $this = $(this);

                if (!$this.parent().hasClass('active')) {
                    $this.next('input').trigger('focus');
                }
            });
        }

        // Insert error message block
        $wrapper.safeAppend('<div class="message-container mega-banner"></div>');

        // With clear button
        this.textArea._withClearButton.call(this);

        // Insert input length checker
        this.textArea._lengthChecker.call(this);

        // Add some class to wrapper
        if ($input.data('wrapper-class')) {
            $wrapper.addClass($input.data('wrapper-class'));
        }
    }
};

mega.ui.MegaInputs.prototype.textArea._bindEvent = mega.ui.MegaInputs.prototype.underlinedText._bindEvent;

mega.ui.MegaInputs.prototype.textArea._showHideErrorAndMsg =
    mega.ui.MegaInputs.prototype.underlinedText._updateShowHideErrorAndMessage;

mega.ui.MegaInputs.prototype.textArea._withClearButton = function() {

    'use strict';

    var $input = this.$input;
    var $wrapper = this.$wrapper;

    if ($input.hasClass('clearButton')) {

        $wrapper.safeAppend(
            `<i class="${mega.ui.sprites.mono} icon-close-component clear-input"></i>`
        );

        const $clearBtn = $('.clear-input', $wrapper);

        $clearBtn.rebind('click.clearInput tap.clearInput', () => {
            if ($input.hasClass('errored')) {
                this.hideError();
            }
            this.setValue('');
            $input.trigger('focus');
        });

        $input.rebind('keyup.clearInput input.clearInput change.clearInput', function() {
            $clearBtn[this.value.length ? 'removeClass' : 'addClass']('hidden');
        });

        if (!$input.val()) {
            $clearBtn.addClass('hidden');
        }
    }
};

mega.ui.MegaInputs.prototype.textArea._lengthChecker = mega.ui.MegaInputs.prototype.underlinedText._lengthChecker;

mega.ui.MegaInputs.prototype.textArea._extendedFunctions =
    mega.ui.MegaInputs.prototype.underlinedText._extendedFunctions;

/*
 * Currency input
 *
 * Please refer to Megainput Core instruction to learn basic usage.
 *
 * Class: `currencyField`
 * Example: `<input class="currencyField" name="redeem-amount" id="redeem-amount" value="1234.56"/>`
 */
mega.ui.MegaInputs.prototype.currencyField = function() {
    'use strict';

    if (!this.$input.hasClass('megaInputs')) {

        this.currencyField._init.call(this);
        this.currencyField._bindEvent.call(this);

        // Dedicate functions
        this.currencyField._extendedFunctions.call(this);
    }
};

mega.ui.MegaInputs.prototype.currencyField._init = function() {

    'use strict';

    // Wrap it with another div for styling and animation
    this.$input.wrap(`<div class="mega-input"></div>`);

    const $wrapper = this.$wrapper = this.$input.closest(`.mega-input`);

    // Hide wrapper if input has hidden class
    if (this.$input.hasClass('hidden')) {
        $wrapper.addClass('hidden');
        this.$input.removeClass('hidden');
    }

    // Insert error message block
    $wrapper.safeAppend('<div class="message-container mega-banner"></div>');

    // Add some class to wrapper
    if (this.$input.data('wrapper-class')) {
        $wrapper.addClass(this.$input.data('wrapper-class'));
    }

    // With icon or prefix (e.g. currency)
    this.currencyField._withIconOrPrefix.call(this);

    // Prepare the currency input
    if (formatCurrency(1111.11, 'EUR', 'number').indexOf(',') >= 4) {

        this.type = 'text';
        this.$input.removeAttr('step');
    }
    else {
        this.type = 'number';
        this.$input.attr('step', 'any');
    }

    this.$input.attr('type', this.type);
};

mega.ui.MegaInputs.prototype.currencyField._bindEvent = function() {

    'use strict';

    this.$input.rebind('focus.currencyField', function() {
        $(this).parent().addClass('active');
    });

    this.$input.rebind('blur.currencyField change.currencyField', function() {
        const $this = $(this);

        if ($this.val()) {
            $this.parent().addClass('valued');
        }
        else {
            $this.parent().removeClass('valued');
        }
        $this.parent().removeClass('active');
    });

    this.$input.off('keydown.currencyField');

    if (this.type === 'text') {

        this.$input.rebind('keydown.currencyField', e => {

            // Valid keys 0-9/keypad 0-9/,/./decimal point/space/left arrow/right arrow/delete/backspace/tab/shift
            if (![8, 9, 16, 32, 37, 39, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
                  96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 110, 188, 190].includes(e.keyCode)) {
                return false;
            }
        });
    }
};

mega.ui.MegaInputs.prototype.currencyField._withIconOrPrefix = function() {

    'use strict';

    var {$input, $wrapper} = this;

    if ($input.data('icon')) {
        $wrapper.addClass('with-icon');
        $wrapper.safePrepend(`<i class="${$input.data('icon') || ''}"></i>`);
    }
    else if ($input.data('prefix')) {
        $wrapper.addClass('with-icon');
        $wrapper.safePrepend(`<span class="prefix">${$input.data('prefix')}</span>`);
    }
};

mega.ui.MegaInputs.prototype.currencyField._extendedFunctions = function() {

    'use strict';

    this.getValue = function() {

        let val = this.$input.val();

        if (this.type === 'text') {

            const matches = val.match(/([,.])\d*$/);
            let cents = 0;

            if (matches) {

                cents = parseInt(matches[0].slice(1));

                if (isNaN(cents)) {
                    cents = 0;
                }
                else {
                    let centLength = matches[0].slice(1).length;

                    if (centLength === 1) {

                        ++centLength;
                        cents *= 10;
                    }

                    let decimal = centLength - 2;

                    while (decimal > 0) {
                        cents *= 0.1;
                        decimal--;
                    }

                    cents = Math.round(cents);
                }

                val = val.slice(0, val.length - matches[0].length);
            }

            val = parseInt(val.replace(/\D/g, ''));

            if (isNaN(val)) {
                return 0;
            }

            return val + cents * 0.01;
        }

        return val;
    };
};

/**
 * Developer Settings Page Logic.
 */
(function(scope) {
    'use strict';

    scope.developerSettings = {
        $page: null,
        $targetAccountInput: null,
        $abTestSettings: null,
        $setUsedTransferQuota: null,
        $setStatus: null,
        $simpleButton: null,
        $userAttributes: null,
        $userAttributeButtons: null,
        targetCurrent: true,

        setValues: {},

        errorMessages: {
            '-2': 'Command Invalid',
            '-5': 'Cannot Apply To Target Account',
            '-9': 'No Item Found',
            '-11': 'No Access',
            '-16': 'Target account is not allowed, or does not exist',
            '-18': 'Command Temporarily Unavailable',
        },

        userAttrSymbols: {
            '-2': '^',
            '-1': '',
            'true': '+',
            'false': '*',
            '0': '',
            '1': '!'
        },

        /** Init Developer Settings Page. */
        init: function() {
            this.$page = $('.bottom-page.developer-settings');
            this.initSettings();
            this.initMiscLocalStorage();
            this.initApplyButton();
            this.initAPICommandSettings();
        },

        /** Show Developer Setting Page. */
        show: function() {
            parsepage(pages['developersettings']);
            topmenuUI();
            this.init();
        },

        /** Reload to apply changes. **/
        apply: function() {
            window.location.reload();
        },

        /** Init HTML defined setting controls **/
        initSettings: function() {
            var $localStorageSettings = this.$page.find('.developer-setting.localstorage');

            // Load in current settings.
            $localStorageSettings.each(function() {
                var $this = $(this);
                $this.val(localStorage.getItem($this.attr('name')) || null);
            });

            // Change event save setting to local storage.
            $localStorageSettings.rebind('change', function() {
                var $this = $(this);
                var itemKey = $this.attr('name');
                var val =  $this.val();
                if (val) {
                    localStorage.setItem(itemKey, val);
                } else {
                    localStorage.removeItem(itemKey);
                }
            });
        },

        initMiscLocalStorage() {
            const dontChange = new Set(['sid', 'k', 'privk', 'v', 'handle', 'fmconfig', 'attr', 'link']);
            const $otherDev = $('.misc-dev', this.$page);
            const $buttons = $('button', $otherDev);
            const $resText = $('.response', $otherDev);

            $buttons.rebind('click', function() {

                const isGet = $(this).hasClass('get');
                const name = $('.name', $otherDev).val().trim();
                const value = $('.value', $otherDev).val();
                if (!name && !isGet) {
                    $otherDev.addClass('error');
                    return;
                }
                else if (!name) {
                    $resText.text('No name provided');
                    return;
                }
                else if (dontChange.has(name)) {
                    $resText.text('Cannot change this value');
                    return;
                }

                $otherDev.removeClass('error');
                if (isGet) {
                    $resText.text(`localStorage.${name} = ${localStorage[name]}`);
                    return;
                }
                if (!value) {
                    delete localStorage[name];
                    $resText.text(`Deleted localStorage.${name}`);
                    return;
                }

                localStorage[name] = value;
                $resText.text(`localStorage.${name} = ${value}`);
            });

        },

        makeRequest(request, $buttons, setTo, id) {
            if ($buttons.hasClass('disabled')) {
                return;
            }
            $buttons.addClass('disabled').parent().removeClass('error');
            const targetAccount = this.$targetAccountInput.val();
            if (targetAccount) {
                request.t = targetAccount;
            }

            const $resText = $('.response', $buttons.parent());

            console.info('dev-settings request:', request);

            return api.req(request).then((res) => {
                console.info('dev-settings response:', res.result);
                if (id === 'transferQuota') {
                    if (this.targetCurrent) {
                        return;
                    }
                    setTo = bytesToSize(setTo);
                }
                else if (setTo) {
                    this.setValues[id] = setTo;
                }
                $resText.text('Set to: ' + (setTo || res.result));
            }).catch((ex) => {
                console.info('dev-settings error:', ex);
                $resText.text('Error: ' + this.errorMessages[ex] + ' (' + ex + ')' || ex);
            }).finally(() => {
                if (id === 'transferQuota') {
                    return;
                }
                $buttons.removeClass('disabled');
            });
        },

        async setABTestFlag() {
            const $buttons = $('button', this.$abTestSettings);
            const flagName = $('.ab-flag-name', this.$page).val().replace('ab_', '');
            const flag = $('.ab-flag-value', this.$page).val();
            if (!flag || !flagName) {
                this.$abTestSettings.addClass('error');
                return;
            }
            const request = {a: 'dev', aa: 'abs', c: 'ab_' + flagName, g: flag | 0};
            await this.makeRequest(request, $buttons, flag, 'ab_' + flagName);
            this.getABTestFlag(true);
        },

        getABTestFlag(skipCheck) {
            if (!skipCheck && $('.get', this.$abTestSettings).hasClass('disabled')) {
                return;
            }
            this.$abTestSettings.removeClass('error');
            const $response = $('.response', this.$abTestSettings);
            const flagName = 'ab_' + $('.ab-flag-name', this.$page).val().replace('ab_', '');
            const flagValue = this.setValues[flagName] || mega.flags[flagName];
            $response.text(typeof flagValue === 'undefined' ? 'Flag not found' : flagName + ' set to: ' + flagValue);
        },

        getTransferQuota() {
            if (!this.targetCurrent) {
                $('button', this.$setUsedTransferQuota).removeClass('disabled');
                return;
            }
            M.getTransferQuota().then((res) => {
                $('button', this.$setUsedTransferQuota).removeClass('disabled');
                const usedText = `Used: ${bytesToSize(res.caxfer)}.`;
                const emptyText = `Remaining: ${bytesToSize(res.max - res.caxfer)}`;
                const maxText = `Max: ${bytesToSize(res.max)}`;
                $('.current-used', this.$setUsedTransferQuota).text(usedText);
                $('.current-empty', this.$setUsedTransferQuota).text(emptyText);
                $('.current-max', this.$setUsedTransferQuota).text(maxText);
            });
        },

        setTransferQuota() {
            const $button = $('button', this.$setUsedTransferQuota);
            const sizeMultiplier = $('.dropdown', this.$setUsedTransferQuota).val() | 0;
            const size = ($('input.value', this.$setUsedTransferQuota).val());
            if (!size) {
                $button.parent().addClass('error');
                return;
            }
            const quota = +size * Math.pow(1024, sizeMultiplier);
            const request = {a: 'dev', aa: 'tq', q: quota};
            const promise = this.makeRequest(request, $button, quota, 'transferQuota');
            if (promise) {
                promise.then(() => this.getTransferQuota());
            }
        },

        setStatus(target) {
            const $setting = $(target).closest('.api-setting-item');
            const $button = $('button', $setting);
            const $dropdown = $('.dropdown', $setting);
            const value = $dropdown.val();
            const type = $dropdown.attr('name');
            const request = {a: 'dev', aa: type, s: value};
            this.makeRequest(request, $button, value, type);
        },

        handleSimpleButton(target) {
            const $setting = $(target).closest('.api-setting-item');
            const $button = $('button', $setting);
            const request = {a: 'dev', aa: $button.attr('name')};
            this.makeRequest(request, $button, false, $button.attr('name'));
        },

        getPublicHistoric() {
            let publicType = $('select.user-attr-public-type', this.$userAttributes).val();

            publicType = +publicType < 0
                ? +publicType
                : publicType === 'true';

            const isHistoric = $('select.user-attr-is-historic', this.$userAttributes).val() | 0;

            return [publicType, isHistoric];
        },

        setUserAttribute() {
            this.$userAttributeButtons = this.$userAttributeButtons || $('button', this.$userAttributes);
            const $set = ('.set', this.$userAttributeButtons);
            if ($set.hasClass('disabled')) {
                return;
            }
            const attrbuteName = $('input.user-attr-name', this.$userAttributes).val();
            const attrbutevalue = $('input.user-attr-value', this.$userAttributes).val();

            if (!attrbuteName || !attrbutevalue) {
                this.$userAttributes.addClass('error');
                return;
            }
            $set.addClass('disabled');
            this.$userAttributes.removeClass('error');

            const [publicType, isHistoric] = this.getPublicHistoric();

            mega.attr.set(attrbuteName, attrbutevalue, publicType, isHistoric, (res) => {
                this.getUserAttribute(res === u_handle, attrbutevalue);
            });
        },

        getUserAttribute(setComplete, valueSet) {

            this.$userAttributeButtons = this.$userAttributeButtons || $('button', this.$userAttributes);

            const $get = $('.get', this.$userAttributeButtons);
            if ($get.hasClass('disabled')) {
                return;
            }
            $get.addClass('disabled');
            this.$userAttributes.removeClass('error');
            this.$userAttributeButtons.addClass('disabled');

            const $responseText = $('.response', this.$userAttributes);
            const attrbuteName = $('input.user-attr-name', this.$userAttributes).val();
            const [publicType, isHistoric] = this.getPublicHistoric();
            const key = this.userAttrSymbols[publicType] + this.userAttrSymbols[isHistoric] + attrbuteName;

            if (setComplete || this.setValues[key]) {
                this.setValues[key] = valueSet || this.setValues[key];
                $responseText.text(key + ': ' + this.setValues[key]);
                this.$userAttributeButtons.removeClass('disabled');
                $get.addClass('disabled');
                return;
            }

            mega.attr.get(u_handle, attrbuteName, publicType, isHistoric, (res) => {
                if (res === -9) {
                    $responseText.text('Not set');
                }
                else {
                    $responseText.text(key + ': ' + res);
                }
            }).catch((ex) => {
                if (ex === -9) {
                    $responseText.text('Not set');
                }
                else {
                    $responseText.text('Error: ' + (this.errorMessages[ex] || 'Unknown issue: ' + ex));
                }
            }).finally(() => {
                this.$userAttributeButtons.removeClass('disabled');
                $get.addClass('disabled');
            });
        },

        initAPICommandSettings() {
            if (!u_attr || !d) {
                $('.developer-settings-container > .logged-in', this.$page).addClass('hidden');
                return;
            }
            const $response = $('.response', this.$page);
            this.$abTestSettings = $('.ab-group-set', this.$page);
            this.$setUsedTransferQuota = $('.set-used-transfer', this.$page);
            this.$setStatus = $('.set-user-status, .set-business-status, .set-pro-flexi-status', this.$page);
            this.$userAttributes = $('.user-attr-settings', this.$page);
            this.$simpleButton = $('.adv-odq-warning-state, .force-reload, .remove-password-manager-attribute',
                                   this.$page);

            this.$targetAccountInput = $('.target-account', this.$page)
                .val(u_attr.email)
                .rebind('change.devsettings', () => {
                    $response.text('');
                    $('.current-info', this.$setUsedTransferQuota).text('');
                    this.targetCurrent = this.$targetAccountInput.val() === u_attr.email;
                    this.getTransferQuota();
                    $('button.get', this.$abTestSettings)
                        .toggleClass('disabled', !this.targetCurrent);
                });

            this.getTransferQuota();

            const clickName = 'click.devsettings';
            $('button.set', this.$abTestSettings).rebind(clickName, () => this.setABTestFlag());
            $('button.get', this.$abTestSettings).rebind(clickName, () => this.getABTestFlag());
            $('button.set', this.$setUsedTransferQuota).rebind(clickName, () => this.setTransferQuota());
            $('button.set', this.$setStatus).rebind(clickName, (e) => this.setStatus(e.target));
            $('button', this.$simpleButton).rebind(clickName, (e) => this.handleSimpleButton(e.target));
            $('button.set', this.$userAttributes).rebind(clickName, () => this.setUserAttribute());
            $('button.get', this.$userAttributes).rebind(clickName, () => this.getUserAttribute());
        },


        /** Init the page reload button **/
        initApplyButton() {
            this.$page.find('.apply').rebind('click.devsettings', () => {
                this.apply();
            });
        }
    };

})(mega);

mBroadcaster.once('fm:initialized', () => {
    'use strict';
    if (!localStorage.devSettDefault) {
        return;
    }
    onIdle(() => {
        mega.developerSettings.show();
    });
});

function RepayPage() {
    "use strict";
    this.noOverduePaymentErrorCode = -1;
    this.unknownErrorCode = -99;
}

RepayPage.prototype.initPage = function() {
    "use strict";

    // if mobile we view the related header for top-mobile.html and hide navigation div of desktop
    if (is_mobile) {

        if (mega.ui && mega.ui.header) {
            mega.ui.header.update();
        }

        $('.mobile.bus-repay').removeClass('hidden');
        $('.mobile.fm-header').addClass('hidden');
        $('.mobile.fm-header.fm-hr').removeClass('hidden');
    }

    // If u_attr not set, or
    // If Business account and (not the master Business account, or not expired or in grace period), or
    // If Pro Flexi account and (not expired or in grace period)
    if (!u_attr ||
        (u_attr.b && (!u_attr.b.m || !pro.isExpiredOrInGracePeriod(u_attr.b.s))) ||
        (u_attr.pf && !pro.isExpiredOrInGracePeriod(u_attr.pf.s))) {

        loadSubPage('start');
        return;
    }

    if (!u_attr.email || isEphemeral()) {
        return loadSubPage('registerb');
    }


    var mySelf = this;

    loadingDialog.show();

    // If necessary attributes are not loaded, load them then comeback.
    if (!u_attr.pf && (!u_attr['%name'] || !u_attr['%email'])) {

        Promise.allSettled([
            u_attr['%name'] || mega.attr.get(u_attr.b.bu, '%name', -1),
            u_attr['%email'] || mega.attr.get(u_attr.b.bu, '%email', -1)
        ]).then(([{value: name}, {value: email}]) => {

            name = u_attr['%name'] = name && from8(base64urldecode(name) || name) || '';
            email = u_attr['%email'] = email && from8(base64urldecode(email) || email) || u_attr.email;

            assert(name && email, `Invalid account state (${name}:${email})`);

            mySelf.initPage();

        }).catch((ex) => {
            loadingDialog.hide();
            msgDialog('warninga', l[135], l[47], ex);
        });
        return false;
    }

    const $repaySection = $('.main-mid-pad.bus-repay');
    const $leftSection = $('.main-left-block', $repaySection);
    const $rightSection = $('.main-right-block', $repaySection);
    const $paymentBlock = $('.bus-reg-radio-block', $leftSection);

    const $repayBtn = $('.repay-btn', $repaySection).addClass('disabled');
    const $revertToFreeBtn = $('.revert-to-free-btn', $repaySection);

    $('.bus-reg-agreement.mega-terms .bus-reg-txt', $leftSection).safeHTML(l['208s']);

    // If Pro Flexi, show the icon and text
    if (u_attr.pf) {
        $('.plan-icon', $rightSection)
            .removeClass('icon-crests-business-details')
            .addClass('icon-crests-pro-flexi-details');
        $('.business-plan-title', $rightSection).text(l.pro_flexi_name);
        $('.bus-reg-agreement.ok-to-auto .radio-txt', $leftSection).text(l.setup_monthly_payment_pro_flexi);
        $('.dialog-subtitle', $repaySection).text(l.reactivate_pro_flexi_subscription);

        // Show the 'Revert to free account' button and add click handler for it
        $revertToFreeBtn.removeClass('hidden');
        $revertToFreeBtn.rebind('click.revert', () => {

            const title = l.revert_to_free_confirmation_question;
            const message = l.revert_to_free_confirmation_info;

            if (is_mobile) {
                parsepage(pages.mobile);
            }

            msgDialog('confirmation', '', title, message, (e) => {
                if (e) {
                    loadingDialog.show();

                    // Downgrade the user to Free
                    api.req({a: 'urpf', r: 1})
                        .catch(dump)
                        .finally(() => {

                            // Reset account cache so all account data will be refetched
                            if (M.account) {
                                M.account.lastupdate = 0;
                            }

                            loadSubPage('fm/account/plan');
                        });
                }
                else if (is_mobile) {

                    // Close button for mobile we need to reload as loadSubPage on the same page doesn't work
                    location.reload();
                }
            });
        });
    }

    // event handler for repay button
    $repayBtn.rebind('click', function repayButtonHandler() {
        if ($(this).hasClass('disabled')) {
            return false;
        }

        if (is_mobile) {
            parsepage(pages.mobile);
        }

        const $selectedProvider = $('.bus-reg-radio-option .bus-reg-radio.radioOn', $repaySection);

        mySelf.planInfo.usedGatewayId = $selectedProvider.attr('prov-id');
        mySelf.planInfo.usedGateName = $selectedProvider.attr('gate-n');

        addressDialog.init(mySelf.planInfo, mySelf.userInfo, new BusinessRegister());
        return false;
    });

    // event handler for radio buttons
    $('.bus-reg-radio-option', $paymentBlock)
        .rebind('click.suba', function businessRepayCheckboxClick() {
            var $me = $(this);
            $me = $('.bus-reg-radio', $me);
            if ($me.hasClass('radioOn')) {
                return;
            }
            $('.bus-reg-radio', $paymentBlock).removeClass('radioOn').addClass('radioOff');
            $me.removeClass('radioOff').addClass('radioOn');
        });

    $('.bus-reg-agreement.mega-terms .checkdiv', $leftSection)
        .removeClass('checkboxOn').addClass('checkboxOff');

    // event handler for check box
    $('.bus-reg-agreement', $leftSection).rebind(
        'click.suba',
        function businessRepayCheckboxClick() {
            var $me = $('.checkdiv', $(this));
            if ($me.hasClass('checkboxOn')) {
                $me.removeClass('checkboxOn').addClass('checkboxOff');
                $repayBtn.addClass('disabled');
            }
            else {
                $me.removeClass('checkboxOff').addClass('checkboxOn');
                if ($('.bus-reg-agreement .checkdiv.checkboxOn', $leftSection).length === 2) {
                    $repayBtn.removeClass('disabled');
                }
                else {
                    $repayBtn.addClass('disabled');
                }
            }
        });

    const fillPaymentGateways = function(status, list) {

        const failureExit = msg => {
            loadingDialog.hide();
            msgDialog('warninga', '', msg || l[19342], '', loadSubPage.bind(null, 'start'));
        };

        if (!status) { // failed result from API
            return failureExit();
        }

        // clear the payment block
        const $paymentBlock = $('.bus-reg-radio-block', $repaySection).empty();

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

        const radioHtml = '<div class="bus-reg-radio-option"> ' +
            '<div class="bus-reg-radio payment-[x] radioOff" prov-id="[Y]" gate-n="[Z]"></div>';
        const textHtml = '<div class="provider">[x]</div>';
        const iconHtml = `<div class="payment-icon">
                            <i class="[x]"></i>
                        </div></div>`;

        if (!list.length) {
            if (u_attr.b) {
                return failureExit(l[20431]);
            }
            return failureExit(l.no_payment_providers);
        }

        let paymentGatewayToAdd = '';
        for (let k = 0; k < list.length; k++) {
            const payRadio = radioHtml.replace('[x]', list[k].gatewayName).replace('[Y]', list[k].gatewayId).
                replace('[Z]', list[k].gatewayName);
            const payText = textHtml.replace('[x]', list[k].displayName);
            const payIcon = iconHtml.replace('[x]', icons[list[k].gatewayName]);
            paymentGatewayToAdd += payRadio + payText + payIcon;
        }
        if (paymentGatewayToAdd) {
            $paymentBlock.safeAppend(paymentGatewayToAdd);
        }

        // setting the first payment provider as chosen
        $('.bus-reg-radio-block .bus-reg-radio', $repaySection).first().removeClass('radioOff')
            .addClass('radioOn');

        // event handler for radio buttons
        $('.bus-reg-radio-option', $paymentBlock)
            .rebind('click.suba', function businessRegCheckboxClick() {
                const $me = $('.bus-reg-radio', $(this));
                if ($me.hasClass('radioOn')) {
                    return;
                }
                $('.bus-reg-radio', $paymentBlock).removeClass('radioOn').addClass('radioOff');
                $me.removeClass('radioOff').addClass('radioOn');
            });

        // view the page
        loadingDialog.hide();
        $repaySection.removeClass('hidden');
    };

    M.require('businessAcc_js').done(function() {
        var business = new BusinessAccount();
        var overduePromise = business.getOverduePayments();

        var failHandler = function(st, res) {
            var msg = l[20671];
            var title = l[6859];
            if (res !== mySelf.noOverduePaymentErrorCode) {
                msg = l[20672];
                title = l[1578];
            }
            msgDialog('warninga', title, msg, '', function() {
                loadingDialog.hide();
                loadSubPage('');
            });
        };

        overduePromise.fail(failHandler);

        overduePromise.done(function(st, res) {
            // validations of API response
            if (st !== 1 || !res || !res.t || !res.inv || !res.inv.length) {
                return failHandler(0, mySelf.unknownErrorCode);
            }

            const mIntl = mega.intl;
            const intl = mIntl.number;
            const sep = mIntl.decimalSeparator;

            const applyFormat = (val) => {
                if (sep !== res.l.sp[0]) {
                    const reg1 = new RegExp(`\\${sep}`, 'g');
                    const reg2 = new RegExp(`\\${res.l.sp[1]}`, 'g');
                    val = val.replace(reg1, '-')
                        .replace(reg2, res.l.sp[0])
                        .replace(/-/g, res.l.sp[1]);
                }

                val = res.l.pl ? `${res.l.cs}${val}`
                    : `${val}${res.l.cs}`;

                return val;
            };

            // Debug...
            if (d && localStorage.debugNewPrice) {
                res.nb = 7; // nb of users
                res.nbdu = 3; // deactivated billed users
                res.nbt = 2; // extra transfer blocks
                res.nbs = 1; // extra storage blocks
                res.lt = 104; // local price for total
                res.let = 71.5; // local price of expired amount
                res.t = 80; // total in euros
                res.et = 55;
                res.list = { 'u': [3, 15, 19.5], 's': [1, 2.5, 3.23], 't': [1, 2.5, 3.23] };
                res.inv[0].nb = 4;
                res.inv[0].nbt = 1; // extra transfer blocks
                res.inv[0].nbs = 1; // extra storage blocks
                res.inv[0].nbdu = 1; // deactivated billed users
                res.inv[0].v = 1; // version
                res.inv[0].list = { 'u': [4, 20, 26.1], 's': [1, 2.5, 3.23], 't': [1, 2.5, 3.23] };
                res.inv[0].lp = 32.56;
                res.inv[0].tot = 25;
                res.inv[0].d = 'ABC Limited'; // company

                res.l = { // (NEW FIELD)
                    "cs": "$",          // currency symbol
                    "n": "NZD",         // currency name
                    "sp": [".", ","], // decimal and thousands separator
                    "pl": 1 // 1=currency symbol before number, 0=after
                };
            }
            // end of Debug

            let futureAmount = res.et && `${intl.format(res.et)} \u20ac`;
            let totalAmount = res.t && `${intl.format(res.t)} \u20ac`;
            let dueAmount = res.inv[0].tot && `${intl.format(res.inv[0].tot)} \u20ac`;

            const $rightBlock = $('.main-right-block', $repaySection);

            // check if we have V1 (new version) of bills
            if (typeof res.nbdu !== 'undefined' && res.inv[0].v) {
                let localPrice = false;
                if (res.let) {
                    futureAmount = applyFormat(intl.format(res.let));
                    localPrice = true;
                }
                if (res.lt) {
                    totalAmount = applyFormat(intl.format(res.lt));
                    localPrice = true;
                }
                if (res.inv && res.inv[0] && res.inv[0].lp) {
                    dueAmount = applyFormat(intl.format(res.inv[0].lp));
                    localPrice = true;
                }
                if (localPrice) {
                    $('.repay-breakdown-footer', $rightBlock).removeClass('hidden');
                }
            }


            if (!totalAmount || !dueAmount) {
                console.error(`Fatal error in invoice, we dont have essential attributes ${JSON.stringify(res)}`);
                return failHandler(0, mySelf.unknownErrorCode);
            }

            const showDetails = function() {
                const $me = $(this);
                if ($me.hasClass('expand')) {
                    $me.removeClass('expand');
                    $me.nextUntil('.repay-breakdown-tb-content, .repay-breakdown-tb-total', '.repay-extra-details')
                        .removeClass('expand');
                    $('.content-desc-container', $me).removeClass('icon-arrow-up-after')
                        .addClass('icon-arrow-down-after');
                }
                else {
                    $me.addClass('expand');
                    $me.nextUntil('.repay-breakdown-tb-content, .repay-breakdown-tb-total', '.repay-extra-details')
                        .addClass('expand');
                    $('.content-desc-container', $me).removeClass('icon-arrow-down-after')
                        .addClass('icon-arrow-up-after');
                }
            };

            var nbOfUsers = 3; // fallback to static value

            var $overduePaymentRow = $('.repay-breakdown-tb-content', $rightBlock);
            var $overduePaymentHeader = $('.repay-breakdown-tb-header', $rightBlock);

            if ($overduePaymentRow.length > 1) {
                var $rowBk = $($overduePaymentRow[0]).clone();
                $overduePaymentRow.remove();
                $rowBk.insertAfter($overduePaymentHeader);
                $overduePaymentRow = $rowBk;
            }

            var rowTemplate = $overduePaymentRow.clone();

            var $overdueExtraRow = $('tr.repay-extra-details', $rightBlock);
            const $extraRowTemplate = $overdueExtraRow.length > 1 ? $($overdueExtraRow[0]).clone()
                : $overdueExtraRow.clone();
            $overdueExtraRow.remove();

            // adding due invoice row
            nbOfUsers = res.inv[0].nb;

            $('.content-desc', $overduePaymentRow).text(u_attr['%name'] || ' ');
            $('.content-date', $overduePaymentRow).text(time2date(res.inv[0].ts, 1));
            $('.content-amou', $overduePaymentRow).text(dueAmount);

            const addDetailsRow = ($template, text, item, $parent) => {
                if (item && item[0] && item[1] && text && $template && $parent) {
                    const $row = $template.clone();
                    $('.repay-extra-desc', $row).text(mega.icu.isICUPlural(text)
                        ? mega.icu.format(text, item[0]) : text.replace('%1', item[0]));
                    $('.repay-extra-val', $row).text(item[2] ? applyFormat(intl.format(item[2]))
                        : `${intl.format(item[1])} \u20ac`);
                    $row.insertAfter($parent);
                }
            };

            if (res.inv[0].list) {
                addDetailsRow($extraRowTemplate, l.additional_transfer, res.inv[0].list.t, $overduePaymentRow);
                addDetailsRow($extraRowTemplate, l.additional_storage, res.inv[0].list.s, $overduePaymentRow);

                // If Pro Flexi, expand any rows by default, hide arrows and don't make clickable
                if (u_attr.pf) {
                    $overduePaymentRow.addClass('expand');
                    $overduePaymentRow
                        .nextUntil('.repay-breakdown-tb-content, .repay-breakdown-tb-total', '.repay-extra-details')
                        .addClass('expand');
                    $('.content-desc-container', $overduePaymentRow)
                        .removeClass('icon-arrow-down-after icon-arrow-up-after');
                }
                else {
                    // For Business, add a users row and make the row clickable
                    addDetailsRow($extraRowTemplate, l.users_unit, res.inv[0].list.u, $overduePaymentRow);
                    $overduePaymentRow.rebind('click.repay', showDetails);
                }
            }

            // Show the previous & current invoice rows for Pro Flexi as well
            if ((res.nb || u_attr.pf) && futureAmount) {
                const $futurePaymentRow = rowTemplate.clone();
                nbOfUsers = res.nb;

                $('.content-desc', $futurePaymentRow).text(u_attr['%name'] || ' ');
                $('.content-date', $futurePaymentRow).text(time2date(Date.now() / 1000, 1));
                $('.content-amou', $futurePaymentRow).text(futureAmount);

                $futurePaymentRow.insertAfter($overduePaymentHeader);

                addDetailsRow($extraRowTemplate, l.additional_transfer, res.list.t, $futurePaymentRow);
                addDetailsRow($extraRowTemplate, l.additional_storage, res.list.s, $futurePaymentRow);

                // If Pro Flexi, expand any rows by default, hide arrows and don't make clickable
                if (u_attr.pf) {
                    $futurePaymentRow.addClass('expand');
                    $futurePaymentRow
                        .nextUntil('.repay-breakdown-tb-content, .repay-breakdown-tb-total', '.repay-extra-details')
                        .addClass('expand');
                    $('.content-desc-container', $futurePaymentRow)
                        .removeClass('icon-arrow-down-after icon-arrow-up-after');
                }
                else {
                    // For Business, add a users row and make the row clickable
                    addDetailsRow($extraRowTemplate, l.users_unit, res.list.u, $futurePaymentRow);
                    $futurePaymentRow.rebind('click.repay', showDetails);
                }
            }

            $('.repay-td-total', $rightBlock).text(totalAmount);

            // If Pro Flexi, don't show the Account information section, also hide billing description row header
            if (u_attr.pf) {
                $('.js-account-info-section', $leftSection).addClass('hidden');
                $('.js-repay-header-description', $overduePaymentHeader).text('');
            }

            $('#repay-business-cname', $leftSection).text(u_attr['%name']);
            $('#repay-business-email', $leftSection).text(u_attr['%email']);

            let nbUsersText = mega.icu.format(l.users_unit, nbOfUsers);
            if (res.nbdu) {
                const activeUsers = nbOfUsers - res.nbdu;
                const inactiveUsersString = mega.icu.format(l.inactive_users_detail, res.nbdu);
                nbUsersText += ` ${mega.icu.format(l.users_detail, activeUsers).replace('[X]', inactiveUsersString)}`;
                $('.repay-nb-users-info', $leftSection).removeClass('hidden');
            }
            $('#repay-business-nb-users', $leftSection).text(nbUsersText);

            business.getListOfPaymentGateways(false).always(fillPaymentGateways);

            business.getBusinessPlanInfo(false, u_attr.pf)
                .then((plan) => {
                    mySelf.planInfo = plan;
                    mySelf.planInfo.pastInvoice = res.inv[0];
                    mySelf.planInfo.currInvoice = {et: res.et || 0, t: res.t};
                    mySelf.userInfo = {
                        fname: '',
                        lname: '',
                        nbOfUsers: res.nb || 0
                    };
                })
                .catch(tell);
        });
    });
};

(function(scope) {
    "use strict";

    var DEBUG = localStorage.debugPasswordReminderDialog || false;

    // all values are in seconds.
    var DAY = 86400;
    var SHOW_AFTER_LASTLOGIN = 14 * DAY;
    var SHOW_AFTER_LASTSKIP = 90 * DAY;
    // var SHOW_AFTER_LASTSKIP_LOGOUT = 30 * DAY;
    var SHOW_AFTER_ACCOUNT_AGE = 7 * DAY;
    var SHOW_AFTER_LASTSUCCESS = 90 * DAY;
    var RECHECK_INTERVAL = 15 * 60;

    if (DEBUG) {
        SHOW_AFTER_LASTLOGIN = 15;
        SHOW_AFTER_LASTSKIP = 30;
        // SHOW_AFTER_LASTSKIP_LOGOUT = 5;
        SHOW_AFTER_LASTSUCCESS = 45;
        SHOW_AFTER_ACCOUNT_AGE = DAY;
        RECHECK_INTERVAL = 15;
    }

    /** bindable events **/
    var MouseDownEvent = 'mousedown.prd';

    var PasswordReminderAttribute = function(dialog, changedCb, str) {
        var self = this;
        self.dialog = dialog;
        self._queuedSetPropOps = [];

        if (changedCb) {
            this.changedCb = changedCb;
        }
        PasswordReminderAttribute.PROPERTIES.forEach(function(prop) {
            self["_" + prop] = 0;

            Object.defineProperty(self, prop, {
                get: function() { return self["_" + prop]; },
                set: function(newValue) {
                    if (!self.loading) {
                        self._queuedSetPropOps.push([prop, newValue]);
                    }
                    else if (self.loading && self.loading.state() === 'pending') {
                        self.loading.always(function() {
                            self["_" + prop] = newValue;
                            self.hasChanged(prop);
                        });
                    }
                    else {
                        self["_" + prop] = newValue;
                        self.hasChanged(prop);
                    }
                },
                enumerable: true,
                configurable: true
            });
        });


        if (str) {
            self.mergeFromString(str);
        }
    };

    PasswordReminderAttribute.prototype.mergeFromString = function(str) {
        var self = this;

        var vals = str.split(":");
        var wasMerged = false;
        PasswordReminderAttribute.PROPERTIES.forEach(function(prop, index) {
            var val = typeof vals[index] !== 'undefined' ? parseInt(vals[index]) : 0;

            if (Number.isNaN(val)) {
                val = 0;
            }

            if (self["_" + prop] !== val) {
                self["_" + prop] = val;
                wasMerged = true;
            }
        });
        if (wasMerged) {
            self.hasBeenMerged();
        }
    };

    PasswordReminderAttribute.prototype.hasChanged = function(prop) {
        // Update ui?
        if (this.changedCb) {
            this.changedCb(prop);
        }

        // Save via mega.attr
        return this.save(prop === 'lastLogin').catch(dump);
    };

    PasswordReminderAttribute.prototype.hasBeenMerged = function() {
        // update ui?
        if (this.changedCb) {
            this.changedCb();
        }
    };

    PasswordReminderAttribute.prototype.toString = function() {
        var self = this;
        var vals = [];
        PasswordReminderAttribute.PROPERTIES.forEach(function(prop) {
            vals.push(self["_" + prop]);
        });
        return vals.join(":");
    };

    PasswordReminderAttribute.prototype.save = function(delayed) {

        if (!this.savingPromise) {

            const save = () => {
                const data = this.toString();

                return mega.attr.set2(null, 'prd', data, -2, true)
                    .always(() => {
                        if (data !== this.toString()) {

                            return save();
                        }
                    })
                    .finally(() => {
                        delete this.savingPromise;
                    });
            };

            if (delayed) {

                this.savingPromise = tSleep(Math.max(delayed | 0, 3)).then(save);
            }
            else {

                this.savingPromise = save();
            }
        }

        return this.savingPromise;
    };

    PasswordReminderAttribute.prototype.loadFromAttribute = function() {
        var self = this;

        if (self.loading) {
            return;
        }

        self.loading = mega.attr.get(u_handle, 'prd', -2, true)
            .done(function (r) {
                if (isString(r)) {
                    self.dialog._initFromString(r);
                }
                else {
                    self.dialog._initFromString("");
                }
            })
            .fail(function (e) {
                if (e === ENOENT) {
                    self.dialog._initFromString("");
                }
            })
            .always(function() {
                if (self._queuedSetPropOps.length > 0) {
                    self._queuedSetPropOps.forEach(function(op) {
                        self[op[0]] = op[1];
                    });
                    self._queuedSetPropOps = [];
                }
                if (self.changedCb) {
                    self.changedCb();
                }
            });
    };

    PasswordReminderAttribute.prototype.attributeUpdatedViaAp = function() {
        if (this.loading) {
            this.loading.reject();
            this.loading = false;
        }

        this.loadFromAttribute();
    };

    /**
     * Those properties are intentionally stored in an array, they are ordered and that order is important for when
     * saving/retrieving data from mega.attr.*.
     * In case a new key is added, please append it at the end of the list.
     * Never remove a key from the array above.
     *
     * @type {Array}
     */
    PasswordReminderAttribute.PROPERTIES = [
        'lastSuccess',
        'lastSkipped',
        'masterKeyExported',
        'dontShowAgain',
        'lastLogin'
    ];



    var PasswordReminderDialog = function() {
        var self = this;
        self.isLogout = false;
        self.passwordReminderAttribute = new PasswordReminderAttribute(self, function(prop) {
            self.recheck(prop !== "lastSuccess" && prop !== "dontShowAgain" ? true : false);
        });
    };

    PasswordReminderDialog.prototype.bindEvents = function() {
        var self = this;

        $(this.dialog.querySelectorAll(is_mobile
            ? '.button-prd-confirm, .button-prd-skip, .change-password-button, .button-prd-backup'
            : 'button.mega-button'
        )).rebind('click.prd', function(e) {
            self.onButtonClicked(this, e);
        });

        $(self.passwordField).rebind('keypress.prd', function(e) {
            if (!self.dialog) {
                console.warn('This event should no longer be reached...');
                return;
            }
            if (e.which === 13 || e.keyCode === 13) {
                $(self.dialog.querySelector('.button-prd-confirm')).triggerHandler('click');
                return false;
            }
        });

        $(this.getCloseButton()).rebind(is_mobile ? 'tap.prd' : 'click.prd', () => {
            self.dismiss();
            return false;
        });

        // Handle forgot password button.
        $(self.dialog.querySelector('.forgot-password')).rebind('click.prd', function() {
            eventlog(500021);
            self.onChangePassClicked();
            return false;
        });

        uiCheckboxes(
            $(this.dialog.querySelector(is_mobile ? '.content-cell' : 'aside')),
            undefined,
            function(newState) {
                if (newState === true) {
                    eventlog(500024);
                    self.passwordReminderAttribute.dontShowAgain = 1;
                }
                else {
                    self.passwordReminderAttribute.dontShowAgain = 0;
                }
            },
            self.passwordReminderAttribute.dontShowAgain === 1
        );

        const showTextIcon = 'icon-eye-reveal';
        const hideTextIcon = 'icon-eye-hidden';

        $('.pass-visible', this.dialog).rebind('click.togglePassV', function() {

            if (this.classList.contains(showTextIcon)) {

                self.passwordField.type = 'text';
                if (self.passwordField.style.webkitTextSecurity) {
                    self.passwordField.style.webkitTextSecurity = 'none';
                }
                this.classList.remove(showTextIcon);
                this.classList.add(hideTextIcon);
            }
            else {
                self.passwordField.type = 'password';
                if (self.passwordField.style.webkitTextSecurity) {
                    self.passwordField.style.webkitTextSecurity = 'disc';
                }
                this.classList.add(showTextIcon);
                this.classList.remove(hideTextIcon);
            }
        });
    };

    /**
     * Dismiss the dialog, rejecting the action promise and hide from view.
     * @return {false}
     */
    PasswordReminderDialog.prototype.dismiss = function() {
        if (self._dialogActionPromise && self._dialogActionPromise.state() === 'pending') {
            self._dialogActionPromise.reject();
        }
        this.hide();
    };

    PasswordReminderDialog.prototype.onButtonClicked = function(element, evt) {
        if (element.classList.contains('button-prd-confirm')) {
            eventlog(500019);
            this.onConfirmClicked(element, evt);
        }
        else if (element.classList.contains('button-prd-skip')) {
            eventlog(500023);
            this.onSkipClicked(element, evt);
        }
        else if (element.classList.contains('button-prd-backup')) {
            eventlog(500020);
            this.onBackupClicked(element, evt);
        }
        else if (element.classList.contains('change-pass')) {
            eventlog(500022);
            this.onChangePassClicked(element, evt);
        }
    };

    PasswordReminderDialog.prototype.onConfirmClicked = function(element, evt) {

        var enteredPassword = this.passwordField.value;
        var self = this;

        this.resetUI();

        // Derive the keys from the password
        security.getDerivedEncryptionKey(enteredPassword)
            .then(function(derivedKey) {
                self.completeOnConfirmClicked(derivedKey);
            })
            .catch(function(ex) {
                console.warn(ex);
                self.completeOnConfirmClicked('');
            });
    };

    PasswordReminderDialog.prototype.completeOnConfirmClicked = function(derivedEncryptionKeyArray32) {

        if (checkMyPassword(derivedEncryptionKeyArray32)) {
            if (this.dialog) {
                this.dialog.classList.add('accepted');
            }
            if (this.correctLabel) {
                this.correctLabel.classList.remove('hidden');
            }
            this.passwordReminderAttribute.lastSuccess = unixtime();

            var skipButtonSpan = this.dialog.querySelector('button.button-prd-skip span');
            if (skipButtonSpan) {
                skipButtonSpan.innerText = l[967];
            }
            this.succeeded = true;
        }
        else {
            if (this.dialog) {
                this.dialog.classList.add('wrong');
            }
            if (this.wrongLabel) {
                this.wrongLabel.classList.remove('hidden');
            }
            if (this.correctLabel) {
                this.correctLabel.classList.add('hidden');
            }
            if (this.passwordField) {
                this.passwordField.value = "";
                $(this.passwordField).focus();
            }

            if (is_mobile) {
                this.exportButton.classList.remove('green-button');
                this.exportButton.classList.add('red-button');
            }
        }
    };

    PasswordReminderDialog.prototype.onSkipClicked = function(element, evt) {
        if (!this.succeeded) {
            this.passwordReminderAttribute.lastSkipped = unixtime();
        }
        else {
            this.hideIcon();
        }
        if (this.passwordField) {
            this.passwordField.classList.add('hidden');
        }

        this.hide();
        delete $.dialog;

        this.onLogoutDialogUserAction();
    };

    PasswordReminderDialog.prototype.onLogoutDialogUserAction = function() {
        var self = this;

        if (self.passwordReminderAttribute.savingPromise) {
            if (self._dialogActionPromise && self._dialogActionPromise.state() === 'pending') {
                loadingDialog.show();
                self._dialogActionPromise.always(function() {
                    loadingDialog.hide();
                });
            }
            self.passwordReminderAttribute.savingPromise.always(function() {
                if (self._dialogActionPromise && self._dialogActionPromise.state() === 'pending') {
                    self._dialogActionPromise.resolve();
                }
            });
        }
        else {
            if (self._dialogActionPromise && self._dialogActionPromise.state() === 'pending') {
                self._dialogActionPromise.resolve();
            }
        }
    };

    PasswordReminderDialog.prototype.onKeyExported = function() {
        this.passwordReminderAttribute.masterKeyExported = 1;
    };

    PasswordReminderDialog.prototype.onBackupClicked = function(element, evt) {
        this.hide();

        if (this._dialogActionPromise && this._dialogActionPromise.state() === 'pending') {
            this._dialogActionPromise.reject();
        }

        if (this.passwordField) {
            // clear the password field, so that if it was filled in the dialog would hide
            this.passwordField.value = "";
        }

        delete $.dialog;

        loadSubPage('keybackup');
    };

    PasswordReminderDialog.prototype.onChangePassClicked = function(element, evt) {
        this.hide();

        if (this._dialogActionPromise && this._dialogActionPromise.state() === 'pending') {
            this._dialogActionPromise.reject();
        }

        if (this.passwordField) {
            // clear the password field, so that if it was filled in the dialog would hide
            this.passwordField.value = "";
        }

        delete $.dialog;

        loadSubPage(is_mobile ? '/fm/account/security/change-password' : '/fm/account/security');
    };

    PasswordReminderDialog.prototype.init = function() {
        var self = this;

        if (!self.initialised) {
            self.initialised = true;
        }

        if (!self.passwordReminderAttribute.loading) {
            self.passwordReminderAttribute.loadFromAttribute();
        }
        else {
            self.recheck();
        }
    };

    PasswordReminderDialog.prototype.onTopmenuReinit = function () {
        if (this.topIcon && !document.body.contains(this.topIcon)) {
            // reinit if the this.topIcon is detached from the DOM.
            if (this.isShown) {
                this.hide();
            }
            this.initialised = false;
            this.topIcon = null;
            this.dialog = null;
            this.wrongLabel = null;
            this.correctLabel = null;
        }
        this.prepare();
    };

    /**
     * Prepare the PRD.
     * @returns {void}
     */
    PasswordReminderDialog.prototype.prepare = function() {
        if (this.initialised) {
            this.resetUI();
        }
        else {
            this.init();
        }
    };

    PasswordReminderDialog.prototype._scheduleRecheck = function() {
        if (this.recheckInterval) {
            this.recheckInterval.abort();
            this.recheckInterval = null;
        }

        (this.recheckInterval = tSleep(RECHECK_INTERVAL))
            .then(() => {
                onIdle(() => this._scheduleRecheck());
                this.recheckInterval = null;
                this.recheck();
            })
            .catch(dump);
    };

    PasswordReminderDialog.prototype._initFromString = function(str) {
        var self = this;

        self.passwordReminderAttribute.mergeFromString(str);

        if (self.recheckInterval) {
            this.recheckInterval.abort();
            this.recheckInterval = null;
        }

        if (!self.passwordReminderAttribute.dontShowAgain) {
            this._scheduleRecheck();

            self.recheck();
        }
    };

    PasswordReminderDialog.prototype.recheck = function(hideIfShown) {
        var self = this;
        if (!u_handle) {
            // user is in the middle of a logout...
            return;
        }

        // skip any re-checks in case this is the 'cancel' page
        if (window.location.toString().indexOf("/cancel") > -1) {
            return;
        }


        // console.error([
        //     "checks",
        //     self.passwordReminderAttribute.toString(),
        //     !self.passwordReminderAttribute.masterKeyExported,
        //     !self.passwordReminderAttribute.dontShowAgain,
        //     unixtime() - u_attr.since > SHOW_AFTER_ACCOUNT_AGE,
        //     unixtime() - self.passwordReminderAttribute.lastSuccess > SHOW_AFTER_LASTSUCCESS,
        //     unixtime() - self.passwordReminderAttribute.lastLogin > SHOW_AFTER_LASTLOGIN
        // ]);


        // account is older then > SHOW_AFTER_ACCOUNT_AGE and lastLogin > SHOW_AFTER_LASTLOGIN
        if (
            u_type === 3 &&
            !self.passwordReminderAttribute.masterKeyExported &&
            !self.passwordReminderAttribute.dontShowAgain &&
            unixtime() - u_attr.since > SHOW_AFTER_ACCOUNT_AGE &&
            unixtime() - self.passwordReminderAttribute.lastSuccess > SHOW_AFTER_LASTSUCCESS &&
            unixtime() - self.passwordReminderAttribute.lastLogin > SHOW_AFTER_LASTLOGIN
        ) {
            // skip recheck in case:
            // - there is no top-icon, i.e. we are on a custom page
            // - there is a visible .dropdown
            // - the user had a textarea, input or select field focused
            // - there is a visible/active dialog
            var skipShowingDialog = !self.showIcon()
                || $(
                    'textarea:focus, input:focus, select:focus, .dropdown:visible:first, .mega-dialog:visible:first'
                ).length > 0;

            if (
                !skipShowingDialog &&
                is_fm() &&
                !pfid &&
                (
                    !self.passwordReminderAttribute.lastSkipped ||
                    unixtime() - self.passwordReminderAttribute.lastSkipped > SHOW_AFTER_LASTSKIP
                )
            ) {
                self.isLogout = false;
                self.show();
            }
            else {
                if (hideIfShown && (!self.passwordField || self.passwordField.value === "")) {
                    self.hide();
                }
            }
        }
        else {
            // only hide if the passwordField was not just entered with some value.
            if (hideIfShown && (!self.passwordField || self.passwordField.value === "")) {
                self.hideIcon();
                if (self.isShown) {
                    self.hide();
                }
            }
        }
    };

    PasswordReminderDialog.prototype.topIconClicked = function() {
        this[this.isShown ? 'hideDialog' : 'showDialog']();
    };

    PasswordReminderDialog.prototype.showIcon = function() {
        if (!this.topIcon || this.topIcon.classList.contains('hidden') || !document.body.contains(this.topIcon)) {
            // because, we have plenty of top menus, that may not be visible/active
            this.topIcon = $('.js-pass-reminder', '.top-head')[0];
            if (this.topIcon) {
                this.topIcon.classList.remove('hidden');
                $(this.topIcon).rebind('click.prd', this.topIconClicked.bind(this));
            }
        }
        return !!this.topIcon;
    };

    PasswordReminderDialog.prototype._initInternals = function() {
        this.dialog = this.getDialog();
        assert(this.dialog, 'this.dialog not found');
        this.passwordField = this.dialog.querySelector('input#test-pass');
        $(this.passwordField).rebind('focus.hack', function() {
            if (this.type === 'password') {
                if (ua.details.browser === "Chrome") {
                    $(this).attr('style', '-webkit-text-security: disc;');
                }
                else {
                    $(this).attr('type', 'password');
                }
            }
            $(this).removeAttr('readonly');
            $(this).attr('autocomplete', 'section-off' + rand_range(1, 123244) + ' off disabled nope no none');
        });
        this.passwordField.classList.remove('hidden');
        this.passwordField.value = "";

        this.wrongLabel = this.dialog.querySelector('.pass-reminder.wrong');
        this.correctLabel = this.dialog.querySelector('.pass-reminder.accepted');

        this.exportButton = this.dialog.querySelector('.button-prd-backup');

        this.firstText = this.dialog.querySelector('.pass-reminder.info-txt');

        if (this.firstText) {

            $(this.firstText).html(
                escapeHTML(!this.isLogout ? l[16900] : l[20633])
                    .replace('[A]', '<a \n' +
                        'href="https://mega.io/security" target="_blank" class="red">')
                    .replace('[/A]', '</a>')
            );
            $('a', this.firstText).rebind('click.more', () => {
                eventlog(500025);
            });
        }
        this.resetUI();

        this.bindEvents();
    };

    PasswordReminderDialog.prototype.show = function() {
        if (this.isShown) {
            return;
        }
        this.isShown = true;

        this._initInternals();

        assert(this.dialog, 'dialog not defined.');

        if (is_mobile) {
            this.showOverlay();
        }
        else {
            assert(this.topIcon, 'topIcon not defined.');
            $(document.body).rebind(MouseDownEvent, this.onGenericClick.bind(this));
        }

        this.dialog.classList.remove('hidden');
    };


    PasswordReminderDialog.prototype.resetUI = function() {
        $('button.button-prd-skip span', $(this.dialog)).text(l[1379]);
        if (this.dialog) {
            this.dialog.classList.remove('wrong', 'accepted');
        }
        if (this.wrongLabel) {
            this.wrongLabel.classList.add('hidden');
        }
        if (this.correctLabel) {
            this.correctLabel.classList.add('hidden');
        }

        if (this.exportButton) {
            this.exportButton.classList.remove('red-button');
            this.exportButton.classList.add('green-button');
        }

        const showTextIcon = 'icon-eye-reveal';
        const hideTextIcon = 'icon-eye-hidden';
        $('i.pass-visible', this.dialog).removeClass(hideTextIcon).addClass(showTextIcon);
        // On mobile, if the input were readonly, the keyboard would not open when taking focus
        $('#test-pass', this.dialog).attr({'style': '', 'type': 'password', 'readonly': !is_mobile});
    };

    PasswordReminderDialog.prototype.hide = function() {
        if (this.dialogShown) {
            return this.hideDialog();
        }
        if (!this.isShown) {
            return;
        }

        this.isShown = false;
        assert(this.dialog, 'dialog not defined.');

        this.resetUI();

        this.dialog.classList.add('hidden');

        $(window).off('resize.prd');
        $(document.body).off(MouseDownEvent);
    };

    PasswordReminderDialog.prototype.onGenericClick = function(e) {
        if (this.dialogShown) {
            // in case this is the dialog shown (not the popup), don't hide it when the user clicks on the overlay
            return;
        }

        if (
            $(e.target).parents('.pass-reminder').length === 0 &&
            !$(e.target).is('.pass-reminder')
        ) {
            if (this.isShown) {
                this.onSkipClicked();
            }
        }
    };

    PasswordReminderDialog.prototype.hideIcon = function() {
        if (!this.topIcon) {
            return;
        }

        this.topIcon.classList.add('hidden');
        $(this.topIcon).off('click.prd');
    };

    PasswordReminderDialog.prototype.showDialog = function(promise) {
        if (this.dialogShown) {
            return;
        }

        $.dialog = "prd";
        this.dialogShown = true;

        this.showOverlay();

        this._initInternals();

        this.dialog.classList.remove('hidden');

        if (promise) {
            this._dialogActionPromise = promise;
        }
    };

    PasswordReminderDialog.prototype.hideDialog = function() {
        this.dialogShown = false;

        this.hideOverlay();

        this.dialog.classList.add('hidden');

        this.resetUI();

        $(window).off('resize.prd');
        $(document.body).off(MouseDownEvent);
        $(this.passwordField).off('keypress.prd');
        delete $.dialog;
    };

    PasswordReminderDialog.prototype.recheckLogoutDialog = function() {
        var self = this;
        if (!u_handle) {
            // user is in the middle of a logout...
            return MegaPromise.resolve();
        }

        // skip any re-checks in case this is the 'cancel' page
        if (window.location.toString().indexOf("/cancel") > -1) {
            return MegaPromise.resolve();
        }

        var returnedPromise = new MegaPromise();


        // console.error([
        //     "checks",
        //     self.passwordReminderAttribute.toString(),
        //     !self.passwordReminderAttribute.masterKeyExported,
        //     !self.passwordReminderAttribute.dontShowAgain,
        //     unixtime() - u_attr.since > SHOW_AFTER_ACCOUNT_AGE,
        //     unixtime() - self.passwordReminderAttribute.lastSuccess > SHOW_AFTER_LASTSUCCESS,
        //     unixtime() - self.passwordReminderAttribute.lastLogin > SHOW_AFTER_LASTLOGIN
        // ]);

        // Intentionally copying the logic from .recheck, so that we can alter it for the logout action

        // account is older then > SHOW_AFTER_ACCOUNT_AGE and lastLogin > SHOW_AFTER_LASTLOGIN
        if (
            u_type === 3 &&
            /*!self.passwordReminderAttribute.masterKeyExported &&*/
            !self.passwordReminderAttribute.dontShowAgain/* &&
            unixtime() - u_attr.since > SHOW_AFTER_ACCOUNT_AGE &&
            unixtime() - self.passwordReminderAttribute.lastSuccess > SHOW_AFTER_LASTSUCCESS &&
            unixtime() - self.passwordReminderAttribute.lastLogin > SHOW_AFTER_LASTLOGIN*/
        ) {
            if (
                page !== 'start' && (is_fm() || dlid)/* &&
                !pfid &&
                (
                    !self.passwordReminderAttribute.lastSkipped ||
                    unixtime() - self.passwordReminderAttribute.lastSkipped > SHOW_AFTER_LASTSKIP_LOGOUT
                )*/
            ) {

                self.isLogout = true;
                self.showDialog(returnedPromise);
            }
            else {
                returnedPromise.resolve();
            }
        }
        else {
            returnedPromise.resolve();
        }

        return returnedPromise;
    };

    /**
    * Get node from password reminder dialog.
    * @returns {Object} Dialog
    */
    PasswordReminderDialog.prototype.getDialog = function() {
        return document.querySelector('.mega-dialog.pass-reminder');
    };

    /**
     * Show dialog using fm_showoverlay function.
     * @returns {void}
     */
    PasswordReminderDialog.prototype.showOverlay = function() {
        fm_showoverlay();
    };

    /**
     * Hide dialog using fm_hideoverlay function.
     * @returns {void}
     */
    PasswordReminderDialog.prototype.hideOverlay = function() {
        fm_hideoverlay();
    };

    /**
     * Get close button from password reminder dialog.
     * @returns {Object} Close button
     */
    PasswordReminderDialog.prototype.getCloseButton = function() {
        return this.dialog.querySelectorAll('button.js-close');
    };

    var passwordReminderDialog = new PasswordReminderDialog();
    scope.mega.ui.passwordReminderDialog = passwordReminderDialog;

    mBroadcaster.once('login', function() {
        // cancel page can trigger a login event, which should NOT trigger PRD attribute update.
        if (window.location.toString().indexOf("/cancel") > -1) {
            return;
        }

        // since u_type is not available yet, assuming that 'login' would only be triggered by a normal user login
        // e.g. u_type === 3
        passwordReminderDialog.passwordReminderAttribute.lastLogin = unixtime();
    });

    mBroadcaster.addListener('keyexported', function() {
        passwordReminderDialog.onKeyExported();
    });

    mBroadcaster.addListener('attr:passwordReminderDialog', function() {
        passwordReminderDialog.passwordReminderAttribute.attributeUpdatedViaAp();
    });

})(window);

mega.metatags = new function() {
    'use strict';

    /**
     * Private function to check if the page is excluded and not missing
     * @param {String} page     Page name
     * @returns {Boolean}       true/false is excluded.
     */
    var isPageExcluded = function(page) {
        // XXX: add new items sorted alphabetically.
        var excludedPages = [
            'keybackup', 'businessinvite', 'businesssignup', 'cancel', 'confirm', 'debug',
            'discount', 'download', 'emailverify', 'key', 'filerequest', 'payment', 'recover',
            'recoverybykey', 'recoverybypark', 'recoveryenterkey',
            'recoverykeychangepass', 'recoveryparkchangepass',
            'redeem', 'repay', 'reset', 'sms', 'special', 'start', 'test', 'thanks', 'twofactor',
            'unsub', 'verify', 'voucher', 'wiretransfer'
        ];

        if (!page) {
            return true;
        }

        for (var i = excludedPages.length; i--;) {
            var ep = excludedPages[i];

            if (page.substr(0, ep.length) === ep) {
                return ep.length === page.length ? -1 : ep.length;
            }
        }

        return false;
    };

    var stopBots = function(metaRobots, noReporting) {
        if (!noReporting && !isPageExcluded(page) && !is_fm() && !is_extension) {
            if (d) {
                console.error('A page without title. Please handle. Page: ' + page);
            }
            eventlog(99735, `page without title: ${String(page).split('#')[0]}`);
        }

        metaRobots = document.createElement('meta');
        metaRobots.name = 'robots';
        metaRobots.content = 'noindex';
        document.head.appendChild(metaRobots);
    };

    var setMeta = function(attr, val, content) {
        var meta = document.head.querySelector('meta[' + attr + '="' + val + '"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute(attr, val);
            document.head.appendChild(meta);
        }
        meta.content = content;
    };

    var insertOgTwitterMetas = function(title, desc, url, image) {
        setMeta('property', 'og:title', title);
        setMeta('property', 'og:description', desc);
        setMeta('property', 'og:url', url);
        setMeta('property', 'og:image', image);
        // ----- Twitter
        var meta = document.head.querySelector('meta[property="twitter:card"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('property', 'twitter:card');
            meta.content = 'summary';
            document.head.appendChild(meta);
        }
        setMeta('property', 'twitter:title', title);
        setMeta('property', 'twitter:description', desc);
        setMeta('property', 'twitter:url', url);
        setMeta('property', 'twitter:image', image);
    };

    var addCanonical = function(link) {
        if (lang && lang !== 'en') {
            link += `/lang_${lang}`;
        }
        var canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        canonical.setAttribute('href', link);
        document.head.appendChild(canonical);
    };

    var ucFirst = function(s) {
        s = String(s || '');
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

    /* eslint-disable complexity */
    this.addStrucuturedData = function(type, data) {

        if (!type || !data) {
            return;
        }

        var supportedTypes = ['Product', 'SoftwareApplication', 'FAQPage', 'NewsArticle', 'Organization'];
        if (supportedTypes.indexOf(type) === -1) {
            return;
        }

        if (
            !(type === 'Product' && data.offers && data.description && data.name) &&
            !(type === 'SoftwareApplication' && data.offers && data.operatingSystem && data.name) &&
            !(type === 'FAQPage' && data.mainEntity && Object.keys(data.mainEntity).length) &&
            !(type === 'NewsArticle' && data.headline && data.image && data.datePublished && data.dateModified) &&
            !(type === 'Organization' && data.url && data.logo)
        ) {
            return;
        }

        var prepareMetaStruct = function() {
            var structData = document.head.querySelector('script[type="application/ld+json"]');
            if (!structData) {
                structData = document.createElement('script');
                structData.setAttribute('type', 'application/ld+json');
                document.head.appendChild(structData);
            }
            return structData;
        };

        var metaStruct = prepareMetaStruct();
        if (!metaStruct) {
            return;
        }

        var structContent = Object.create(null);
        structContent['@context'] = 'https://schema.org/';
        structContent['@type'] = type;

        if (type === 'Product') {
            structContent['name'] = data.name;
            structContent['image'] = [data.image || 'https://cms2.mega.nz/b41537c0eae056cfe5ab05902fca322b.png'];
            structContent['description'] = data.description;
            structContent['brand'] = { '@type': 'Brand', 'name': 'MEGA' };
            structContent['offers'] = {
                '@type': 'Offer',
                'url': data.offers.url || '',
                'priceCurrency': 'EUR',
                'price': data.offers.price
            };

        }
        else if (type === 'SoftwareApplication') {
            structContent['name'] = data.name;
            structContent['operatingSystem'] = data.operatingSystem;
            if (data.applicationCategory) {
                structContent['applicationCategory'] = data.applicationCategory;
            }
            structContent['offers'] = {
                '@type': 'Offer',
                'priceCurrency': 'EUR',
                'price': data.offers.price
            };
        }
        else if (type === 'FAQPage') {
            var mainE = [];
            for (var entity in data.mainEntity) {
                if (data.mainEntity[entity]) {
                    var temp = {
                        '@type': 'Question',
                        'name': entity,
                        'acceptedAnswer': {
                            '@type': 'Answer',
                            'text': data.mainEntity[entity]
                        }
                    };
                    mainE.push(temp);
                }
            }
            if (mainE.length) {
                structContent['mainEntity'] = mainE;
            }
            else {
                document.head.removeChild(metaStruct);
                return;
            }
        }
        else if (type === 'NewsArticle') {
            structContent['headline'] = data.headline;
            structContent['image'] = [data.image];
            structContent['datePublished'] = data.datePublished;
            structContent['dateModified'] = data.dateModified;
        }
        else if (type === 'Organization') {
            structContent['url'] = data.url;
            structContent['logo'] = data.logo;
        }
        else {
            return;
        }
        metaStruct.textContent = JSON.stringify(structContent, null, 3);
    };

    this.disableBots = function() {
        var metaRobots = document.head.querySelector('meta[name="robots"]');
        if (!metaRobots) {
            metaRobots = document.createElement('meta');
            document.head.appendChild(metaRobots);
        }
        metaRobots.name = 'robots';
        metaRobots.content = 'noindex';
    };

    /**
     * Get Page meta tags.
     * @param {String} page     Page name
     * @returns {Object}        Object contains needed tags
     */
    this.getPageMetaTags = function(page) {
        var mTags = Object.create(null);
        var metaRobots = document.head.querySelector('meta[name="robots"]');
        if (metaRobots) {
            document.head.removeChild(metaRobots);
        }
        var metaCanonical = document.head.querySelector('link[rel="canonical"]');
        if (metaCanonical) {
            document.head.removeChild(metaCanonical);
        }
        var metaStruct = document.head.querySelector('script[type="application/ld+json"]');
        if (metaStruct) {
            document.head.removeChild(metaStruct);
        }

        if (page === 'bird') {
            mTags.en_title = 'MEGAbird - MEGA';
            mTags.en_desc = 'Send large files by email through MEGA';
            mTags.mega_title = l[23969] || mTags.en_title;
            mTags.mega_desc = l[20931] || mTags.en_desc;
        }
        else if (page === 'pro' || page.substr(0, 6) === 'propay') {
            mTags.en_title = 'Compare Plans and Pricing - MEGA';
            mTags.en_desc = 'Compare MEGA\'s pricing plans. Get 16% off if you purchase an annual plan. ' +
                'Start using MEGA\'s secure cloud storage and fast transfers today.';
            mTags.mega_title = l[23971] || mTags.en_title;
            mTags.mega_desc = l[23972] || mTags.en_desc;
            mTags.image = 'https://cms2.mega.nz/559d084a50ad7283acb6f1c433136952.png';
        }
        else if (page === 'register') {
            mTags.en_title = 'Create Your Account - MEGA';
            mTags.en_desc = 'Get started with MEGA, the world\'s largest fully-featured free cloud storage and ' +
                'communications provider with secure, user-controlled end-to-end encryption.';
            mTags.mega_title = l[23973] || mTags.en_title;
            mTags.mega_desc = l[23974] || mTags.en_desc;
        }
        else if (page === 'login') {
            mTags.en_title = 'Login - MEGA';
            mTags.en_desc = 'Log in to your MEGA account. Access the world\'s most trusted, protected cloud storage.';
            mTags.mega_title = l[23975] || mTags.en_title;
            mTags.mega_desc = l.mtags_desc_login || mTags.en_desc;
        }
        else if (page === 'recovery') {
            mTags.en_title = 'Recovery - MEGA';
            mTags.en_desc = 'Forgot your MEGA password? Start your recovery process here.';
            mTags.mega_title = l[23976] || mTags.en_title;
            mTags.mega_desc = l[23977] || mTags.en_desc;
        }
        else if (page === 'disputenotice') {
            mTags.en_title = 'Copyright Counter-Notification - MEGA';
            mTags.en_desc = 'Copyright Counter-Notification';
            mTags.mega_title = l[23987] || mTags.en_title;
            mTags.mega_desc = l[8789] || mTags.en_desc;
        }
        else if (page === 'registerb') {
            mTags.en_title = 'Business Account - MEGA';
            mTags.en_desc = 'With our user-controlled end-to-end encryption, your data and communications have never ' +
                'been safer. MEGA is the secure solution for your business.';
            mTags.mega_title = l[24012] || mTags.en_title;
            mTags.mega_desc = l.mtags_desc_registerb || mTags.en_desc;
        }
        else if (page === 'cookie') {
            mTags.mega_title = 'Cookie Policy - MEGA';
            mTags.mega_desc = 'Our Cookie Policy explains what types of cookies we use ' +
                'and what we do with the information we collect.';
        }
        else if (typeof Object(window.dlmanager).isStreaming === 'object') {
            mTags.mega_title = dlmanager.isStreaming._megaNode.name + ' - MEGA';
            mTags.dynamic = true;
        }
        else if (page === 'recoveryparkchangepass') {
            mTags.mega_title = 'Park Change Password - MEGA';
            stopBots(metaRobots);
        }
        else if (page === 'recoverykeychangepass') {
            mTags.mega_title = 'Key Change Password - MEGA';
            stopBots(metaRobots);
        }
        else if (page === 'recoveryenterkey') {
            mTags.mega_title = 'Recovery Key - MEGA';
            stopBots(metaRobots);
        }
        else if (page === 'recoverybypark') {
            mTags.mega_title = 'Park Recovery - MEGA';
            stopBots(metaRobots);
        }
        else if (page === 'recoverybykey') {
            mTags.mega_title = 'Recover by Key - MEGA';
            stopBots(metaRobots);
        }
        else if (page === 'wiretransfer') {
            mTags.mega_title = 'Wire Transfer - MEGA';
            stopBots(metaRobots);
        }
        else if (page === 'twofactor') {
            mTags.mega_title = 'Two Factor - MEGA';
            stopBots(metaRobots);
        }
        else if (page.substr(0, 11) === 'emailverify') {
            mTags.mega_title = 'Email Verify - MEGA';
            mTags.mega_desc = 'Email verification';
            stopBots(metaRobots, true);
        }
        else if (page === 'businessinvite') {
            mTags.mega_title = 'Business Invite - MEGA';
            stopBots(metaRobots);
        }
        else if (page === 'businesssignup') {
            mTags.mega_title = 'Business Signup - MEGA';
            stopBots(metaRobots);
        }
        else if (page === 'achievements') {
            mTags.en_title = 'Achievements - MEGA';
            mTags.en_desc = 'Free additional cloud storage - 5 GB per achievement, valid for 365 days.';
            mTags.mega_title = l.achievement_meta_title || mTags.en_title;
            mTags.mega_desc = l.achievement_meta_desc || mTags.en_desc;
        }
        else if (page === 'support') {
            mTags.en_title = 'Support - MEGA';
            mTags.en_desc = 'Get support';
            mTags.mega_title = l.support_meta_tag || mTags.en_title;
            mTags.mega_desc = l[516] || mTags.en_desc;
        }
        else if (page.startsWith('special')) {
            mTags.mega_title = 'Special - MEGA';
            mTags.mega_desc = 'MEGA\'s Special Page';

            if (page.endsWith('/pro')) {
                mTags.mega_title = 'Special - PRO - MEGA';
            }
            else if (page.endsWith('/business')) {
                mTags.mega_title = 'Special - Business - MEGA';
            }

            stopBots(metaRobots);
        }
        else if (page && (mTags.excluded = isPageExcluded(page))) {
            mTags.mega_title = page.charAt(0).toUpperCase() + page.slice(1) + ' - MEGA';
            stopBots(metaRobots);
        }
        else {
            mTags.mega_title = 'MEGA';
            stopBots(metaRobots);
        }
        if (!mTags.mega_desc) {
            mTags.mega_desc = l[24023] || mega.whoami;
            if (!isPageExcluded(page) && !is_fm() && !is_extension) {
                if (d) {
                    console.error('A page without Description. Please handle. Page: ' + page);
                }
                eventlog(99736, `page without desc: ${String(page).split('#')[0]}`);
            }
        }

        mTags.image = mTags.image || 'https://cms2.mega.nz/b41537c0eae056cfe5ab05902fca322b.png';
        insertOgTwitterMetas(
            mTags.mega_title,
            mTags.mega_desc,
            getBaseUrl() + (page && page !== 'start' ? '/' + page : ''),
            mTags.image
        );

        mTags.page = page;
        this.lastSetMetaTags = mTags;

        return mTags;
    };
    /* eslint-enable complexity */

    this.checkPageMatchesURL = function() {
        if (page !== (getCleanSitePath() || 'start')) {
            var metaRobots = document.head.querySelector('meta[name="robots"]');
            if (!metaRobots) {
                stopBots(metaRobots);
            }
        }
    };
};

/*!
 * verge 1.9.1+201402130803
 * https://github.com/ryanve/verge
 * MIT License 2013 Ryan Van Etten
 */

(function(root, name, make) {
  if (typeof module != 'undefined' && module['exports']) module['exports'] = make();
  else root[name] = make();
}(this, 'verge', function() {

  var xports = {}
    , win = typeof window != 'undefined' && window
    , doc = typeof document != 'undefined' && document
    , docElem = doc && doc.documentElement
    , matchMedia = win['matchMedia'] || win['msMatchMedia']
    , mq = matchMedia ? function(q) {
        return !!matchMedia.call(win, q).matches;
      } : function() {
        return false;
      }
    , viewportW = xports['viewportW'] = function() {
        var a = docElem['clientWidth'], b = win['innerWidth'];
        return a < b ? b : a;
      }
    , viewportH = xports['viewportH'] = function() {
        var a = docElem['clientHeight'], b = win['innerHeight'];
        return a < b ? b : a;
      };
  
  /** 
   * Test if a media query is active. Like Modernizr.mq
   * @since 1.6.0
   * @return {boolean}
   */  
  xports['mq'] = mq;

  /** 
   * Normalized matchMedia
   * @since 1.6.0
   * @return {MediaQueryList|Object}
   */ 
  xports['matchMedia'] = matchMedia ? function() {
    // matchMedia must be binded to window
    return matchMedia.apply(win, arguments);
  } : function() {
    // Gracefully degrade to plain object
    return {};
  };

  /**
   * @since 1.8.0
   * @return {{width:number, height:number}}
   */
  function viewport() {
    return {'width':viewportW(), 'height':viewportH()};
  }
  xports['viewport'] = viewport;
  
  /** 
   * Cross-browser window.scrollX
   * @since 1.0.0
   * @return {number}
   */
  xports['scrollX'] = function() {
    return win.pageXOffset || docElem.scrollLeft; 
  };

  /** 
   * Cross-browser window.scrollY
   * @since 1.0.0
   * @return {number}
   */
  xports['scrollY'] = function() {
    return win.pageYOffset || docElem.scrollTop; 
  };

  /**
   * @param {{top:number, right:number, bottom:number, left:number}} coords
   * @param {number=} cushion adjustment
   * @return {Object}
   */
  function calibrate(coords, cushion) {
    var o = {};
    cushion = +cushion || 0;
    o['width'] = (o['right'] = coords['right'] + cushion) - (o['left'] = coords['left'] - cushion);
    o['height'] = (o['bottom'] = coords['bottom'] + cushion) - (o['top'] = coords['top'] - cushion);
    return o;
  }

  /**
   * Cross-browser element.getBoundingClientRect plus optional cushion.
   * Coords are relative to the top-left corner of the viewport.
   * @since 1.0.0
   * @param {Element|Object} el element or stack (uses first item)
   * @param {number=} cushion +/- pixel adjustment amount
   * @return {Object|boolean}
   */
  function rectangle(el, cushion) {
    el = el && !el.nodeType ? el[0] : el;
    if (!el || 1 !== el.nodeType) return false;
    return calibrate(el.getBoundingClientRect(), cushion);
  }
  xports['rectangle'] = rectangle;

  /**
   * Get the viewport aspect ratio (or the aspect ratio of an object or element)
   * @since 1.7.0
   * @param {(Element|Object)=} o optional object with width/height props or methods
   * @return {number}
   * @link http://w3.org/TR/css3-mediaqueries/#orientation
   */
  function aspect(o) {
    o = null == o ? viewport() : 1 === o.nodeType ? rectangle(o) : o;
    var h = o['height'], w = o['width'];
    h = typeof h == 'function' ? h.call(o) : h;
    w = typeof w == 'function' ? w.call(o) : w;
    return w/h;
  }
  xports['aspect'] = aspect;

  /**
   * Test if an element is in the same x-axis section as the viewport.
   * @since 1.0.0
   * @param {Element|Object} el
   * @param {number=} cushion
   * @return {boolean}
   */
  xports['inX'] = function(el, cushion) {
    var r = rectangle(el, cushion);
    return !!r && r.right >= 0 && r.left <= viewportW();
  };

  /**
   * Test if an element is in the same y-axis section as the viewport.
   * @since 1.0.0
   * @param {Element|Object} el
   * @param {number=} cushion
   * @return {boolean}
   */
  xports['inY'] = function(el, cushion) {
    var r = rectangle(el, cushion);
    return !!r && r.bottom >= 0 && r.top <= viewportH();
  };

  /**
   * Test if an element is in the viewport.
   * @since 1.0.0
   * @param {Element|Object} el
   * @param {number=} cushion
   * @return {boolean}
   */
  xports['inViewport'] = function(el, cushion) {
    // Equiv to `inX(el, cushion) && inY(el, cushion)` but just manually do both 
    // to avoid calling rectangle() twice. It gzips just as small like this.
    var r = rectangle(el, cushion);
    return !!r && r.bottom >= 0 && r.right >= 0 && r.top <= viewportH() && r.left <= viewportW();
  };

  return xports;
}));
