/* Bundle Includes:
 *   js/utils/api.js
 *   js/utils/browser.js
 *   js/utils/clipboard.js
 *   js/utils/conv.js
 *   js/utils/crypt.js
 *   js/utils/csp.js
 *   js/utils/debug.js
 *   js/utils/dom.js
 *   js/utils/events.js
 *   js/utils/icu.js
 *   js/keymgr.js
 *   js/utils/locale.js
 *   js/utils/md5.js
 */

/* global MEGAException, MegaLogger, JSONSplitter, freeze, sleep, api_reqfailed, requesti, scqhead, scqtail */

/**
 * Deferred callback invocation controller
 */
class MEGADeferredController extends Promise {
    /**
     * Constructs a new instance.
     * @param {String|Function} [callback] the function to invoke deferred.
     * @param {*} [ctx] context/scope to invoke the function with.
     * @param {*} data data to pass through the callback
     * @param {String} [method] fire on idle, or timer based
     */
    constructor(callback, ctx, data, method = 'idle') {
        let _reject, _resolve;
        super((resolve, reject) => {
            _reject = reject;
            _resolve = resolve;
        });

        if (typeof callback === 'string') {
            method = callback;
            callback = nop;
        }

        this.id = null;
        this.timeout = false;
        this.callback = () => {
            Promise.resolve(callback.call(ctx, data)).then(_resolve).catch(_reject);

            if (this.id !== 0) {
                this.id = false;
                this.callback = nop;
            }
        };

        Object.defineProperty(this, 'method', {value: method});
        Object.defineProperty(this, 'reject', {value: _reject});
        Object.defineProperty(this, 'resolve', {value: _resolve});

        Object.defineProperty(this, 'name', {value: ctx ? `${this}:${ctx}:${(ctx.logger || ctx).name}` : method});
    }

    get [Symbol.toStringTag]() {
        return 'MEGADeferredController';
    }

    /**
     * Fire the deferred invocation.
     * @param {Number} timeout value in milliseconds.
     * @returns {MEGADeferredController} oneself
     */
    fire(timeout = 350) {
        const cb = this.callback;

        this.timeout = timeout;
        if (this.method === 'idle') {
            this.id = requestIdleCallback(cb, {timeout});
        }
        else {
            (this.id = tSleep(timeout / 1e3)).then(cb);
        }
        return this;
    }

    /**
     * Deferring cancellation.
     * @param {Boolean} [resolve] Whether the promise shall be fulfilled.
     * @returns {void}
     */
    cancel(resolve) {
        if (this.id) {
            if (this.method === 'idle') {
                cancelIdleCallback(this.id);
            }
            else {
                this.id.abort();
            }

            if (!resolve) {
                this.callback = this.reject.bind(null, new MEGAException(`${this.name} aborted.`, null, 'AbortError'));
            }
            queueMicrotask(this.callback);

            this.id = 0;
            this.catch(nop);
            this.callback = nop;
            freeze(this);
        }
    }
}

/**
 * Auto Renew Time-Offset
 */
class AutoRenewTimeOffset {
    constructor(offset = 168) {
        const time = Date.now();
        if (time < 169e10) {
            tryCatch(() => {
                if (!sessionStorage.ivComTmo) {
                    sessionStorage.ivComTmo = 1;
                    onIdle(() => {
                        eventlog(99893, JSON.stringify([1, time]));
                    });
                    console.error('Invalid computer time.', time, new Date(time));
                }
            }, false)();
        }

        while (time + 864e5 - ++offset * 1e10 > 0) {
            /* noop */
        }
        Object.defineProperty(this, 'value', {value: (time - --offset * 1e10) / 1e3 >>> 0});
    }

    get [Symbol.toStringTag]() {
        return 'AutoRenewTimeOffset';
    }

    valueOf() {
        return this.value;
    }
}

/** @property AutoRenewTimeOffset.value */
Object.defineProperty(AutoRenewTimeOffset, 'value', {
    get() {
        'use strict';
        return new AutoRenewTimeOffset().value;
    }
});

/**
 * Unique Lexicographically Sortable Identifier
 */
class MEGALexWord {
    constructor(value, mode = 'relaxed') {
        const rnd = new Uint16Array(3);
        crypto.getRandomValues(rnd);

        Object.defineProperty(this, 'timed', {
            value: this.generate(mode === 'strict' ? (Date.now() - 1671e9) / 1e3 : AutoRenewTimeOffset.value)
        });
        this.value = ((rnd[0] | rnd[2]) & 0x3f) * (value >>> 7 | rnd[2] << 3 | rnd[0] << 1 | rnd[1]);
    }

    get [Symbol.toStringTag]() {
        return 'MEGALexWord';
    }

    generate(value, range = MEGALexWord.range) {
        let res = '';

        do {
            res = range[value % range.length | 0] + res;
            value /= range.length;
        }
        while (value > 1);

        return res;
    }

    toString() {
        return this.timed + this.generate(++this.value);
    }

    toJSON() {
        return String(this);
    }

    valueOf() {
        return this.value;
    }
}

Object.defineProperty(MEGALexWord, 'range', {
    value: "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~"
});

/**
 * API Request Interface
 */
class MEGAPIRequest {
    constructor(channel, service, split = null, sid = false) {

        // channel identifier.
        Object.defineProperty(this, 'channel', {value: channel});

        // base URI component
        Object.defineProperty(this, 'service', {value: service});

        // associated JSON splitter rules; presence triggers progressive/chunked mode
        Object.defineProperty(this, 'split', {value: split});

        // queued executing commands + contexts
        Object.defineProperty(this, 'queue', {value: new Set()});

        // Unique Identifier(s)
        Object.defineProperty(this, '__ident_0', {
            value: `api${this.channel}.${this.service}${makeUUID().slice(-13)}`
        });
        this.__ident_1 = Math.random().toString(31).slice(-7);

        // sid URI component (optional)
        this.sid = sid || '';

        // Unique request start ID
        this.seqNo = -Math.log(Math.random()) * 0x10000000 >>> 0;

        /**
         * Unique Lexicographically Sortable Identifier
         * @property MEGAPIRequest.lex
         */
        lazy(this, 'lex', () => new MEGALexWord(this.seqNo));

        this.clear();

        const b = Math.min(172, 0x3f + (Math.random() * (this.channel << 4) | 0)).toString(16);
        this.logger = new MegaLogger(() => `[${this.__ident_0}.${this.__ident_1}]`, {
            // adaptiveTextColor: true,
            throwOnAssertFail: true,
            printDate: 'rad' in mega,
            levelColors: {
                ERROR: `#${b}0000`,
                DEBUG: `#0000${b}`,
                WARN: `#${b}${b}00`,
                INFO: `#00${b}00`,
                LOG: '#444'
            }
        });

        if (this.split) {
            this.fetch = this.chunkedFetch;
            this.parser = this.chunkedParser;
        }
    }

    get [Symbol.toStringTag]() {
        return 'MEGAPIRequest';
    }

    get idle() {
        return !this.flushing;
    }

    get sid() {
        return this['__@>'];
    }

    set sid(value) {
        delete this['__@<'];
        Object.defineProperty(this, '__@>', {value, configurable: true});
    }

    get queryString() {
        let value = this['__@<'];
        const wsc = this.service === 'wsc';

        if (value === undefined) {
            value = api.getURLSearchParams(`v=${api.version}${this.split ? '&ec' : ''}&${this.sid}`, +wsc);

            Object.defineProperty(this, '__@<', {value, configurable: true});
        }
        return wsc ? value : `id=${++this.seqNo}&${value}`;
    }

    clear() {
        this.queue.clear();

        if (this.flushing instanceof MEGADeferredController) {
            this.flushing.cancel();
        }
        if (this.timer instanceof MEGADeferredController) {
            this.timer.cancel();
        }
        if (this.controller) {
            tryCatch(() => this.controller.abort(), false)();
        }

        this.backoff = 0;
        this.cancelled = false;
        this.controller = null;
        this.flushing = false;
        this.inflight = false;
        this.rawreq = false;
        this.received = 0;
        this.residual = false;
        this.response = null;
        this.status = 0;
        this.timer = false;
        this.totalBytes = -1;
        this.url = null;
    }

    abort() {
        const queue = [...this.queue, ...this.inflight || []];

        if (d) {
            this.logger.warn('Aborting %s API channel...', this.idle ? 'idle' : 'busy', [this]);
        }
        Object.defineProperty(this, '__ident_1', {value: 'ABORTED'});

        this.clear();
        this.cancelled = true;
        Object.freeze(this);

        for (let i = queue.length; i--;) {
            const {reject, payload} = queue[i];
            if (d) {
                this.logger.warn('Rejecting API Request', payload);
            }
            reject(new APIRequestError(EROLLEDBACK, queue[i]));
        }
    }

    async enqueue(data) {
        MEGAException.assert(!this.cancelled);
        let flush = false;

        if (data.type === 'string' || data.type === 'array' || data.custom) {
            await this.flush();
            flush = true;
        }

        if (d) {
            const req = JSON.stringify(data.payload)
                .replace(/[\w-]{15,}/g, '\u2026')
                .replace(mega.chrome && /%/g, '%%');

            this.logger.debug(`Enqueue API request: ${req}`, [data]);
        }

        this.queue.add(data);

        if (flush) {
            return this.flush();
        }
        if (!this.flushing) {
            this.flushing = new MEGADeferredController(this.flush, this).fire(350);
        }
    }

    async dequeue(responses) {
        const queue = this.inflight;

        this.logger.assert(!this.cancelled, 'dequeue: this channel is aborted.');
        this.logger.assert(this.validateRequestResponse(responses, queue), 'dequeue: unexpected response(s)');

        for (let i = 0; i < queue.length; ++i) {
            const data = queue[i];
            const {resolve, reject, payload, type} = data;
            const result = this.getRequestResponse(responses, i, payload, type);

            if (result === EPAYWALL) {
                // @todo check whether we need to handle this more gracefully.
                return result;
            }

            if (this.isRequestError(result)) {

                reject(result);
            }
            else {
                delete data.reject;
                delete data.resolve;

                if (type === 'array') {
                    assert(queue.length === 1);
                    data.responses = responses;
                }

                data.result = result;
                resolve(data);
            }
        }
    }

    isRequestError(value) {
        return typeof value === 'number' && value < 0 || value instanceof APIRequestError;
    }

    validateRequestResponse(responses, queue) {

        if (responses.length !== queue.length) {

            return queue.length === 1 && queue[0].type === 'array'
                && (
                    queue[0].payload.length === responses.length || responses[0] === EROLLEDBACK
                );
        }

        return true;
    }

    getRequestResponse(responses, index, payload, type) {
        let result = responses[index];

        if (result && result.err < 0) {
            if (self.d) {
                this.logger.info('APIv2 Custom Error Detail', result, payload);
            }
            result = new APIRequestError(result.err, result);
        }

        if (type === 'array') {
            let rolledBack;

            for (index = responses.length; index--;) {
                result = this.getRequestResponse(responses, index, payload);

                if (this.isRequestError(result)) {

                    rolledBack = true;

                    if (Number(result) !== EROLLEDBACK) {
                        break;
                    }
                }
            }

            if (rolledBack) {

                result = new APIRequestError(EROLLEDBACK, {index, result});
            }
        }

        return result;
    }

    async flush() {
        this.logger.assert(!this.cancelled);

        if (!this.queue.size || this.inflight) {
            if (!this.inflight) {
                this.clear();
            }
            return this.flushing;
        }
        const queue = [...this.queue];
        this.clear();

        if (this.rawreq === false) {
            this.createRequestURL(queue);
        }
        this.inflight = queue;
        const flushing = this.flushing = mega.promise;

        let res;
        do {
            if (d) {
                const url = String(this.url).replace(/sid=[\w-]+/, 'sid=\u2026');
                const req = String(this.rawreq || queue[0].payload).replace(mega.chrome && /%/g, '%%');

                this.logger.info('Sending API request %s to %s', req, url);
            }

            res = await this.fetch(this.url, this.rawreq)
                .then((res) => this.finish(res))
                .catch(ex => {
                    if (self.d) {
                        this.logger.error(' --- fetch error --- ', [ex]);
                    }
                    return this.cancelled ? ex
                        : this.errorHandler(ex.name === 'InvalidCharacterError' && ex.data || self.ERATELIMIT);
                });
        }
        while (!this.cancelled && res === EAGAIN);

        if (this.cancelled) {
            if (self.d) {
                this.logger.warn('Inflight request aborted.', tryCatch(() => JSON.stringify(res))() || res);
                this.logger.assert(Object.isFrozen(this));
            }
            res = EROLLEDBACK;
        }
        else {
            this.inflight = null;
            this.__ident_1 = Math.random().toString(31).slice(-7);
            queueMicrotask(() => this.flush().catch((ex) => self.d && this.logger.warn(ex)));
        }

        flushing.resolve(res);
        return flushing;
    }

    createRequestURL(queue) {
        let raw = false;
        let {apipath} = window;
        let {queryString, service} = this;

        if (queue.length === 1) {
            const {custom, options, type} = queue[0];

            if (custom) {
                let {queryString: qs} = options;

                if (qs) {
                    if (typeof qs === 'object') {
                        qs = new URLSearchParams(qs);
                    }
                    queryString += `&${qs}`;
                }
                apipath = options.apipath || apipath;
            }

            raw = type === 'string' || type === 'array';
        }

        this.url = `${apipath + service}?${queryString}`;

        if (raw) {
            if (queue[0].type === 'string') {
                this.url += `&${queue[0].payload}`;
                delete this.rawreq;
            }
            else {
                this.url += '&bc=1';
                this.rawreq = JSON.stringify(queue[0].payload);
            }
        }
        else {
            this.rawreq = JSON.stringify(queue.map(e => e.payload));
        }
    }

    async errorHandler(res) {
        if (typeof res === 'object' && res.err < 0) {
            res = res.err | 0;
        }

        if (typeof res === 'number') {
            if (self.d) {
                this.logger.warn(`API Request Error ${res}`);
            }

            if (!this.cancelled) {

                if (res === ERATELIMIT) {
                    if (!this.backoff) {
                        this.backoff = 900 + -Math.log(Math.random()) * 4e3 | 0;
                    }
                    res = EAGAIN;
                }

                if (res !== EAGAIN) {
                    // @todo modularize.
                    res = await api_reqfailed.call(this, this.channel, res);
                }

                if (res === EAGAIN) {
                    // request failed - retry with exponential backoff

                    if (!this.backoff) {
                        this.backoff = 192 + -Math.log(Math.random()) * 256;
                    }
                    this.backoff = Math.max(63, Math.min(3e5, this.backoff << 1));

                    if (navigator.onLine === false) {
                        // api.retry() will be invoked whenever getting back online.
                        this.backoff = 8888888;
                    }
                    this.timer = new MEGADeferredController('timer').fire(this.backoff);

                    if (self.d && this.backoff > 4e3) {
                        this.logger.info('Retrying in %sms...', this.backoff);
                    }

                    await this.timer;
                    this.timer = null;
                }
            }
        }
        return res;
    }

    getAbortSignal() {
        if (!this.controller || this.controller.signal.aborted) {
            this.controller = new AbortController();
        }
        return this.controller.signal;
    }

    async fetch(uri, body) {
        const signal = this.getAbortSignal();
        const response = await fetch(uri, {method: body ? 'POST' : 'GET', body, signal});

        this.response = response;
        this.status = response.status;
    }

    async parser() {
        const res = await this.response.json();
        if (d) {
            this.logger.info('API response:', JSON.stringify(res).replace(/[\w-]{48,}/g, '\u2026'));
        }
        return typeof res === 'number' ? res : Array.isArray(res) ? res : [res];
    }

    async chunkedFetch(uri, body) {
        const signal = this.getAbortSignal();
        const response = await fetch(uri, {method: body ? 'POST' : 'GET', body, signal});
        const splitter = new JSONSplitter(this.split, this, true);

        this.residual = [];
        this.response = response;
        this.status = response.status;
        this.totalBytes = response.headers.get('Original-Content-Length') | 0;

        if (typeof WritableStream !== 'undefined' && mega.shouldApplyNetworkBackPressure(this.totalBytes)) {
            const queueingStrategy =
                typeof ByteLengthQueuingStrategy !== 'undefined'
                && 'highWaterMark' in ByteLengthQueuingStrategy.prototype
                && new ByteLengthQueuingStrategy({highWaterMark: BACKPRESSURE_HIGHWATERMARK});

            const stream = new WritableStream({
                write: async(chunk) => {
                    if (self.d) {
                        this.logger.debug('fetch/write', chunk.byteLength);
                    }

                    await this.progress(splitter, chunk);

                    while (decWorkerPool.busy || fmdb && fmdb.busy) {
                        if (d) {
                            this.logger.debug('fetch/backpressure (%d%%)', this.received * 100 / this.totalBytes);
                        }
                        // apply backpressure
                        await sleep(BACKPRESSURE_WAIT_TIME);
                    }
                },
                close: () => {
                    if (self.d) {
                        this.logger.debug('fetch/close');
                    }
                },
                abort: (ex) => {
                    if (self.d) {
                        this.logger.error('fetch/abort', ex);
                    }
                }
            }, queueingStrategy);

            await response.body.pipeTo(stream, {signal});
        }
        else {
            const reader = response.body.getReader();

            while (true) {
                const {value, done} = await reader.read();

                if (done) {
                    break;
                }

                // feed received chunk to JSONSplitter via .onprogress()
                await this.progress(splitter, value);
            }
        }

        return splitter;
    }

    async chunkedParser(splitter) {
        const {response, received, totalBytes, residual, service} = this;
        MEGAException.assert(totalBytes >= 0);

        // is this residual data that hasn't gone to the splitter yet?
        // we process the full response if additional bytes were received
        // in moz-chunked transfers, if we can contain chars beyond
        // the last onprogress(), send .substr(this.received) instead!
        // otherwise, we send false to indicate no further input
        // in all cases, set the input-complete flag to catch incomplete API responses

        let chunk = false;
        if (response && response.byteLength > received) {
            if (received === 0) {
                chunk = new Uint8Array(response);
            }
            else if (response instanceof ArrayBuffer) {
                chunk = new Uint8Array(response, received);
            }
            else {
                chunk = response.subarray(received);
            }
        }

        if (d && response instanceof Response) {
            const data = tryCatch(() => ab_to_str(this.last.buffer.slice(-280)).replace(/[\w-]{15,}/g, '\u2026'))();
            this.logger.info('API response: %s, \u2026\u2702\u2026\u2026%s', response.statusText, data);
        }

        const rc = splitter.chunkproc(chunk, true);
        if (rc) {
            const val = rc >> 1;

            if (val < 1 || service !== 'cs') {
                return [val];
            }

            await residual[0];
            return residual.slice(1);
        }

        return fm_fullreload(this, 'onload JSON Syntax Error');
    }

    async deliver(chunk) {
        if (!this.idle) {
            await this.flush();
        }
        this.logger.assert(!this.cancelled && this.received === 0, 'invalid state to deliver');

        if (d) {
            this.logger.info('deliver', tryCatch(() => JSON.parse(ab_to_str(chunk)))() || chunk);
        }

        this.response = chunk;
        this.totalBytes = chunk.byteLength;
        return this.parser(new JSONSplitter(this.split, this, true))
            .then((res) => {
                const val = res | 0;
                if (val < 0) {
                    throw val;
                }
            })
            .catch((ex) => {
                if (d) {
                    this.logger.warn('Caught delivery error...', ex);
                }

                if (this.isRequestError(ex)) {

                    return this.errorHandler(ex | 0);
                }

                throw ex;
            });
    }

    async progress(splitter, chunk) {
        this.logger.assert(!this.cancelled);

        /**
         if (this.channel == 5) {
            this.totalBytes = 2;
            chunk = Uint8Array.from([45, 54]);
            // debugger;
        }
         /**/

        chunk = new Uint8Array(chunk);
        this.received += chunk.byteLength;

        if (this.inflight) {
            const [{options: ctx}] = this.inflight;

            if (ctx && ctx.progress && this.totalBytes > 2) {
                ctx.progress(this.received / this.totalBytes * 100);
            }
        }

        if (self.d) {
            this.last = chunk;
        }

        // send incoming live data to splitter
        // for maximum flexibility, the splitter ctx will be this
        const rc = splitter.chunkproc(chunk, chunk.length === this.totalBytes);
        if (!rc) {
            // a JSON syntax error occurred: hard reload
            await fm_fullreload(this, 'onerror JSON Syntax Error');
        }

        if (rc !== -1 && rc >> 1 < 1) {
            throw new MEGAException(`\u26a0 [${rc >> 1}]`, rc >> 1, 'InvalidCharacterError');
        }
    }

    async finish(split) {
        let t = ERATELIMIT;
        const {status, response} = this;

        if (status === 200) {
            const result = await this.parser(split).catch(dump);

            if (result === undefined) {
                if (d) {
                    this.logger.error('Bad JSON data in response', response);
                }
                t = EAGAIN;
            }
            else {
                t = result;
                this.status = true;

                if (t === EARGS) {
                    if (d) {
                        this.logger.warn('Request-level error for command? probably wrongly invoked request..');
                    }
                    t = [t];
                }
            }
        }
        else if (d) {
            this.logger.warn(`API server connection failed (error ${status})`);
        }

        if (typeof t === 'object') {
            t = await this.dequeue(t) || t;
        }

        return this.errorHandler(t);
    }
}

mWebLockWrap(MEGAPIRequest.prototype, 'enqueue');

Object.defineProperty(MEGADeferredController, Symbol.species, {
    get() {
        'use strict';
        return Promise;
    }
});

/**
 * Fetch API helper that does keep a connection alive as long it is not aborted.
 * @param {RequestInfo|URL} [url] The resource that you wish to fetch
 * @param {RequestInit} [options] An object containing any custom settings that you want to apply to the request.
 * @param {Object} handlers Dynamic fetch handlers
 * @constructor
 * @see {@link window.fetch}
 */
class MEGAKeepAliveStream {
    constructor(url, options, handlers) {
        if (!handlers) {
            if (!(handlers = options)) {
                handlers = url;
                url = false;
            }
            options = false;
        }
        if (typeof handlers === 'function') {
            handlers = {onload: handlers};
        }

        const value = Math.max(self.d | 0, 'rad' in mega && 3);
        Object.defineProperty(this, 'debug', {value, writable: true});
        Object.defineProperty(this, 'options', {value: {...options}, writable: true});
        Object.defineProperty(this, 'verbose', {value: this.debug > 2, writable: true});

        const pid = this.ident;
        Object.defineProperty(this, 'logger', {
            configurable: true,
            value: new MegaLogger(() => `${this.__ident_0}-${this.__ident_1}-${pid}`, {
                throwOnAssertFail: true,
                captureLastLogLine: true,
                levelColors: {
                    ERROR: `#de1234`, DEBUG: `#1234bc`, WARN: `#646523`, INFO: `#147852`, LOG: '#2d3e4f'
                }
            })
        });

        this.reset();
        this.reader = null;
        this.controller = null;
        this.backoff = 1e3 + Math.random() * 4e3;

        if (handlers) {
            const descriptor = Object.getOwnPropertyDescriptors(handlers);
            const ownKeys = Reflect.ownKeys(descriptor);

            for (let i = ownKeys.length; i--;) {
                const h = ownKeys[i];
                this.logger.assert(h.startsWith('on'), h);
                if (descriptor[h].value) {
                    descriptor[h].value = freeze(descriptor[h].value.bind(this));
                }
            }
            Object.defineProperties(this, descriptor);
        }

        if (url) {
            this.connect(url);
        }

        window.addEventListener('online', this);
        window.addEventListener('offline', this);
    }

    get [Symbol.toStringTag]() {
        return 'MEGAKeepAliveStream';
    }

    get signal() {
        const {controller} = this;

        if (!controller || controller.signal.aborted) {
            this.controller = new AbortController();
        }
        return this.controller.signal;
    }

    get ident() {
        return Math.random().toString(36).slice(-4).toUpperCase();
    }

    handleEvent(ev) {
        const {verbose, logger} = this;

        if (verbose) {
            logger.debug('event', ev.type, [ev]);
        }

        if (ev.type === 'online') {
            this.backoff = 1e3 + Math.random() * 7e3;
            this.restart(ev.type);
        }
        else if (ev.type === 'offline') {
            this.backoff = 1e6;
            this.abort(ev.type);
        }
    }

    destroy(reason) {
        if (!this.destroyed) {

            this.abort(reason);
            this.options = null;

            window.removeEventListener('online', this);
            window.removeEventListener('offline', this);

            const keys = Reflect.ownKeys(this);
            for (let i = keys.length; i--;) {
                tryCatch(() => Reflect.deleteProperty(this, keys[i]))();
            }

            Object.defineProperty(this, 'destroyed', {value: true});
            freeze(this);
        }
    }

    abort(reason) {
        const {reader, controller, verbose, logger} = this;

        if (verbose) {
            logger.info(reason || 'connection aborted', reader, controller);
        }

        if (controller) {
            tryCatch(() => {
                controller.abort(reason);
            }, false)();
            this.controller = null;
        }

        if (reader) {
            tryCatch(() => {
                reader.cancel(reason)
                    .then(() => reader.releaseLock())
                    .catch((ex) => {
                        if (verbose) {
                            logger.warn('release-lock', ex);
                        }
                    });
            })();
            this.reader = null;
        }

        return this.reset();
    }

    reset() {
        const {timer, ident} = this;

        if (timer && !timer.aborted) {
            timer.abort();
        }

        this.timer = 0;
        this.begin = 0;
        this.status = 0;
        this.__ident_1 = ident;

        return this;
    }

    restart(reason) {
        this.abort(`Restarting connection due to ${reason || 'user request'}.`);

        queueMicrotask(() => {
            if (this.controller) {
                if (this.debug) {
                    this.logger.warn('Unexpected ongoing connection!', this);
                }
                this.abort('restart-safety');
            }

            if (!this.destroyed) {
                this.connect();
            }
        });

        return this;
    }

    setURL(url) {
        if (url !== this.url) {
            Object.defineProperty(this, 'url', {value: url, configurable: true});

            url = String(url).split('?')[0].split(/^.*\/\/[^/]+\/|\/[^/]+$/)[1];
            Object.defineProperty(this, '__ident_0', {
                configurable: true,
                value: `api.kas:${url}-${this.ident}${this.ident}`
            });
        }

        return this;
    }

    connect(url, options = false) {
        let tmp;
        const {signal, onload, onclose, debug, verbose, logger} = this;

        if (url) {
            this.setURL(url);
        }
        this.reset();

        if (!this.url) {
            if (verbose) {
                logger.warn('No URL set.', this);
            }
            return this;
        }

        if (verbose) {
            logger.debug('connecting', String(this.url).replace(/[\w-]{15,}/g, '\u2026'));
            tmp = logger.lastLogLine;
        }
        const begin = this.begin = Date.now();

        this.fetch({...this.options, ...options, signal})
            .then((stream) => {
                if (verbose) {
                    logger.log({stream});
                }
                return onload && stream.arrayBuffer() || this.reader.closed;
            })
            .then((buf) => {
                if (verbose) {
                    logger.log('response', buf && ab_to_str(buf));
                }
                return onload && onload(buf);
            })
            .catch((ex) => {
                if (verbose || debug && ex && ex.name !== 'AbortError') {
                    logger.warn(ex);
                }
                if (!signal.aborted) {
                    this.abort(ex.message);
                }
            })
            .finally(() => {

                if (!this.destroyed) {
                    if (onclose) {
                        queueMicrotask(onclose);
                    }
                    this.schedule();
                }

                if (verbose) {
                    tmp[0] = tmp[0].replace(/^\S+/, `%c${new Date().toISOString()}`)
                        .replace('connecting', 'connection closed, duration=%sms, status=%d, backoff=%f');

                    console.debug(...tmp, Date.now() - begin, this.status | 0, this.backoff);
                }
            });

        return this;
    }

    schedule(backoff) {
        if (navigator.onLine === false) {
            return;
        }

        if (!backoff) {
            if (this.status === 200) {
                // Increase backoff if we do keep receiving packets is rapid succession, so that we maintain
                // smaller number of connections to process more data at once - backoff up to 4 seconds.
                this.backoff = Date.now() - this.begin < 1482 ? Math.min(4e3, this.backoff << 1) : Math.random() * 4e3;
            }
            else {
                this.backoff = Math.min(40e3, this.backoff << 1);
            }

            backoff = this.backoff / 1e3;
        }

        this.timer = tSleep.schedule(backoff, this, () => !this.destroyed && this.restart('scheduler'));
    }

    async fetch(options) {
        this.schedule(36);
        const {body, ok, status, statusText} = await fetch(this.url, options);

        this.status = status;
        if (!(ok && status === 200)) {
            const ex = new MEGAException(`Server error ${status} (${statusText})`, this, 'NetworkError');

            if (this.onerror) {
                this.onerror(ex);
            }
            throw ex;
        }

        this.reader = body.getReader();
        return new ReadableStream(this);
    }

    async start(controller) {
        const {onchunk, onload, onstart, reader, verbose, logger} = this;

        if (onstart) {
            await onstart(controller);
        }

        while (true) {
            this.schedule(32);
            const {value, done} = await reader.read();

            if (done) {
                controller.close();
                break;
            }

            if (verbose) {
                logger.log(`Got ${value.byteLength} bytes chunk...`);
            }

            if (onchunk) {
                await onchunk(value);
            }

            if (onload) {
                controller.enqueue(value);
            }
        }
    }

    cancel(reason) {
        const {oncancel, debug, logger} = this;

        if (debug) {
            logger.info('cancel', reason);
        }

        if (oncancel) {
            oncancel(reason);
        }
    }

    static test(url = 'https://192.168.2.3:444/zero?t=1') {
        let size = 0;
        const handlers = {
            onload(data) {
                size += data.byteLength;
                console.info('data received', size, data);
            }
        };
        const kas = new MEGAKeepAliveStream(url, handlers);

        tSleep(7)
            .then(() => kas.restart('test-stage1'))
            .then(() => tSleep(Math.random() * 10))
            .then(() => {
                return kas.destroy('test-stage2');
            })
            .then(() => tSleep(4))
            .then(() => {
                size = 0;
                return new MEGAKeepAliveStream({
                    ...handlers,
                    onerror(ex) {
                        if (size > 1e4) {
                            this.destroy(ex);
                        }
                        throw new Error(`trap <${ex}>`);
                    },
                    onclose() {
                        if (size > 7e4) {
                            this.destroy('test-stage3');
                        }
                    }
                });
            })
            .then((kas) => {
                console.info('new instance', kas);
                return kas.connect(url);
            })
            .catch(dump);

        return kas;
    }
}

/**
 * API Communication Layer
 * @name api
 * @memberOf window
 */
lazy(self, 'api', () => {
    'use strict';
    const chunkedSplitHandler = freeze({
        cs: freeze({
            '[': tree_residue,     // tree residue
            '[{[f{': tree_node,    // tree node
            '[{[f2{': tree_node,   // tree node (versioned)
            '[{[ok0{': tree_ok0    // tree share owner key
        }),
        sc: freeze({
            '{': sc_residue,       // SC residue
            '{[a{': sc_packet,     // SC command
            '{[a{{t[f{': sc_node,  // SC node
            '{[a{{t[f2{': sc_node  // SC node (versioned)
        })
    });
    const channels = [
        // user account API interface
        [0, 'cs'],

        // folder link API interface
        [1, 'cs'],

        // active view's SC interface (chunked mode)
        [2, 'sc', chunkedSplitHandler.sc],

        // user account event notifications
        [3, 'sc'],

        // active view's initial tree fetch (chunked mode)
        [4, 'cs', chunkedSplitHandler.cs],

        // WSC interface (chunked mode)
        [5, 'wsc', chunkedSplitHandler.sc],

        // off band attribute requests (keys) for chat
        [6, 'cs']
    ];
    const apixs = [];
    const inflight = new Map();
    const observers = new MapSet();
    const seenTreeFetch = new Set();
    const pendingTreeFetch = new Set();
    const logger = new MegaLogger(`api.xs${makeUUID().substr(-18)}`);
    const clone = ((clone) => (value) => clone(value))(window.Dexie && Dexie.deepClone || window.clone || echo);
    const cache = new LRULapse(12, 36, self.d > 0 && ((...args) => logger.debug('reply.cache flush', ...args)));
    const defaults = freeze({
        dedup: true,
        cache: false,
        scack: false
    });
    let gSearchParams, currst, lastst;
    const uSearchParams = Object.create(null);

    // cache entries lifetime rules.
    cache.commands = Object.assign(Object.create(null), {
        clc: -1,
        g(req) {

            if (req.g) {
                // cache for four seconds.
                return -4;
            }

            // cache for the session lifetime
            return true;
        }
    });

    // check whether the global SC connection is running.
    const isScRunning = () => {
        const {waitsc = false} = window;
        return !!waitsc.running;
    };

    // Set globally-accessed current sequence-tag
    const mSetSt = (st) => {
        if (isScRunning()) {
            currst = st || null;
        }
        else if (d) {
            logger[st === '.' ? 'info' : 'warn']('SC connection is not ready, per st=%s', st || null);
        }
    };

    // split API response into sequence-tag + result
    const mStParser = (res) => {

        if (!Array.isArray(res) || !mStParser.prim[typeof res[0]]) {

            res = typeof res === 'string' ? [res, 0] : [null, res];
        }

        return res;
    };
    mStParser.prim = freeze({'string': 1, 'number': 1});

    // Pack API response and action-packets into a single object.
    const mScPack = (pid, q) => {
        let packet, handle, sn, st;
        const sts = new Set([pid, q.st]);
        const {type, pkt, responses, log} = q;
        const gh = (n) => n && (n[0] && n[0].h || n[0]);

        for (let i = 0; i < pkt.length; ++i) {
            const p = pkt[i];

            st = p.st || st;
            sn = p.usn || p.sn || sn;
            handle = gh(p.scnodes) || handle;

            pkt[p.a] = packet = p;
        }

        if (type === 'array') {
            const batch = [];
            for (let i = 0; i < responses.length; ++i) {
                const packets = [];
                const payload = q.payload[i];
                const [st, result] = responses[i];
                assert(typeof st !== 'number' || st >= 0, `Unexpected sequence tag ${st}`);

                for (let j = 0; j < pkt.length; ++j) {
                    const p = pkt[j];
                    if (p.st === st) {
                        packets.push(p);
                    }
                }

                sts.add(st);
                batch.push({result, payload, packets, st, sn});
            }
            q.batch = batch;
        }

        if (log) {
            log('scack(%s) completed.', pid, currst, lastst, q);

            if (pkt.length) {
                const pst = pkt[0].st || st;
                logger.assert(pst === q.st, `Unmatched sequence tag "${pst}" != "${q.st}"`);
            }
            delete q.tid;
            delete q.log;
        }

        delete q.type;
        delete q.reject;
        delete q.resolve;
        delete q.responses;

        q.sn = sn;
        q.st = st || q.st;
        q.handle = handle;
        q.packet = packet;

        inflight.remove(...sts);
        return freeze(q);
    };

    // API-command handler for st-conveyed requests.
    const mStCommandHandler = (instance, pid) => {
        const mStRef = (res) => {
            const [st] = res = mStParser(res);

            if (typeof st === 'string') {
                inflight.set(st, pid);
            }
            return res;
        };
        return (resolve, reject, ctx) => {
            let {result: res, responses, type} = ctx;

            if (type === 'array') {
                for (let i = responses.length; i--;) {
                    res = responses[i] = mStRef(responses[i]);
                }
            }
            else {
                res = mStRef(res);
            }
            let [st, result] = res;

            if (typeof st === 'number') {
                if (st < 0) {
                    return reject(st);
                }
                st = false;
            }

            if (window.scinflight) {
                queueMicrotask(execsc);
            }
            mSetSt(st);

            ctx.st = st;
            ctx.result = result;
            ctx.reject = reject;
            ctx.resolve = resolve;

            api.ack(instance, pid, ctx);
        };
    };

    /**
     * @param {MEGAPIRequest} instance
     * @param {Object|String|Array} payload
     * @param {String} type
     * @param {Object} options
     * @returns {Object}
     */
    const getRequestTrial = (instance, payload, type, options) => {
        const trial = Object.create(null);

        if (instance.service === 'cs') {
            trial.dedup = options.dedup && type === 'object' && (!payload.i || payload.i !== window.requesti);

            if (trial.dedup) {
                getRequestTrial.sink.setDupRef(trial, instance, payload, type, options);
            }

            if (options.scack) {
                getRequestTrial.sink.setSCAckRef(trial, instance, payload, type);
            }
        }

        return trial;
    };

    Object.defineProperty(getRequestTrial, 'sink', {
        value: freeze({
            setDupRef(target, instance, payload, type, options) {
                const key = JSON.stringify(payload);

                if (inflight.has(key)) {
                    target.inflight = inflight.get(key);
                    return;
                }
                target.dedup = key;
                target.cache = options.cache;

                switch (cache.has(key)) {
                    case true:
                        target.cachedResponse = clone(cache.get(key));
                        break;
                    case false:
                        // did exist, but expired.
                        if (!target.cache) {
                            target.cache = -cache.lapse;
                        }
                }
            },

            setSCAckRef(target, instance, payload, type) {
                const tmp = type === 'array' ? payload : [payload];

                for (let z = 0; z < tmp.length; ++z) {
                    tmp[z].i = tmp[z].i !== window.requesti && tmp[z].i || (z > 0 ? tmp[0].i : `${instance.lex}`);
                }
                const pid = tmp[tmp.length - 1].i;
                const obj = Object.create(null);
                const {logger} = instance;

                if (self.d) {
                    obj.tid = `sc$ack:pkt(${pid})`;
                    obj.log = logger.info.bind(logger);
                }
                obj.pkt = [];

                logger.assert(!inflight.has(pid), `pid(${pid}) exists.`);
                inflight.set(pid, obj);

                target.scack = pid;
            }
        })
    });

    Object.defineProperty(inflight, 'remove', {
        value: function(...args) {
            for (let i = args.length; i--;) {
                this.delete(args[i]);
            }
            delay('api!sc<resume>', () => {
                console.assert(this.size || !window.scinflight, 'Invalid SC-inflight state, API gave no ST?');
                return !this.size && window.scinflight && queueMicrotask(execsc);
            });
        }
    });

    const lock = (id = 'main', callback = nop) => {
        // eslint-disable-next-line compat/compat -- we've a polyfill
        return navigator.locks.request(`${logger.name}.${id}`, callback);
    };

    // -----------------------------------------------------------------------------------\
    // -----------------------------------------------------------------------------------/
    // Public API.
    return freeze({
        /**
         * Enqueue API Request
         * @param {Object|String|Array} payload Request payload to send
         * @param {Number|Object} channel Channel number (v2), or options object (v3)
         * @returns {Promise<*>} fulfilled on API request completion.
         * @memberOf api
         */
        async req(payload, channel = 0) {
            const options = Object.assign({channel: channel | 0}, defaults, channel);

            await lock(options.channel);
            const instance = apixs[options.channel];

            let type = typeof payload;
            type = type === 'object' && Array.isArray(payload) ? 'array' : type;

            const trial = getRequestTrial(instance, payload, type, options);

            if (trial.inflight) {
                if (self.d) {
                    instance.logger.debug('Reusing API Request...', payload);
                }
                return trial.inflight;
            }

            if ('cachedResponse' in trial) {
                if (self.d) {
                    instance.logger.info('Returning Cached API Request Response...', payload, trial.cachedResponse);
                }
                return trial.cachedResponse;
            }

            let promise = new Promise((resolve, reject) => {
                if (trial.scack) {
                    const pid = trial.scack;

                    reject = ((rej) => (ex) => rej(ex, inflight.remove(pid)))(reject);

                    resolve = Promise.lock({
                        reject,
                        resolve,
                        name: 'api.sc-inflight.lock',
                        handler: mStCommandHandler(instance, pid)
                    });
                }
                const custom = Boolean(options.apipath || options.queryString);

                instance.enqueue({type, payload, custom, options, resolve, reject}).catch(reject);
            });

            if (trial.dedup) {
                const {dedup: key} = trial;
                inflight.set(key, promise);

                if (trial.cache) {
                    let rule = trial.cache;

                    promise = promise.then((res) => {
                        rule = cache.commands[res.payload.a] || rule;

                        if (typeof rule === 'function') {
                            rule = rule(res.payload);
                        }

                        cache.set(key, clone(res), rule < 0 ? -rule : Infinity);
                        return res;
                    });
                }
                promise = promise.finally(() => inflight.remove(key));
            }

            return promise;
        },

        /**
         * Wrapper around {@link api.req} that does take st/response combos into account.
         * Meant for commands that did reply a string with v2, and an array as per v3.
         * If an action-packet is expected to be received, {@link api.screq} MUST be used.
         * @param {Object|String|Array} payload Request payload to send
         * @param {Number|Object} channel Channel number (v2), or options object (v3)
         * @returns {Promise<*>} fulfilled on API request and server completion.
         * @memberOf api
         */
        async send(payload, channel = 0) {
            const options = Object.assign({cache: -20, channel: channel | 0}, channel);

            if (typeof payload === 'string') {
                payload = {a: payload};
            }
            const {result} = await this.req(payload, options);
            const [st, value] = mStParser(result);

            if (self.d > 1 && st !== 0) {
                // The caller probably wanted to use api.req(), we'll make him happy...
                logger.info(`Unexpected response for ${payload.a} with st=${st}`, result);
            }

            return st === 0 ? value : result;
        },

        /**
         * Wrapper around {@link api.req} that does await for server-side acknowledge through action-packets.
         * @param {Object|String|Array} payload Request payload to send
         * @param {Number|Object} channel Channel number (v2), or options object (v3)
         * @returns {Promise<*>} fulfilled on API request and server completion.
         * @memberOf api
         */
        async screq(payload, channel = 0) {
            const options = Object.assign({channel: channel | 0}, channel, {scack: true});

            if (typeof payload === 'string') {
                payload = {a: payload};
            }

            if (!currst) {
                mSetSt('.');
            }

            return this.req(payload, options);
        },

        /**
         * Retrieve tree nodes on-demand (aka, server-side paging)
         * @param {Array|String} handles Tree node-handles to fetch.
         * @return {Promise<*>} void
         * @memberOf api
         */
        async tree(handles) {

            if (Array.isArray(handles)) {

                handles.forEach(pendingTreeFetch.add, pendingTreeFetch);
            }
            else {
                pendingTreeFetch.add(handles);
            }

            return lock('tree-fetch.lock', async() => {
                const pending = [...pendingTreeFetch];
                pendingTreeFetch.clear();

                // @todo ensure we won't store into "seen" a node we may need again (e.g. deleted/restored)

                const payload = [];
                for (let i = pending.length; i--;) {
                    const n = pending[i];

                    if (!seenTreeFetch.has(n) && (!M.d[n] || M.d[n].t && !M.c[n])) {

                        seenTreeFetch.add(n);
                        payload.push({a: 'f', r: 1, inc: 1, n});
                    }
                }

                while (payload.length) {
                    const res = await this.req(payload, 4).catch(echo);
                    const val = Number(res);

                    if (val === EROLLEDBACK) {
                        if (self.d) {
                            logger.warn('Rolling back command#%d/%d', res.index, payload.length, res.result);
                        }
                        payload.splice(res.index, 1);
                    }
                    else {
                        if (val < 0) {
                            throw val;
                        }
                        return res;
                    }
                }
            });
        },

        /**
         * Acknowledge packet/api-response processor
         * @param {Object|MEGAPIRequest} pr who triggers it.
         * @param {String} pid seq-tag or req-id
         * @param {*} [hold] arguments
         * @returns {Number|void} Status code
         */
        ack(pr, pid, hold) {
            if (!inflight.has(pid)) {
                if (!inflight.size) {
                    return 3;
                }

                // logger.warn('ack(%s)=%s/%s', pid, pr.st > currst, inflight.has(pr.st), currst, lastst, hold, [pr]);

                pid = inflight.get(pr.st);
                if (!pid) {
                    return pr.st > currst ? 7 : 2;
                }
            }

            let rc = 0;
            const q = inflight.get(pid);

            if (d) {
                logger.warn('api.ack(%s)', pid, currst, lastst, hold, [pr]);
            }

            if (pr instanceof MEGAPIRequest) {

                Object.assign(q, hold);
                hold = !q.pkt.length && q.st && isScRunning();
            }
            else if (q.resolve) {

                if (pr.st === currst) {
                    lastst = currst;
                }

                q.pkt.push(pr);
            }
            else {
                rc = 7;
                hold = true;
            }

            if (hold) {
                if (q.tid) {
                    delay(q.tid, () => q.log('scack(%s) not yet fulfilled...', pid));
                }
            }
            else {
                if (q.tid) {
                    delay.cancel(q.tid);
                }

                queueMicrotask(tryCatch(() => {
                    const {resolve} = q;

                    if (resolve) {
                        resolve(mScPack(pid, q));
                        mSetSt('.');
                    }
                    else if (d) {
                        logger.debug('st/idtag-less packet accumulated.', q);
                    }
                }, q.reject));
            }

            return rc;
        },

        /**
         * Abort all API channel.
         * @returns {void}
         * @memberOf api
         */
        stop() {

            if (inflight.size) {
                if (d) {
                    logger.warn('Cleaning in-flight API Requests...', [...inflight.keys()]);
                }
                inflight.clear();
            }

            for (let i = apixs.length; i--;) {
                this.cancel(i);
            }
        },

        /**
         * Abort API channel
         * @param {Number} channel API channel
         * @returns {void|string} sid
         * @memberOf api
         */
        cancel(channel) {
            const req = apixs[channel];

            if (req instanceof MEGAPIRequest) {
                let tick = 0;

                if (req.service === 'cs') {
                    const dk = [...inflight.keys()].filter(a => a[0] === '{');

                    if (dk.length) {
                        if (d) {
                            logger.warn('Expunging de-dup records...', dk);
                        }

                        inflight.remove(...dk);
                    }
                }
                api.webLockSummary();

                lock(req.channel, async() => {
                    if (!req.idle && req.service === 'cs') {
                        if (d) {
                            req.logger.warn('Flushing and aborting channel...', [req]);
                        }
                        tick++;
                        await Promise.race([
                            req.flush(),
                            tSleep(7).then(() => {
                                if (tick < 2 && d) {
                                    req.logger.warn('Flush-attempt timed out.');
                                }
                            })
                        ]);
                    }
                    tick++;
                    return req.abort();
                }).catch((ex) => {
                    if (self.d) {
                        req.logger.warn('cancel failed', tick, ex);
                    }
                });

                apixs[channel] = null;
                return req.sid;
            }
        },

        /**
         * Initialize API channel
         * @param {Number} channel API channel
         * @param {String} service URI component.
         * @param {Object} split chunked-method splitter rules.
         * @returns {void}
         * @memberOf api
         */
        init(channel, service, split) {
            const sid = this.cancel(channel);
            apixs[channel] = new MEGAPIRequest(channel, service, split, sid);
        },

        /**
         * Re-initialize API channel(s)
         * @param {Number} [channel] channel, or all if omitted.
         * @returns {void}
         * @memberOf api
         */
        reset(channel) {
            if (channel >= 0 && channel < channels.length) {

                if (channels[channel]) {

                    this.init(...channels[channel]);
                }
            }
            else if (channel === undefined) {

                for (let i = channels.length; i--;) {

                    this.reset(i);
                }
            }
        },

        /**
         * Awake all API request that may be retrying, e.g. on offline network.
         * @returns {void}
         * @memberOf api
         */
        retry() {
            const cap = 3000;

            if (navigator.onLine === false) {
                if (self.d > 1) {
                    logger.warn('will not retry, network is offline...');
                }
                return;
            }

            for (let i = apixs.length; i--;) {
                const req = apixs[i];

                if (req && req.timer && req.backoff > cap) {
                    req.backoff = cap + -Math.log(Math.random()) * cap;
                    req.timer.cancel(true);
                }
            }
        },

        /**
         * Deliver data through specific API channel.
         * @param {Number} channel API channel
         * @param {ArrayBuffer} chunk data
         * @returns {Promise<*>}
         * @memberOf api
         */
        async deliver(channel, chunk) {
            const req = apixs[channel];

            if (req instanceof MEGAPIRequest) {
                return req.deliver(chunk);
            }
        },

        /**
         * Add new API channel to issue requests through.
         * @param {Number} idx Channel number.
         * @param {*} args additional arguments (i.e. service type, splitter)
         * @memberOf api
         */
        addChannel(idx, ...args) {
            if (idx < 0) {
                idx = channels.length << -idx;
            }
            if (idx > 10) {
                channels[idx] = [idx, ...args];
                this.reset(idx);

                if (apixs[2] instanceof MEGAPIRequest) {
                    apixs[idx].sid = apixs[2].sid;
                }

                return idx;
            }
        },

        /**
         * Remove previously created API custom channel.
         * @param {Number} idx Channel number.
         * @memberOf api
         */
        removeChannel(idx) {
            if (idx > 10) {
                this.cancel(idx);

                const layers = [channels, apixs];
                for (let i = layers.length; i--;) {
                    const layer = layers[i];

                    let pos = idx;
                    if (!layer[pos + 1]) {
                        while (!layer[pos - 1]) {
                            --pos;
                        }
                    }
                    layer.splice(pos, 1 + idx - pos);
                }
            }
        },

        /**
         * Retrieve URL search-params to append to API Requests.
         * @param {*} [options] Additional parameters to append
         * @param {*} [mode] operation mode for options
         * @returns {String} Query string for use in a URL.
         * @memberOf api
         */
        getURLSearchParams(options, mode) {

            if (!gSearchParams) {
                const obj = {...uSearchParams, v: this.version, lang: window.lang};

                // If using an extension, the version is passed through to the API for the helpdesk tool
                if (is_extension) {
                    obj.domain = 'meganz';
                    obj.ext = is_chrome_web_ext ? buildVersion.chrome : buildVersion.firefox;
                }
                else {
                    obj.domain = location.host.split('.').slice(-3).join('');
                }

                const b = mega.getBrowserBrandID();
                if (b) {
                    obj.bb = b | 0;
                }

                gSearchParams = new URLSearchParams(obj).toString();
            }

            if (options) {
                if (typeof options === 'string') {
                    // remove dupes and cleanup
                    options = options.split('&')
                        .reduce((obj, e) => {
                            const [k, v] = e.split('=');
                            if (k) {
                                obj[k] = v && decodeURIComponent(v) || '';
                            }
                            return obj;
                        }, Object.create(null));
                }
                const src = new URLSearchParams(options);
                if (mode === 1) {
                    return src.toString();
                }
                const dst = new URLSearchParams(gSearchParams);

                for (const [k, v] of src) {
                    if (mode === 2) {
                        dst.append(k, v);
                    }
                    else {
                        dst.set(k, v);
                    }
                }
                return dst.toString();
            }

            return gSearchParams;
        },

        /**
         * Define URL search-params to append to API Requests.
         * @param {Object|String} options key/value pairs
         * @returns {void}
         * @memberOf api
         */
        setURLSearchParams(options) {
            const {u_sid, pfid, n_h} = window;

            if (self.d > 1) {
                logger.warn('Establishing URL Search Params...', options);
            }

            Object.assign(uSearchParams, Object.fromEntries(new URLSearchParams(options).entries()));

            // re-set sid to expunge cached QS.
            this.setSID(u_sid);
            if (pfid) {
                this.setFolderSID(n_h, u_sid);
            }

            gSearchParams = null;
        },

        /**
         * Remove and optionally re-apply URL search-params used to append to API Requests.
         * @param {String|Array|Set} keys the key name(s) to remove.
         * @param {Object} [options] optionally set these key/value pairs
         * @returns {*} value
         * @memberOf api
         */
        recycleURLSearchParams(keys, options) {
            let changed = false;

            if (typeof keys === 'string') {
                keys = keys.split(',');
            }
            options = options && clone(options) || false;

            if (self.d > 1) {
                logger.warn('Recycling URL Search Params...', keys, options);
            }

            keys = [...keys];
            for (let i = keys.length; i--;) {
                const k = keys[i];

                if (k in uSearchParams) {

                    if (options[k] === uSearchParams[k]) {
                        delete options[k];
                        if (!Object.keys(options).length) {
                            options = false;
                        }
                    }
                    else {
                        changed = true;
                        delete uSearchParams[k];
                    }
                }
            }

            return (changed || options) && this.setURLSearchParams({...options});
        },

        /**
         * Set new cache entries lifetime rules.
         * @param {Object} ruleset see {@link cache.commands}
         * @memberOf api
         */
        setCommandCacheRule(ruleset) {
            Object.assign(cache.commands, ...ruleset);
        },

        /**
         * Set new session identifier
         * @param {String} sid The new session to establish
         * @returns {void}
         * @memberOf api
         */
        setSID(sid) {
            if (sid) {
                this.notify('setsid', sid);
                sid = `sid=${sid}`;
            }
            else {
                sid = '';
            }

            for (let i = channels.length; i--;) {
                if (i !== 1 && apixs[i]) {
                    apixs[i].sid = sid;
                }
            }
        },

        /**
         * Set new session identifier for folder-links
         * @param {String} h Folder-link handle
         * @param {String} sid The new session to establish
         * @returns {void}
         * @memberOf api
         */
        setFolderSID(h, sid) {
            h = `${self.pfcol ? 's' : 'n'}=${h}`;

            if (sid) {
                this.notify('setsid', sid);
                h += `&sid=${sid}`;
            }
            const exclude = new Set([0, 3, 6]);

            for (let i = channels.length; i--;) {
                if (apixs[i] && !exclude.has(i)) {
                    apixs[i].sid = h;
                }
            }
        },

        setAPIPath(aDomain, aSave) {
            if (aDomain === 'debug') {
                aDomain = `${location.host}:444`;
            }
            apipath = `https://${aDomain}/`;

            if (aSave) {
                localStorage.apipath = apipath;
            }

            return apipath;
        },

        staging(aSave) {
            return this.setAPIPath('staging.api.mega.co.nz', aSave);
        },

        prod(aSave) {
            return this.setAPIPath('g.api.mega.co.nz', aSave);
        },

        /**
         * Observer API event.
         * @param {String} what to listen for.
         * @param {Function} callback to invoke
         * @returns {void}
         * @memberOf api
         */
        observe(what, callback) {
            observers.set(what, callback);
        },

        /**
         * Notify API event.
         * @param {String} what to listen for.
         * @param {*} [data] data to send with the event
         * @returns {void}
         * @memberOf api
         * @private
         */
        notify(what, data) {
            delay(`api:event-notify.${what}`, () => {
                observers.find(what, (callback) => {
                    queueMicrotask(callback.bind(null, data));
                });
            });
        },

        /**
         * Check for and release any held locks due to a faulty w/sc connection.
         * @returns {Promise<void>}
         * @memberOf api
         */
        async poke() {

            if (!(await navigator.locks.query()).held.map(o => o.name).join('|').includes('sc-inflight.lock')) {
                logger.info('cannot poke, sc-inflight is not being held...');
                return;
            }

            if (isScRunning()) {
                logger.warn('cannot poke, w/sc is running...');
                return;
            }

            for (const [k, {st, options = false, payload: {a, i} = false}] of inflight) {

                if (st && options.scack === true) {
                    const pid = inflight.get(st);

                    logger.assert(pid === k && pid === i, `Invalid state ${pid}~~${k}~~${i}`);

                    if (pid === i) {
                        logger.warn(`dispatching held command ... ${a}~~${i}~~${st} ...`);

                        this.ack({st, a: 'd00m3d'}, pid);
                    }
                }
            }
        },

        /**
         * Catch up (await) sequence-tag.
         * @param {String|Object} pkt to expect
         * @returns {Promise<Object>|*} packet
         */
        catchup(pkt) {
            let store = inflight.get('catchup');
            let fire = (f, v) => f(v);

            if (d) {
                const st = pkt.st || pkt;

                fire = (f, v) => {
                    logger.info('Catchup completed, %s -> %s', st, v);
                    f(v);
                };

                if (store || !pkt.st) {
                    logger.warn('Catching up st=%s', st);
                }
            }

            if (typeof pkt !== 'string') {

                if (store) {
                    for (const pending of store) {
                        const {st, resolve} = pending;

                        if (pkt.st >= st) {
                            fire(resolve, pkt.st);
                            store.delete(pending);

                            if (!store.size) {
                                inflight.remove('catchup');
                            }
                            break;
                        }
                    }
                }
                return;
            }

            return new Promise((resolve) => {
                if (pkt >= currst) {
                    return fire(resolve, pkt);
                }
                if (!store) {
                    inflight.set('catchup', store = new Set());
                }
                store.add({st: pkt, resolve});
            });
        },

        /**
         * Get description for an API error code.
         * @param {Number} code API error code
         * @param {*} [fallback] fall back value if unknown error passed
         * @returns {String} error description
         */
        strerror(code, fallback) {
            assert(code !== 0 || fallback, 'Not an error code.');
            return code < 0 && api_strerror(code) || fallback || `${code}`;
        },

        /**
         * Set node attributes.
         * @param {String|MegaNode} n The ufs-node, or a handle
         * @param {Object} attrs attributes to define
         * @param {Function} [ack] function to acknowledge invocation.
         * @param {Function} [hook] hook a promise chain behind the web-lock.
         * @returns {Promise<*>} API sc-req result.
         */
        setNodeAttributes(n, attrs = false, ack = echo, hook = echo) {
            if (typeof n === 'string') {
                n = M.getNodeByHandle(n);
            }

            return lock(`sna.${n.h}`, () => api_setattr(ack({...n, ...attrs})).then(hook));
        },

        webLockSummary() {
            delay('api:deadlock:dump', () => {
                // eslint-disable-next-line compat/compat -- we've a polyfill
                navigator.locks.query()
                    .then((res) => {
                        const out = Object.create(null);

                        const k = ['pending', 'held'];
                        for (let i = k.length; i--;) {
                            const t = res[k[i]];

                            for (let j = t.length; j--;) {
                                const e = t[j];

                                out[`${k[i]}@${j} ${e.name}`] = `${e.mode}, ${e.clientId}`;
                            }
                        }

                        console.group('WebLock(s) Summary');
                        if ($.len(out)) {
                            console.table(out);
                        }
                        else {
                            console.info('None.');
                        }
                        console.groupEnd();
                    })
                    .catch(dump);
            });
        },

        /**
         * Internal logger
         * @memberOf api
         * @type {MegaLogger}
         * @public
         */
        get logger() {
            return logger;
        },

        /**
         * Current Sequence-Tag
         * @memberOf api
         * @type {String}
         * @public
         */
        get currst() {
            return currst;
        },

        /**
         * Last Sequence-Tag
         * @memberOf api
         * @type {String}
         * @public
         */
        get lastst() {
            return lastst;
        },

        /**
         * Highest API Version Supported.
         * @returns {Number} API version number.
         * @memberOf api
         * @public
         */
        get version() {
            return 3;
        },

        [Symbol('__private__')]: self.d && freeze({apixs, observers, inflight, cache})
    });
});

mBroadcaster.once('boot_done', () => {
    'use strict';

    if (window.is_karma) {
        return;
    }

    mBroadcaster.once('startMega', SoonFc(300, () =>
        !mega.flags && api.req({a: 'gmf'})
            .then(({result}) => {
                mega.apiMiscFlags = result;
                mBroadcaster.sendMessage('global-mega-flags');
            })
            .catch((ex) => {
                console.error('Failed to retrieve API flags...', ex);
            })
    ));

    api.reset();
});

/**
 * Returns an object identifying the user agent browser
 * @param {String} [useragent] The user-agent string to identify
 * @returns {Object}
 */
function browserdetails(useragent) {
    var os = false;
    var browser = false;
    var icon = '';
    var name = '';
    var verSep = "\\s+";
    var verTag = '';
    var nameTrans = '';
    var current = false;
    var brand = false;
    var details = {};
    var displayName;
    var origUA = useragent;

    if (useragent === undefined || useragent === ua) {
        current = true;
        useragent = ua;
    }
    if (Object(useragent).details !== undefined) {
        return useragent.details;
    }
    useragent = (' ' + useragent).toLowerCase();

    if (current) {
        brand = mega.getBrowserBrandID();
    }
    else if (useragent.indexOf('~:') !== -1) {
        brand = useragent.match(/~:(\d+)/);
        brand = brand && brand.pop() | 0;
    }

    if (useragent.indexOf('windows phone') > 0) {
        icon = 'wp.png';
        os = 'Windows Phone';
    }
    else if (useragent.indexOf('android') > 0 || useragent.indexOf('andr0id') > 0) {
        os = 'Android';
    }
    else if (useragent.indexOf('windows') > 0) {
        os = 'Windows';
    }
    else if (useragent.indexOf('iphone') > 0) {
        os = 'iPhone';
    }
    else if (useragent.indexOf('imega') > 0) {
        os = 'iPhone';
    }
    else if (useragent.indexOf('ipad') > 0) {
        os = 'iPad';
    }
    else if (useragent.indexOf('mac') > 0
        || useragent.indexOf('darwin') > 0) {
        os = 'Apple';
    }
    else if (useragent.indexOf('qnap') > 0) {
        os = 'QNAP';
    }
    else if (useragent.indexOf('synology') > 0) {
        os = 'Synology';
    }
    else if (useragent.indexOf('linux') > 0
        || useragent.indexOf('freebsd') > 0
        || useragent.indexOf('netbsd') > 0
        || useragent.indexOf('openbsd') > 0
        || useragent.indexOf('sunos') > 0
        || useragent.indexOf('gentoo') > 0) {
        os = 'Linux';
    }
    else if (useragent.indexOf('blackberry') > 0) {
        os = 'Blackberry';
    }
    else if (useragent.indexOf(' cros ') > 0) {
        os = 'ChromeOS';
    }
    else if (useragent.indexOf(' kaios') > 0) {
        os = 'KaiOS';
    }
    else if (useragent.indexOf('webos') > 0) {
        os = 'WebOS';
    }
    else if (useragent.indexOf('playstation') > 0) {
        os = 'PlayStation';
    }

    if (mega.browserBrand[brand]) {
        browser = mega.browserBrand[brand];
        brand = null;
    }
    else if (useragent.indexOf(' edge/') > 0) {
        browser = 'Edge';
    }
    else if (useragent.indexOf(' edg/') > 0) {
        browser = 'Edgium';
        verTag = 'Edg';
    }
    else if (useragent.indexOf('iemobile/') > 0) {
        icon = 'ie.png';
        brand = 'IEMobile';
        browser = 'Internet Explorer';
    }
    else if (useragent.indexOf('oculusbrowser/') > 0) {
        icon = 'oculus.png';
        browser = 'OculusBrowser';
    }
    else if (useragent.indexOf('immersed/') > 0) {
        browser = 'Immersed';
    }
    else if (useragent.indexOf('samsungbrowser') > 0) {
        icon = 'samsung.png';
        browser = 'SamsungBrowser';
    }
    else if (useragent.indexOf('smarttv') > 0
        || useragent.indexOf('smart-tv') > 0
        || useragent.indexOf('smart_tv') > 0
        || useragent.indexOf('ezcast') > 0
        || useragent.indexOf('netcast') > 0
        || useragent.indexOf('webos') > 0
        || useragent.indexOf(' tizen') > 0
        || useragent.indexOf('appletv') > 0
        || useragent.indexOf('tvos') > 0
        || useragent.indexOf('hbbtv') > 0) {
        icon = 'linux.png';
        browser = 'SmartTV';
    }
    else if (useragent.indexOf('opera') > 0 || useragent.indexOf(' opr/') > 0 || useragent.indexOf(' opt/') > 0) {
        if (useragent.indexOf(' opr/') > 0) {
            verTag = 'opr';
        }
        else if (useragent.indexOf(' opt/') > 0) {
            verTag = 'opt';
        }
        browser = 'Opera';
    }
    else if (useragent.indexOf(' dragon/') > 0) {
        icon = 'dragon.png';
        browser = 'Comodo Dragon';
        verTag = 'Dragon';
    }
    else if (useragent.indexOf('vivaldi') > 0) {
        browser = 'Vivaldi';
    }
    else if (useragent.indexOf('maxthon') > 0) {
        browser = 'Maxthon';
    }
    else if (useragent.indexOf(' electron/') > 0) {
        browser = 'Electron';
    }
    else if (useragent.indexOf('palemoon') > 0) {
        browser = 'Palemoon';
    }
    else if (useragent.indexOf('cyberfox') > 0) {
        browser = 'Cyberfox';
    }
    else if (useragent.indexOf('waterfox') > 0) {
        browser = 'Waterfox';
    }
    else if (useragent.indexOf('iceweasel') > 0) {
        browser = 'Iceweasel';
    }
    else if (useragent.indexOf('seamonkey') > 0) {
        browser = 'SeaMonkey';
    }
    else if (useragent.indexOf('lunascape') > 0) {
        browser = 'Lunascape';
    }
    else if (useragent.indexOf(' iron/') > 0) {
        browser = 'Iron';
    }
    else if (useragent.indexOf(' superbird/') > 0) {
        browser = 'Superbird';
    }
    else if (useragent.indexOf('avant browser') > 0) {
        browser = 'Avant';
    }
    else if (useragent.indexOf('polarity') > 0) {
        browser = 'Polarity';
    }
    else if (useragent.indexOf('k-meleon') > 0) {
        browser = 'K-Meleon';
    }
    else if (useragent.indexOf(' edga/') > 0) {
        os = 'Android';
        browser = 'Edge';
        details.brand = verTag = 'EdgA';
    }
    else if (useragent.indexOf(' edgw/') > 0) {
        browser = 'Edge';
        details.brand = verTag = 'EdgW';
    }
    else if (useragent.indexOf(' edgios') > 0) {
        browser = 'Edge';
        details.brand = verTag = 'EdgiOS';
    }
    else if (useragent.indexOf(' crios') > 0) {
        browser = 'Chrome';
        details.brand = verTag = 'CriOS';
    }
    else if (useragent.indexOf(' opios') > 0) {
        browser = 'Opera';
        details.brand = verTag = 'OPiOS';
    }
    else if (useragent.indexOf(' fxios') > 0) {
        browser = 'Firefox';
        details.brand = verTag = 'FxiOS';
    }
    else if (useragent.indexOf('ucbrowser') > 0) {
        browser = 'UCBrowser';
    }
    else if (useragent.indexOf('windvane') > 0) {
        browser = 'WindVane';
    }
    else if (useragent.indexOf('yabrowser') > 0) {
        browser = 'YaBrowser';
    }
    else if (useragent.indexOf('yasearchbrowser') > 0) {
        browser = 'YaBrowser';
        verTag = 'YaSearchBrowser';
    }
    else if (useragent.indexOf('miuibrowser') > 0) {
        verTag = 'XiaoMi/MiuiBrowser';
        browser = 'MiuiBrowser';
    }
    else if (useragent.indexOf('puffin/') > 0) {
        browser = 'Puffin';
    }
    else if (useragent.indexOf(' mcent/') > 0) {
        browser = 'mCent';
    }
    else if (useragent.indexOf(' avast/') > 0 || useragent.indexOf(' asw/') > 0) {
        if (useragent.indexOf(' asw/') > 0) {
            verTag = 'ASW';
        }
        browser = 'Avast';
    }
    else if (useragent.indexOf(' vivobrowser/') > 0) {
        browser = 'VivoBrowser';
    }
    else if (useragent.indexOf(' alohabrowser/') > 0) {
        browser = 'AlohaBrowser';
    }
    else if (useragent.indexOf('qqbrowser/') > 0) {
        browser = 'QQBrowser';
    }
    else if (useragent.indexOf(' whale/') > 0) {
        browser = 'Whale';
    }
    else if (useragent.indexOf('coc_coc_browser') > 0) {
        browser = 'Coc';
        icon = 'coc.png';
        verTag = 'coc_coc_browser';
    }
    else if (useragent.indexOf('maxbrowser') > 0) {
        icon = 'max.png';
        browser = 'MaxBrowser';
    }
    else if (useragent.indexOf(' kik/') === 0) {
        browser = 'Kik';
    }
    else if (useragent.indexOf(' silk/') > 0) {
        browser = 'Silk';
    }
    else if (useragent.indexOf(' soul/') > 0) {
        browser = 'Soul';
    }
    else if (useragent.indexOf(' stargon/') > 0) {
        browser = 'Stargon';
    }
    else if (useragent.indexOf(' sleipnir/') > 0) {
        browser = 'Sleipnir';
    }
    else if (useragent.indexOf(' tenta/') > 0) {
        browser = 'Tenta';
    }
    else if (useragent.indexOf(' quark/') > 0) {
        browser = 'Quark';
    }
    else if (useragent.indexOf(' falkon/') > 0) {
        browser = 'Falkon';
    }
    else if (useragent.indexOf('qtwebengine') > 0) {
        icon = 'qtweb.png';
        browser = 'QtWebEngine';
    }
    else if (useragent.indexOf('jiosphere/') > 0
        || useragent.indexOf('jiopages/') > 0) {

        browser = 'JioSphere';
    }
    else if (useragent.indexOf(' rddocuments/') > 0) {
        icon = 'rdd.png';
        browser = 'Documents 5 App';
    }
    else if (useragent.indexOf(' canvasframe/') > 0) {
        icon = 'canvas.png';
        browser = 'CanvasFrame';
    }
    else if (useragent.indexOf('huaweibrowser') > 0) {
        icon = 'huaw.png';
        browser = 'HuaweiBrowser';
    }
    else if (useragent.indexOf('heytapbrowser') > 0) {
        icon = 'hey.png';
        browser = 'HeyTapBrowser';
    }
    else if (useragent.indexOf(' [fb') > 0
        || useragent.indexOf(' steam ') > 0
        || useragent.indexOf(' eve-') > 0
        || useragent.indexOf(' zalo') > 0
        || useragent.indexOf(' kik/') > 0
        || useragent.indexOf(' gsa/') > 0
        || useragent.indexOf('yjapp') > 0
        || useragent.indexOf('talk/') > 0
        || useragent.indexOf('(inapp') > 0
        || useragent.indexOf('webview') > 0
        || useragent.indexOf('akaotalk') > 0
        || useragent.indexOf('inkedina') > 0
        || useragent.indexOf('adfitsdk/') > 0
        || useragent.indexOf('messenger') > 0
        || useragent.indexOf('ok.katana;') > 0
        || useragent.indexOf('bingsapphire') > 0
        || useragent.indexOf('twit' + 'ter') > 0
        || useragent.indexOf('cros' + 'swalk') > 0
        || useragent.indexOf('snap' + 'chat') > 0
        || useragent.indexOf('pint' + 'erest') > 0
        || useragent.indexOf('inst' + 'agram') > 0) {

        icon = 'app.png';
        browser = 'In-App WebView';

        if (useragent.indexOf(' [fb') > 0) {
            verSep = ';';
            verTag = 'FBAV';
        }
        else if (useragent.indexOf(' gsa/') > 0) {
            verTag = 'GSA';
            browser = 'Google Search App';
        }

        details.brand = os === 'Android' ? 'Chrome' : 'Safari';
    }
    else if (useragent.indexOf(' line/') > 0) {
        browser = 'Line';
    }
    else if (useragent.indexOf(' chromium/') > 0) {
        browser = 'Chromium';
    }
    else if (useragent.indexOf('chrome') > 0) {
        browser = 'Chrome';
    }
    else if (useragent.indexOf('safari') > 0) {
        verTag = 'Version';
        browser = os === 'Android' || os === 'Linux' ? null : 'Safari';
    }
    else if (useragent.indexOf('firefox') > 0) {
        browser = 'Firefox';
    }
    else if (useragent.indexOf(' otter/') > 0) {
        browser = 'Otter';
    }
    else if (useragent.indexOf('thunderbird') > 0) {
        browser = 'Thunderbird';
    }
    else if (useragent.indexOf('es plugin ') === 1) {
        icon = 'esplugin.png';
        browser = 'ES File Explorer';
    }
    else if (useragent.indexOf('megasync') > 0) {
        icon = 'mega.png';
        browser = 'Desktop app';
    }
    else if (useragent.indexOf('megacmd') > 0) {
        icon = 'mega.png';
        browser = 'MEGAcmd';
    }
    else if (useragent.indexOf(' megaandroid/') === 0 || useragent.indexOf(' megaios/') === 0) {
        icon = 'mega.png';
        browser = 'MEGA App';
    }
    else if (useragent.indexOf('msie') > 0
        || useragent.indexOf('trident') > 0) {
        browser = 'Internet Explorer';
    }
    else if (useragent.indexOf('megavpn/') > 0) {
        icon = 'mega.png';
        browser = 'MEGA VPN';
    }
    else if (useragent.indexOf('://') > 0) {
        icon = 'bot.png';
        os = os || 'Linux';
        browser = 'Crawler';
    }
    else if (useragent.startsWith(' mozilla')) {
        const guess = String(origUA)
            .replace(/\([^)]+\)/g, '')
            .split(/\s+/)
            .filter((s) => /^\w{3,9}\/\d+\.\d/.test(s))
            .pop();

        if (guess && !guess.includes('Mozilla')) {
            browser = guess.split('/').shift();
            details.wild = true;
            icon = 'unknown.png';
        }
    }
    else if (/^[\sa-z]+\/\d/.test(useragent)) {
        verSep = '^';
        browser = String(origUA).split('/').shift().trim();
        details.wild = true;
        icon = 'unknown.png';
    }

    if (browser === 'Edgium') {
        icon = 'edgium.png';
        verTag = verTag || 'Chrome';
        displayName = 'Edge (Chromium)';
    }
    else if (verTag === 'EdgW') {
        icon = 'edgium.png';
        displayName = 'Edge (WebView)';
    }

    // Translate "%1 on %2" to "Chrome on Windows"
    if ((os) && (browser)) {
        name = (brand || browser) + ' on ' + os;
        nameTrans = String(l && l[7684]).replace('%1', displayName || brand || browser).replace('%2', os);
    }
    else if (os) {
        name = os;
        icon = icon || (os.toLowerCase() + '.png');
    }
    else if (browser) {
        name = browser;
        nameTrans = displayName || name;
    }
    else {
        name = 'Unknown';
        icon = 'unknown.png';
    }

    if (!icon && browser) {
        if (browser === 'Internet Explorer') {
            icon = 'ie.png';
        }
        else {
            icon = browser.toLowerCase() + '.png';
        }
    }

    if (browser === null && os === 'Android') {
        icon = 'android.png';
        name = browser = 'Android Browser';
    }

    details.name = name;
    details.nameTrans = nameTrans || name;
    details.icon = icon;
    details.os = os || '';
    details.browser = browser;
    details.version =
        (useragent.match(RegExp(verSep + (verTag || brand || browser) + "/([\\d.]+)", 'i')) || [])[1] || 0;

    // Determine if the OS is 64bit
    details.is64bit = /\b(WOW64|x86_64|Win64|intel mac os x 10.(9|\d{2,}))/i.test(useragent);

    // Determine if using a browser extension
    details.isExtension = (current && is_extension || useragent.indexOf('megext') > -1);

    // Determine device is ARM machine
    details.isARM = /\barmv?[4-8]+l?\b/.test(useragent);

    if (useragent.indexOf(' MEGAext/') !== -1) {
        var ver = useragent.match(/ MEGAext\/([\d.]+)/);

        details.isExtension = ver && ver[1] || true;
    }

    if (brand) {
        details.brand = brand;
    }

    // Determine core engine.
    if (browser === 'Edge') {
        details.engine = 'EdgeHTML';
    }
    else if (useragent.indexOf('webkit') > 0) {
        details.engine = 'Webkit';
        details.blink = useragent.match(/\bchrom[eium]+\/(\d+(?:\.\d+)?)/);
        if (details.blink) {
            details.engine = 'Blink';
            details.blink = String(details.blink[1] || '').replace(/\.0+$/, '');
        }
    }
    else if (useragent.indexOf('trident') > 0) {
        details.engine = 'Trident';
    }
    else if (useragent.indexOf('gecko') > 0) {
        details.engine = 'Gecko';
    }
    else if (useragent.indexOf('presto') > 0) {
        details.engine = 'Presto';
    }
    else {
        details.engine = 'Unknown';
    }

    // Product info to quickly access relevant info.
    details.prod = details.name + ' [' + details.engine + ']'
        + (details.brand ? '[' + details.brand + ']' : '')
        + '[' + details.version + ']'
        + (details.isExtension ? '[E:' + details.isExtension + ']' : '')
        + '[' + (details.is64bit ? 'x64' : 'x32') + ']';

    return details;
}

/**
 * Highlights some text inside an element as if you had selected it with the mouse
 * From http://stackoverflow.com/a/987376
 * @param {String} elementId The name of the id
 */
function selectText(elementId) {
    'use strict';
    var range;
    var selection;
    var text = document.getElementById(elementId);

    if (document.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(text);
        range.select();
    }
    else if (window.getSelection) {
        selection = window.getSelection();
        range = document.createRange();
        range.selectNodeContents(text);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

/**
 * Copy the provided content to the clipboard.
 * @param {String} content The content to copy to the clipboard
 * @param {String} [toastText] Optional toast notification message
 * @param {String} [classname] Optional toast notification addition classname
 * @param {Number} [timeout] Optional toast notification time (millis) until dismiss
 * @returns {Boolean} Whether the operation was successful
 */
function copyToClipboard(content, toastText, classname, timeout) {
    'use strict';
    const success = clip(content);

    if (success && toastText) {

        showToast(classname || 'clipboard', toastText, "", "", null, null, timeout);
    }

    return success;
}

/**
 * @file Helper functions involving conversion and extraction.
 */

(function(global) {
    "use strict";

    var array = Object.create(null);
    array.to = Object.create(null);

    /**
     * Convert Array to Object
     * @param {Array|String} input The input array, or string
     * @param {*} [value] Optional value to assign to objects
     * @returns {Object}
     */
    array.to.object = function(input, value) {
        if (!Array.isArray(input)) {
            input = [input];
        }
        return input.reduce(function(obj, key, idx) {
            obj[key] = value !== undefined ? value : (idx | 0) + 1;
            return obj;
        }, Object.create(null));
    };

    /**
     * Get a random value from an array
     * @param {Array} input The input array
     * @memberOf array
     */
    array.random = function(input) {
        return input[rand(input.length)];
    };

    /**
     * Get an array with unique values
     * @param {Array} input The input array
     * @memberOf array
     */
    array.unique = function(input) {
        return [...new Set(input)];
    };

    /**
     * Remove an element from an array
     * @param {Array} input The input array
     * @param {*} value The value to remove
     * @param {Boolean} [can_fail] Whether the value might not be in the array
     * @returns {Boolean} whether the value was removed
     * @memberOf array
     */
    array.remove = function(input, value, can_fail) {
        var idx = input.indexOf(value);
        if (d) {
            if (!(can_fail || idx !== -1)) {
                console.warn('Unable to Remove Value ' + value, value);
            }
        }
        if (idx !== -1) {
            input.splice(idx, 1);
        }
        return idx !== -1;
    };

    /**
     * Pick one array value not matching with needle
     * @param {Array} input array
     * @param {*} needle the
     * @returns {*} first non-matching needle
     */
    array.one = function(input, needle) {
        for (var i = input.length; i--;) {
            if (input[i] !== needle) {
                return input[i];
            }
        }
        return false;
    };

    /**
     * Pack an array into a serialized string, usually shorter than JSON.stringify()'ed
     * @param {Array} input The input array
     * @param {Boolean} [enc] Encode each value using base64
     * @returns {String}
     * @memberOf array
     */
    array.pack = function(input, enc) {
        var s = [];
        var ilen = d && JSON.stringify(input).length;

        if (enc) {
            input = input.map(base64urlencode);
        }

        // find pairs of repetitions
        for (var n = 0; n < input.length; n++) {
            var p = n;

            if (input[n] !== input[n + 1]) {
                while (input[n] === input[p + 2] && input[n + 1] === input[p + 3]) {
                    s.push(input[n] + '>' + input[n + 1]);
                    p += 2;
                }
            }

            if (p === n) {
                s.push(input[n]);
            }
            else {
                s.push(input[n] + '>' + input[n + 1]);
                n = p + 1;
            }
        }
        input = s;

        // shrink repetitions
        var result = input.reduce(function(o, v) {
            var k = String(o[o.length - 1]).split('*');
            if (k[0] === v) {
                o[o.length - 1] = k[0] + '*' + (Math.max(k[1] | 0, 1) + 1);
            }
            else {
                o.push(v);
            }
            return o;
        }, []).join(',');

        if (d) {
            console.debug('array.pack saved %s bytes (%s%)',
                ilen - result.length,
                100 - Math.round(result.length * 100 / ilen));
        }

        return result;
    };


    /**
     * Unpack a previously serialized array
     * @param {String} input The serialized array
     * @param {Boolean} [dec] Whether the values were encoded using base64
     * @returns {Array}
     * @memberOf array
     */
    array.unpack = function(input, dec) {
        var result = input.split(',').reduce(function(o, v) {
            if (String(v).indexOf('*') >= 0) {
                v = v.split('*');

                if (String(v[0]).indexOf('>') >= 0) {
                    var k = v[0].split('>');

                    for (var j = v[1] | 0; j--;) {
                        o.push(k[0]);
                        o.push(k[1]);
                    }
                }
                else {
                    for (var g = v[1] | 0; g--;) {
                        o.push(v[0]);
                    }
                }
            }
            else {
                o.push(v);
            }
            return o;
        }, []);

        if (dec) {
            result = result.map(base64urldecode);
        }

        return result;
    };

    /**
     * Like array.remove, but would clone the array and return the array with the `val` removed (if exists)
     *
     * @param {Array} arr
     * @param {String|Number} val
     * @returns {Array}
     */
    array.filterNonMatching = function(arr, val) {
        "use strict";
        var arrWithoutVal = [].concat(arr);
        this.remove(arrWithoutVal, val, 1);
        return arrWithoutVal;
    };


    /**
     * Compare to arrays and return a diff ({'removed': [...], 'added': [...]}) object
     *
     * @param {Array} old_arr
     * @param {Array} new_arr
     * @returns {{removed, added}}
     */
    array.diff = function(old_arr, new_arr) {
        return {
            'removed': old_arr.filter(function(v) { return new_arr.indexOf(v) < 0; }),
            'added': new_arr.filter(function(v) { return old_arr.indexOf(v) < 0; }),
        };
    };


    /**
     * Array helper functions.
     * @name array
     */
    Object.defineProperty(global, 'array', {value: Object.freeze(array)});

})(self);

/**
 * Retrieve object/array values
 * @param {Object|Array} obj The input object
 * @returns {Array}
 */
var obj_values = function obj_values(obj) {
    "use strict";

    var vals = [];
    Object.keys(obj).forEach(function(memb) {
        if (typeof obj.hasOwnProperty !== 'function' || obj.hasOwnProperty(memb)) {
            vals.push(obj[memb]);
        }
    });

    return vals;
};

if (typeof Object.values === 'function') {
    obj_values = Object.values;
}
else {
    Object.values = obj_values;
}

function oDestroy(obj) {
    'use strict';

    if (d && Object.isFrozen(obj)) {
        console.warn('Object already frozen...', obj);
    }

    Object.keys(obj).forEach(function(memb) {
        if (obj.hasOwnProperty(memb)) {
            delete obj[memb];
        }
    });

    if (!oIsFrozen(obj) && Object.isExtensible(obj)) {
        Object.defineProperty(obj, ":$:frozen:", {
            value: String(new Date()),
            writable: false
        });
    }

    if (d) {
        Object.freeze(obj);
    }
}

function oIsFrozen(obj) {
    'use strict';
    return obj && typeof obj === 'object' && obj.hasOwnProperty(":$:frozen:");
}

/**
 * Convert hexadecimal string to binary
 * @param {String} hex The input string
 * @returns {String}
 */
function hex2bin(hex) {
    "use strict";

    var bytes = [];
    for (var i = 0; i < hex.length - 1; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }

    return String.fromCharCode.apply(String, bytes);
}


(function uh64(global) {
    'use strict';

    function getInt32(data, offset) {
        return data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 | data[offset + 3] << 24;
    }

    function makeClass(o) {
        return {value: Object.create(null, Object.getOwnPropertyDescriptors(o))};
    }

    /**
     * Helper to deal with user-handles as int64_t (ala SDK)
     * @param {String} aUserHandle The 11 chars long user handle
     * @constructor
     * @global
     */
    function UH64(aUserHandle) {
        if (!(this instanceof UH64)) {
            return new UH64(aUserHandle);
        }

        try {
            this.buffer = new Uint8Array(base64_to_ab(aUserHandle), 0, 8);
            this.lo = getInt32(this.buffer, 0);
            this.hi = getInt32(this.buffer, 4);
        }
        catch (ex) {}
    }

    Object.defineProperty(UH64, 'prototype', makeClass({
        constructor: UH64,
        mod: function mod(n) {
            var r = 0;
            var b = 64;

            if (!this.buffer) {
                return false;
            }

            while (b--) {
                r <<= 1;
                r |= (b < 32 ? this.lo >>> b : this.hi >>> b - 32) & 1;
                if (r >= n) {
                    r = r + ~n + 1 | 0;
                }
            }

            return r;
        }
    }));

    global.UH64 = UH64;

})(self);

(() => {
    'use strict';
    /**
     * Utility functions to convert ufs-node's handles from/to their decimal number representation.
     */

    Object.defineProperties(mega, {
        hton: {
            value(h, pad = 15) {
                let res = 0;

                for (let s = base64urldecode(h), i = s.length; i--;) {
                    res = res * 256 + s.charCodeAt(i);
                }
                return pad ? String(res).padStart(pad, '0') : res;
            }
        },
        ntoh: {
            value(n) {
                let s = '';
                while (n > 1) {
                    s += String.fromCharCode(n & 255);
                    n /= 256;
                }
                return base64urlencode(s);
            }
        }
    });

})();


/**
 * Instantiates an enum-like list on the provided target object
 */
function makeEnum(aEnum, aPrefix, aTarget, aNorm) {
    'use strict';

    aTarget = aTarget || {};

    var len = aEnum.length;
    while (len--) {
        Object.defineProperty(aTarget,
            (aPrefix || '') + String(aEnum[len]).toUpperCase(), {
                value: aNorm ? len : (1 << len),
                enumerable: true
            });
    }
    return aTarget;
}

/** Key ring holding own private keys. */
var u_keyring;

/** Own private Ed25519 key. */
var u_privEd25519;

/** Own public Ed25519 key. */
var u_pubEd25519;

/** Cache for contacts' public Ed25519 keys. */
var pubEd25519 = {};

/** Own private Curve25519 key. */
var u_privCu25519;

/** Own public Curve25519 key. */
var u_pubCu25519;

/** Cache for contacts' public Curve25519 keys. */
var pubCu25519 = {};

var crypt = (function() {
    "use strict";

    // Disables warnings for explicit initialisation with `undefined`.
    /* jshint -W080 */

    /**
     * @description
     * Cryptography related functionality.
     *
     * Note: A namespace naming of `crypto` leads to collisions, probably with
     *       the default WebCrypto namespace. Therefore the name `crypt` only.
     */
    var ns = {};
    var logger = MegaLogger.getLogger('crypt');
    ns._logger = logger;

    // TODO: Eventually migrate all functionality into this name space.

    /** Mapping of public key types to their attribute names. */
    ns.PUBKEY_ATTRIBUTE_MAPPING = {
        Ed25519: 'puEd255',
        Cu25519: 'puCu255',
        RSA: null
    };

    /** Mapping of private key types to their attribute names in the keyring. */
    ns.PRIVKEY_ATTRIBUTE_MAPPING = {
        Ed25519: 'prEd255',
        Cu25519: 'prCu255',
        RSA: null
    };

    /** Mapping of public key types to their signature attribute names. */
    ns.PUBKEY_SIGNATURE_MAPPING = {
        Cu25519: 'sigCu255',
        RSA: 'sigPubk'
    };

    /** Maps the storage variable for a public key type. */
    ns.PUBKEY_VARIABLE_MAPPING = {
        Ed25519: 'u_pubEd25519',
        Cu25519: 'u_pubCu25519',
        RSA: null
    };

    /** Maps the storage variable for a private key type. */
    ns.PRIVKEY_VARIABLE_MAPPING = {
        Ed25519: 'u_privEd25519',
        Cu25519: 'u_privCu25519',
        RSA: 'u_privk'
    };

    /**
     * Returns the cache variable for a public key type.
     *
     * @param keyType {string}
     *     Key type of pub key. Can be one of 'Ed25519', 'Cu25519' or 'RSA'.
     * @return {Object}
     *     The cache variable object.
     */
    ns.getPubKeyCacheMapping = function(keyType) {
        switch (keyType) {
            case 'Ed25519':
                return pubEd25519;
            case 'Cu25519':
                return pubCu25519;
            case 'RSA':
                return u_pubkeys;
        }
    };

    // getPubKeyAttribute's async/await helper
    ns.getRSAPubKeyAttribute = function(user, type = 'RSA') {
        return new Promise((resolve, reject) => {
            this.getPubKeyAttribute(user, type)
                .done((meh, [res]) => resolve(res))
                .fail((ex) => reject(ex));
        });
    };

    /**
     * Retrieves a users' pub keys through the Mega API.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param keyType {string}
     *     Key type of pub key. Can be one of 'Ed25519', 'Cu25519' or 'RSA'.
     * @param [userData] {string}
     *     Optional argument, any provided data will be passed to the fullfiled promise.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     */
    ns.getPubKeyAttribute = function(userhandle, keyType, userData) {
        // According to doShare() this can be an email for RSA keyType
        if (keyType !== 'RSA' || String(userhandle).indexOf('@') < 1) {
            assertUserHandle(userhandle);
        }
        if (typeof ns.PUBKEY_ATTRIBUTE_MAPPING[keyType] === 'undefined') {
            throw new Error('Unsupported key type to retrieve: ' + keyType);
        }

        // Make the promise to execute the API code.
        var masterPromise = new MegaPromise();

        if (keyType === 'RSA') {
            let fromCache = true;
            const cacheKey = `${userhandle}_@uk`;

            /** Function to settle the promise for the RSA pub key attribute. */
            const __settleFunction = function(res) {
                if (typeof res === 'object' && res.pubk) {

                    var debugUserHandle = userhandle;
                    if (userhandle !== res.u) {
                        debugUserHandle += ' (' + res.u + ')';
                    }

                    var pubKey = crypto_decodepubkey(base64urldecode(res.pubk));

                    // cache it, the legacy way.
                    u_pubkeys[userhandle] = u_pubkeys[res.u] = pubKey;

                    if (d > 1 || is_karma) {
                        logger.debug('Got ' + keyType + ' pub key of user ' + debugUserHandle);
                    }

                    if (!fromCache && attribCache) {
                        const cacheData = JSON.stringify(res);

                        // if an email was provided, cache it using the user-handle
                        if (String(userhandle).indexOf('@') > 0) {
                            attribCache.setItem(`${res.u}_@uk`, cacheData);
                        }

                        attribCache.setItem(cacheKey, cacheData);
                    }

                    masterPromise.resolve(pubKey, [res, userData]);
                }
                else {
                    if (d > 1 || is_karma || userhandle === window.u_handle) {
                        logger.warn(keyType + ' pub key for ' + userhandle + ' could not be retrieved: ' + res);
                    }

                    if (!fromCache && res === ENOENT) {
                        attribCache.setItem(cacheKey, JSON.stringify({error: res, ts: Date.now() + 3e4}));
                    }

                    masterPromise.reject(res, [res, userData]);
                }
            };

            if (window.is_karma) {
                // @todo fix'em..
                attribCache.getItem(cacheKey);
                api_req({a: 'uk', u: userhandle}, {u: userhandle, callback: __settleFunction});
            }
            else if (Object(window.u_attr).u === userhandle) {
                __settleFunction({u: u_attr.u, pubk: u_attr.pubk});
            }
            else {
                attribCache.getItem(cacheKey)
                    .then((res) => {
                        res = JSON.parse(res);

                        if (res.error) {
                            if (Date.now() > res.ts) {
                                // expired
                                attribCache.removeItem(cacheKey);
                                throw res.error;
                            }
                            res = res.error;
                        }

                        __settleFunction(res);
                    })
                    .catch(() => {
                        fromCache = false;
                        api.req({a: 'uk', u: userhandle})
                            .then(({result}) => __settleFunction(result))
                            .catch(__settleFunction);
                    });

            }
        }
        else {
            var pubKeyPromise = userData && userData.chatHandle ?
                    mega.attr.get(userhandle, ns.PUBKEY_ATTRIBUTE_MAPPING[keyType], true, false,
                        undefined, undefined, userData.chatHandle) :
                    mega.attr.get(userhandle, ns.PUBKEY_ATTRIBUTE_MAPPING[keyType], true, false);

            pubKeyPromise.done(function(result) {
                result = base64urldecode(result);
                ns.getPubKeyCacheMapping(keyType)[userhandle] = result;
                if (d > 1) {
                    logger.debug('Got ' + keyType + ' pub key of user ' + userhandle + '.');
                }
                masterPromise.resolve(result);
            });
            masterPromise.linkFailTo(pubKeyPromise);
        }

        return masterPromise;
    };


    /**
     * Checks the integrity (through the authring) of users' pub keys and
     * returns the authentication method used for that key.
     *
     * @private
     * @param userhandle {String}
     *     Mega user handle.
     * @param pubKey {(String|Array)}
     *     Public key in the form of a byte string or array (RSA keys).
     * @param keyType {String}
     *     Key type of pub key. Can be one of 'Ed25519', 'Cu25519' or 'RSA'.
     * @return {Number}
     *     Authentication record, `null` if not recorded, and `false`
     *     if fingerprint verification fails.
     */
    ns._getPubKeyAuthentication = function(userhandle, pubKey, keyType) {
        var recorded = authring.getContactAuthenticated(userhandle, keyType);
        if (recorded === false) {
            return null;
        }

        var fingerprint = authring.computeFingerprint(pubKey, keyType, 'string');
        if (recorded && authring.equalFingerprints(recorded.fingerprint, fingerprint) === false) {

            logger.warn('Error verifying authenticity of ' + keyType + ' pub key: '
                + 'fingerprint does not match previously authenticated one!');

            return false;
        }

        return recorded.method;
    };


    /**
     * Verifies a public key signature.
     *
     * @private
     * @param signature {string}
     *     Signature string.
     * @param pubKey {string}
     *     Public key to verify.
     * @param keyType {string}
     *     Key type of pub key. Can be one of 'Cu25519' or 'RSA'.
     * @param signingKey {string}
     *     Ed25519 key needed to verify the signature.
     * @return {MegaPromise}
     *     The signature verification result. true for success, false for
     *     failure and null for a missing signature.
     */
    ns._checkSignature = function(signature, pubKey, keyType, signingKey) {
        if (signature === '') {
            return MegaPromise.resolve(null);
        }

        return authring.verifyKey(signature, pubKey, keyType, signingKey);
    };


    /**
     * Used for caching .getPubKey requests which are in progress (by reusing MegaPromises)
     */
    ns._pubKeyRetrievalPromises = {};

    ns.getPubKeyViaChatHandle = function(userhandle, keyType, chathandle, callback) {
        // This promise will be the one which is going to be returned.
        var masterPromise = new MegaPromise();
        // Some things we need to progress.
        var pubKeyCache = ns.getPubKeyCacheMapping(keyType);
        var authMethod;
        var newAuthMethod;

        /** If a callback is passed in, ALWAYS call it when the master promise
         * is resolved. */
        var __callbackAttachAfterDone = function(aPromise) {
            if (callback) {
                aPromise.done(function __classicCallback(result) {
                    logger.debug('Calling callback');
                    callback(result);
                });
            }
        };
        // Get out quickly if the key is cached.
        if (pubKeyCache[userhandle]) {
            masterPromise.resolve(pubKeyCache[userhandle]);
            __callbackAttachAfterDone(masterPromise);

            return masterPromise;
        }

        // And now for non-cached keys.

        /** Persist potential changes in authentication, call callback and exit. */
        var __finish = function(pubKey, authMethod, newAuthMethod) {
            __callbackAttachAfterDone(masterPromise);

            return masterPromise;
        };

        // Get the pub key and update local variable and the cache.
        var getPubKeyPromise = ns.getPubKeyAttribute(userhandle, keyType, {'chatHandle': chathandle});

        getPubKeyPromise.done(function __resolvePubKey(result) {
            var pubKey = result;
            pubKeyCache[userhandle] = pubKey;
            masterPromise.resolve(pubKey);

                // Finish off.
                __finish(pubKey, authMethod, newAuthMethod);
        });
        masterPromise.linkFailTo(getPubKeyPromise);
        return masterPromise;
    };
    /**
     * Caching public key retrieval utility.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param keyType {string}
     *     Key type of pub key. Can be one of 'Ed25519', 'Cu25519' or 'RSA'.
     * @param callback {function}
     *     Callback function to call upon completion of operation. The
     *     callback requires two parameters: `value` (an object
     *     containing the public in `pubkey` and its authencation
     *     state in `authenticated`). `value` will be `false` upon a
     *     failed request.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is
     *     settled.  Can be used to use promises instead of callbacks
     *     for asynchronous dependencies.
     */
    ns.getPubKey = function(userhandle, keyType, callback) {
        if (keyType !== 'RSA' || String(userhandle).indexOf('@') < 1) {
            assertUserHandle(userhandle);
        }

        let ignoreCache = false;
        if (callback === true) {
            ignoreCache = true;
            callback = null;
        }

        // if there is already a getPubKey request in progress, return it, instead of creating a brand new one
        if (ns._pubKeyRetrievalPromises[userhandle + "_" + keyType]) {
            var promise = ns._pubKeyRetrievalPromises[userhandle + "_" + keyType];
            if (callback) {
                promise.done(function(res) {
                    callback(res);
                });
            }
            return promise;
        }
        // This promise will be the one which is going to be returned.
        var masterPromise = new MegaPromise();

        // manage the key retrieval cache during the request is being processed
        ns._pubKeyRetrievalPromises[userhandle + "_" + keyType] = masterPromise;

        // and then clean it up after the request is done.
        masterPromise.always(function() {
            delete ns._pubKeyRetrievalPromises[userhandle + "_" + keyType];
        });

        /** If a callback is passed in, ALWAYS call it when the master promise
         * is resolved. */
        var __callbackAttachAfterDone = function(aPromise) {
            if (callback) {
                aPromise.done(function __classicCallback(result) {
                    logger.debug('Calling callback');
                    callback(result);
                });
            }
        };

        if (!is_chatlink && (authring.hadInitialised() === false || typeof u_authring === 'undefined')) {
            // Need to initialise the authentication system (authring).
            if (d > 1) {
                logger.debug('Waiting for authring to initialise first.', 'Tried to access: ', userhandle, keyType);
            }

            var authringLoadingPromise = authring.initAuthenticationSystem();
            masterPromise.linkFailTo(authringLoadingPromise);

            // Now, with the authring loaded, link recursively to getPubKey again.
            authringLoadingPromise.done(function() {
                var tmpPromise;
                // if already cached, swap the request promise!
                if (ns._pubKeyRetrievalPromises[userhandle + "_" + keyType]) {
                    tmpPromise = ns._pubKeyRetrievalPromises[userhandle + "_" + keyType];
                    delete ns._pubKeyRetrievalPromises[userhandle + "_" + keyType];
                }

                var newPromise = ns.getPubKey(userhandle, keyType, ignoreCache);

                if (tmpPromise) {
                    tmpPromise.linkDoneAndFailTo(newPromise);
                }

                masterPromise.linkDoneAndFailTo(newPromise);
            });
            __callbackAttachAfterDone(masterPromise);

            return masterPromise;
        }

        // Some things we need to progress.
        var pubKeyCache = ns.getPubKeyCacheMapping(keyType);
        var authMethod;
        var newAuthMethod;
        var fingerprint;

        // Get out quickly if the key is cached.
        if (!ignoreCache && pubKeyCache[userhandle]) {
            masterPromise.resolve(pubKeyCache[userhandle]);
            __callbackAttachAfterDone(masterPromise);

            return masterPromise;
        }

        // And now for non-cached keys.

        /** Persist potential changes in authentication, call callback and exit. */
        var __finish = function(pubKey, authMethod, newAuthMethod) {
            if (typeof newAuthMethod !== 'undefined' && newAuthMethod !== authMethod) {
                authring.setContactAuthenticated(userhandle, fingerprint, keyType,
                    newAuthMethod, authring.KEY_CONFIDENCE.UNSURE);
            }
            __callbackAttachAfterDone(masterPromise);

            return masterPromise;
        };

        // Get the pub key and update local variable and the cache.
        var getPubKeyPromise = ns.getPubKeyAttribute(userhandle, keyType);

        // 2020-03-31: nowadays there is no point on verifying non-contacts...
        // 2023-03-09: let's think that twice...
        var isNonContact = !is_karma && M.getUserByHandle(userhandle).c !== 1;
        if (isNonContact) {
            const seen = d && authring.getContactAuthenticated(userhandle, keyType);

            if (d && !seen || d > 2) {
                logger.warn('Performing %s verification for non-contact "%s"', keyType, userhandle);
            }
        }

        getPubKeyPromise.done(function __resolvePubKey(result) {
            var pubKey = result;
            authMethod = ns._getPubKeyAuthentication(userhandle, pubKey, keyType);
            fingerprint = authring.computeFingerprint(pubKey, keyType, 'string');
            if (keyType === 'Ed25519') {
                // Treat Ed25519 pub keys.
                if (authMethod === false) {
                    // Something is dodgy: Choke!
                    var authRecord = authring.getContactAuthenticated(userhandle, keyType);
                    ns._showFingerprintMismatchException(userhandle, keyType, authMethod,
                        authRecord.fingerprint,
                        fingerprint);
                    newAuthMethod = undefined;
                    masterPromise.reject(EINTERNAL);
                }
                else {
                    // Newly seen key, record it.
                    if (authMethod === null) {
                        newAuthMethod = authring.AUTHENTICATION_METHOD.SEEN;
                    }
                    pubKeyCache[userhandle] = pubKey;
                    masterPromise.resolve(pubKey);
                }

                // Finish off.
                __finish(pubKey, authMethod, newAuthMethod);
            }
        });

        // Get Ed25519 key and signature to verify for all non-Ed25519 pub keys.

        /**
         * Verify signature of signed pub keys.
         *
         * @param {Array} result  This is an array of arrays (`arguments`) for each
         *                        resolved promise as processed by MegaPromise.all()
         * @private
         */
        var __resolveSignatureVerification = function(result) {
            var pubKey = result[0];
            if (keyType === 'RSA') {
                // getPubKeyAttribute returned more than a single argument
                pubKey = pubKey[0];
            }
            var signingKey = result[1];
            var signature = base64urldecode(result[2]);
            ns._checkSignature(signature, pubKey, keyType, signingKey)
                .done(function(signatureVerification) {
                    if (authMethod === false) {
                        // Authring check fails, but could be a new key.
                        if (signatureVerification === true) {
                            // Record good (new) signature.
                            newAuthMethod = authring.AUTHENTICATION_METHOD.SIGNATURE_VERIFIED;
                            pubKeyCache[userhandle] = pubKey;
                            masterPromise.resolve(pubKey);
                        }
                        else {
                            // Mismatch on authring, but no new signature,
                            // or failed signature verification: Choke!
                            newAuthMethod = undefined;
                            ns._showKeySignatureFailureException(userhandle, keyType);
                            masterPromise.reject(EINTERNAL);
                        }
                    }
                    else {
                        // Not seen previously or not verified, yet.
                        if (signatureVerification === null) {
                            var authRecord = authring.getContactAuthenticated(userhandle, keyType);
                            if ((authRecord === false) || (fingerprint === authRecord.fingerprint)) {
                                // Can only record it seen.
                                newAuthMethod = authring.AUTHENTICATION_METHOD.SEEN;
                                pubKeyCache[userhandle] = pubKey;
                                masterPromise.resolve(pubKey);
                            }
                            else {
                                newAuthMethod = undefined;
                                ns._showFingerprintMismatchException(userhandle, keyType, authMethod,
                                    authRecord.fingerprint,
                                    fingerprint);
                                masterPromise.reject(EINTERNAL);
                            }
                        }
                        else if (signatureVerification === true) {
                            // Record good signature.
                            newAuthMethod = authring.AUTHENTICATION_METHOD.SIGNATURE_VERIFIED;
                            pubKeyCache[userhandle] = pubKey;
                            masterPromise.resolve(pubKey);
                        }
                        else {
                            // Failed signature verification: Choke!
                            ns._showKeySignatureFailureException(userhandle, keyType);
                        }
                    }

                    // Finish off.
                    __finish(pubKey, authMethod, newAuthMethod);
                });
        };

        if (keyType === 'Ed25519') {
            masterPromise.linkFailTo(getPubKeyPromise);
        }
        else {
            var pubEd25519KeyPromise = ns.getPubKey(userhandle, 'Ed25519', ignoreCache);
            var signaturePromise = mega.attr.get(userhandle, ns.PUBKEY_SIGNATURE_MAPPING[keyType], true, false);

            // Signing key and signature required for verification.
            var signatureVerificationPromise = MegaPromise.all([
                getPubKeyPromise,
                pubEd25519KeyPromise,
                signaturePromise
            ]);

            signatureVerificationPromise.done(__resolveSignatureVerification);
            masterPromise.linkFailTo(signatureVerificationPromise);
        }

        return masterPromise;
    };

    /**
     * Cached Ed25519 public key retrieval utility.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param callback {function}
     *     Callback function to call upon completion of operation. The
     *     callback requires two parameters: `value` (an object
     *     containing the public in `pubkey` and its authencation
     *     state in `authenticated`). `value` will be `false` upon a
     *     failed request.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is
     *     settled.  Can be used to use promises instead of callbacks
     *     for asynchronous dependencies.
     */
    ns.getPubEd25519 = function(userhandle, callback) {
        assertUserHandle(userhandle);
        return ns.getPubKey(userhandle, 'Ed25519', callback);
    };

    /**
     * Cached Ed25519 public key retrieval utility via chat handle.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param chathandle {string}
     *     Mega chat handle.
     * @param [callback] {function}
     *     Callback function to call upon completion of operation. The
     *     callback requires two parameters: `value` (an object
     *     containing the public in `pubkey` and its authencation
     *     state in `authenticated`). `value` will be `false` upon a
     *     failed request.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is
     *     settled.  Can be used to use promises instead of callbacks
     *     for asynchronous dependencies.
     */
    ns.getPubEd25519ViaChatHandle = function(userhandle, chathandle, callback) {
        assertUserHandle(userhandle);
        return ns.getPubKeyViaChatHandle(userhandle, 'Ed25519', chathandle, callback);
    };

    /**
     * Cached Curve25519 public key retrieval utility. If the key is cached, no API
     * request will be performed. The key's authenticity is validated through
     * the tracking in the authring and signature verification.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param [callback] {function}
     *     (Optional) Callback function to call upon completion of operation. The callback
     *     requires one parameter: the actual public Cu25519 key. The user handle is
     *     passed as a second parameter, and may be obtained that way if the call
     *     back supports it.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     *     The promise returns the Curve25519 public key.
     */
    ns.getPubCu25519 = function(userhandle, callback) {
        assertUserHandle(userhandle);
        return ns.getPubKey(userhandle, 'Cu25519', callback);
    };

    /**
     * Cached Curve25519 public key retrieval utility. If the key is cached, no API
     * request will be performed. The key's authenticity is validated through
     * the tracking in the authring and signature verification.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param chathandle {string}
     *     Mega chat handle.
     * @param [callback] {function}
     *     (Optional) Callback function to call upon completion of operation. The callback
     *     requires one parameter: the actual public Cu25519 key. The user handle is
     *     passed as a second parameter, and may be obtained that way if the call
     *     back supports it.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     *     The promise returns the Curve25519 public key.
     */
    ns.getPubCu25519ViaChatHandle = function(userhandle, chathandle, callback) {
        assertUserHandle(userhandle);
        return ns.getPubKeyViaChatHandle(userhandle, 'Cu25519', chathandle, callback);
    };


    /**
     * Cached RSA public key retrieval utility. If the key is cached, no API
     * request will be performed. The key's authenticity is validated through
     * the tracking in the authring and signature verification.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param [callback] {function}
     *     (Optional) Callback function to call upon completion of operation. The callback
     *     requires one parameter: the actual public RSA key. The user handle is
     *     passed as a second parameter, and may be obtained that way if the call
     *     back supports it.
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is settled.
     *     The promise returns the RSA public key.
     */
    ns.getPubRSA = function(userhandle, callback) {
        if (String(userhandle).indexOf('@') < 1) {
            assertUserHandle(userhandle);
        }
        return ns.getPubKey(userhandle, 'RSA', callback);
    };

    /**
     * Retrieve and cache all public keys for the given user/handle
     * @param {String} userHandle 11-chars-long user-handle
     * @returns {MegaPromise} fulfilled on completion
     */
    ns.getAllPubKeys = async function(userHandle) {
        const promises = [];
        assertUserHandle(userHandle);

        if (!pubCu25519[userHandle]) {
            promises.push(crypt.getPubCu25519(userHandle));
        }

        if (!pubEd25519[userHandle]) {
            promises.push(crypt.getPubEd25519(userHandle));
        }

        if (!u_pubkeys[userHandle]) {
            promises.push(crypt.getPubRSA(userHandle));
        }

        return promises.length && Promise.allSettled(promises);
    };


    /**
     * Computes a user's Ed25519 key finger print. This function uses the
     * `pubEd25519` object for caching.
     *
     * @param userhandle {string}
     *     Mega user handle.
     * @param format {string}
     *     Format in which to return the fingerprint. Valid values: "hex" and
     *     "string" (default: "hex").
     * @return {MegaPromise}
     *     A promise that is resolved when the original asynch code is
     *     settled.
     */
    ns.getFingerprintEd25519 = function(userhandle, format) {
        assertUserHandle(userhandle);
        // This promise will be the one which is going to be returned.
        var masterPromise = new MegaPromise();

        if (pubEd25519[userhandle]) {
            // It's cached: Only compute fingerprint of it.
            var value = authring.computeFingerprint(pubEd25519[userhandle],
                'Ed25519', format);
            var message = 'Got Ed25519 fingerprint for user "' + userhandle + '": ';
            if (format === 'string') {
                message += base64urlencode(value);
            }
            else {
                message += value;
            }
            logger.debug(message);

            // And resolve the promise with it.
            masterPromise.resolve(value);

            return masterPromise;
        }
        else {
            // Non-cached value: First get the public key.
            var keyLoadingPromise = crypt.getPubEd25519(userhandle);

            // Recursively link to .getFingerprintEd25519 as we now have the
            // key cached.
            keyLoadingPromise.done(function() {
                var recursionPromise = ns.getFingerprintEd25519(userhandle, format);
                masterPromise.linkDoneAndFailTo(recursionPromise);
            });

            return masterPromise;
        }
    };


    /**
     * Stores a public key for a contact and notify listeners.
     *
     * @param pubKey {string}
     *     Public key in byte string form.
     * @param keyType {string}
     *     Key type to set. Allowed values: 'Ed25519', 'Cu25519'.
     */
    ns.setPubKey = function(pubKey, keyType) {
        var keyCache = ns.getPubKeyCacheMapping(keyType);
        if (typeof keyCache === 'undefined') {
            throw new Error('Illegal key type to set: ' + keyType);
        }
        logger.debug('Setting ' + keyType + ' public key', u_handle, pubKey);
        keyCache[u_handle] = pubKey;
        Soon(function __setPubKey() {
            mBroadcaster.sendMessage(keyType);
        });
    };


    /**
     * Derives the public key from a private key.
     *
     * @param privKey {String}
     *     Private key in byte string form.
     * @param keyType {String}
     *     Key type to set. Allowed values: 'Ed25519', 'Cu25519'.
     * @return {String}
     *     Corresponding public key in byte string form. `undefined` for
     *     unsupported key types.
     */
    ns.getPubKeyFromPrivKey = function(privKey, keyType) {
        var result;
        if (keyType === 'Ed25519') {
            result = nacl.sign.keyPair.fromSeed(
                asmCrypto.string_to_bytes(privKey)).publicKey;

            return asmCrypto.bytes_to_string(result);
        }
        else if (keyType === 'Cu25519') {
            result = nacl.scalarMult.base(
                asmCrypto.string_to_bytes(privKey));

            return asmCrypto.bytes_to_string(result);
        }

        // Fall through if we don't know how to treat a key (yet).
        logger.error('Unsupported key type for deriving a public from a private key: ' + keyType);

        return;
    };


    /**
     * Converts a string to a hexadecimal string
     * @param {String} text The string to convert
     * @returns {String} Returns the string as hexadecimal string e.g. ac9da63...
     */
    ns.stringToHex = function(text) {

        var bytes = asmCrypto.string_to_bytes(text);
        var hex = asmCrypto.bytes_to_hex(bytes);

        return hex;
    };


    /**
     * Shows the fingerprint warning dialog.
     *
     * @private
     * @param {String} userHandle
     *     The user handle e.g. 3nnYu_071I3.
     * @param {String} keyType
     *     Type of the public key the fingerprint results from. One of
     *     'Ed25519', 'Cu25519' or 'RSA'.)
     * @param {Number} method
     *     The key comparison method (any of the options in
     *     authring.AUTHENTICATION_METHOD).
     * @param {String} prevFingerprint
     *     The previously seen or verified fingerprint.
     * @param {String} newFingerprint
     *     The new fingerprint.
     */
    ns._showFingerprintMismatchException = function(userHandle, keyType,
                                                    method, prevFingerprint,
                                                    newFingerprint) {

        // Keep format consistent
        prevFingerprint = (prevFingerprint.length === 40) ? prevFingerprint : ns.stringToHex(prevFingerprint);
        newFingerprint = (newFingerprint.length === 40) ? newFingerprint : ns.stringToHex(newFingerprint);

        // Show warning dialog if it hasn't been locally overriden (as needed by poor user Fiup who added 600
        // contacts during the 3 week broken period and none of them are signing back in to heal their stuff).
        authring.showCryptoWarningDialog('credentials', userHandle, keyType, prevFingerprint, newFingerprint)
            .dump('cred-fail');

        // Remove the cached key, so the key will be fetched and checked against
        // the stored fingerprint again next time.
        delete ns.getPubKeyCacheMapping(keyType)[userHandle];

        logger.warn(keyType + ' fingerprint does not match the previously authenticated one!\n'
            + 'Previous fingerprint: ' + prevFingerprint + '.\nNew fingerprint: ' + newFingerprint + '.');
    };


    /**
     * Shows the key signature failure warning dialog.
     *
     * @private
     * @param {String} userhandle
     *     The user handle e.g. 3nnYu_071I3.
     * @param {String} keyType
     *     Type of the public key the signature failed for. One of
     *     'Cu25519' or 'RSA'.)
     */
    ns._showKeySignatureFailureException = function(userHandle, keyType) {

        // Show warning dialog if it hasn't been locally overriden (as need by poor user Fiup who added 600
        // contacts during the 3 week broken period and none of them are signing back in to heal their stuff).
        authring.showCryptoWarningDialog('signature', userHandle, keyType).dump('sign-fail');

        logger.error(keyType + ' signature does not verify for user ' + userHandle + '!');
    };

    return ns;
}());

/** @function window.csp */
lazy(self, 'csp', () => {
    'use strict';

    let value;
    const tag = 'cookies-dialog';
    const storage = localStorage;
    const pid = Math.random().toString(28).slice(-6);

    // Cookie settings.
    const CS_ESSENT = 1 << 0;   // 1    Essential cookies
    const CS_PREFER = 1 << 1;   // 2    Preference cookies
    const CS_ANALYT = 1 << 2;   // 4    Analytics cookies
    const CS_ADVERT = 1 << 3;   // 8    Advertisement cookies
    const CS_THIRDP = 1 << 4;   // 16   Thirdparty cookies
    const CS_SETADS = 1 << 5;   // 32   Check if ads cookies are correctly set.

    const bitdef = {
        cs: {s: CS_ESSENT, r: CS_PREFER, n: CS_ANALYT, d: CS_ADVERT, h: CS_THIRDP, e: CS_SETADS},
    };

    const sgValue = async(newValue, byUser) => {
        const u_handle = mega.user;

        if (d) {
            console.group('csp.sgValue(%s, %s)', newValue, byUser, u_handle);
            console.trace();
        }

        if ((newValue >>>= 0) & CS_ESSENT) {

            if (u_handle) {
                delete storage.csp;

                const srv = await Promise.resolve(mega.attr.get(u_handle, 'csp', -2, 1)).catch(nop) >>> 0;
                if (!byUser && srv) {
                    value = (storage['csp.' + u_handle] || value) >>> 0;
                    if (value !== srv) {
                        // different settings, ask to reconfigure.
                        onIdle(() => csp.init());
                    }
                    if (d) {
                        console.info('csp.sgValue sync', value, srv);
                        console.groupEnd();
                    }
                    return;
                }

                u_attr['^!csp'] = String(newValue);
                storage['csp.' + u_handle] = newValue;
                const res = srv === newValue ? -srv : mega.attr.set('csp', newValue, -2, 1);

                if (d) {
                    console.info('csp.sgValue-set result', res);
                    console.groupEnd();
                }
                return res;
            }

            storage.csp = newValue;
        }

        const res = u_handle && mega.attr.get(u_handle, 'csp', -2, 1) || storage.csp;

        if (d) {
            console.info('csp.sgValue-get result', res);
            console.groupEnd();
        }
        return res;
    };

    const canShowDialog = promisify(resolve => {
        const exclude = {
            download: 1, file: 1, folder: 1, filerequest: 1
        };

        (function check(page) {
            if (!mega.flags.ab_adse && (pfid || exclude[String(page).split('/')[0]])) {
                return mBroadcaster.once('pagechange', check);
            }
            if ($.msgDialog) {
                return mBroadcaster.once('msgdialog-closed', SoonFc(200, () => check(window.page)));
            }
            resolve();
        })(window.page);
    });

    mBroadcaster.addListener('login2', () => sgValue(value).dump('csp.login'));
    mBroadcaster.addListener('logout', () => sgValue(value).dump('csp.logout'));

    return Object.freeze({
        init: mutex(tag, async(resolve) => {

            if (d) {
                console.group('csp.init invoked...', value);
                console.trace();
            }

            let shown = false;
            const val = await sgValue().catch(nop) >>> 0;
            const chg = value && mega.user && value !== val ? value : false;

            value = val;
            if (mega.flags.ab_adse && !csp.has('setad')) {
                // reset and ask to re-configure per new requirements.
                value = 0;
            }

            if (chg || !csp.has('essential')) {
                await canShowDialog();
                await csp.showCookiesDialog(chg);
                shown = true;
            }

            if (d) {
                console.info('csp.init [leaving]', value, shown);
                console.groupEnd();
            }

            resolve(shown);
        }),

        reset: async() => {
            value = null;
            delete storage.csp;
            if (mega.user) {
                await mega.attr.remove('csp', -2, 1).catch(nop);
            }
            return csp.init();
        },

        trigger: async() => {
            if (!storage.csp) {
                value = 0;
                storage.csp = CS_ESSENT;
            }
            const shown = await csp.init();
            console.assert(!shown);

            return csp.showCookiesDialog('step2');
        },

        has: (opt, ns = 'cs') => {
            if (d) {
                console.assert(value !== undefined, 'must have been initialized.');
            }
            return value & bitdef[ns][opt[1]];
        },

        showCookiesDialog: promisify((resolve, reject, step, chg) => {
            let banner = document.querySelector('.cookie-banner');
            let dialog = document.querySelector('.cookie-dialog');

            if (!banner || !dialog) {
                return reject(tag);
            }

            if (step === 'nova') {
                value = 0;
                step = null;
            }

            // Show advertisement cookies option if commercials are enabled.
            if (mega.flags.ab_adse) {
                dialog.querySelector('.settings-row.advertisement').classList.remove('hidden');
            }

            let $banner = $(banner);
            let $dialog = $(dialog);
            const first = !csp.has('essential');
            const qsa = (sel, cb) => dialog.querySelectorAll(sel).forEach(cb);

            const forEachCell = (cb, p = '') => qsa('.settings-cell' + p, cell => {
                const toggle = cell.querySelector('.mega-switch');

                if (toggle) {
                    const row = cell.parentNode;
                    const type = row.dataset.type;

                    cb(type, toggle, cell, row);
                }
            });

            const updateMegaSwitch = (toggleSwitch, isOn) => {
                const iconNode = toggleSwitch.querySelector('.mega-feature-switch');

                toggleSwitch.classList[isOn ? 'add' : 'remove']('toggle-on');
                toggleSwitch.setAttribute('aria-checked', isOn ? 'true' : 'false');

                iconNode.classList.add('sprite-fm-mono-after');
                iconNode.classList.remove('icon-check-after', 'icon-minimise-after');
                iconNode.classList.add(`icon-${isOn ? 'check' : 'minimise'}-after`);
            };

            const showBlock = (step) => {
                const qsa = (sel, cb) => dialog.querySelectorAll(sel).forEach(cb);
                const all = (sel = '.current') => {
                    sel += ' .mega-switch:not(.all)';
                    const total = dialog.querySelectorAll(`.settings-row:not(.hidden) ${sel}`).length;

                    if (total) {
                        const active = dialog.querySelectorAll(`.settings-row:not(.hidden) ${sel}.toggle-on`).length;

                        updateMegaSwitch(dialog.querySelector(`${sel.split(':')[0]}.all`), total === active);
                    }
                };

                if (step === 'step1') {

                    if ($.dialog === tag) {

                        closeDialog();
                    }

                    // Show banner in mobile sheet component
                    if (is_mobile) {
                        mega.ui.overlay.hide();
                        $banner = $banner.clone(true);
                        banner = $banner[0];

                        mega.ui.sheet.show({
                            name: 'cookie-banner',
                            type: 'modalLeft',
                            showClose: false,
                            preventBgClosing: true,
                            contents: [banner]
                        });
                    }

                    banner.classList.remove('hidden');

                    all('.saved');
                    all('.current');

                    if (mega.flags.ab_adse) {
                        banner.querySelector('.info .experiment').classList.remove('hidden');
                    }
                    else {
                        banner.querySelector('.info .current').classList.remove('hidden');
                    }

                    return false;
                }

                banner.classList.add('hidden');

                if (is_mobile) {
                    mega.ui.sheet.hide();
                    $dialog = $dialog.clone(true).removeClass('hidden');
                    dialog = $dialog[0];
                }

                M.safeShowDialog(tag, () => {

                    // Show dialog in mobile overlay component
                    if (is_mobile) {
                        mega.ui.overlay.show({
                            name: 'cookie-settings-overlay',
                            showClose: false,
                            contents: [dialog],
                        });
                        return;
                    }

                    return $dialog;
                });

                // Add settings policy link to the last dialog option, if it does not already have them.
                const $settingsLinks = $('.settings-links.hidden', $dialog).clone().removeClass('hidden');
                const $lastSetting =
                    $('.settings-row:not(.hidden) .settings-cell:not(.current):not(.saved)', $dialog).last();

                if (!$('.settings-links', $lastSetting).length){

                    // It's possible that it was previously added to another option, remove it from all options first.
                    $('.settings-row .settings-links', $dialog).remove();
                    $lastSetting.safeAppend($settingsLinks.prop('outerHTML'));
                }

                if (chg) {
                    dialog.classList.add('active-saved-cookies');
                    dialog.querySelector('.save-settings').classList.add('hidden');
                    dialog.querySelector('.close-settings').classList.add('hidden');
                    dialog.querySelector('.use-saved-settings').classList.remove('hidden');
                    dialog.querySelector('.use-current-settings').classList.remove('hidden');

                    forEachCell((type, toggle) => {
                        updateMegaSwitch(toggle, chg & bitdef.cs[type[1]]);
                    }, '.saved');

                    if (is_mobile) {
                        const $tabs = $('.settings-tab', dialog);

                        $tabs.rebind('click.tabs', function() {
                            $tabs.removeClass('active');
                            this.classList.add('active');

                            if (this.dataset.type === 'saved') {
                                qsa('.settings-cell.current', e => e.classList.add('hidden'));
                                qsa('.settings-cell.saved', e => e.classList.remove('hidden'));

                                dialog.querySelector('.use-current-settings').classList.add('hidden');
                                dialog.querySelector('.use-saved-settings').classList.remove('hidden');
                            }
                            else {
                                qsa('.settings-cell.saved', e => e.classList.add('hidden'));
                                qsa('.settings-cell.current', e => e.classList.remove('hidden'));

                                dialog.querySelector('.use-saved-settings').classList.add('hidden');
                                dialog.querySelector('.use-current-settings').classList.remove('hidden');
                            }
                        });

                        dialog.querySelector('.use-current-settings').classList.add('positive');
                        $tabs.filter('[data-type="current"]').trigger('click');
                    }
                }
                else {
                    dialog.classList.remove('active-saved-cookies');
                    dialog.querySelector('.save-settings').classList.remove('hidden');
                    dialog.querySelector('.close-settings').classList.remove('hidden');
                    dialog.querySelector('.use-saved-settings').classList.add('hidden');
                    dialog.querySelector('.use-current-settings').classList.add('hidden');

                    qsa('.settings-cell.current', e => e.classList.remove('hidden'));

                    if (first) {
                        dialog.querySelector('.close-settings').classList.remove('hidden');
                    }
                    else {
                        dialog.querySelector('.close-settings').classList.add('hidden');
                    }
                }

                $('.mega-switch', dialog).rebind('mousedown.toggle', function() {
                    if (!this.classList.contains('disabled')) {
                        const setOn = !this.classList.contains('toggle-on');

                        if (this.classList.contains('all')) {

                            qsa('.settings-cell.current', cell => {
                                const toggle = cell.querySelector('.mega-switch');

                                if (!toggle.classList.contains('disabled')) {
                                    updateMegaSwitch(toggle, setOn);
                                }
                            });
                        }
                        else {
                            updateMegaSwitch(this, setOn);
                            all();
                        }
                    }

                    return false;
                });

                all('.saved');
                all('.current');
                onIdle(clickURLs);

                if (!is_mobile) {

                    const scroll = dialog.querySelector('.scrollable-block');

                    onIdle(() => {
                        scroll.scrollTop = 0;
                        Ps[scroll.classList.contains('ps') ? 'update' : 'initialize'](scroll);
                    });
                }

                return false;
            };

            const save = async(ev) => {
                onIdle(() => {

                    if ($.dialog === tag) {

                        closeDialog();
                    }
                    banner.classList.add('hidden');

                    if (is_mobile) {
                        mega.ui.overlay.hide();
                        mega.ui.sheet.hide();
                    }
                });
                $('.fm-dialog-overlay').off('click.csp');
                $('*', $dialog.off()).off();
                delay.cancel('csp.timer');

                value = CS_ESSENT;
                forEachCell((type, toggle) => {
                    if (toggle.classList.contains('toggle-on')
                    && !toggle.closest('.settings-row').classList.contains('hidden')) {
                        value |= bitdef.cs[type[1]];
                    }
                    else {
                        value &= ~bitdef.cs[type[1]];
                    }
                }, ev === true ? '.saved' : '.current');

                if (mega.flags.ab_adse) {
                    value |= CS_SETADS;
                }

                await sgValue(value, true).catch(dump);
                resolve(value);

                if (!window.buildOlderThan10Days) {
                    const type = ev.type === 'dialog-closed' ? 1 :
                        $(ev.target).hasClass('accept-cookies') ? 2 :
                            ev === -0xBADF ? 3 : first ? 4 : chg ? 5 : 0;

                    const ctx = is_extension ? 1 :
                        location.host === 'mega.nz' ? 2 :
                            location.host === 'mega.io' ? 3 : location.host;

                    eventlog(99743, JSON.stringify([1, type, value | 0, chg | 0, pid, ctx]));
                }

                // If they came from mega.io to directly edit their cookie settings, go back
                // there after saving so they don't remain on the placeholder background page
                if (page === 'cookiedialog') {
                    window.location.replace('https://mega.io/cookie');
                }
                mBroadcaster.sendMessage('csp:settingsSaved');
            };

            value |= CS_ESSENT;

            if (typeof step === 'number') {
                chg = step;
                step = 'step2';
            }

            forEachCell((type, toggle) => updateMegaSwitch(toggle, csp.has(type)), '.current');
            showBlock(step || 'step1');

            $('.accept-cookies', $banner).rebind('click.ac', (ev) => {
                forEachCell((type, toggle) => updateMegaSwitch(toggle, true));
                return save(ev);
            });
            $('.cookie-settings', $banner).rebind('click.ac', () => showBlock('step2'));

            // $('.fm-dialog-overlay').rebind('click.csp', save);
            $('.use-saved-settings', $dialog).rebind('click.ac', () => save(true));
            $('.save-settings, .use-current-settings', $dialog).rebind('click.ac', save);
            $('.close-settings', $dialog).rebind('click.ac', () => showBlock('step1'));
            $('.cookie-settings', $dialog).rebind('click.ac', () => showBlock('step2'));

            console.assert(!delay.has('csp.timer'));
            delay('csp.timer', () => {
                if (!elementIsVisible(banner) && !elementIsVisible(dialog)) {
                    // Some extension did hide the dialog (?)
                    save(-0xBADF);
                }
            }, 7654);
        }),

        showCurrentCookies: async function() {

            if (!d) {
                return;
            }

            await csp.init();

            const text = {
                1: 'essential cookies',
                2: 'preferences cookies',
                4: 'analytics/performance cookies',
                8: 'advertisement cookies',
                16: 'thirdparty cookies',
                32: 'set advertisement cookies',
            };

            console.group('Current Cookies: ' + localStorage[`csp.${u_handle}`]);
            for (let i = 1; i <= 32; i *= 2) {
                if (csp.has(text[i])) {
                    console.info(`${i} SET: ${text[i]}`);
                }
                else {
                    console.info(`${i} NOT SET: ${text[i]}`);
                }
            }
            console.groupEnd();
        }
    });
});

mBroadcaster.once('startMega', async() => {
    'use strict';
    if (is_bot) {
        delete window.csp;
        return;
    }
    // csp.init();
});

/* eslint-disable no-debugger,strict */
/**
 * Watch Object mutations/accesses.
 * @param {Object} obj THe object to watch
 * @param {String} [name] object identification.
 * @param {Number} [flags] bitfield options
 * @returns {{}|any} proxied obj
 */
function watcho(obj, name, flags = 10) {
    if (!d) {
        return obj;
    }
    name = name || makeUUID().slice(-17);
    const log = console.warn.bind(console, `[watcho:${name}]`);

    return new Proxy(obj, {
        get(target, prop) {
            const value = Reflect.get(target, prop);
            if (flags & 1) {
                debugger;
            }
            if (flags & 2) {
                log(`get(${prop})`, value);
            }
            return value;
        },
        set(target, prop, value) {
            const type = typeof value;
            if (flags & 4) {
                debugger;
            }
            if (flags & 8) {
                log(`set(${type}:${prop})`, value);
            }
            return Reflect.set(target, prop, type === 'object' ? watcho(value, `${name}:${prop}`, flags) : value);
        }
    });
}

self.tryCatch = (() => {
    'use strict';
    const fcl = Symbol('__function__');
    const sml = Symbol('__tryCatcher__');

    return (func, onerror) => {
        if (!func[sml]) {
            func[sml] = function tryCatcher() {
                // eslint-disable-next-line local-rules/hints
                try {
                    return func.apply(this, arguments);
                }
                catch (ex) {
                    if (onerror !== false) {
                        console.error(ex);
                    }
                    if (typeof onerror === 'function') {
                        queueMicrotask(() => onerror(ex));
                    }
                }
            };

            // eslint-disable-next-line local-rules/hints
            try {
                Object.defineProperty(func[sml], 'name', {value: `tryCatcher(${func.name || '<anonymous>'})`});
            }
            catch (ex) {
                /* noop */
            }
            func[sml][fcl] = func;
        }

        return func[sml];
    };
})();

lazy(self, 'runKarmaTests', () => {
    'use strict';
    let currentFile = -1;
    const storage = Object.create(null);
    const assert = (expr, msg) => {
        if (!expr) {
            throw new MEGAException(msg);
        }
    };
    const tag = (v) => v && (v[Symbol.toStringTag] || v.name);
    const name = (v) => tag(v) || v && tag(v.constructor) || v;
    const val = (v) => {
        if (typeof v === 'number' && v > 0x1fff) {
            return `${v} (0x${v.toString(16)})`;
        }
        return v;
    };

    let value;
    const chai = {
        expect: (v) => {
            value = v;
            return chai;
        },
        eql: (v) => assert(value === v, `Expected '${value}' to be equal to '${v}'`),
        instanceOf: (v) =>
            assert(value instanceof v, `Expected '${name(value)}' to be instance of ${name(v)}`),
        lessThan: (v) => assert(value < v, `Expected ${val(value)} to be less than ${val(v)}`),
        greaterThan: (v) => assert(value > v, `Expected ${val(value)} to be greater than ${val(v)}`)
    };
    chai.assert = assert;
    chai.to = chai.be = chai;

    self.chai = chai;
    self.expect = chai.expect;

    self.describe = (name, batch) => {
        storage[currentFile][name] = batch;
    };

    return mutex('karma-runner', async(resolve, reject, file = 'webgl', deps = ['tiffjs']) => {
        currentFile = `test/${file.replace(/\W/g, '')}_test.js`;

        if (!storage[currentFile]) {
            storage[currentFile] = Object.create(null);
            await M.require(currentFile, ...deps);
        }

        const getTestLocation = (name) => {
            let location;
            const {stack} = new Error('M');

            if (stack) {
                const lines = stack.split('\n');

                while (lines.length) {
                    const line = lines.splice(0, 1)[0];
                    if (line.includes('_test.js:')) {
                        location = line.split(/[\s@]/).pop();
                        break;
                    }
                }
            }

            if (self.d > 1) {
                console.debug('Testing it %s...', name, location);
            }

            return location;
        };

        const TestResult = class {
            constructor(name, took, location) {
                this.location = location;
                this.message = `${name} \u2714`;
                this.took = performance.now() - took;
            }
        };

        const TestError = class extends MEGAException {
            constructor(name, took, ex) {
                const partial = ex.name === 'NotSupportedError';
                const details = String(ex.stack).includes(ex.message) ? '' : ` (${ex.message})`;
                const status = partial ? `\uD83C\uDF15 (${ex.message})` : `\u2716${details}`;
                super(`${name}: ${status}`, null, ex.name);

                this.color = partial ? 'fd0' : 'f00';
                this.took = performance.now() - took;
                this.soft = partial;

                if (ex.stack) {
                    Object.defineProperty(this, 'stack', {value: ex.stack});
                }
            }
        };

        const promises = [];
        self.it = (testName, testFunc) => {
            promises.push(new Promise((resolve, reject) => {
                const location = getTestLocation(testName);
                const tn = 6000;
                const ts = performance.now();
                const th = setTimeout(() => {
                    const ex = new MEGAException(`Timeout of ${tn}ms exceeded.`, 'TimeoutError');
                    reject(new TestError(testName, ts, ex));
                }, tn);

                Promise.resolve((async() => testFunc())())
                    .then(() => {
                        resolve(new TestResult(testName, ts, location));
                    })
                    .catch((ex) => {
                        reject(new TestError(testName, ts, ex));
                    })
                    .finally(() => clearTimeout(th));
            }));
        };

        // eslint-disable-next-line guard-for-in
        for (const name in storage[currentFile]) {
            console.group(name);
            console.time(name);

            storage[currentFile][name]();
            const res = await Promise.allSettled(promises);

            for (let i = 0; i < res.length; ++i) {
                const {value, reason} = res[i];
                const result = reason || value;
                const color = result.color || '0f0';
                const took = parseFloat(result.took).toFixed(2);
                const details = `${reason && !reason.soft ? reason.stack || reason : result.location || ''}`;
                console.log('%c%s %c%sms', `color:#${color}`, result.message, 'color:#abc', took, details);
            }
            console.timeEnd(name);
            console.groupEnd();
            promises.length = 0;
        }

        resolve();
        self.it = null;
    });
});

mBroadcaster.once('startMega', async() => {
    'use strict';

    console.group(`[DEBUG] ${new Date().toISOString()}`);
    console.table({apipath, staticpath, bootstaticpath, defaultStaticPath});
    console.table(staticServerLoading);

    const data = {};
    const keys = Object.keys(localStorage).sort();
    const exclude = new Set(['sid', 'k', 'privk', 'v', 'handle', 'attr', 'randseed']);
    for (let i = keys.length; i--;) {
        const k = keys[i];

        if (!exclude.has(k) && !/sid/i.test(k)) {
            const v = localStorage[k];

            if (v !== undefined) {
                data[k] = v;
            }
        }
    }
    console.table(data);


    if (d && window.chrome) {
        var usages = Object.create(null);
        var createObjectURL = URL.createObjectURL;
        var revokeObjectURL = URL.revokeObjectURL;

        URL.createObjectURL = function() {
            var stackIdx = 2;
            var stack = M.getStack().split('\n');
            var result = createObjectURL.apply(URL, arguments);

            for (var i = stack.length; i--;) {
                if (stack[i].indexOf('createObjectURL') > 0) {
                    stackIdx = i;
                    break;
                }
            }

            usages[result] = {
                r: 0,
                ts: Date.now(),
                id: MurmurHash3(result, -0x7f000e0),
                stack: stack.splice(stackIdx)
            };

            return result;
        };

        URL.revokeObjectURL = function(objectURL) {
            var result = revokeObjectURL.apply(URL, arguments);

            delete usages[objectURL];
            return result;
        };

        var intv = 60000 / +d;
        setInterval(function() {
            var now = Date.now();
            var known = [
                '1:setUserAvatar', '1:previewimg', '1:onload', '2:onload', '3:procfa', '3:addScript',
                '1:MediaElementWrapper', '2:chatImageParser', '2:initall', '3:initall', '2:MEGAWorkerController',
                '2:/gallery.js'
            ];
            // ^ think twice before whitelisting anything new here...

            for (var uri in usages) {
                var data = usages[uri];

                if ((now - data.ts) > intv) {
                    var warn = true;

                    for (var i = known.length; i--;) {
                        var k = known[i].split(':');

                        if (String(data.stack[k[0]]).indexOf(k[1]) !== -1) {
                            warn = false;
                            break;
                        }
                    }

                    if (warn && !(data.r++ % 10)) {
                        console.warn("[$%s] a call to createObjectURL was not revoked"
                            + " in too long, possible memory leak?", data.id.toString(16), uri, data);
                    }
                }
            }
        }, intv * 1.5);

        window.createObjectURLUsages = usages;
    }

    console.groupEnd();
});

mBroadcaster.once('boot_done', function radSetup() {
    'use strict';

    const exclude = is_mobile || is_karma || is_iframed || localStorage.norad || !is_livesite;
    if (exclude && !sessionStorage.rad) {
        return;
    }

    if (typeof mega.flags !== 'object') {
        mBroadcaster.once('global-mega-flags', radSetup);
        return;
    }

    const rad = parseInt(mega.flags.rad || sessionStorage.rad);

    if (!rad) {
        if (mega.flags.rad === 0) {
            delete localStorage.d;
            delete localStorage.minLogLevel;
            delete localStorage.chatdLogger;
        }
        if (!window.u_sid) {
            mBroadcaster.once('login2', radSetup);
        }
        return;
    }

    localStorage.d = d |= 1;
    localStorage.minLogLevel |= 0;

    if (Date.now() < 173e10) {
        localStorage.chatdLogger = 1;
    }
    else if (d) {
        console.debug('%cKnock, knock... is this still needed?', 'font-size:20px');
    }

    let idb, pfx;
    let indent = 0;
    const buffer = new Set();
    const jsonp = tryCatch((...o) => JSON.stringify(...o), false);

    const toString = (v) => (v = Object(v)) && Reflect.has(v, 'toString') && v.toString() || 'Object';
    const toStringTag = (v) => v && (v[Symbol.toStringTag] || v.name);
    const toPropertyName = (v) => toStringTag(v) || v && toStringTag(v.constructor) || toString(v);
    const toPropertyValue = (name, v) => {
        if (name === 'Event') {
            return `{${v.type},${toPropertyName(v.target)}}`;
        }
        const num = Number('byteLength' in v ? v.byteLength : 'length' in v ? v.length : 'size' in v ? v.size : NaN);
        return num >= 0 ? num : toString(v);
    };
    const serialize = tryCatch((value, name) => {
        name = String(name || toPropertyName(value));
        if (name) {
            value = String(toPropertyValue(name, value));
            if (value[0] === '[') {
                value = value.replace(/^\[object\s*|]$/g, '');
            }
            return name === value ? name : `${name}(${value})`;
        }
    }, false);

    const stringify = tryCatch((value) => {
        const type = typeof value;

        if (type !== 'string') {
            if (value && type === 'object') {
                const name = toPropertyName(value);

                if (name === 'Array') {
                    if (value.length > 8) {
                        value = [...value];
                        value.splice(8, Infinity, '\u2026');
                    }
                    value = `Array[${value.map(stringify).join(';')}]`;
                }
                else if (name === 'Object') {
                    let max = 15;
                    const srz = [];
                    for (const p in value) {
                        if (!--max) {
                            srz.push('\u2026');
                            break;
                        }
                        const v = value[p];
                        const t = typeof v;
                        srz.push(`${p}:${t === 'object' && serialize(v) || (t === 'function' ? v.name : v)}`);
                    }
                    value = `Object{${srz.join(';')}}`;
                }
                else {
                    value = serialize(value, name) || '\u2753';
                }
            }
            else if (type === 'function') {
                value = `${type}(${value.name})`;
            }
            else {
                value = value === undefined ? 'undefined' : `${type}(${value})`;
            }
        }

        return value;
    }, false);

    const argp = (args = [], name = null) => {
        args = [...args];
        const type = typeof args[0];

        if (type === 'string') {
            args.unshift(
                args.shift().replace(/%[Ocdfios]/g, (m) => {
                    if (m === '%s') {
                        return String(args.shift());
                    }
                    else if (m === '%o' || m === '%O') {
                        return jsonp(args.shift());
                    }
                    else if (m === '%f') {
                        return parseFloat(args.shift()).toFixed(6);
                    }
                    else if (m === '%c') {
                        args.shift();
                        return '';
                    }

                    return parseInt(args.shift());
                })
            );
        }
        else if (type === 'object') {
            args[0] = jsonp(args[0]) || args[0];
        }

        for (let i = args.length; i--;) {
            args[i] = stringify(args[i]);
        }

        if (name) {
            name = name.toUpperCase();
            if (indent) {
                args.unshift(name);
                if (pfx) {
                    args.unshift(`[${pfx}]`);
                }
            }
            else {
                if (pfx) {
                    args.unshift(`[${pfx}]`);
                }
                args.unshift(name.padStart(9));
            }
        }
        else if (pfx) {
            args.unshift(`[${pfx}]`);
        }
        args = args.join(' ');

        if (indent > 0) {
            const ps = Array(indent + 1).join('\u00B7');
            args = args.split('\n').map(ln => `${ps.padStart(9)} ${ln}`).join('\n');
        }

        return args.replace(/[\w-]{31,}/g, "\u2026");
    };

    const flush = async() => {
        const db = idb || (idb = await flush.db);
        if (buffer.size) {
            const bump = [...buffer];
            buffer.clear();
            await db.set(`${Date.now().toString(36)}.${bump.length}`, flush.tx.encode(`${bump.join('\n')}\n`));
        }
        return db;
    };
    lazy(flush, 'tx', () => new TextEncoder());
    lazy(flush, 'db', () => LRUMegaDexie.create('rad.log', {limit: 9e3, pfx: '$rad'}));

    const log = (name, args) => {
        if (typeof args === 'string') {
            args = [args];
        }
        buffer.add(argp(args, name));

        if (buffer.size > 400) {
            flush().catch(dump);
        }
    };

    const handlers = {
        table(name, args) {
            log(name, [jsonp(args[0], null, 4)]);
        },
        group(name, args) {
            ++indent;
            log(name, args);
        },
        groupCollapsed(name, args) {
            ++indent;
            log('group', args);
        },
        groupEnd() {
            --indent;
        },
        assert(name, args) {
            if (!args[0]) {
                if (args.length < 2) {
                    args = [0, `${new Error('Failed assertion.').stack}`];
                }
                log(name, args.slice(1));
            }
        }
    };

    'debug,error,info,log,warn,table,group,groupCollapsed,groupEnd,assert'
        .split(',')
        .map(tryCatch((fn) => {
            const gConsoleMethod = console[fn];
            const mConsoleWrapper = handlers[fn] || log;

            console[fn] = tryCatch((...args) => {
                mConsoleWrapper(fn, args);
                return gConsoleMethod.apply(console, args);
            }, false);
        }));

    log('----');
    log('MEGA', `Starting RAD Session, ${new Date().toISOString()}`);

    mBroadcaster.once('crossTab:setup', (owner) => {
        if (!owner) {
            pfx = mBroadcaster.crossTab.origin.toString(36);

            const buf = [...buffer];
            buffer.clear();

            for (let i = 0; i < buf.length; ++i) {
                const p = buf[i].split(/^(\s+\w+)/);
                p.splice(2, 0, ` [${pfx}]`);
                buffer.add(p.join(''));
            }
        }
    });

    mBroadcaster.addListener('crossTab:owner', () => {
        if (pfx) {
            const pid = pfx;
            const {owner, actors} = mBroadcaster.crossTab;
            pfx = null;
            log('CROSSTAB', `Ownership (was '${pid}'), (${owner})<>${actors.map(s => parseInt(s).toString(36))}`);
            flush().catch(dump);
        }
    });

    mBroadcaster.addListener('crossTab:actor', (id) => {
        const {owner, actors} = mBroadcaster.crossTab;
        log('CROSSTAB', `New tab with id:${id.toString(36)}, (${owner})<>${actors.map(s => parseInt(s).toString(36))}`);
        flush().catch(dump);
    });

    window.addEventListener('error', (ev) => {
        let error = ev.error || ev.message || !1;

        if (error.stack) {
            error = `${error}${String(error.stack).replace(ev.message, '')}`;
        }

        log('UNCAUGHT', `Exception, ${error}`);
        flush().catch(dump);
    });

    window.addEventListener("unhandledrejection", (ev) => {
        log('UNCAUGHT', `Promise Rejection, ${ev.reason}`);
        flush().catch(dump);
    });

    tSleep(7).then(function setup() {
        M.onFileManagerReady(flush);
        console.info('%cretroactive-logging enabled.', 'font: 18px LatoWebBold');

        const exporter = async(ev) => {
            const cn = 'block-loading-spinner';
            const cl = ev.target.classList;
            if (!cl.contains(cn)) {
                cl.add(cn, 'sprite-fm-theme');
                await mega.rad.export().catch(dump);
                cl.remove(cn, 'sprite-fm-theme');
            }
        };

        for (const elm of document.querySelectorAll('.top-mega-version')) {
            if (!elm.nextElementSibling || elm.nextElementSibling.nodeName === 'BUTTON') {
                elm.after(parseHTML('<div class="block-null-spinner icon-loading-spinner">\u33D2&#127917;</div>'));
                elm.nextElementSibling.addEventListener('click', exporter);
            }
        }

        if (!window.u_sid) {
            mBroadcaster.once('login2', () => M.onFileManagerReady(setup));
        }
    });

    /** @property mega.rad */
    lazy(mega, 'rad', () => {
        const rad = Object.getOwnPropertyDescriptors({
            log,
            flush,
            drop: async() => {
                const db = await flush();
                return db.delete();
            },
            export: async(save = true, compress = true) => {
                const chunks = [];
                const filename = `rad-${new Date().toISOString().replace(/\D/g, '')}.log`;

                // @todo this will dump a mumbo-jumbo of entries not chronologically sorted, fix me!
                console.info('Flushing cross-tab entries...');
                await flush();
                await watchdog.query('rad-flush', 2e3).catch(dump);

                console.info(`RAD Export to "${filename}"`);

                const db = await flush();
                if (db instanceof LRUMegaDexie) {
                    await db.data.orderBy('ts').each(({data}) => chunks.push(data));

                    for (let i = chunks.length; i--;) {
                        chunks[i] = await db.decrypt(chunks[i]);
                    }
                }
                else {
                    chunks.push(...[...db.values()]);
                }

                const blob = new Blob(chunks);
                const data = compress && await M.compress(blob).catch(nop);

                const args = [data || blob, data ? `${filename}.gz` : filename];
                return save ? M.saveAs(...args) : args;
            }
        });

        return Object.freeze(Object.setPrototypeOf(Object.defineProperties(rad, rad), null));
    });
});


((global, debug) => {
    'use strict';
    if (!debug) {
        return;
    }
    const seen = new Map();
    const stag = 'unhandled.promise.rejection.handler';
    const warn = (m, ...args) => console.warn(`PromiseRejectionEvent \u26a0\u26a0 ${m}`, m && m.stack, ...args);
    const info = (m, ...args) => console.info(`PromiseRejectionEvent \u26a0\u26a0 ${m}`, m && m.stack, ...args);

    const scheduler = () => delay(stag, () => {
        if (seen.size) {
            for (const [promise, ex] of seen) {
                warn(ex, promise);
                reportError(new Error(`Unhandled Promise Rejection :x: ${ex instanceof Error && ex.stack || ex}`));
            }
            seen.clear();
        }
    }, 2e4);

    global.addEventListener('unhandledrejection', ({promise, reason}) => {
        queueMicrotask(scheduler);
        seen.set(promise, reason);
    });

    global.addEventListener('rejectionhandled', ({promise, reason}) => {
        if (seen.has(promise)) {
            seen.delete(promise);
            warn('Rejection handling was mistakenly deferred!', reason);
        }
        else {
            info(reason, promise);
        }
    });

})(self, self.d);

/* eslint-disable strict */
/** @function window.createHTMLDocumentSandbox */
lazy(self, 'createHTMLDocumentSandbox', () => {
    'use strict';
    return tryCatch(() => {
        const sandbox = document.implementation.createHTMLDocument("");
        const base = sandbox.createElement("base");
        base.href = document.location.href;
        sandbox.head.appendChild(base);
        return sandbox;
    });
});

/**
 * Safely parse an HTML fragment, removing any executable
 * JavaScript, and return a document fragment.
 *
 * @param {string} markup The HTML fragment to parse.
 * @returns {DocumentFragment}
 */
function parseHTML(markup) {
    'use strict';
    if (!markup) {
        console.error('Empty content passed to parseHTML');
        markup = 'no content';
    }

    // console.time('parseHTML');

    const doc = createHTMLDocumentSandbox();
    const fragment = document.createDocumentFragment();

    markup = String(markup).replace(/<!--[\S\s]*?-->/g, '');

    const dumb = {
        'SCRIPT': 1,
        'STYLE': 1,
        'SVG': 1,
        'XML': 1,
        'OBJECT': 1,
        'IFRAME': 1,
        'EMBED': 1,
        'MARQUEE': 1,
        'META': 1
    };

    $.parseHTML(markup, doc)
        .forEach((node) => {
            // console.debug(node.nodeName, node.outerHTML, node.data, [node]);

            var content = String(node.outerHTML).replace(/[\s\x00-\x19]+/g, '');
            var invalid = /<[^>]+script:/i.test(content);

            if (!invalid) {
                invalid = domNodeForEach(node, (n) => {
                    // console.warn('domNodeForEach(%s)', n.nodeName, [n]);

                    var nn = n.nodeName.substr(n.nodeName.indexOf(':') + 1);
                    return dumb[nn] || domAttributeForEach(n, ({name}) => {
                        // console.warn('domAttrForEach(%s:%s)', a.name, a.value, [a], [n]);

                        return name[0] === 'o' && name[1] === 'n'
                            || nn !== 'IMG' && name[0] === 's' && name[1] === 'r' && name[2] === 'c';
                    });
                });
            }

            if (invalid) {
                console.warn('Filtered out invalid content passed to parseHTML...', [node]);
            }
            else {
                fragment.appendChild(node);
            }
        });

    // console.timeEnd('parseHTML');

    return fragment;
}

/**
 * Handy printf-style parseHTML to apply escapeHTML
 * @param {string} markup The HTML fragment to parse.
 * @param {...*} args
 */
function parseHTMLfmt(markup, ...args) {
    if (args.length) {
        let idx = 0;
        markup = markup.replace(/@@/g, () => escapeHTML(args[idx++]));
    }
    return parseHTML(markup);
}

/**
 * Handy printf-style parseHTML to apply escapeHTML
 * @param {String} markup The HTML fragment to parse.
 * @param {...*} args
 */
function parseHTMLfmt2(markup, ...args) {
    if (args.length) {
        for (let idx = args.length; idx--;) {
            markup = markup.replace(RegExp(`%${idx}`, 'g'), escapeHTML(args[idx]));
        }
    }
    return parseHTML(markup);
}

/**
 * Safely inject an HTML fragment using parseHTML()
 * @param {string} markup The HTML fragment to parse.
 * @param {...*} var_args
 * @see This should be used instead of jQuery.html()
 * @example $(document.body).safeHTML('<script>alert("XSS");</script>It Works!');
 * @todo Safer versions of append, insert, before, after, etc
 */
(function(jQuery, stubs) {
    'use strict';

    const mock = (name) => {
        const meth = stubs[name];
        Object.defineProperty(jQuery, name, {
            value: function $afeCall(...args) {
                let i = this.length;
                if (i) {
                    const fragment = args[0] === '%n' ? parseHTMLfmt2(...args.slice(1)) : parseHTMLfmt(...args);

                    while (i--) {
                        meth(this[i], fragment, i);
                    }
                }
                return this;
            }
        });
    };

    const meths = Object.keys(stubs);
    for (let i = meths.length; i--;) {
        mock(meths[i]);
    }
    jQuery = stubs = undefined;
})($.fn, {
    safePrepend: (target, fragment, clone) => {
        if (target.nodeType === 1) {
            target.insertBefore(clone ? fragment.cloneNode(true) : fragment, target.firstChild);
        }
    },
    safeAppend: (target, fragment, clone) => {
        if (target.nodeType === 1) {
            target.appendChild(clone ? fragment.cloneNode(true) : fragment);
        }
    },
    safeHTML: (target, fragment, clone) => {
        if (target.nodeType === 1) {
            target.textContent = '';
            target.appendChild(clone ? fragment.cloneNode(true) : fragment);
        }
    }
});

/**
 * Escape HTML markup
 * @param {string} str The HTML fragment to parse.
 * NB: This should be the same than our legacy `htmlentities`
 *     function, except that it's faster and deals with quotes
 */
function escapeHTML(str) {
    return String(str).replace(/["&'<>]/g, (match) => escapeHTML.replacements[match]);
}
escapeHTML.replacements = {"&": "&amp;", '"': "&quot;", "'": "&#39;", "<": "&lt;", ">": "&gt;"};

// deprecated
function htmlentities(value) {
    if (!value) {
        return '';
    }
    return $('<div/>').text(value).html();
}

/**
 * Purge html content from an string
 * @param {String} str The html string
 * @param {Boolean} escape Whether we want the result escaped,
 *                         MUST be set if you want to insert the string back in the DOM as html
 */
function removeHTML(str, escape) {
    'use strict';
    str = $('<div/>').safeHTML(str).text();
    return escape ? escapeHTML(str) : str;
}

/**
 * Traverses a DOM Node hierarchy
 * @param {Object} node the parent node
 * @param {Function} callback Function to invoke for each node
 * @param {*} [irn] Ignore root node
 * @returns {Boolean} The callback result
 */
function domNodeForEach(node, callback, irn) {
    'use strict';

    const {childNodes} = node;
    let len = childNodes && childNodes.length;
    while (len--) {
        const n = childNodes[len];

        if (n.nodeType === 1 && callback(n)) {
            return true;
        }

        if (n.hasChildNodes() && domNodeForEach(n, callback, 1)) {
            return true;
        }
    }

    return irn ? false : callback(node, true);
}

/**
 * Traverses a DOM Node's attributes
 * @param {Object} node the parent node
 * @param {Function} callback Function to invoke for each node
 * @returns {Boolean} The callback result
 */
function domAttributeForEach(node, callback) {
    'use strict';

    const {attributes} = node;
    let len = attributes && attributes.length;
    while (len--) {
        if (callback(attributes[len], node)) {
            return true;
        }
    }

    return false;
}

/**
 * Parses an XML fragment into a plain object.
 * @param {XMLDocument|Element} xml document
 * @param {String} [name] element name
 * @returns {Object} the one
 */
function xmlParser(xml, name) {
    'use strict';
    if (!xml.children.length) {
        return xmlParser.value(name, xml.textContent);
    }
    const res = Object.create(null);
    const {safePropertyName} = xmlParser;

    for (let i = 0; i < xml.children.length; ++i) {
        const element = xml.children[i];
        const name = safePropertyName(element.nodeName);
        const children = xmlParser(element, name);

        if (res[name]) {
            if (!Array.isArray(res[name])) {
                res[name] = [res[name]];
            }
            res[name].push(children);
        }
        else {
            res[name] = children;
        }
    }

    return freeze(res);
}

/** @property xmlParser.fromString */
lazy(xmlParser, 'fromString', () => {
    const parser = new DOMParser();
    return (str) => {
        const doc = parser.parseFromString(str || '<empty/>', 'application/xml');
        const elm = doc.documentElement;
        const err = doc.querySelector('parsererror') || elm.nodeName === 'Error' && xmlParser(elm);

        if (err) {
            const message = String(err.textContent || err.message || err);
            throw new MEGAException(message, err, err.code || 'SyntaxError');
        }
        return xmlParser(elm);
    };
});

/** @property xmlParser.fromJSON */
lazy(xmlParser, 'fromJSON', () => {
    const {safePropertyName} = xmlParser;

    return (str, nc) => JSON.parse(str, function(key, value) {

        if (value) {

            if (Array.isArray(value)) {
                value = [...new Set(value[Symbol.iterator] ? value : Array.from(value))];
            }
            else if (typeof value === 'object') {
                value = freeze(value);
            }
        }

        if (Object.getPrototypeOf(this)) {
            Object.setPrototypeOf(this, null);
        }

        if (key) {
            const prop = safePropertyName(key, nc);

            if (prop !== key) {

                this[prop] = value;
                return;
            }
        }

        return value;
    });
});

/** @property xmlParser.safePropertyName */
lazy(xmlParser, 'safePropertyName', () => {
    const invalid = new Set(['prototype', ...Reflect.ownKeys(Object.prototype)]);

    return (p, nc) => {
        let name = typeof p === 'string' && (nc ? p : p.replace(/^[A-Z]/, (v) => v.toLowerCase()));

        if (!name || name[0] === '_' || invalid.has(name)) {
            console.error('Found restricted property name on payload...', p);
            name = Symbol.for(`(invalid):~~${p}`);
        }

        return name;
    };
});

/** @property xmlParser.value */
lazy(xmlParser, 'value', () => {
    const map = freeze({
        'null': null,
        'true': true,
        'false': false
    });

    return (key, value) => {
        let res = map[value];
        if (res !== undefined) {
            return res;
        }

        res = parseFloat(value);
        if (res === Number(value) && Number.isFinite(res)) {
            return res;
        }

        // if (key && key.endsWith('Date')) {
        //     value = Date.parse(value);
        // }

        return value;
    };
});

/** @property xmlParser.fetch */
Object.defineProperty(xmlParser, 'fetch', {
    value: async function xmlParserFetch(...args) {
        if (self.d) {
            console.info('Sending XML-Fetch request...', ...args);
        }
        let res = await fetch(...args);
        const headers = Object.create(null);
        const status = `${res.status} ${res.statusText}`;

        for (const [k, v] of res.headers) {
            headers[k.toLowerCase()] = v;
        }
        const text = await res.text();

        res = Object.assign(
            Object.create(null),
            xmlParser[headers['content-type'] === 'application/json' ? 'fromJSON' : 'fromString'](text)
        );

        Object.defineProperties(res, {
            [Symbol.for('status')]: {value: status},
            [Symbol.for('response')]: {value: text},
            [Symbol.for('response-headers')]: {value: freeze(headers)}
        });

        return freeze(res);
    }
});

function MegaEvents() {
    'use strict';
    this._events = Object.create(null);
}

MegaEvents.prototype.trigger = function(name, args) {
    'use strict';

    var count = false;

    if (!this._events) {
        console.error('MegaEvents: This instance is destroyed and cannot dispatch any more events.', name, args);
        return false;
    }

    if (this._events[name]) {

        if (d > 1) {
            console.log(' >>> Triggering ' + name, this._events[name].length, args);
        }
        args = args || [];

        var evs = this._events[name];
        for (var i = 0; i < evs.length; ++i) {
            try {
                evs[i].apply(null, args);
            }
            catch (ex) {
                console.error(ex);

                onIdle(function() {
                    // Let window.onerror catch it
                    throw ex;
                });
            }
            ++count;
        }
    }

    return count;
};

MegaEvents.prototype.on = function(name, callback) {
    'use strict';

    if (this._events[name]) {
        this._events[name].push(callback);
    }
    else {
        this._events[name] = [callback];
    }
    return this;
};


// ---------------------------------------------------------------------------

mBroadcaster.once('startMega', tryCatch(() => {
    'use strict';

    if (is_livesite && self.buildOlderThan10Days || localStorage.nomjs) {
        return;
    }
    const state = Object.create(null);
    const eventlog = self.d ? dump : self.eventlog;

    const sendMediaJourneyEvent = tryCatch((id) => {
        let value;

        if (self.pfcol) {
            value = id + 3;
        }
        else if (self.pfid) {
            value = id + 1;
        }
        else if (self.page === 'download') {
            value = id + 2;
        }
        else if (self.fminitialized) {

            if (M.currentrootid === M.RootID) {
                value = id;
            }
            else if (M.currentdirid === 'photos') {
                value = id + 4;
            }
            else if (M.currentdirid === 'videos') {
                value = id + 5;
            }
            else if (M.albums) {
                value = id + 6;
            }
        }

        if (value > 5e5) {
            eventlog(value, true);
        }
    });

    const setMediaPlaybackState = () => {

        if (state.mediaPlayback) {
            console.assert(false, 'already running...');
            return;
        }
        const evs = [];
        const cleanup = () => {

            for (let i = evs.length; i--;) {
                mBroadcaster.removeListener(evs[i]);
            }
            state.mediaPlayback = false;
        };
        evs.push(
            mBroadcaster.addListener('slideshow:next', cleanup),
            mBroadcaster.addListener('slideshow:prev', cleanup),
            mBroadcaster.addListener('slideshow:close', cleanup)
        );

        state.mediaPlayback = true;
    };
    const actions = freeze({
        'preview': {
            audio() {
                setMediaPlaybackState();
            },
            video() {
                setMediaPlaybackState();
            },
            'send-chat'() {
                if (state.mediaPlayback) {
                    sendMediaJourneyEvent(500140);
                }
            },
            'close-btn'() {
                if (state.mediaPlayback) {
                    state.mediaPlayback = -1;
                    sendMediaJourneyEvent(500170);
                }
            },
            'arrow-key'() {
                if (state.mediaPlayback) {
                    sendMediaJourneyEvent(500180);
                }
            },
            'close-nav'() {
                if (state.mediaPlayback > 0) {
                    sendMediaJourneyEvent(500220);
                }
            }
        },
        'videostream': {
            playing({options}) {
                const userClick = !options.autoplay || 'preBuffer' in options || options.uclk;

                if (userClick) {
                    sendMediaJourneyEvent(500050);
                }
                else {
                    sendMediaJourneyEvent(500040);
                }
            }
        },
        'breadcrumb': {
            click() {
                if (state.mediaPlayback) {
                    state.mediaPlayback = -1;
                    sendMediaJourneyEvent(500120);
                }
            }
        },
        'properties-dialog': {
            click(on) {
                if (state.mediaPlayback && on === 'file-version') {
                    state.mediaPlayback = -1;
                    sendMediaJourneyEvent(500130);
                }
            }
        },
        'move-to-rubbish': {
            remove() {
                if (state.mediaPlayback) {
                    state.mediaPlayback = -1;
                    sendMediaJourneyEvent(500150);
                }
            }
        },
        'media-journey': {
            playback(state) {
                if (state === 'ended') {
                    sendMediaJourneyEvent(500210);
                }
                else if (state === 'watch-again') {
                    sendMediaJourneyEvent(500200);
                }
                else if (state === 'pause-click') {
                    sendMediaJourneyEvent(500110);
                }
            },
            subtitles(op) {
                if (op === 'open') {
                    sendMediaJourneyEvent(500190);
                }
                else if (op === 'add') {
                    sendMediaJourneyEvent(500100);
                }
                else if (op === 'cancel') {
                    sendMediaJourneyEvent(500090);
                }
                else if (op === 'close') {
                    sendMediaJourneyEvent(500080);
                }
                else if (op === 'select') {
                    sendMediaJourneyEvent(500070);
                }
                else if (op === 'off') {
                    sendMediaJourneyEvent(500060);
                }
            }
        }
    });

    mBroadcaster.addListener('trk:event', (category, action, name, value) => {

        if (actions[category] && (action = actions[category][action])) {

            tryCatch(action)(name, value);
        }
    });
}));

/**
 * @property {Object} mega.icu   ICU class for messages formatting
 */
lazy(mega, 'icu', () => {
    'use strict';

    let plural = tryCatch(() => {
        if (window.Intl && Intl.PluralRules !== undefined) {
            return new Intl.PluralRules(mega.intl.locale);
        }
    }, false)();

    const reportError = (error) => {
        if (d) {
            console.error(error);
        }
    };

    if (!plural) {
        if (d) {
            console.warn('Using own Intl.PluralRules adaptation as Intl.PluralRules is unavailable');
        }
        plural = getPlurals(mega.intl.locale);
    }

    /**
     * Fetch a plural option from the message
     * @param {String} msg      Message to extract options from
     * @param {Number} start    Start index of the search
     * @returns {Object}        {key, option, index} key of the option & value and last index of match
     */
    const getOption = function getOption(msg, start) {
        let openFound = 0;
        let option = '';
        let key = '';
        start = start || 0;

        for (let k = start; k < msg.length; k++) {
            option += msg[k];
            if (msg[k] === '{') {
                openFound++;
                if (openFound === 1) {
                    key = option.slice(0, -1);
                    option = '{';
                }
            }
            else if (msg[k] === '}') {
                openFound--;
                if (openFound === 0) {
                    // end
                    return { key, option, index: k };
                }
                else if (openFound < 0) {
                    reportError(`---- Parsing error, failed to parse Plural set, not matched brackets. `
                        + `value = ${msg}`);
                    return null;
                }
            }
        }
        reportError(`---- Parsing error, failed to parse Plural set. value = ${msg}`);
        return null;
    };

    return Object.freeze({

        /**
         * Check if the message is in ICU format and has Plural
         * @param {String} msg      Message to check
         * @returns {Boolean}       True if ICU/Plural
        */
        isICUPlural: msg => /{.+,\s*plural\s*,[^]+}/.test(msg),

        /**
         * Format ICU message
         * @param {String} msg      Message to format
         * @param {Number} count    The count of counted items in the rule
         * @returns {Boolean}       True if ICU/Plural
         */
        format: (msg, count, localizeCount) => {
            if (d && window.dstringids) {
                return msg;
            }
            if (!mega.icu.isICUPlural(msg)) {
                reportError(`---- Parsing error, not expected ICU message. value = ${msg}`);
                return String(msg);
            }
            const icuBody = /({[^{}]*,\s*plural\s*,[^]+})/g.exec(msg);

            if (!icuBody || icuBody.length !== 2) {
                reportError(`---- Parsing error, not expected ICU Body format. value = ${icuBody}`);
                return String(msg);
            }

            // removing the brackets { }
            const clearBody = icuBody[1].substring(1, icuBody[1].length - 1).trim();

            const token = clearBody.match(/,\s*plural\s*,/);

            if (!token || token.length !== 1) {
                reportError(`---- Parsing error, Failed to find Plural token. value = ${clearBody}`);
                return String(msg);
            }

            const stringDic = Object.create(null);

            let st = token.index + token[0].length;

            while (st < clearBody.length) {
                const opts = getOption(clearBody, st);

                if (!opts) {
                    reportError(`---- Parsing error, malformed Plural set. value = ${clearBody}`);
                    return String(msg);
                }

                const condition = opts.key.trim();
                let strVal = opts.option.trim();

                st = opts.index + 1;
                // removing the brackets { }
                strVal = strVal.substring(1, strVal.length - 1);
                stringDic[condition.replace('=', '')] = strVal;

            }

            if (!Object.keys(stringDic).length) {
                reportError(`---- Parsing error, Plural values not found. value = ${icuBody}`);
                return String(msg);
            }

            let val = stringDic[count] || stringDic[plural.select(count)] || stringDic.other;

            if (val) {
                val = val.replace(/#/g, localizeCount ? mega.intl.decimal.format(count) : count);
                const beginTxt = msg.substring(0, icuBody.index);
                const endTxt = msg.substring(icuBody.index + icuBody[1].length, msg.length);
                return beginTxt + val + endTxt;
            }
            reportError(`---- Parsing error, Plural values for count ${count} not found.`
                + `value = ${JSON.stringify(stringDic)}`);

            return String(msg);
        }
    });

    /**
     * Polyfill for Intl.PluralRules for MEGA Webclient languages
     *
     * Based on:
     * https://www.npmjs.com/package/intl-pluralrules
     * https://www.npmjs.com/package/make-plural
     *
     * Reference for plural rules:
     * https://unicode-org.github.io/cldr-staging/charts/latest/supplemental/language_plural_rules.html
     *
     * @param {string} localeVal mega.intl.locale value. First two characters should be a valid key to select._sel
     * @returns {{select: ((function(*): (string|*))|*)}} The constructed PluralRules object with the required
     * select function.
     */
    function getPlurals(localeVal) {
        const select = (number) => {
            if (typeof number !== 'number') {
                number = Number(number);
            }
            if (!isFinite(number)) {
                return 'other';
            }
            const formatter = new Intl.NumberFormat('en');
            const fmt = formatter.format(Math.abs(number));
            return select._sel[select._locale](fmt);
        };
        const plurals_other = () => 'other';
        select._sel = {
            en: n => {
                const s = String(n).split('.');
                return n === 1 && !s[1] ? 'one' : 'other';
            },
            ar: n => {
                const s = String(n).split('.');
                const n100 = Number(s[0]) === n && s[0].slice(-2);
                if (n === 0) {
                    return 'zero';
                }
                if (n === 1) {
                    return 'one';
                }
                if (n === 2) {
                    return 'two';
                }
                if (n100 >= 3 && n100 <= 10) {
                    return 'few';
                }
                if (n100 >= 11 && n100 <= 99) {
                    return 'many';
                }
                return 'other';
            },
            de: n => {
                const s = String(n).split('.');
                return n === 1 && !s[1] ? 'one' : 'other';
            },
            fr: n => {
                const s = String(n).split('.');
                const i = s[0];
                const i1000000 = i.slice(-6);
                if (n >= 0 && n < 2) {
                    return 'one';
                }
                if (i !== 0 && i1000000 === 0 && !s[1]) {
                    return 'many';
                }
                return 'other';
            },
            pt: n => {
                const s = String(n).split('.');
                const i = s[0];
                const i1000000 = i.slice(-6);
                if (i === 0 || i === 1) {
                    return 'one';
                }
                if (i !== 0 && i1000000 === 0 && !s[1]) {
                    return 'many';
                }
                return 'other';
            },
            zh: plurals_other,
            es: n => {
                const s = String(n).split('.');
                const i = s[0];
                const i1000000 = i.slice(-6);
                if (n === 1) {
                    return 'one';
                }
                if (i !== 0 && i1000000 === 0 && !s[1]) {
                    return 'many';
                }
                return 'other';
            },
            id: plurals_other,
            it: n => {
                const s = String(n).split('.');
                const i = s[0];
                const v0 = !s[1];
                const i1000000 = i.slice(-6);
                if (n === 1 && v0) {
                    return 'one';
                }
                if (i !== 0 && i1000000 === 0 && v0) {
                    return 'many';
                }
                return 'other';
            },
            ja: plurals_other,
            ko: plurals_other,
            nl: plurals_other,
            pl: n => {
                const s = String(n).split('.');
                const i = s[0];
                const v0 = !s[1];
                const i10 = i.slice(-1);
                const i100 = i.slice(-2);
                if (v0) {
                    if (n === 1) {
                        return 'one';
                    }
                    if (i10 >= 2 && i10 <= 4 && (i100 < 12 || i100 > 14)) {
                        return 'few';
                    }
                    if (i !== 1 && (i10 === 0 || i10 === 1) || i10 >= 5 && i10 <= 9 || i100 >= 12 && i100 <= 14) {
                        return 'many';
                    }
                }
                return 'other';
            },
            ro: n => {
                const s = String(n).split('.');
                const v0 = !s[1];
                const t0 = Number(s[0]) === n;
                const n100 = t0 && s[0].slice(-2);
                if (n === 1 && v0) {
                    return 'one';
                }
                if (!v0 || n === 0 || n100 >= 2 && n100 <= 19) {
                    return 'few';
                }
                return 'other';
            },
            ru: n => {
                const s = String(n).split('.');
                const i = s[0];
                const v0 = !s[1];
                const i10 = i.slice(-1);
                const i100 = i.slice(-2);
                if (v0) {
                    if (i10 === 1 && i100 !== 11) {
                        return 'one';
                    }
                    if (i10 >= 2 && i10 <= 4 && (i100 < 12 || i100 > 14)) {
                        return 'few';
                    }
                    if (i10 === 0 || i10 >= 5 && i10 <= 9 || i100 >= 11 && i100 <= 14) {
                        return 'many';
                    }
                }
                return 'other';
            },
            th: plurals_other,
            vi: plurals_other
        };
        select._locale = String(localeVal).substring(0, 2);
        return {
            select
        };
    }
});

/** @property mega.keyMgr */
lazy(mega, 'keyMgr', () => {
    'use strict';

    Object.defineProperty(self, 'secureKeyMgr', {
        get() {
            return mega.keyMgr.secure && mega.keyMgr.generation > 0;
        },
        configurable: true
    });
    const logger = MegaLogger.getLogger('KeyMgr');
    const dump = logger.warn.bind(logger, 'Caught Promise Rejection');

    const pkPull = {
        lock: null,
        dsLock: null,
        smbl: Symbol('fetch-pending-share-keys')
    };
    let sNodeUsers = Object.create(null);

    const decryptShareKeys = async(h) => {
        let n;
        const debug = d > 0 && [];
        const nodes = await M.getNodes(h, true);

        for (let i = nodes.length; i--;) {
            n = M.getNodeByHandle(nodes[i]);

            if (crypto_keyok(n)) {

                nodes.splice(i, 1);
            }
            else if (debug && !String(n.k).includes(`${h}:`)) {

                debug.push(`Invalid key on ${h}/${n.h}, ${n.k || '<empty!>'}`);
            }
        }

        if (nodes.length) {
            if (debug) {
                console.groupCollapsed(`${logger.name}: Trying to decrypt ${h}/${nodes}...`);
                debug.map(m => logger.info(m));
            }
            const fixed = crypto_fixmissingkeys(array.to.object(nodes));

            if (debug) {
                logger.info(`Decrypted: ${fixed || 'none'}`);
                console.groupEnd();
            }
        }

        return debug && JSON.stringify([h, crypto_keyok(n) || n]);
    };

    const expungePendingOutShares = (u8, nodes, users = false, emails = false) => {
        const sub = $.len(users) || $.len(emails);
        const any = !sub && nodes === false;

        let match = false;
        let len = u8.byteLength;

        for (let p = 0; p < len;) {
            // match by node
            const n = ab_to_base64(new Uint8Array(u8.buffer, u8.byteOffset + p + 1, 6));

            if (any || nodes.includes(n)) {
                match = true;
            }
            else if (sub) {
                const ptr = new Uint8Array(u8.buffer, u8.byteOffset + p + 7, u8[p] || 8);

                match = emails && emails[n + ab_to_str(ptr)]
                    || users && users[n + ab_to_base64(ptr)];
            }

            const l = u8[p] ? u8[p] + 7 : 15;

            if (match) {
                // delete l byes and shorten len by l
                u8.set(new Uint8Array(u8.buffer, u8.byteOffset + p + l, len - p - l), p);
                len -= l;
                match = false;
            }
            else {
                p += l;
            }
        }

        return new Uint8Array(u8.buffer, u8.byteOffset, len);
    };

    const cleanupCachedAttribute = async() => {
        if (u_attr['^!keys']) {
            logger.warn('Cleaning ug-provided ^!keys attribute.');
            delete u_attr['^!keys'];
        }
        return attribCache.removeItem(`${u_handle}_^!keys`);
    };

    const syncRemoteKeysAttribute = async(keyMgr) => {
        await cleanupCachedAttribute();

        return Promise.resolve(mega.attr.get(u_handle, 'keys', -2, true))
            .then((result) => {
                assert(typeof result === 'string' && result.length > 0, `KeyMgr: Bogus fetch-result, "${result}"`);

                return keyMgr.importKeysContainer(result);
            })
            .then(() => {
                if (d) {
                    logger.debug('Remote attribute synced, checking pending shares and missing keys...');
                }
                keyMgr.acceptPendingInShares().catch(dump);
            })
            .catch((ex) => {
                cleanupCachedAttribute().catch(dump);
                throw ex;
            });
    };

    const kmWebLock = self.LockManager && navigator.locks instanceof self.LockManager
        ? async(handler) => navigator.locks.request('KeyMgr-readwrite.lock', handler)
        : async(handler) => handler();

    const eventlog = (...args) => {
        if (window.buildOlderThan10Days) {
            logger.warn(...args);
        }
        else {
            queueMicrotask(() => window.eventlog(...args));
        }
    };

    // @todo exceptionally allowing All-0 mk since some ancient 3rd-party Android app may created those (confirm/remove)
    const isValidMasterKey = (k) =>
        Array.isArray(k) && k.length === 4
        && (
            Math.max(...k) >>> 0 || k[0] === 0 && k[1] === 0 && k[2] === 0 && k[3] === 0
        );

    if (!window.is_karma) {
        let gMasterKey = window.u_k;

        delete window.u_k;
        Object.defineProperty(window, 'u_k', {
            get() {
                if (d > 8) {
                    logger.warn('Feeding master-key for user %s...', u_handle);
                }
                return gMasterKey;
            },
            set(value) {
                const valid = value === undefined || isValidMasterKey(value);

                if (!valid || value
                    && mega.keyMgr.equal(Uint32Array.from(value), Uint32Array.from(gMasterKey || []))) {

                    if (!valid || mega.keyMgr.version) {
                        logger.error('Forbidden attempt to replace the master-key...', !!value);
                    }
                    return;
                }

                if (d) {
                    const user = window.u_handle || $.createanonuser || 'anon';

                    if (gMasterKey) {
                        logger.warn('%s master-key for user %s...', value ? 'Replacing' : 'Removing', user);
                    }
                    else {
                        logger.warn('Establishing new master-key for user %s.', user);
                    }
                }

                // @todo ensure there is nothing pending/running concurrently given the reset() call..

                gMasterKey = value;
                mega.keyMgr.reset();
            }
        });
    }

    return new class KeyMgr {

        constructor() {
            this.reset();
        }

        reset() {
            const ownKeys = Reflect.ownKeys(this);

            for (let i = ownKeys.length; i--;) {
                delete this[ownKeys[i]];
            }

            // share keys that an upload is allowed to encrypt to
            // { uploadid : [ targetnode, [ sharenode, sharenode, ... ] ] }
            this.uploads = Object.create(null);

            // nodes under a newly shared node at the time the user opened the sharing dialog
            // (only these will be included in the cr element of the s/s2 command)
            // all newer nodes received their shareufskey through the share being announced
            // to other clients via the ^!keys update
            this.sharechildren = Object.create(null);

            // trusted sharekeys never had MITM/API exposure
            this.trustedsharekeys = Object.create(null);

            // deserialised sharekeys are known to be in ^!keys
            this.deserialisedsharekeys = Object.create(null);

            // share-key revocation queue
            this.delSharesQueue = null;

            // a commit() attempt was unsuccessful due to incomplete state
            this.pendingcommit = null;

            // a pk-packet is awaiting
            this.pendingpullkey = false;

            // indicates an unresolved version clash
            this.versionclash = false;

            // feature flag: enable with the blog post going live
            this.secure = true;

            // true if user needs to manually verify contact's credentials to encrypt/decrypt share keys
            this.manualVerification = false;

            /** @property KeyMgr.ph -- Protocol Handler instance */
            lazy(this, 'ph', () => {
                return new strongvelope.ProtocolHandler(u_handle, u_privCu25519, u_privEd25519, u_pubEd25519);
            });
        }

        async initKeyManagement(keys) {
            if (this.version || this.fetchPromise || !window.u_privk) {
                throw new SecurityError('Unexpected Key Management Initialization.');
            }

            if (this.secure) {
                if (decWorkerPool.ok) {
                    decWorkerPool.signal({assign: true, secureKeyMgr: true});
                }
                Object.defineProperty(self, 'secureKeyMgr', {value: true});
            }

            if (keys) {
                return this.importKeysContainer(keys, -0x4D454741);
            }

            if (d) {
                logger.warn('Setting up ^!keys store management... post-reg=%s', this.postregistration);
            }

            if (this.secure && !this.postregistration) {
                // inform the user not to accept this message more than once
                // and remind him of his outgoing shared folders, if any.

                let msg = l.security_upgrade_message;

                const shared = Object.values(M.getOutShareTree()).map(n => n.name).filter(Boolean);
                if (shared.length) {
                    msg += '\n\n' + mega.icu.format(l.security_upgrade_shared_folders, shared.length)
                        .replace('%1', shared.join(', '));
                }

                // eslint-disable-next-line no-alert -- @todo non-alert blocking method..
                if (!confirm(msg)) {
                    location.replace('https://blog.mega.io/?resilience=1');
                }
            }
            else {
                this.postregistration = false;
            }

            // TLV container format version
            this.version = 1;

            // initial creation time of this blob (static) for forensic analysis after deletion/recreation attacks
            this.creationtime = this.uint32u8(Date.now() / 1000);

            // user handle - for a very basic sanity check (static)
            this.identity = new Uint8Array(base64_to_ab(u_handle), 0, 8);

            // generation count, monotonically increasing with every commit
            // purpose: detect replay attacks of older versions
            this.generation = 1;

            // generic attributes { string : Uint8Array }
            this.attr = Object.create(null);

            // asymmetric private keys
            this.prived25519 = this.str2u8(u_privEd25519);
            this.privcu25519 = this.str2u8(u_privCu25519);
            this.privrsa = this.str2u8(crypto_encodeprivkey2(u_privk));

            // pending outshares - ( \0 + nodehandle.6 + userhandle + 8 | \email.length + nodehandle.6 + email )*
            this.pendingoutshares = new Uint8Array(0);

            // pending inshares - { node : u8( userhandle + encryptedsharekey ) }
            this.pendinginshares = Object.create(null);

            // share keys that a backup is allowed to encrypt to
            // { backupid : [ targetnode, [ sharenode, sharenode, ... ] ] }
            this.backups = Object.create(null);

            // cryptographic warnings { warningid : warning }
            this.warnings = Object.create(null);

            // unprocessed tags
            this.other = new Uint8Array(0);

            return this.commit();
        }

        async setKey(basekey) {
            if (!this.gcmkey) {
                assert(isValidMasterKey(basekey), 'Invalid base-key.');

                const key = await crypto.subtle.importKey(
                    "raw",
                    new Uint8Array(a32_to_ab(basekey)),
                    "HKDF",
                    false,
                    ["deriveKey"]
                );

                this.gcmkey = await crypto.subtle.deriveKey(
                    {name: 'HKDF', salt: new Uint8Array(0), info: new Uint8Array([1]), hash: 'SHA-256'},
                    key,
                    {name: 'AES-GCM', length: 128},
                    true,
                    ['encrypt', 'decrypt']
                );

                Object.defineProperty(this.gcmkey, 'bk', {
                    value: basekey,
                    configurable: true
                });
            }
        }

        serialise() {
            return this.tlvConcat(this.other, [
                1, new Uint8Array([this.version]),
                2, this.creationtime,
                3, this.identity,
                4, this.uint32u8(this.generation),
                5, this.obj2u8(this.attr),
                16, this.prived25519,
                17, this.privcu25519,
                18, this.privrsa,
                32, this.str2u8(authring.serialise(u_authring.Ed25519)),
                33, this.str2u8(authring.serialise(u_authring.Cu25519)),
                48, this.serialiseShareKeys(u_sharekeys),
                64, this.pendingoutshares,
                65, this.obj2u8(this.pendinginshares),
                80, this.backups2u8(this.backups),
                96, this.obj2u8(this.warnings)
            ]);
        }

        unserialise(blob) {
            let val;
            let p = 4;
            const tagpos = Object.create(null);

            while (p <= blob.length) {
                const tag = blob[p - 4];
                const len = (blob[p - 3] << 16) + (blob[p - 2] << 8) + blob[p - 1];

                if (p + len > blob.length) {
                    return false;
                }
                tagpos[tag] = [p, len];
                p += len + 4;
            }

            const version = this.gettlv(blob, tagpos, 1)[0];
            if (!version) {
                return false;
            }

            const creationtime = this.gettlv(blob, tagpos, 2);
            if (creationtime.byteLength !== 4) {
                return false;
            }

            const identity = this.gettlv(blob, tagpos, 3);
            if (ab_to_base64(identity) !== u_handle) {
                return false;
            }

            if ((val = this.gettlv(blob, tagpos, 4)).byteLength !== 4) {
                return false;
            }

            const generation = this.u8uint32(val);
            if (d) {
                logger.info(`Generation: ${generation}`);
            }

            const attr = this.u82obj(this.gettlv(blob, tagpos, 5));

            // deserialise static members only once
            if (this.keyring) {
                logger.info('Keyring already established, not overwriting...');
                assert(this.equal(this.privrsa, this.gettlv(blob, tagpos, 18)), 'prRSA');
                assert(this.equal(this.privcu25519, this.gettlv(blob, tagpos, 17)), 'prCu255');
                assert(this.equal(this.prived25519, this.gettlv(blob, tagpos, 16)), 'prEd255');
            }
            else {

                const prived25519 = this.gettlv(blob, tagpos, 16);
                if (prived25519.length !== 32) {
                    return false;
                }

                const privcu25519 = this.gettlv(blob, tagpos, 17);
                if (privcu25519.length !== 32) {
                    return false;
                }

                const privrsa = this.gettlv(blob, tagpos, 18);
                if (privrsa.length < 512) {
                    return false;
                }

                this.keyring = Object.create(null);
                this.keyring.prEd255 = ab_to_str(prived25519);
                this.keyring.prCu255 = ab_to_str(privcu25519);

                this.privrsa = privrsa;
                this.prived25519 = prived25519;
                this.privcu25519 = privcu25519;

                u_privk = crypto_decodeprivkey2(this.privrsa);
            }

            this.attr = attr;
            this.version = version;
            this.identity = identity;
            this.generation = generation;
            this.creationtime = creationtime;

            this.authrings = Object.create(null);

            val = this.gettlv(blob, tagpos, 32);
            this.authrings.Ed25519 = authring.deserialise(this.u82str(val));

            val = this.gettlv(blob, tagpos, 33);
            this.authrings.Cu25519 = authring.deserialise(this.u82str(val));

            this.deserialiseShareKeys(this.gettlv(blob, tagpos, 48));

            this.pendingoutshares = this.gettlv(blob, tagpos, 64);
            this.pendinginshares = this.u82obj(this.gettlv(blob, tagpos, 65));

            this.backups = this.u82backups(this.gettlv(blob, tagpos, 80));
            this.warnings = this.u82obj(this.gettlv(blob, tagpos, 96));

            // we don't touch unknown tags written by a newer version
            const unk = [];

            if ($.len(tagpos)) {
                logger.warn('Unknown tags...', JSON.stringify(tagpos));
            }

            for (const tag in tagpos) {
                val = this.gettlv(blob, tagpos, tag);
                if (val.byteLength) {
                    unk.push(tag, val);
                }
            }
            this.other = this.tlvConcat([], unk);

            // @todo deprecate the global 'u_authrings'..
            const {u_authring} = window;
            if (u_authring) {
                Object.assign(u_authring, this.authrings);

                queueMicrotask(() => {
                    const users = array.unique(Object.values(u_authring).flatMap((o) => Object.keys(o || {})));

                    for (let i = users.length; i--;) {
                        const user = M.u[users[i]];
                        if (user) {
                            user.trackDataChange();
                        }
                    }
                });
            }

            return true;
        }

        // utility functions - move elsewhere?
        str2u8(s) {
            const u8 = new Uint8Array(s.length);

            for (let i = s.length; i--;) {
                u8[i] = s.charCodeAt(i);
            }

            return u8;
        }

        // concatenate arguments to form a TLV blob. The first argument is appended to the end.
        tlvConcat(other, payload) {
            // calculate final length
            let size = other.length;

            for (let i = 1; i < payload.length; i += 2) {
                size += payload[i].length + 4;
            }

            // allocate and populate buffer
            const blob = new Uint8Array(size);
            let p = 0;

            for (let i = 0; i < payload.length; i += 2) {
                // set header
                blob[p] = payload[i];
                const len = payload[i + 1].length;

                blob.set([len >> 16 & 255, len >> 8 & 255, len & 255], p + 1);

                // copy data
                blob.set(payload[i + 1], p + 4);

                p += len + 4;
            }

            // append raw blob
            if (other.length) {
                blob.set(other, p);
            }

            return blob;
        }

        // extract tlv subfield and remove from pos/len array
        gettlv(blob, tagpos, index) {
            const p = tagpos[index][0];
            const len = tagpos[index][1];

            delete tagpos[index];

            return new Uint8Array(blob.buffer, p, len);
        }

        // convert hash of { strings : Uint8Arrays } to Uint8Array
        // format: taglen.8 tagstring size.16be (if -1, followed by size.32be) data
        obj2u8(obj) {
            let size = 0;

            for (const name in obj) {
                size += name.length + 1 + obj[name].length + 2;
                if (obj[name].length > 65534) {
                    size += 4;
                }
            }

            const blob = new Uint8Array(size);
            const view = new DataView(blob.buffer);
            let p = 0;

            for (const name in obj) {
                blob[p] = name.length;
                for (let i = name.length; i--;) {
                    blob[p + i + 1] = name.charCodeAt(i);
                }

                p += name.length + 1;

                size = obj[name].length;
                if (size < 65535) {
                    view.setUint16(p, size);
                    p += 2;
                }
                else {
                    view.setInt16(p, -1);
                    view.setUint32(p + 2, size);
                    p += 6;
                }

                blob.set(obj[name], p);
                p += size;
            }

            return blob;
        }

        // revert the above with zero data copying (no error checking is performed)
        u82obj(blob) {
            let p = 0;
            const obj = Object.create(null);
            const view = new DataView(blob.buffer, blob.byteOffset);

            while (p < blob.length) {
                let size = blob[p];
                let name = '';

                for (let i = 0; i < size; i++) {
                    name += String.fromCharCode(blob[p + i + 1]);
                }

                p += size + 1;
                size = view.getUint16(p);

                if (size === 65535) {
                    size = view.getUint32(p + 2);
                    p += 4;
                }

                obj[name] = new Uint8Array(blob.buffer, blob.byteOffset + p + 2, size);
                p += size + 2;
            }

            return obj;
        }

        uint32u8(val) {
            const u8 = new Uint8Array(4);
            new DataView(u8.buffer).setUint32(0, val);
            return u8;
        }

        u8uint32(blob) {
            return new DataView(blob.buffer).getUint32(blob.byteOffset);
        }

        u82str(blob) {
            let b = '';

            for (let i = 0; i < blob.length; i++) {
                b += String.fromCharCode(blob[i]);
            }

            return b;
        }

        // converts sharekeys into a series of struct { handle[6]; key[16]; } in a Uint8Array
        serialiseShareKeys(keys) {
            const blob = new Uint8Array(Object.keys(keys).length * 23);
            const view = new DataView(blob.buffer);
            let p = 0;

            for (const h in keys) {
                const bh = atob(h);

                for (let i = 0; i < 6; i++) {
                    blob[p + i] = bh.charCodeAt(i);
                }

                for (let i = 4; i--;) {
                    view.setInt32(p + 6 + i * 4, keys[h][0][i]);
                }

                if (this.trustedsharekeys[h]) {
                    blob[p + 22] = this.trustedsharekeys[h] | 0;
                }

                p += 23;
            }

            return blob;
        }

        // replaces u_sharekeys with the contents of the serialised blob
        // retains existing records if possible to reduce overhead
        deserialiseShareKeys(blob) {
            const view = new DataView(blob.buffer, blob.byteOffset);

            for (let p = 0; p < blob.length; p += 23) {
                const h = ab_to_base64(blob.slice(p, p + 6).buffer);
                const k = [view.getInt32(p + 6), view.getInt32(p + 10), view.getInt32(p + 14), view.getInt32(p + 18)];

                // we recycle the old u_sharekeys[] record if it is unchanged
                if (!u_sharekeys[h] || !this.equal(u_sharekeys[h][0], k)) {
                    if (d && u_sharekeys[h]) {
                        logger.warn(`Replacing share-key for ${h}`, u_sharekeys[h][0], k);
                    }
                    crypto_setsharekey2(h, k);
                }

                if (blob[p + 22]) {
                    this.trustedsharekeys[h] = blob[p + 22] | 0;
                }

                this.deserialisedsharekeys[h] = true;
            }
        }

        // unpack target / share node handles from binary blob
        u82backups(blob) {
            const r = this.u82obj(blob);

            for (const backupid in r) {
                const ahandles = ab_to_base64(r[backupid]);

                r[backupid] = [ahandles.substr(0, 8), []];

                for (let i = 8; i < ahandles.length; i += 8) {
                    r[backupid][1].push(ahandles.substr(i, 8));
                }
            }

            return r;
        }

        // pack target / share node handles and tlv-encode to blob
        backups2u8(backups) {
            const r = Object.create(null);

            for (const backupid in backups) {
                r[backupid] = new Uint8Array(
                    base64_to_ab(backups[backupid][0] + backups[backupid][1].join('')),
                    0,
                    (backups[backupid][1].length + 1) * 6
                );
            }

            return this.obj2u8(r);
        }

        // compare [typed]array/string
        equal(a, b) {
            const len = a.length;

            if (len === b.length) {
                let i = -1;
                while (++i < len) {
                    if (a[i] !== b[i]) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        }

        // serialise and encrypt
        async getKeysContainer() {
            const {u_k} = window;
            const iv = crypto.getRandomValues(new Uint8Array(12));

            if (!this.gcmkey) {
                await this.setKey(u_k);
            }
            assert(this.equal(this.gcmkey.bk, u_k), 'Unexpected GCM Key..');

            const ciphertext = await crypto.subtle.encrypt(
                {name: "AES-GCM", iv},
                this.gcmkey,
                this.serialise()
            );

            return ab_to_str(new Uint8Array([20, 0])) + ab_to_str(iv) + ab_to_str(ciphertext);
        }

        // decrypt and unserialise
        async importKeysContainer(s, stage) {
            if (s === this.prevkeys) {
                if (d) {
                    logger.debug('The current ^!keys were written by ourselves, not processing.');
                }
                return;
            }
            this.prevkeys = s;

            if (d) {
                logger.warn('Importing keys...', s && s.length);
            }

            // header format: 20 / reserved (always 0)
            if (s.charCodeAt(0) !== 20) {
                throw new SecurityError('Unexpected key repository, please try again later.');
            }
            const algo = {name: "AES-GCM", iv: this.str2u8(s.substr(2, 12))};
            const {u_k} = window;

            if (!this.gcmkey) {
                await this.setKey(u_k);
            }
            assert(this.equal(this.gcmkey.bk, u_k), 'Unexpected GCM Key.');

            const res = await crypto.subtle.decrypt(algo, this.gcmkey, this.str2u8(s.substr(14)))
                .catch((ex) => {
                    logger.error(ex);
                    throw new SecurityError(`Your key repository cannot be read (${s.length}) Please try again later.`);
                });

            if (!this.unserialise(new Uint8Array(res))) {
                throw new SecurityError(`
                    The cryptographic state of your account appears corrupt.
                    Your data cannot be accessed safely. Please try again later.
                `);
            }
            logger.assert(this.generation > 0, `Unexpected generation... ${this.generation}`, typeof this.generation);

            if (this.generation) {
                const lastKnown = parseInt(await this.getGeneration().catch(dump));

                if (lastKnown && this.generation < lastKnown) {

                    if (stage === -0x4D454741) {
                        logger.warn('downgrade-attack? verifying...', lastKnown, this.generation);

                        return this.fetchKeyStore().dump('KeyMgr.staged.fetch');
                    }
                    logger.error('downgrade attack', lastKnown, this.generation);
                    eventlog(99812, JSON.stringify([4, this.generation, lastKnown]));

                    /**
                    msgDialog('warninga', l[135], `
                      A downgrade attack has been detected. Removed shares may have reappeared. Please tread carefully.
                    `);
                     /**/
                }
                else if (!lastKnown || this.generation > lastKnown) {
                    return this.setGeneration(this.generation).catch(dump);
                }
            }
            /** @returns void */
        }

        // newest known generation persistence.
        async setGeneration(generation) {
            const key = `keysgen_${u_handle}`;

            tryCatch(() => localStorage.setItem(key, generation))();
            await M.setPersistentData(key, generation).catch(dump);
            /** @returns void */
        }

        async getGeneration() {
            const {u_handle} = window;
            console.assert(String(u_handle).length === 11, 'check this..', u_handle);

            const key = `keysgen_${u_handle}`;
            let value = parseInt(tryCatch(() => localStorage.getItem(key))()) || 0;

            if (typeof M.getPersistentData === 'function') {
                const dbValue = parseInt(await M.getPersistentData(key).catch(nop)) || 0;

                if (dbValue !== value) {
                    if (dbValue > value) {
                        logger.warn('Redundancy collision, db > ls', dbValue, value);
                    }
                    else {
                        logger.warn('Redundancy collision, ls > db', value, dbValue);
                    }
                }

                value = Math.max(value, dbValue);
            }

            return value || false;
        }

        // fetch current state from versioned user variable ^!keys
        async fetchKeyStore() {
            if (d) {
                logger.warn('*** FETCH', this.commitPromise, this.fetchPromise);
            }

            // piggyback onto concurent commit()s
            if (this.commitPromise) {
                return this.commitPromise;
            }

            // aggregate concurrent fetch()es
            if (this.fetchPromise) {
                return this.fetchPromise;
            }
            this.fetchPromise = mega.promise;

            kmWebLock(() => syncRemoteKeysAttribute(this))
                .catch((ex) => {
                    // @todo recover/repair the keys-container (?)
                    logger.error(ex);
                    logger.error(ex);
                    logger.error(ex);
                    eventlog(99813, JSON.stringify([4, String(ex).trim().split('\n')[0]]));
                })
                .finally(() => {
                    this.resolveCommitFetchPromises(false);
                });

            return this.fetchPromise;
        }

        // tells whether initialization took place and the keyrings are available.
        unableToCommit() {
            if (!this.version) {
                if (d) {
                    logger.warn('*** NOT LOADED, cannot commit.');
                }
                return -1;
            }

            if (!u_keyring || !u_privCu25519) {
                if (d) {
                    logger.warn('*** INCOMPLETE STATE, cannot commit.');
                }
                return -2;
            }

            if (window.pfid) {
                if (d) {
                    logger.error('*** INVALID STATE, cannot commit under a folder-link.');
                }
                return -3;
            }

            return false;
        }

        // commit current state to ^!keys
        // cmds is an array of supplemental API commands to run with the attribute put
        async commit(cmds) {
            if (this.unableToCommit()) {
                assert(!cmds);
                this.pendingcommit = !!this.version;
                return true;
            }
            if (d) {
                logger.warn('*** COMMIT', this.commitPromise, this.fetchPromise);
            }

            // piggyback onto concurrent fetch() (it will signal a failed commit(), triggering a retry)
            if (this.fetchPromise) {
                return this.fetchPromise;
            }

            if (this.commitPromise) {
                // only the first commit() must return success
                // all subsequent concurrent (piggybacking) commit()s must return failure so that they get retried
                if (!this.commitRetryPromise) {
                    this.commitRetryPromise = mega.promise;
                }
                return this.commitRetryPromise;
            }

            this.commitPromise = mega.promise;

            kmWebLock(() => this.updateKeysAttribute(cmds))
                .then((res) => {

                    if (d && this.versionclash) {
                        logger.log('Resolved versioning clash after %d retries', this.versionclash | 0);
                    }

                    this.versionclash = false;
                    this.resolveCommitFetchPromises(res || true);
                })
                .catch((ex) => {

                    if (this.versionclash) {

                        if (this.versionclash > 4) {
                            eventlog(99814, true);
                            logger.error("Too many versioning-clash errors -- FIXME.", ex);
                        }

                        if (d) {
                            logger.warn('Retrying last commit on version clash...', this.versionclash, ex);
                        }
                    }
                    else if (d) {
                        logger.error('*** FAIL', ex);
                    }

                    tSleep(2 + -Math.log(Math.random()) * 4)
                        .then(() => this.resolveCommitFetchPromises(false));
                });

            this.pendingcommit = false;
            return this.commitPromise;
        }

        async updateKeysAttribute(cmds) {
            // tentatively increment generation and store
            const generation = ++this.generation;

            return this.getKeysContainer()
                .then((result) => {
                    this.prevkeys = result;

                    return mega.attr.set2(cmds, 'keys', result, -2, true, true);
                })
                .then((result) => {
                    assert(generation === this.generation);

                    if (d) {
                        logger.log(`new generation ${generation}`, result);
                    }
                    return this.setGeneration(generation).catch(dump).then(() => result);
                })
                .catch(async(ex) => {

                    if (ex === EEXPIRED) {

                        if (d) {
                            logger.warn('Version clash, retrieving remote attribute...', this.versionclash);
                        }

                        this.versionclash++;
                        await syncRemoteKeysAttribute(this);
                    }

                    throw ex;
                });
        }

        // overlapping commit()s/fetch()s are not permitted
        // this resets and then resolves all related promises
        resolveCommitFetchPromises(r) {
            const p = this.commitPromise;
            this.commitPromise = false;

            const rp = this.commitRetryPromise;
            this.commitRetryPromise = false;

            const fp = this.fetchPromise;
            this.fetchPromise = false;

            if (d) {
                logger.warn('Resolving promises...', r, p, rp, fp);
            }

            if (p) {
                p.resolve(r);
            }

            if (rp) {
                rp.resolve(false);
            }

            if (fp) {
                fp.resolve();
            }
        }

        // commit() with autoretry until successful
        // no-op if we haven't fetched or initialised yet
        async commitWithRetry() {
            if (!this.generation) {
                return;
            }

            const {generation} = this;

            while (!await this.commit() || generation === this.generation) {
                if (d) {
                    logger.log('commit with retry');
                }
            }
        }

        // take snapshot of the prevailing sharekeys at backup creation time
        async setBackup(id, node) {
            if (!this.generation) {
                return;
            }

            do {
                this.backups[id] = [node, await this.pathShares(node)];
            } while (!await this.commit());
        }

        async setUpload(id, node) {
            this.uploads[id] = [node, await this.pathShares(node)];
        }

        // returns a shared node's path back to root
        async pathShares(node) {
            const sharedNodes = [node, []];

            if (!M.d[node]) {
                await dbfetch.acquire(node);
            }
            this.setRefShareNodes(sharedNodes);

            return sharedNodes[1];
        }

        async cacheVerifiedPeerKeys(userHandle) {
            const promises = [];

            if (typeof userHandle !== 'string' || userHandle.length !== 11) {
                logger.error('Got invalid user-handle...', userHandle, typeof userHandle);
                return;
            }

            const cuMissing =
                pubCu25519[userHandle] ? authring.getContactAuthenticated(userHandle, 'Cu25519') ? 0 : -2 : -1;

            const edMissing =
                pubEd25519[userHandle] ? authring.getContactAuthenticated(userHandle, 'Ed25519') ? 0 : -2 : -1;

            if (d) {
                logger.debug('Cache peer-key for %s', userHandle, cuMissing, edMissing);
            }

            if (cuMissing) {
                promises.push(crypt.getPubCu25519(userHandle, true));
            }

            if (edMissing) {
                promises.push(crypt.getPubEd25519(userHandle, true));
            }

            return promises.length && Promise.all(promises)
                .catch((ex) => {
                    logger.warn(`pub-key(s) retrieval failed for ${userHandle}`, [ex]);
                    eventlog(99815, JSON.stringify([2, userHandle, String(ex).trim().split('\n')[0]]));
                });
        }

        haveVerifiedKeyFor(userHandle) {
            if (typeof userHandle !== 'string' || userHandle.length !== 11) {
                logger.error('Got invalid user-handle..', userHandle, typeof userHandle);
                return false;
            }

            // trusted key available?
            const ed = authring.getContactAuthenticated(userHandle, 'Ed25519');
            const cu = authring.getContactAuthenticated(userHandle, 'Cu25519');

            if (d) {
                const msg = 'Checking verified status for %s... (cu=%s, ed=%s)';
                logger.debug(msg, userHandle, cu && cu.method, ed && ed.method);

                if (!cu) {
                    logger.warn(`Cu25519 for ${userHandle} not yet cached...`);
                }
            }

            if (!this.manualVerification) {
                // if no manual verification required, still check Ed25519 public key is SEEN

                return ed && ed.method >= authring.AUTHENTICATION_METHOD.SEEN;
            }

            return cu && cu.method >= authring.AUTHENTICATION_METHOD.SIGNATURE_VERIFIED
                && ed && ed.method >= authring.AUTHENTICATION_METHOD.FINGERPRINT_COMPARISON;
        }

        // encrypt blob to peer (keys must be cached)
        encryptTo(blob, userHandle) {
            if (!this.haveVerifiedKeyFor(userHandle)) {
                return false;
            }

            return this.ph._encryptKeysTo([blob], userHandle);
        }

        // decrypt blob from peer (keys must be cached) (returns array of KEY_SIZE chunks)
        decryptFrom(blob, userHandle) {
            if (!this.haveVerifiedKeyFor(userHandle)) {
                return false;
            }

            const r = this.ph._decryptKeysFrom(blob, userHandle);

            if (Array.isArray(r)) {
                return r[0];
            }

            return false;
        }

        // try decrypting inshares based on the current key situation
        async decryptInShares() {

            if (!pkPull.dsLock) {
                pkPull.dsLock = mega.promise;

                let shares = mega.infinity && array.unique((await fmdb.get('s')).map(n => n.t || n.h));

                onIdle(() => {
                    const {resolve} = pkPull.dsLock;

                    const promises = [];
                    if (!shares.length) {
                        shares = Object.keys(u_sharekeys);
                    }

                    if (d) {
                        logger.warn(`Checking missing keys for... ${shares}`);
                    }

                    for (let i = shares.length; i--;) {

                        promises.push(decryptShareKeys(shares[i]));
                    }

                    Promise.allSettled(promises)
                        .then((res) => self.d && logger.info('decryptInShares', res))
                        .finally(() => {
                            pkPull.dsLock = false;
                            resolve();
                        });
                });
            }

            return pkPull.dsLock;
        }

        // pending inshare keys (from this.pendinginshares)
        // from peers whose keys are verified and cached will be decrypted, set and removed from ^!keys
        async acceptPendingInShareCacheKeys(stub) {
            if (!this.generation) {
                return;
            }
            const getEncryptedKey = (n, t) => {
                let key = null;

                if (t.byteLength - 8 > 16) {
                    key = tryCatch(() => base64urldecode(ab_to_str(new Uint8Array(t.buffer, t.byteOffset + 8, 22))))();

                    if (self.d) {
                        logger.warn('long key for %s, trying base64->binary...', n, key && key.length, key, [t]);
                    }
                }

                return [key, ab_to_str(new Uint8Array(t.buffer, t.byteOffset + 8, 16))];
            };
            const decryptFrom = tryCatch((s, u) => this.decryptFrom(s, u));
            const decrypt = tryCatch((n, u, t) => {
                const [k1, k2] = getEncryptedKey(n, t);

                return k1 && decryptFrom(k1, u) || decryptFrom(k2, u);
            });

            // (new users appearing during the commit attempts will not be cached and have to wait for the next round)
            do {
                let changed = typeof stub === 'function' && stub() || false;

                for (const node in this.pendinginshares) {
                    const t = this.pendinginshares[node];
                    const u = ab_to_base64(new Uint8Array(t.buffer, t.byteOffset, 8));
                    const k = u_sharekeys[node];

                    const sharekey = decrypt(node, u, t);

                    if (sharekey) {
                        // decrypted successfully - set key and delete record
                        crypto_setsharekey(node, str_to_a32(sharekey), false, true);
                        delete this.pendinginshares[node];
                        changed = true;

                        if (d) {
                            if (k) {
                                const k1 = Uint32Array.from(k[0]);
                                const k2 = Uint32Array.from(u_sharekeys[node][0]);
                                const eq = this.equal(k1, k2);

                                logger.info('share-key decrypted and replaced for %s', node, eq || [k1, k2]);
                            }
                            else {
                                logger.info('share-key decrypted for %s', node);
                            }
                        }
                    }
                    else if (k && d) {
                        logger.debug('cannot (yet) decrypt share-key for %s, leaving existing one...', node);
                    }
                    else if (d) {
                        logger.debug('cannot (yet) decrypt share-key for %s', node);
                    }
                }

                if (!changed) {
                    if (d) {
                        logger.warn('acceptPendingInShareCacheKeys: Nothing changed.');
                    }
                    break;
                }
            } while (!await this.commit());
        }

        // cache peer public keys required to decrypt pendinginshare
        // then, try to decrypt them and persist the remainder for retry later
        async acceptPendingInShares(stub, hold) {
            const users = Object.create(null);

            // cache senders' public keys
            for (const node in this.pendinginshares) {
                const {buffer, byteOffset} = this.pendinginshares[node];

                users[ab_to_base64(new Uint8Array(buffer, byteOffset, 8))] = 1;
            }

            await Promise.all(Object.keys(users).map(uh => this.cacheVerifiedPeerKeys(uh)));

            const res = this.acceptPendingInShareCacheKeys(stub);

            const ds = this.decryptInShares().catch(dump);
            if (hold) {
                await ds;
            }

            return res;
        }

        // fetch pending inshare keys from the API, decrypt inshares for trusted sender keys, store in ^!keys otherwise
        // (idempotent operation)
        async fetchPendingInShareKeys() {

            if (!this.version || pkPull.lock) {
                logger.debug('Cannot fetch pending in-share keys atm.', this.version, this.pendingpullkey, pkPull.lock);
                this.pendingpullkey = true;
                return pkPull.lock;
            }
            this.pendingpullkey = false;

            pkPull.lock = this._fetchPendingInShareKeys(pkPull.smbl)
                .catch((ex) => {
                    if (ex !== ENOENT) {

                        throw ex;
                    }
                })
                .finally(() => {

                    pkPull.lock = false;

                    if (this.pendingpullkey) {
                        this.pendingpullkey = false;

                        onIdle(() => {
                            this.fetchPendingInShareKeys().catch(dump);
                        });
                    }
                });

            return pkPull.lock;
        }

        async _fetchPendingInShareKeys(auth) {
            let rem, stub;

            assert(auth === pkPull.smbl, 'invalid invocation.');
            await authring.waitForARSVLP('fetch-pending-share-keys');

            if (d) {
                logger.warn('Fetching pending in-share keys...');
            }

            // fetch pending inshare keys and add them to pendinginshares
            const {result: res} = await api.req({a: 'pk'}).catch(nop) || {};

            if (typeof res == 'object') {
                if (d) {
                    logger.info('pk.res', res);
                }
                rem = res.d;
                delete res.d;

                // ensure required sender key(s) are available...
                await Promise.all(Object.keys(res).map(uh => this.cacheVerifiedPeerKeys(uh))).catch(dump);

                stub = () => {
                    let changed = false;

                    for (const userHandle in res) {
                        const uhab = new Uint8Array(base64_to_ab(userHandle), 0, 8);

                        for (const node in res[userHandle]) {
                            // construct userhandle / key blob and add it to pendinginshares
                            const t = new Uint8Array(24);

                            t.set(uhab);
                            t.set(new Uint8Array(base64_to_ab(res[userHandle][node])), 8);

                            changed = true;
                            this.pendinginshares[node] = t;

                            if (d) {
                                logger.info('Creating pending incoming share record for %s, %s', node, ab_to_base64(t));
                            }
                        }
                    }

                    return changed;
                };
            }

            // decrypt trusted keys, store the remaining ones
            await this.acceptPendingInShares(stub, this.shouldWaitForMKCompletion);

            // we can now delete the fetched inshare keys from the queue
            // (if this operation fails, no problem, it's all idempotent)
            return rem && api.req({a: 'pk', d: rem});
        }

        // sanity check: don't allow inshare keys on cloud drive nodes
        isInShare(node) {
            for (; ;) {
                if (!M.d[node]) {
                    // we have reached the parent of the inshare
                    return true;
                }
                if (!M.d[node].p) {
                    // no parent: cloud drive root
                    return false;
                }

                node = M.d[node].p;
            }
        }

        // tells whether the node belongs to a trusted share
        isTrusted(node) {
            if (!this.trustedsharekeys[node]) {
                console.assert(!this.secure || u_sharekeys[node], 'share-clash..');
                return false;
            }

            return this.secure;
        }

        // meant to append cr-element only once during share
        hasNewShareKey(node) {
            return !(this.trustedsharekeys[node] & 2);
        }

        // write out a new share-key was successfully used in s/s2.cr
        async setUsedNewShareKey(node) {
            this.removeShareSnapshot(node);

            if (!this.trustedsharekeys[node]
                || this.trustedsharekeys[node] & 2) {

                return;
            }

            do {

                this.trustedsharekeys[node] |= 2;
            }
            while (!await this.commit());
        }

        // write out an out-share was successfully revoked, so s/s2.cr shall be used when sharing again.
        async revokeUsedNewShareKey(node) {
            if (!this.trustedsharekeys[node]) {
                return;
            }

            logger.warn(`Out-Share ${node} revoked, cleaning bit 1 flag...`);

            if (!(this.trustedsharekeys[node] & 2)) {
                logger.warn('... the flag was not set, though.');
                return;
            }

            do {

                this.trustedsharekeys[node] &= ~2;
            }
            while (!await this.commit());
        }

        // creates a sharekey for a node and sends the subtree's shareufskeys to the API
        // FIXME: (this must be called right before opening the share dialog
        //         to prevent the API from clandestinely adding nodes later)
        async createShare(node, fromsetsharekey) {
            let sharekey;

            if (u_sharekeys[node]) {
                sharekey = u_sharekeys[node][0];
            }
            else {
                sharekey = [...crypto.getRandomValues(new Int32Array(4))];

                if (this.secure) {
                    this.trustedsharekeys[node] = true;
                }
            }

            // take a snapshot of the current tree under node
            // (FIXME: repeat snapshot upon commit() clashing once sn tagging is implemented to
            // prevent race conditions)

            // sharekey holds either the existing or the newly created sharekey.
            // commit it to ^!keys.
            do {
                // save sharekey (since fetch() does not delete it, there is no need to set it again
                // after a commit failure...  just leaving it in the loop to be robust against that
                // approach changing
                if (!u_sharekeys[node]) {
                    crypto_setsharekey2(node, sharekey);
                }

                // also, authorise this sharekey to be targeted by active backups and uploads
                // also, authorise this sharekey to be targeted for ongoing uploads
                this.addShare(node, this.uploads);
                this.addShare(node, this.backups);
            } while (!this.deserialisedsharekeys[node] && !await this.commit());

            if (!fromsetsharekey) {
                crypto_setsharekey(node, u_sharekeys[node][0], true, true);
            }
        }

        // delete u_sharekeys[node] and commit the change to ^!keys
        async deleteShares(nodes) {
            do {
                let changed = false;

                for (let i = nodes.length; i--;) {
                    if (u_sharekeys[nodes[i]]) {
                        delete u_sharekeys[nodes[i]];
                        delete this.trustedsharekeys[nodes[i]];
                        delete this.deserialisedsharekeys[nodes[i]];
                        changed = true;
                    }
                }

                const {byteLength} = this.pendingoutshares || {};
                if (byteLength) {
                    const tmp = expungePendingOutShares(this.pendingoutshares, nodes);

                    if (tmp.byteLength !== byteLength) {
                        this.pendingoutshares = tmp;
                        changed = true;
                    }
                }

                if (!changed) {
                    if (d) {
                        logger.warn('deleteShares: Nothing changed.');
                    }
                    break;
                }
            } while (!await this.commit());
        }

        // share-key revocation.
        enqueueShareRevocation(handles) {

            if (this.delSharesQueue) {

                for (let i = handles.length; i--;) {

                    this.delSharesQueue.add(handles[i]);
                }
            }
            else {
                this.delSharesQueue = new Set(handles);

                const assertSafeState = (t) => {
                    const {fmdb} = window;

                    if (!fmdb || fmdb.crashed) {
                        const state = fmdb ? 'crashed' : 'unavailable';

                        throw new SecurityError(`Cannot revoke share-keys, FMDB is ${state} (${t})`);
                    }
                };

                tSleep(2)
                    .then(() => {
                        const handles = [...this.delSharesQueue];
                        this.delSharesQueue = null;

                        assertSafeState(1);
                        return dbfetch.geta(handles).then(() => handles);
                    })
                    .then((handles) => {
                        assertSafeState(2);

                        for (let i = handles.length; i--;) {
                            const h = handles[i];

                            if (M.d[h]) {
                                logger.warn(`Cannot revoke share-key for ${h}, node exists...`);
                                handles.splice(i, 1);
                            }
                            else {

                                fmdb.del('ok', h);
                            }
                        }

                        if (d) {
                            logger.warn('Revoking share-keys...', handles);
                        }

                        return this.deleteShares(handles);
                    })
                    .catch((ex) => logger.error(ex))
                    .finally(() => logger.info('Share-keys revocation finished.'));
            }
        }

        // authorise all uploads or backups under node to encrypt to sharekey
        // structure of uploads/backups: id => [node, [key1, key2, ...]]
        addShare(sharenode, t) {
            for (const id in t) {
                for (let p = t[id][0]; p; p = M.d[p].p) {
                    if (p === sharenode) {
                        t[1].push(sharenode);
                    }
                }
            }
        }

        // the user just opened the sharing dialog:
        // we create a snapshot of the child nodes (unless we already have one)
        // and authorise further uploads/backups into the tree
        // FIXME: add reentrant behaviour
        async setShareSnapshot(node) {

            // snapshot exists?
            if (!this.sharechildren[node]) {
                this.createShare(node).catch(dump);
                this.sharechildren[node] = await M.getNodes(node, true);
            }
        }

        // retrieve previously created share-nodes snapshot
        getShareSnapshot(node) {
            return this.sharechildren[node];
        }

        // remove previously created share-nodes snapshot
        removeShareSnapshot(node) {
            delete this.sharechildren[node];
        }

        // create pending outshare key records and try to send them to
        // the target users (requiring them to have a verified public key)
        async sendShareKeys(node, users) {
            if (d) {
                logger.info('*** sending share-keys', users, [node]);
            }

            if (!(typeof node === 'string' && node.length === 8 && Array.isArray(users) && users.length)) {
                logger.warn('Cannot send share keys with the provided parameters..', node, users);
                return false;
            }

            if (sNodeUsers[node]) {
                sNodeUsers[node].push(...users);
            }
            else {
                sNodeUsers[node] = [...users];
            }

            if (!this.sendShareKeysLock) {
                this.sendShareKeysLock = mega.promise;

                onIdle(() => {
                    const {resolve, reject} = this.sendShareKeysLock;

                    const nodes = Object.keys(sNodeUsers);
                    const users = Object.values(sNodeUsers);

                    this.sendShareKeysLock = null;
                    sNodeUsers = Object.create(null);

                    this.createPendingOutShares(nodes, users)
                        .then(resolve)
                        .catch(reject)
                        .finally(() => {
                            this.completePendingOutShares().catch(dump);
                        });
                });
            }

            return this.sendShareKeysLock;
        }

        // pending outshares
        // associate targetuser (handle or email address) with a node
        async createPendingOutShares(nodes, targets) {
            if (!this.generation) {
                return;
            }

            do {
                let t = this.pendingoutshares;

                for (let u = 0; u < nodes.length; ++u) {
                    const node = nodes[u];
                    const targetusers = targets[u];

                    if (d) {
                        logger.info(`Creating pending out-share with ${node} for...`, targetusers);
                    }

                    for (let j = 0; j < targetusers.length; ++j) {
                        const targetuser = targetusers[j];

                        if (targetuser.length && targetuser.length < 256) {

                            if (!targetuser.includes('@') && targetuser.length === 11) {
                                // store as NUL + 12-byte node-user pair
                                const tt = new Uint8Array(t.length + 15);

                                tt.set(new Uint8Array(base64_to_ab(node + targetuser), 0, 14), 1);
                                tt.set(t, 15);
                                t = tt;
                            }
                            else if (targetuser !== 'EXP') {
                                // store as targetuser.length + 8-byte node plus ASCII email address + targetuser
                                const tt = new Uint8Array(t.length + targetuser.length + 7);

                                tt[0] = targetuser.length;
                                tt.set(new Uint8Array(base64_to_ab(node), 0, 6), 1);

                                // eslint-disable-next-line max-depth -- @todo
                                for (let i = 0; i < targetuser.length; i++) {
                                    tt[i + 7] = targetuser.charCodeAt(i);
                                }
                                tt.set(t, targetuser.length + 7);
                                t = tt;
                            }
                        }
                    }
                }

                if (t === this.pendingoutshares) {
                    if (d) {
                        logger.warn('createPendingOutShares: Nothing changed.');
                    }
                    break;
                }

                this.pendingoutshares = t;

            } while (!await this.commit());
        }

        // remove pending outshares
        // nodes, nodeusers and nodeemails are objects with keys indicating the outshare to be removed
        // { nodehandle : 1 }, { nodehandle + userhandle : 1 }, { nodehandle + email : 1 }
        async deletePendingOutShares(nodes, nodeusers = false, nodeemails = false) {
            // keyMgr not intialised yet - bail
            if (!this.pendingoutshares.byteLength) {
                return;
            }

            do {
                const tmp = expungePendingOutShares(this.pendingoutshares, nodes, nodeusers, nodeemails);

                if (tmp.byteLength === this.pendingoutshares.byteLength) {
                    if (d) {
                        logger.warn('deletePendingOutShares: Nothing changed.');
                    }
                    break;
                }

                this.pendingoutshares = tmp;

            } while (!await this.commit());
        }

        // complete all pending outshares that have a userhandle attached for which we have an authenticated public key
        // (this is idempotent and must be called at app start to cater for aborts during the previous run)
        async completePendingOutShares() {
            if (!this.generation || !this.pendingoutshares.byteLength) {
                return;
            }

            // first, expand the binary pendingoutshares blob
            const t = this.pendingoutshares;
            const pending = [];
            const users = Object.create(null);

            for (let p = 0; p < t.length;) {
                let uh = null;

                if (t[p]) {
                    // pending user - email address
                    const email = String.fromCharCode.apply(null, t.subarray(p + 7, t[p] + p + 7));

                    // FIXME: risk of crossover attacks
                    if (email) {
                        uh = M.getUserByEmail(email).u;

                        if (uh) {
                            pending.push([ab_to_base64(new Uint8Array(t.buffer, t.byteOffset + p + 1, 6)), uh, email]);
                        }
                    }
                    else {
                        logger.error('Empty email on pending out-shares store..', p, t[p]);
                    }

                    p += t[p] + 7;
                }
                else {
                    // known user handle
                    const nodeuser = ab_to_base64(new Uint8Array(t.buffer, t.byteOffset + p + 1, 14));

                    uh = nodeuser.substr(8, 11);
                    pending.push([nodeuser.substr(0, 8), uh]);
                    p += 15;
                }

                if (uh) {
                    users[uh] = 1;
                }
            }

            // step 1: cache recipients' keys
            await Promise.all(Object.keys(users).map(uh => this.cacheVerifiedPeerKeys(uh)));

            // step 2: encrypt sharekeys to cached recipients and queue to the API
            const deletePendingNode = [];
            const deletePendingNodeUser = Object.create(null);
            const deletePendingNodeEmail = Object.create(null);

            for (let i = pending.length; i--;) {
                if (u_sharekeys[pending[i][0]]) {    // do we still have a sharekey for the node?
                    // attempt completion for pending outshares that have a userhandle attached
                    const shareKeyForPeer = this.encryptTo(a32_to_str(u_sharekeys[pending[i][0]][0]), pending[i][1]);

                    if (shareKeyForPeer) {
                        api_req({a: 'pk', u: pending[i][1], h: pending[i][0], k: base64urlencode(shareKeyForPeer)});
                        deletePendingNodeUser[pending[i][0] + pending[i][1]] = true;

                        if (pending[i][2]) {
                            deletePendingNodeEmail[pending[i][0] + pending[i][2]] = true;
                        }
                    }
                }
                else {
                    // we have no sharekeys for the node - delete
                    deletePendingNode.push(pending[i][0]);
                }
            }

            return this.deletePendingOutShares(deletePendingNode, deletePendingNodeUser, deletePendingNodeEmail);
        }

        // adjust the permitted sharekeys for any backup or upload under
        // the nodes being moved through locally initiated action
        async moveNodesApiReq(cmds) {
            if (!this.generation) {
                return api.screq(cmds);
            }

            while (1) {

                // we temporarily instantly speculatively complete the moves
                for (let i = 0; i < cmds.length; i++) {
                    const n = M.d[cmds[i].n];
                    if (n && n.t) {
                        // a folder is being moved - record old parent and move it to the new location
                        cmds[i].pp = n.p;
                        n.p = cmds[i].t;
                    }
                }

                let changed = false;

                // and then replace the permitted backup sharekeys
                for (const backupid in this.backups) {
                    // FIXME: detect changes
                    changed |= this.setRefShareNodes(this.backups[backupid]);
                }

                // also replace permitted upload sharekeys
                for (const uploadid in this.uploads) {
                    // FIXME: detect changes
                    this.setRefShareNodes(this.uploads[uploadid]);
                }

                // undo speculative instant completion
                // FIXME - this is prone to race condition by concurrent user action or actionpackets
                for (let i = 0; i < cmds.length; i++) {
                    if (cmds[i].pp) {
                        const n = M.d[cmds[i].n];

                        if (n && n.p === cmds[i].t) {
                            // a folder is being moved - record old parent and move it to the new location
                            n.p = cmds[i].pp;
                        }

                        delete cmds[i].pp;
                    }
                }

                if (!changed || this.unableToCommit()) {
                    return api.screq(cmds);
                }

                const res = await this.commit(cmds);
                if (res) {
                    return res;
                }
            }
        }

        // this replaces MegaData.getShareNodesSync
        // if a backupid or an uploadid are supplied, only authorised share nodes are returned
        setRefShareNodes(sn, root, all) {
            const sh = [];
            const [h, a] = sn;
            const ss = a.join(',');

            let n = M.d[h];
            while (n && n.p) {
                if (u_sharekeys[n.h]) {

                    if (all || n.su || n.shares || M.ps[n.h]) {

                        sh.push(n.h);
                    }
                    else if (d) {
                        logger.warn(`Skipping share-key for ${n.h} which seems no longer shared...`);
                    }
                }
                n = M.d[n.p];
            }

            if (root) {
                root.handle = n && n.h;
            }

            sn[1] = sh;
            return sh.join(',') !== ss;
        }

        async setWarningValue(key, value) {
            assert(typeof key === 'string' && key.length > 1 && key.length < 5, `Invalid key name (${key})`);

            do {
                if (value === undefined) {
                    if (!(key in this.warnings)) {
                        // nothing to do, doesn't exist.
                        return;
                    }
                    delete this.warnings[key];
                }
                else {
                    if (!(value instanceof Uint8Array)) {

                        if (typeof value === 'number') {
                            // we got a raw number, store as 32-bits integer.
                            value = this.uint32u8(value);
                        }
                        else {
                            if (typeof value === 'boolean') {
                                value = String(+value);
                            }

                            // threat anything else as raw 8-bit ASCII strings.
                            value = this.str2u8(`${value}`);
                        }
                    }

                    this.warnings[key] = value;
                }
            }
            while (!await this.commit());
        }

        async removeWarningValue(key) {
            return this.setWarningValue(key);
        }

        getWarningValue(key, type) {
            if (key in this.warnings) {
                const val = this.warnings[key];

                if (type) {
                    return this.u8uint32(val);
                }

                return this.u82str(val);
            }
            return false;

        }

        // record share situation at the beginning of an ordinary (non-backup) upload
        snapshotUploadShares(uploadid, target) {
            // @todo fixme
            // this.uploads[uploadid] = [target, this.setRefShareNodes(target)];
        }

        // returns a data structure with all incomplete shares [[out],[in]]
        // with out/in arrays of strings concatenating the node with the peeruser handle
        getPendingShares() {
            const r = [[], []];
            const t = this.pendingoutshares;

            if (t) {
                for (let p = 0; p < t.length;) {
                    if (t[p]) {
                        p += t[p] + 7;
                    }
                    else {
                        // known user handle
                        r[0].push(ab_to_base64(new Uint8Array(t.buffer, t.byteOffset + p + 1, 14)));
                        p += 15;
                    }
                }

                for (const node in this.pendinginshares) {
                    const t = this.pendinginshares[node];
                    r[1].push(node + ab_to_base64(new Uint8Array(t.buffer, t.byteOffset, 8)));
                }
            }

            return r;
        }

        get didLoadFromAPI() {
            return !mega.loadReport || mega.loadReport.mode === 2;
        }

        get gotHereFromAFolderLink() {
            return folderlink === 0;
        }

        get shouldWaitForMKCompletion() {
            Object.defineProperty(this, 'shouldWaitForMKCompletion', {
                value: false,
                configurable: true,
            });
            return this.didLoadFromAPI && this.gotHereFromAFolderLink;
        }
    };
});

mBroadcaster.addListener('fm:initialized', () => {
    'use strict';

    if (folderlink) {
        return;
    }

    if (u_type > 0) {
        let state = null;
        const logger = MegaLogger.getLogger('KeyMgr');

        const dspSequentialPendingEvents = (v) => {
            const seq = [];

            if (mega.keyMgr.pendingpullkey) {
                seq.push(() => {
                    if (d) {
                        logger.warn('Dispatching pending pk..');
                    }
                    return mega.keyMgr.fetchPendingInShareKeys();
                });
            }
            else if (mega.keyMgr.shouldWaitForMKCompletion) {
                // navigated from a folder-link, check for pending shares and missing keys.
                seq.push(() => {
                    if (d) {
                        logger.warn('checking for pending shares and missing keys...');
                    }
                    return mega.keyMgr.acceptPendingInShares(null, true).catch(dump);
                });
            }

            seq.push(() => {
                if (mega.keyMgr.pendingcommit) {
                    if (d) {
                        logger.warn('Dispatching pending commit...');
                    }
                    return mega.keyMgr.commit();
                }
            });

            if (Object(self.M).fireKeyMgrDependantActions) {

                seq.push(() => {
                    if (d) {
                        logger.debug('firing dependant actions...');
                    }
                    return M.fireKeyMgrDependantActions(v).catch(dump);
                });
            }

            logger.info('Dispatching sequential pending events...', v, seq.length);

            return seq.reduce((p, f) => p.then(f), Promise.resolve(v));
        };

        Promise.all([authring.onAuthringReady('KeyMgr'), mega.keyMgr.getGeneration()])
            .then(([, keyMgrGeneration]) => {
                console.assert(window.u_attr, `u(attr) cleaned(?) check this.. (${keyMgrGeneration})`);
                if (!window.u_attr) {
                    return;
                }
                const keys = u_attr['^!keys'];

                state = [
                    mega.keyMgr.version,
                    mega.keyMgr.generation,
                    keyMgrGeneration,
                    keys ? keys.length : -1
                ].join(':');

                if (!keyMgrGeneration && mega.keyMgr.version > 0) {
                    logger.error('Unstable local-storage...', state);
                    keyMgrGeneration = mega.keyMgr.generation;
                }

                if (keys) {
                    assert(!mega.keyMgr.pendingcommit, 'We were about to import keys, but there is a pending commit.');
                }
                else if (!keyMgrGeneration) {
                    assert(!mega.keyMgr.generation, `Unexpected State.`);
                }
                assert(window.u_privCu25519 && u_privCu25519.length === 32, 'Caught Invalid Cu25119 Key.');

                if (keys || !keyMgrGeneration) {
                    delete u_attr['^!keys'];

                    // Save now complete crypto state to ^!keys
                    return mega.keyMgr.initKeyManagement(keys)
                        .then(dspSequentialPendingEvents)
                        .catch((ex) => {

                            if (keys && !mega.keyMgr.secure) {
                                logger.warn(ex);

                                mega.keyMgr.reset();
                                return mega.keyMgr.initKeyManagement();
                            }

                            throw ex;
                        });
                }

                return dspSequentialPendingEvents();
            })
            .catch((ex) => {
                logger.error(`key-manager error (${state})`, ex);

                if (!window.buildOlderThan10Days) {

                    eventlog(99811, JSON.stringify([4, String(ex).trim().split('\n')[0], state]));
                }
            })
            .finally(() => logger.info('Setup finished...'));
    }

    return 0xDEAD;
});

var date_months = [];

var locale = "en";

var remappedLangLocales = {
    "cn": "zh-Hans",
    "ct": "zh-Hant",
    "kr": "ko",
    "jp": "ja",
    "tl": "fil",
    "br": "pt"
};

// Arabic speaking countries
var arabics = ['DZ', 'BH', 'TD', 'KM', 'DJ', 'EG', 'ER', 'IQ', 'JO', 'KW', 'LB', 'LY',
    'MR', 'MA', 'OM', 'PS', 'QA','SA', 'SO', 'SS', 'SY', 'TZ', 'TN', 'AE', 'YE'];

$.dateTimeFormat = Object.create(null);
$.acc_dateTimeFormat = Object.create(null);

if (typeof l === 'undefined') {
    l = [];
}

/**
 * Convert all instances of [$nnn] e.g. [$102] to their localized strings
 * @param {String} html The html markup
 * @returns {String}
 */
function translate(html) {
    'use strict';

    /**
     * String.replace callback
     * @param {String} match The whole matched string
     * @param {Number} localeNum The locale string number
     * @param {String} namespace The operation, if any
     * @returns {String} The localized string
     */
    var replacer = function(match, localeNum, namespace) {

        if (namespace) {
            match = localeNum + '.' + namespace;
            localeNum = match;
        }

        // XXX: Seeing this warning could simply mean we forgot to replace entity tags
        //      within populate_l(), or it may indicate a worse issue where html pages
        //      are used before startMega() have finished. Also, injecting them in the
        //      DOM to manipulate it later is something we should avoid doing as well.
        // FIXME: we will for now whitelist onboarding strings doing so though...
        if (d && /\[\w+]/.test(l[localeNum]) && (localeNum < 17566 || localeNum > 17577) && localeNum != 23718) {
            console.warn('locale string %s does contain raw entity tags', localeNum, [l[localeNum]]);
        }

        if (typeof l[localeNum] === 'string') {
            return String(l[localeNum]);
        }

        // if the type is an object (not simple), then it's not allowed on HTML
        console.error(`locale l[${localeNum}] is used in HTML, not a string, val= ${JSON.stringify(l[localeNum])}`);

        return l[localeNum];
    };

    return String(html).replace(/\[\$(\w+)(?:\.(\w+))?\]/g, replacer);
}

/**
 * Loads localisation for images
 * Apply the locale-img class and the data-baseimg attribute for the image to be loaded in its localised version
 *    Images will be loaded from /images/mega/locale/lang_data-baseimg
 *        If the locale image is not present /images/mega/locale/en_data-baseimg will be used
 * For language codes see languages defined in secureboot
 *
 * @param {string|jQuery} scope The optional scope to perform the load on
 * @returns {void} void
 */
function localeImages(scope) {
    'use strict';
    const $imgs = $('.locale-img', scope || 'body');
    const fallbackLang = 'en';
    const prepImg = ($img, src, fbsrc) => {
        const img = new Image();
        const onload = () => {
            $img.replaceWith(img);
        };
        const onerr = () => {
            if (fbsrc) {
                if (d) {
                    console.warn(`Image ${src} missing. Using fallback`);
                }
                prepImg($img, fbsrc, undefined);
            }
            else if (d) {
                console.error(`Error loading fallback image ${src}`);
            }
        };
        img.classList = $img.get(0).classList;
        if (typeof img.decode === 'function') {
            img.src = src;
            img.decode().then(onload).catch(onerr);
        }
        else {
            img.onload = onload;
            img.onerror = onerr;
            img.src = src;
        }
    };
    for (let i = 0; i < $imgs.length; i++) {
        if ($imgs.eq(i).attr('data-baseimg')) {
            const base = $imgs.eq(i).attr('data-baseimg');
            $imgs.eq(i).removeAttr('data-baseimg');
            const ls = `${staticpath}images/mega/locale/${lang}_${base}`;
            const fs = `${staticpath}images/mega/locale/${fallbackLang}_${base}`;
            prepImg($imgs.eq(i), ls, fs);
        }
    }
}

/**
 * Set Date time object for time2date
 *
 * Examples by format value (NZ locale all made on Monday, 3 October 2022):
 * 1:       3/10/2022
 * 2:       3 October 2022
 * 3:       October 2022
 * 4:       Monday, 3 October 2022
 * 5:       Monday, 3 October 2022 at 10:30:00 NZDT
 * 6:       Oct 2022
 * 7:       Monday, 3 October 2022 at 10:30 NZDT
 * 8:       3 October 2022
 * 9:       3 October 2022
 * 10:      Mon
 * 11:      Monday
 * 12:      Oct
 * 13:      October
 * 14:      2022
 * 15:      3 Oct
 * 16:      3
 * 17:      3/10/22
 * 18:      3 Oct 2022
 * 19:      Mon, 3 Oct
 * 20:      Mon, 3 Oct 2022
 * 21:      13:30
 * 22:      1:30 pm
 *
 * @param {String} locales Locale string
 * @param {Number} format format number for the case.
 */
function setDateTimeFormat(locales, format) {

    "use strict";

    // Set date format
    var options = {hourCycle: 'h23'};

    if (format < 10) {
        options.year = 'numeric';
        options.month = format >= 2 ? 'long' : 'numeric';
        options.day = format === 3 || format === 6 ? undefined : 'numeric';
        options.weekday = format === 4 || format === 5 ? 'long' : undefined;

        if (format === 0 || format === 5 || format === 7) {
            options.minute = 'numeric';
            options.hour = 'numeric';
            if (format === 5) {
                options.second = 'numeric';
                options.timeZoneName = 'short';
            }
        }

        if (format === 6) {
            options.month = 'short';
        }
        if (format === 7) {
            options.weekday = 'long';
            options.timeZoneName = 'short';
        }
    }
    // Set non full date format
    else {
        switch (format) {
            case 10:
                options.weekday = 'short';
                break;
            case 11:
                options.weekday = 'long';
                break;
            case 12:
                options.month = 'short';
                break;
            case 13:
                options.month = 'long';
                break;
            case 14:
                options.year = 'numeric';
                break;
            case 15:
                options.month = 'short';
                options.day = 'numeric';
                break;
            case 16:
                options.day = 'numeric';
                break;
            case 17:
                options.year = '2-digit';
                options.month = 'numeric';
                options.day = 'numeric';
                break;
            case 18:
                options.day = 'numeric';
                options.month = 'short';
                options.year = 'numeric';
                break;
            case 19:
                options.weekday = 'short';
                options.day = 'numeric';
                options.month = 'long';
                break;
            case 20:
                options.weekday = 'short';
                options.day = 'numeric';
                options.month = 'long';
                options.year = 'numeric';
                break;
            case 21:
                options.hourCycle = 'h23';
                options.hour = 'numeric';
                options.minute = 'numeric';
                break;
            case 22:
                options.hourCycle = undefined;
                options.hour = 'numeric';
                options.minute = 'numeric';
                break;
        }
    }

    // Create new DateTimeFormat object if it is not exist
    try {
        $.dateTimeFormat[locales + '-' + format] = typeof Intl !== 'undefined' ?
            new Intl.DateTimeFormat(locales, options) : 'ISO';

        // If locale is Arabic and country is non-Arabic country, not set, or not logged in
        if (locale === 'ar' && (!u_attr || !u_attr.country || arabics.indexOf(u_attr.country) < 0)) {
            // To avoid Firefox bug, set Egypt as default country.
            $.dateTimeFormat[locales + '-' + format] = new Intl.DateTimeFormat('ar-AE', options);
        }
    }
    catch (e) {
        $.dateTimeFormat[locales + '-' + format] = format > 1 ? new Intl.DateTimeFormat(locale, options) : 'ISO';
    }
}

/**
 * Converts a timestamp to a readable time format - e.g. 2016-04-17 14:37
 * If user selected use ISO date formate, short date format will using ISO date format.
 * If user selected country on the setting using it to find locale.
 * If user did not selected country, assume country with ip address and apply date format.
 * e.g. US: mm/dd/yyyy, NZ: dd/mm/yyyy, CN: yyyy/mm/dd
 *
 * @param {Number} unixTime  The UNIX timestamp in seconds e.g. 1464829467
 * @param {Number} [format]  The readable time format to return
 * @returns {String}
 *
 * Formats (examples are ISO date format):
 *       0: yyyy-mm-dd hh:mm (Short date format with time)
 *       1: yyyy-mm-dd (Short date format without time)
 *       2: yyyy fmn dd (fmn: Full month name, based on the locale) (Long Date format)
 *       3: yyyy fmn (fmn: Full month name, based on the locale) (Long Date format without day)
 *       4: Monday, yyyy fmn dd (fmn: Full month name, based on the locale) (Long Date format with weekday)
 *       5: Monday, yyyy fmn dd hh:mm:ss TZ (fmn: Full month name, based on the locale)
 *                                                                  (Long Date format with weekday, time, and timezone)
 *       6: yyyy mm (Short Date format without day and time)
 *
 * Non full date formats:
 *       10: Mon (Only day of the week long version)
 *       11: Monday (Only day of the week short version)
 *       12: Jan (Only month short version)
 *       13: January (Only month long version)
 *       14: 2021 (Only year)
 *       15: dd mm (Date format with short month and without time and year)
 *       16: dd (Only day)
 */
function time2date(unixTime, format) {
    'use strict';
    var date = new Date(unixTime * 1000 || 0);
    var result;
    var dateFunc;
    var countryAndLocales = getCountryAndLocales();

    format = format || 0;

    // If dateTimeFormat is not set with the current locale set it.
    if ($.dateTimeFormat[countryAndLocales.locales + '-' + format] === undefined) {
        setDateTimeFormat(countryAndLocales.locales, format);
    }

    var dFObj = $.dateTimeFormat[countryAndLocales.locales + '-' + format];

    // print time as ISO date format
    var printISO = function _printISO() {
        var timeOffset = date.getTimezoneOffset() * 60;
        var isodate = new Date((unixTime - timeOffset) * 1000 || 0);
        var length = format === 0 ? 16 : 10;
        return isodate.toISOString().replace('T', ' ').substr(0, length);
    };

    dateFunc = dFObj === 'ISO' ? printISO : dFObj.format;

    // if it is short date format and user selected to use ISO format
    if ((fmconfig.uidateformat || countryAndLocales.country === 'ISO') && format < 2) {
        result = printISO();
    }
    else {
        result = dateFunc(date);
    }

    return result;
}

/**
 * Set Date time object for acc_time2date
 * @param {String} locales Locale string
 */
function setAccDateTimeFormat(locales) {

    "use strict";

    // Set acc date format
    var options = {month: 'long', day: 'numeric', year: 'numeric'};
    var nYOptions = {month: 'long', day: 'numeric'};

    // Create new DateTimeFormat object if it is not exist
    try {
        $.acc_dateTimeFormat[locales] = typeof Intl !== 'undefined' ?
            new Intl.DateTimeFormat(locales, options) : 'fallback';
        $.acc_dateTimeFormat[locales + '-noY'] = Intl ? new Intl.DateTimeFormat(locales, nYOptions) : 'fallback';

        // If locale is Arabic and country is non-Arabic country or non set,
        if (locale === 'ar' && (!u_attr || !u_attr.country || arabics.indexOf(u_attr.country) < 0)) {
            // To avoid Firefox bug, set Egypt as default country.
            $.acc_dateTimeFormat[locales] = new Intl.DateTimeFormat('ar-AE', options);
            $.acc_dateTimeFormat[locales + '-noY'] = new Intl.DateTimeFormat('ar-AE', nYOptions);
        }
    }
    catch (e) {
        $.acc_dateTimeFormat[locales] = new Intl.DateTimeFormat(locale, options);
        $.acc_dateTimeFormat[locales + '-noY'] = new Intl.DateTimeFormat(locale, nYOptions);
    }
}

/**
 * Function to create long date format for current locales.
 * @param {Number} unixtime The UNIX timestamp in seconds e.g. 1464829467
 * @param {Boolean} yearIsOptional Optional, set year for the date format as optional
 * @returns {String} result Formatted date.
 */
function acc_time2date(unixtime, yearIsOptional) {

    var MyDate = new Date(unixtime * 1000 || 0);
    var locales = getCountryAndLocales().locales;
    var currYear = l.year;
    var result;

    // If dateTimeFormat is already set with the current locale using it.
    if (!$.acc_dateTimeFormat[locales]) {
        setAccDateTimeFormat(locales);
    }

    if (yearIsOptional && currYear === MyDate.getFullYear()) {
        locales += '-noY';
    }

    if ($.acc_dateTimeFormat[locales] === 'fallback') {
        result = date_months[MyDate.getMonth()] + ' ' + MyDate.getDate();
        if (yearIsOptional && currYear === MyDate.getFullYear()) {
            result += MyDate.getFullYear();
        }
    }
    else {
        var dateFunc = $.acc_dateTimeFormat[locales].format;
        result = dateFunc(MyDate);
    }

    if (locale === 'en') {
        var date = MyDate.getDate();
        var lb = date.toString().slice(-1);
        var th = 'th';
        if (lb === '1' && date !== 11) {
            th = 'st';
        }
        else if (lb === '2' && date !== 12) {
            th = 'nd';
        }
        else if (lb === '3' && date !== 13) {
            th = 'rd';
        }

        result = result.replace(date, date + th);
    }

    return result;
}

function time2last(timestamp, skipSeconds) {
    var sec = Date.now() / 1000 - timestamp;
    if (skipSeconds && sec < 59) {
        return l[23252] || "Less then a minute ago";
    }
    else if (sec < 4) {
        return l[880];
    }
    else if (sec < 59) {
        return mega.icu.format(l.second_last_count, Math.ceil(sec));
    }
    else if (sec < 3540) {
        return mega.icu.format(l.minute_last_count, Math.ceil(sec / 60));
    }
    else if (sec < 82000) {
        return mega.icu.format(l.hour_last_count, Math.ceil(sec / 3600));
    }
    return mega.icu.format(l.day_last_count, Math.ceil(sec / 86400));
}

/**
 * Function to create long date format for current locales.
 * @param {Number} expiry The UNIX timestamp in seconds that the offer expires OR seconds until offer expires.
 * @param {Boolean} remainingGiven Optional, are the remaining seconds given, otherwise is a UNIX timestamp.
 * @returns {String} result Formatted date.
 */
function time2offerExpire(expiry, remainingGiven) {
    'use strict';
    const remainingSecs = remainingGiven ? expiry : expiry - Date.now() / 1000;
    // Expired
    if (remainingSecs <= 0) {
        return l.notif_offer_expired;
    }
    else if (remainingSecs < 60) {
        return mega.icu.format(l.notif_offer_exp_second, Math.floor(remainingSecs));
    }
    else if (remainingSecs < 3600) {
        const mins = Math.floor(remainingSecs / 60);
        const secs = Math.floor(remainingSecs % 60);
        return l.notif_offer_exp_minute_second.replace('%1', mins).replace('%2', secs);
    }
    else if (remainingSecs < 86400) {
        return mega.icu.format(l.notif_offer_exp_hour, Math.floor(remainingSecs / 3600));
    }
    return mega.icu.format(l.notif_offer_exp_day, Math.floor(remainingSecs / 86400));
}

/*
 * Calculate start and end of calendar on the week/month/year contains time passed or today.
 *
 * @param {String} type  type of calendar to calculate. 'w' for week, 'm' for month, 'y' for year
 * @param {Number} [unixTime]  The UNIX timestamp in seconds e.g. 1464829467
 * @returns {Object}
 */
function calculateCalendar(type, unixTime) {

    'use strict';

    unixTime = unixTime * 1000 || Date.now();

    var time = new Date(unixTime);
    var startDate;
    var endDate;

    if (type === 'd') {
        startDate = endDate = time;
    }
    else if (type === 'w') {
        var timeDay = time.getDay();

        startDate = new Date(unixTime - 86400000 * timeDay);
        endDate = new Date(unixTime + 86400000 * (6 - timeDay));
    }
    else if (type === 'm') {
        var timeMonth = time.getMonth();

        startDate = new Date(unixTime);
        startDate.setDate(1);

        endDate = new Date(unixTime);

        // End date of months can be vary and cause issue when update month, lets set it for 15 for now.
        endDate.setDate(15);
        endDate.setMonth(timeMonth + 1);
        endDate.setDate(0); // -1 day from next month
    }
    else if (type === 'y') {
        var timeYear = time.getFullYear();

        startDate = new Date(unixTime);
        startDate.setDate(1);
        startDate.setMonth(0);

        endDate = new Date(unixTime);
        endDate.setFullYear(timeYear + 1);
        endDate.setMonth(0);
        endDate.setDate(0);
    }
    else {
        return false;
    }

    startDate = startDate.setHours(0, 0, 0, 0) / 1000;
    endDate = endDate.setHours(23, 59, 59, 0) / 1000;

    return {start: startDate, end: endDate};
}

/**
 * Function to get date time structure for current locale.
 * @returns {String|Boolean} result Date structure as 'ymd', 'dmy', or 'mdy' or false if errored.
 */
function getDateStructure() {

    'use strict';

    // Date made with unique number 1987-04-23.
    var uniqTime = new Date(1987, 3, 23);
    var uniqUnix = uniqTime.getTime() / 1000 | 0;
    var index = [];
    var localeTime = time2date(uniqUnix, 1);
    var result;
    if (locale !== 'ar') {
        // thai case using buddhist calendar, 1987 in gregorian calendar is 2530 in buddhist calendar
        index.y = (locale === 'th') ? localeTime.indexOf(2530) : localeTime.indexOf(1987);
        index.m = localeTime.indexOf(4);
        index.d = localeTime.indexOf(23);

        result = Object.keys(index).sort(function(a, b) {
            return index[a] - index[b];
        }).join('');
    }
    else {
        // Arabic special
        var locales = getCountryAndLocales().locales;

        var options_y = {year: 'numeric'}; // Format only Day
        var options_m = {month: 'numeric'}; // Format only Month
        var options_d = {day: 'numeric'}; // Format only Year

        locales = !u_attr || !u_attr.country || arabics.indexOf(u_attr.country) < 0 ? 'ar-AE' : locales;

        try {
            if (typeof Intl !== 'undefined') {
                var locale_y = new Intl.DateTimeFormat(locales, options_y).format(uniqTime);
                var locale_m = new Intl.DateTimeFormat(locales, options_m).format(uniqTime);
                var locale_d = new Intl.DateTimeFormat(locales, options_d).format(uniqTime);

                index.y = localeTime.indexOf(locale_y);
                index.m = localeTime.indexOf(locale_m);
                index.d = localeTime.indexOf(locale_d);

                result = Object.keys(index).sort(function(a, b) {
                    return index[b] - index[a];
                }).join('');
            }
            else {
                return false;
            }
        }
        catch (e) {
            return false;
        }
    }

    return result;
}

/**
 * Basic calendar math function (using moment.js) to return true or false if the date passed in is either
 * the same day or the previous day.
 *
 * @param dateString {String|int}
 * @param [refDate] {String|int}
 * @returns {Boolean}
 */
function todayOrYesterday(dateString, refDate) {
    "use strict";
    var targetDate = new Date(dateString);
    var today = refDate ? new Date(refDate) : new Date();

    // 24h only limit
    if ((today - targetDate) / 1e3 < 172800) {
        var yesterday = new Date(today / 1);
        yesterday.setDate(yesterday.getDate() - 1);

        return today.getDay() === targetDate.getDay() || yesterday.getDay() === targetDate.getDay();
    }
    return false;
}

/**
 * Basic calendar math function (using moment.js) that will return a string, depending on the exact calendar
 * dates/months ago when the passed `dateString` had happened.
 *
 * @param dateString {String|int}
 * @param [refDate] {String|int}
 * @returns {String}
 */
function time2lastSeparator(dateString, refDate) {
    var momentDate = moment(dateString);
    var today = moment(refDate ? refDate : undefined).startOf('day');
    var yesterday = today.clone().subtract(1, 'days');
    var weekAgo = today.clone().startOf('week').endOf('day');
    var twoWeeksAgo = today.clone().startOf('week').subtract(1, 'weeks').endOf('day');
    var thisMonth = today.clone().startOf('month').startOf('day');
    var thisYearAgo = today.clone().startOf('year');

    if (momentDate.isSame(today, 'd')) {
        // Today
        return l[1301];
    }
    else if (momentDate.isSame(yesterday, 'd')) {
        // Yesterday
        return l[1302];
    }
    else if (momentDate.isAfter(weekAgo)) {
        // This week
        return l[1303];
    }
    else if (momentDate.isAfter(twoWeeksAgo)) {
        // Last week
        return l[1304];
    }
    else if (momentDate.isAfter(thisMonth)) {
        // This month
        return l[1305];
    }
    else if (momentDate.isAfter(thisYearAgo)) {
        // This year
        return l[1306];
    }
    else {
        // more then 1 year ago...
        return l[1307];
    }
}

/**
 * Gets the current UNIX timestamp
 * @returns {Number} Returns an integer with the current UNIX timestamp (in seconds)
 */
function unixtime() {
    'use strict';
    return Math.round(Date.now() / 1000);
}

function uplpad(number, length) {
    'use strict';
    var str = String(number);
    while (str.length < length) {
        str = '0' + str;
    }
    return str;
}

function secondsToTime(secs, html_format) {
    'use strict';

    if (isNaN(secs) || secs === Infinity) {
        return '--:--:--';
    }
    if (secs < 0) {
        return '';
    }

    var hours = uplpad(Math.floor(secs / (60 * 60)), 2);
    var divisor_for_minutes = secs % (60 * 60);
    var minutes = uplpad(Math.floor(divisor_for_minutes / 60), 2);
    var divisor_for_seconds = divisor_for_minutes % 60;
    var seconds = uplpad(Math.floor(divisor_for_seconds), 2);
    var returnvar = hours + ':' + minutes + ':' + seconds;

    if (html_format) {
        hours = (hours !== '00') ? (hours + '<span>h</span> ') : '';
        returnvar = hours + minutes + '<span>m</span> ' + seconds + '<span>s</span>';
    }
    return returnvar;
}

function secondsToTimeShort(secs) {
    'use strict';
    var val = secondsToTime(secs);

    if (!val) {
        return val;
    }

    if (val.substr(0, 1) === "0") {
        val = val.substr(1, val.length);
    }
    if (val.substr(0, 2) === "0:") {
        val = val.substr(2, val.length);
    }

    return val;
}

function hoursToSeconds(hours) {
    'use strict';
    return hours * 60 * 60;
}

function secondsToHours(seconds) {
    'use strict';
    return seconds / (60 * 60);
}

function daysToSeconds(days) {
    'use strict';
    return days * 24 * 60 * 60;
}

function secondsToDays(seconds) {
    'use strict';
    return seconds / (24 * 60 * 60);
}

function formatTimeField(field, value) {
    'use strict';
    return `${value}${field} `;
}

function secondsToTimeLong(secs) {
    'use strict';

    if (isNaN(secs) || secs === Infinity) {
        return '--:--:--';
    }
    if (secs < 0) {
        return '';
    }

    const years = Math.floor(secs / (365 * 24 * 60 * 60));
    const divisor_for_months = secs % (365 * 24 * 60 * 60);
    const months = Math.floor(divisor_for_months / (30 * 24 * 60 * 60));
    const divisor_for_days = divisor_for_months % (30 * 24 * 60 * 60);
    const days = Math.floor(divisor_for_days / (24 * 60 * 60));
    const divisor_for_hours = divisor_for_days % (24 * 60 * 60);
    const hours = uplpad(Math.floor(divisor_for_hours / (60 * 60)), 2);
    const divisor_for_minutes = divisor_for_hours % (60 * 60);
    const minutes = uplpad(Math.floor(divisor_for_minutes / 60), 2);
    const divisor_for_seconds = divisor_for_minutes % 60;
    const seconds = uplpad(Math.floor(divisor_for_seconds), 2);

    const fields = ['y', 'm', 'd', 'h', 'm'];
    const values = [years, months, days, hours, minutes];
    const time_fields = [];

    for (let i = 0; i < values.length; i++) {
        if (values[i] > 0) {
            for (let j = i; j < values.length; j++) {
                time_fields.push(formatTimeField(fields[j], values[j]));
            }
            break;
        }
    }

    time_fields.push(`${seconds}s `);

    return time_fields.join('');
}

/**
 * Calculate the number of days since the given date
 * @param {String} dateStr The date string, in YYYY-MM-DD format
 * @returns {Number} the number of days
 */
function daysSince(dateStr) {
    'use strict';
    return moment(new Date()).diff(moment(dateStr, 'YYYY-MM-DD'), 'days');
}

/**
 * Calculate the number of days since Jan 1, 2000
 * @returns {Number}
 */
function daysSince1Jan2000() {
    'use strict';
    return daysSince('2000-01-01');
}

/**
 * Function to format currency with current locale
 * @param {Number} value Value to format
 * @param {String} [currency] Currency to use in currency formatting. Default: 'EUR'
 * @param {String} [display] display type of currency format, supporting types are below:
 *                  'symbol' - use a localized currency symbol but with country code such as "NZ$",
 *                  'narrowSymbol' - use a localized currency symbol without country code such as "$" for "NZ$",
 *                  'code' - use the ISO currency code such as "NZD",
 *                  'name' - use a localized currency name such as "dollar"
 *                  'number' - just number with correct decimal
 * @param {*} noDecimals True if no decimals wanted, otherwise it is the maximum number of decimals wanted
 * @param {Number} maxDecimalPlaces Set the maximum decimal places that will be printed
 * @returns {String} formated currency value
 */
function formatCurrency(value, currency, display, noDecimals) {

    'use strict';

    value = typeof value === 'string' ? parseFloat(value) : value;
    currency = currency || 'EUR';
    display = display || 'symbol';

    var displayNumber = false;
    var narrowSymbol = false;

    if (display === 'number') {
        display = 'code';
        displayNumber = true;
    }

    if (display === 'narrowSymbol') {
        display = 'symbol';
        narrowSymbol = currency !== 'EUR'; // Euro cannot have country
    }

    const {country, locales} = getCountryAndLocales();

    var options = {'style': 'currency', 'currency': currency, currencyDisplay: display};

    if (noDecimals) {
        options.minimumFractionDigits = 0;
        options.maximumFractionDigits = noDecimals === true ? 0 : noDecimals;
    }

    var result = value.toLocaleString(locales, options);

    // For Safari that 'symbol' result same as 'code', using fallback locale without country code to avoid the bug.
    if (display === 'symbol' && result.indexOf(currency.toUpperCase()) !== -1) {

        // Romanian with Euro Symbol currency display is currently buggy on all browsers, so doing this to polyfill it
        if (locales.startsWith('ro')) {
            result = value.toLocaleString('fr', options);
        }
        else if (locales.startsWith('ar') && !arabics.includes(country)) {
            // To avoid Firefox bug, set UAE as default country.
            result = value.toLocaleString('ar-AE', options);
        }
        else {
            result = value.toLocaleString(locale, options);
        }
    }

    // Polyfill for narrow symbol format as lacking support on Safari and old browers
    if (narrowSymbol) {

        // Cover NZ$, $NZ kinds case to just $ and not change something like NZD
        result = result.replace(/\b[A-Z]{2}\b/, '');
    }

    // If this is number only, remove currency code
    if (displayNumber) {
        result = result.replace(currency, '').trim();
    }

    if (locale === 'fr' && display === 'symbol') {
        result = result.replace(/([^1-9A-Za-z])([A-Z]{2})/, '$1 $2');
    }

    return result;
}

/**
 * Function to return percentage structure as it is difference on some locale.
 * @param {Number} value Value to format
 * @param {Boolean} twoDecimals If the number should be displayed with 2 decimals
 * @returns {String} Formateed percentage value with curreny locales
 */
function formatPercentage(value, twoDecimals) {

    'use strict';

    twoDecimals = twoDecimals || false;
    const locales = getCountryAndLocales().locales;
    const options = {'style': 'percent'};

    if (twoDecimals) {
        options.maximumFractionDigits = 2;
        options.minimumFractionDigits = 2;
    }

    return value.toLocaleString(locales, options);
}

/**
 * Function to return locales(e.g. en-GB, en-NZ...) and country code
 * @returns {Object} currently selected country and locales that user chosen
 */
function getCountryAndLocales() {

    'use strict';

    let country = 'ISO';
    let locales = '';

    // If user logged in and country data is set on Mega, using it.
    if (u_attr && u_attr.country) {
        country = u_attr.country;
        locales = locale + '-' + country;
    }
    // Otherwise, try grab country data from browser's navigator.languages
    else if (Array.isArray(navigator.languages)) {

        locales = navigator.languages.filter(l => l !== locale && l.startsWith(locale))[0];

        if (locales) {
            country = locales.replace(`${locale}-`, '');
        }
    }

    // cnl is exist and has same country as u_attr return cached version.
    if ($.cnl && $.cnl.country === country) {
        return $.cnl;
    }

    locales = mega.intl.test(locales) || mega.intl.test(locale) || 'ISO';

    // If locale is Arabic and country is non-Arabic country or non set,
    if (locale === 'ar' && !arabics.includes(country)) {
        // To avoid Firefox bug, set UAE as default country.
        locales = 'ar-AE';
    }

    return $.cnl = {country: country, locales: locales};
}

//----------------------------------------------------------------------------
/**
 * Date.parse with progressive enhancement for ISO 8601 <https://github.com/csnover/js-iso8601>
 * (c) 2011 Colin Snover <http://zetafleet.com>
 * Released under MIT license.
 */
(function(Date, undefined) {
    var origParse = Date.parse,
        numericKeys = [1, 4, 5, 6, 7, 10, 11];
    Date.parse = function(date) {
        var timestamp, struct, minutesOffset = 0;

        // ES5 15.9.4.2 states that the string should attempt to be parsed as a Date Time String Format string
        // before falling back to any implementation-specific date parsing, so that's what we do, even if native
        // implementations could be faster
        //              1 YYYY                2 MM       3 DD           4 HH    5 mm       6 ss        7 msec        8 Z 9 +    10 tzHH    11 tzmm
        if ((struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date))) {
            // avoid NaN timestamps caused by "undefined" values being passed to Date.UTC
            for (var i = 0, k; (k = numericKeys[i]); ++i) {
                struct[k] = +struct[k] || 0;
            }

            // allow undefined days and months
            struct[2] = (+struct[2] || 1) - 1;
            struct[3] = +struct[3] || 1;

            if (struct[8] !== 'Z' && struct[9] !== undefined) {
                minutesOffset = struct[10] * 60 + struct[11];

                if (struct[9] === '+') {
                    minutesOffset = 0 - minutesOffset;
                }
            }

            timestamp = Date.UTC(struct[1],
                struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
        }
        else {
            timestamp = origParse ? origParse(date) : NaN;
        }

        return timestamp;
    };
}(Date));


/**
 * Returns "Today" (or "Today, 16:32" if verbose is true) if  the specific timestamp was in the past 2 days, otherwise
 * uses an absolute date stamp (1st June 2020)
 *
 * @param {Number} unixtime
 * @param {Boolean} [verbose]
 * @returns {String}
 */
function getTimeMarker(unixtime, verbose) {
    'use strict';
    var result;
    if (todayOrYesterday(unixtime * 1000)) {
        // if in last 2 days, use the time2lastSeparator
        var iso = (new Date(unixtime * 1e3)).toISOString();
        result = time2lastSeparator(iso) + (verbose ? ", " + toLocaleTime(unixtime) : "");
    }
    else {
        // if not in the last 2 days, use 1st June [Year]
        result = acc_time2date(unixtime, false);
    }
    return result;

}

/**
 * Returns formatted time string for the given timestamp. The format used is based on the user's locale and selected
 * settings, e.g. ISO formatting. Use `HH h MM` format for French locales.
 * @param {Number} unixtime UNIX timestamp, either in milliseconds or seconds.
 * @returns {String}
 */

function toLocaleTime(unixtime) {
    'use strict';
    unixtime = Math.abs(Date.now() - unixtime) < Math.abs(Date.now() - unixtime * 1000) ? unixtime / 1000 : unixtime;
    const { locales, country } = getCountryAndLocales();
    if (fmconfig.uidateformat || country === 'ISO') {
        return time2date(unixtime, 21);
    }
    return locales.startsWith('fr') ? time2date(unixtime, 22).replace(':', ' h ') : time2date(unixtime, 22);
}

//----------------------------------------------------------------------------

// eslint-disable-next-line complexity
mBroadcaster.once('boot_done', function populate_l() {
    'use strict';

    if (d) {
        const loaded = l;
        window.dstringids = localStorage.dstringids;
        l = new Proxy(loaded, {
            get: (target, prop) => {
                if (dstringids) {
                    return `[$${prop}]`;
                }

                return target[prop] ? target[prop] : `(missing-$${prop})`;
            }
        });
    }

    l[0] = 'MEGA ' + new Date().getFullYear();
    if ((lang === 'es') || (lang === 'pt') || (lang === 'sk')) {
        l[0] = 'MEGA';
    }

    // MEGA static hosts
    l.mega_help_host = 'https://help.mega.io';

    l[8762] = escapeHTML(l[8762]).replace("[S]", "<span class='red'>").replace("[/S]", "</span>");
    l[208] = escapeHTML(l[208]).replace('[/A]', '</a>');
    l['208a'] = l[208].replace('[A]', '<a href="/terms" class="red clickurl" tabindex="-1">');
    l['208.a2'] = l[208].replace('[A]', '<a href="https://mega.io/terms" tabindex="-1" target="_blank">');
    l['208s'] = l[208].replace('[A]', '<a href="https://mega.io/terms" class="red txt-bold" target="_blank">');
    l['208.g'] = l[208].replace('[A]', '<a href="https://mega.io/terms" class="green" target="_blank">');
    l['208.g2'] = l[208].replace('[A]', '<a href="/terms" class="green clickurl" target="_blank">');
    l[208] = l[208].replace('[A]', '<a href="https://mega.io/terms" class="clickurl" tabindex="-1" target="_blank">');
    l[517] = escapeHTML(l[517]).replace(
        '[A]',
        '<a href="' + l.mega_help_host + '" class="help-center-link clickurl" target="_blank">'
    ).replace('[/A]', '</a>');
    l[1094] = escapeHTML(l[1094])
        .replace('[A]', '<a href="https://mega.io/extensions" target="_blank" class="clickurl">')
        .replace('[/A]', '</a>');
    l[1095] = escapeHTML(l[1095]).replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[731] = escapeHTML(l[731])
        .replace('[A]', '<a href="https://mega.io/terms" target="_blank" class="clickurl">')
        .replace('[/A]', '</a>');
    l[1274] = escapeHTML(l[1274]).replace('[A]', '<a href="/takedown" class="clickurl">').replace('[/A]', '</a>');
    l[1275] = escapeHTML(l[1275]).replace('[A]', '<a href="/copyright" class="clickurl">').replace('[/A]', '</a>');
    l[1942] = escapeHTML(l[1942]).replace('[A]', '<a href="/keybackup" class="clickurl">').replace('[/A]', '</a>');
    l[1943] = escapeHTML(l[1943]).replace('[A]', '<a href="mailto:support@mega.nz">').replace('[/A]', '</a>');
    l[1982] = escapeHTML(l[1982]).replace('[A]', '<span class="red">').replace('[/A]', '</span>');
    l[5931] = escapeHTML(l[5931]).replace('[A]', '<a href="/fm/account" class="clickurl">').replace('[/A]', '</a>');
    l[6216] = escapeHTML(l[6216])
        .replace('[A1]', '<a href="/fm/account/security/change-email" class="clickurl">')
        .replace('[/A1]', '</a>')
        .replace('[A2]', '<a href="mailto:support@mega.nz">')
        .replace('[/A2]', '</a>');
    l[6976] = escapeHTML(l[6976]).replace('%1', '<span class="plan-name"></span>');
    l[7156] = escapeHTML(l[7156])
        .replace('[A]', '<a href="https://mega.io/mobile" target="_blank" class="clickurl">')
        .replace('[/A]', '</a>');
    l[7202] = escapeHTML(l[7202]).replace(
        '[A]',
        '<a href="https://mega.io/resellers" target="_blank" rel="noopener noreferrer" class="voucher-reseller-link">'
    ).replace('[/A]', '</a>');
    l[7709] = escapeHTML(l[7709]).replace('[S]', '<span class="complete-text">').replace('[/S]', '</span>');
    l[7945] = escapeHTML(l[7945]).replace('[B]', '<b>').replace('[/B]', '</b>');
    l[7991] = escapeHTML(l[7991])
        .replace('%1', '<span class="provider-icon"></span><span class="provider-name"></span>');
    l[7996] = escapeHTML(l[7996]).replace('[S]', '<span class="purchase">').replace('[/S]', '</span>');

    l[8436] = escapeHTML(l[8436])
        .replace('[/A]', '</a>').replace('[A]', '<a class="red" href="mailto:support@mega.nz">');
    l[8440] = escapeHTML(l[8440]).replace('[A]', '<a href="https://github.com/meganz/">').replace('[/A]', '</a>')
        .replace('[A2]', '<a href="/contact" class="clickurl">').replace('[/A2]', '</a>');
    l[8441] = escapeHTML(l[8441]).replace('[A]', '<a href="mailto:bugs@mega.nz">').replace('[/A]', '</a>')
        .replace('[A2]', `<a href="https://blog.mega.io/vulnerability-rewards-the-first-week"  target="_blank">`)
        .replace('[/A2]', '</a>');
    l[19310] = escapeHTML(l[19310])
        .replace('[A]', `<a href="https://blog.mega.io/the-mega-vulnerability-reward-program" target="_blank">`)
        .replace('[/A]', '</a>');

    l[8644] = escapeHTML(l[8644]).replace('[S]', '<span class="green">').replace('[/S]', '</span>');
    l[8651] = escapeHTML(l[8651]).replace('%1', '<span class="header-pro-plan"></span>');
    l[8653] = escapeHTML(l[8653]).replace('[S]', '<span class="renew-text">').replace('[/S]', '</span>')
        .replace('%1', '<span class="pro-plan"></span>').replace('%2', '<span class="plan-duration"></span>')
        .replace('%3', '<span class="provider-icon"></span>').replace('%4', '<span class="gateway-name"></span>');
    l[8654] = escapeHTML(l[8654]).replace('[S]', '<span class="choose-text">').replace('[/S]', '</span>');

    l[8833] = escapeHTML(l[8833]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l[8850] = escapeHTML(l[8850]).replace('%1', '<span class="release-version"></span>');
    l[8851] = escapeHTML(l[8851]).replace('%1', '<span class="release-date-time"></span>');
    l[8855] = escapeHTML(l[8855]).replace('[BR]', '<br>');
    l[8912] = escapeHTML(l[8912]).replace('[B]', '<span>').replace('[/B]', '</span>');
    l[8846] = escapeHTML(l[8846]).replace('[S]', '').replace('[/S]', '');
    l[8847] = escapeHTML(l[8847]).replace('[S]', '').replace('[/S]', '');
    l[8950] = escapeHTML(l[8950]).replace('[S]', '<span>').replace('[/S]', '</span>');
    l[8951] = escapeHTML(l[8951]).replace('[S]', '<span>').replace('[/S]', '</span>');
    l[8952] = escapeHTML(l[8952]).replace('[S]', '<span>').replace('[/S]', '</span>');

    l[10631] = escapeHTML(l[10631])
        .replace('[A]', '<a href="https://mega.io/terms/#Refunds" target="_blank" rel="noopener noreferrer">')
        .replace('[/A]', '</a>');
    l[10630] = escapeHTML(l[10630])
        .replace('[A1]',
                 `<a target="_blank" href="https://mega.io/terms#RecurringPaidSubscriptions">`)
        .replace('[A2]',
                 `<a target="_blank" href="https://mega.io/terms#Refunds">`)
        .replace('[A3]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/payments-billing/cancel-subscription">`)
        .replace(/\[\/A\d]/g, '</a>');
    l[10634] = escapeHTML(l[10634])
        .replace('[A]', '<a href="https://127.0.0.1/support" target="_blank" rel="noopener noreferrer">')
        .replace('[/A]', '</a>');

    l[10635] = escapeHTML(l[10635]).replace('[B]', '<b>').replace('[/B]', '</b>');

    l[12482] = escapeHTML(l[12482]).replace('[B]', '<b>').replace('[/B]', '</b>');
    l[12483] = escapeHTML(l[12483]).replace('[BR]', '<br>');
    l[12487] = escapeHTML(l[12487]).replace('[A1]', '<a href="" class="red windows">').replace('[/A1]', '</a>')
        .replace('[A2]', '<a href="" class="red linux">').replace('[/A2]', '</a>');
    l[12488] = escapeHTML(l[12488]).replace('[A]', '<a>').replace('[/A]', '</a>').replace('[BR]', '<br>');
    l.megasync_upload_wrong_user = escapeHTML(l.megasync_upload_wrong_user).replace(/\[BR]/g, '<br>');
    l[16116] = escapeHTML(l[16116]).replace('[S]', '<span class="red">').replace('[/S]', '</span>');

    l.bus_acc_delete_msg = escapeHTML(l.bus_acc_delete_msg)
        .replace('[S]', '<span class="red">').replace('[/S]', '</span>');

    l[16167] = escapeHTML(l[16167])
        .replace('[A]', '<a href="https://mega.io/mobile" target="_blank" class="clickurl">')
        .replace('[/A]', '</a>');
    l[16301] = escapeHTML(l[16301]).replace('[S]', '<span class="quota-info-pr-txt-used">').replace('[/S]', '</span>');
    l[16310] = escapeHTML(l[16310])
        .replace('[A]', '<a href="/fm/dashboard" class="clickurl dashboard-link">').replace('[/A]', '</a>');
    l[16317] = escapeHTML(l[16317]).replace('[S]', '<strong>').replace('[/S]', '</strong>');
    l[16494] = escapeHTML(l[16494]).replace('[S]2[/S]', '%1');
    l[25048] = escapeHTML(l[25048])
        .replace('[A]', '<a href="mailto:support@mega.nz">').replace('[/A]', '</a>');
    l[25050] = escapeHTML(l[25050])
        .replace('[A]', '<a href="mailto:support@mega.nz">').replace('[/A]', '</a>');
    l[25081] = escapeHTML(l[25081])
        .replace('[A]', '<a href="mailto:support@mega.nz">').replace('[/A]', '</a>');

    l[16649] = escapeHTML(l[16649]).replace('%1', '<span class="amount">10.00</span>');
    l[16501] = escapeHTML(l[16501]).replace('[A1]', '<a class="red" href="mailto:support@mega.nz">')
        .replace('[/A1]', '</a>')
        .replace(
            '[A2]',
            '<a class="red" target="_blank" href="'
            + l.mega_help_host
            + '/plans-storage/payments-billing/cancel-mobile-subscription'
            + '#:~:text=with%20the%20Appstore-,Android%20/%20Google,-Learn%20here%20how'
            + '">'
        )
        .replace('[/A2]', '</a>')
        .replace(
            '[A3]',
            '<a class="red" target="_blank" href="'
            + l.mega_help_host
            + '/plans-storage/payments-billing/cancel-mobile-subscription'
            + '#:~:text=your%20device%20type.-,iOS,-Learn%20here%20how'
            + '">'
        )
        .replace('[/A3]', '</a>');
    l[16614] = escapeHTML(l[16614])
        .replace('[A]', '<a class="red" href="https://thunderbird.net/" target="_blank" rel="noopener noreferrer">')
        .replace('[/A]', '</a>');
    l[16865] = escapeHTML(l[16865])
        .replace('[A]', '<a href="https://mega.io/desktop" target="_blank" class="clickurl">')
        .replace('[/A]', '</a>');
    l[16866] = escapeHTML(l[16866])
        .replace('[A]', '<a href="https://mega.io/desktop" target="_blank" class="clickurl">')
        .replace('[/A]', '</a>');
    l[16870] = escapeHTML(l[16870])
        .replace('[A]', '<a href="https://mega.io/desktop" target="_blank" class="clickurl">')
        .replace('[/A]', '</a>');
    l[16883] = escapeHTML(l[16883])
        .replace('[A]', '<a href="https://mega.io/desktop" target="_blank" class="clickurl">')
        .replace('[/A]', '</a>');
    l[17793] = escapeHTML(l[17793])
        .replace('[A1]', '<a href="https://mega.io/desktop" target="_blank" class="clickurl">')
        .replace('[/A1]', '</a>')
        .replace('[A2]', '<a href="https://mega.io/extensions" target="_blank" class="clickurl">')
        .replace('[/A2]', '</a>')
        .replace('[A3]', '<a class="freeupdiskspace">').replace('[/A3]', '</a>');

    l[17083] = escapeHTML(l[17083])
        .replace('[A]', '<a href="https://www.microsoft.com/store/apps/9nbs1gzzk3zg" target="_blank">')
        .replace('[/A]', '</a>');

    var linktohelp = l.mega_help_host + '/files-folders/restore-delete/file-version-history';
    l[17097] =  escapeHTML(l[17097])
                .replace('[A]', '<a id="versionhelp" href="' + linktohelp + '" target="_blank" class="red">')
                .replace('[/A]', '</a>');
    l[17690] = escapeHTML(l[17690]).replace('[A]', '<a href="https://127.0.0.1/recovery" target="_blank" class="red">')
                       .replace('[/A]', '</a>');
    l[17701] = escapeHTML(l[17701]).replace('[B]', '<b>').replace('[/B]', '</b>');
    l[17742] = escapeHTML(l[17742]).replace('[S]', '<strong>').replace('[/S]', '</strong>');
    l[17805] = escapeHTML(l[17805]).replace('[A]', '<a class="mobile red-email" href="mailto:support@mega.nz">')
                       .replace('[/A]', '</a>');
    l[18301] = escapeHTML(l[18301]).replace(/\[B]/g , '<b class="megasync-logo">')
        .replace(/\[\/B\]/g, '</b>').replace(/\(M\)/g, '').replace(/\[LOGO\]/g, '');
    l[18311] = escapeHTML(l[18311]).replace(/\[B1]/g, '<strong class="warning-text">')
        .replace(/\[\/B1\]/g, '</strong>');
    l[18312] = escapeHTML(l[18312]).replace(/\[B]/g , '<strong class="warning-text">')
        .replace(/\[\/B\]/g, '</strong>');

    l[18638] = escapeHTML(l[18638]).replace(/\[+[1-9B]+]/g, '<b>').replace(/\[\/+[1-9B]+]/g, '</b>');
    l[18787] = escapeHTML(l[18787])
        .replace('[A]', '<a href="https://github.com/meganz/MEGAcmd" rel="noreferrer" target="_blank">')
        .replace('[/A]', '</a>');
    l[19111] = escapeHTML(l[19111])
        .replace('[A]', `<a class="public-contact-link simpletip" data-simpletip="${l[18739]}">`)
        .replace('[/A]', '</a>');
    l[19328] = escapeHTML(l[19328]).replace('[B]', '<b>').replace('[/B]', '</b>');

    l[19512] = escapeHTML(l[19512]).replace('%1', '<span class="plan-name"></span>')
        .replace('%2', '<span class="user-email"></span>').replace('[B]', '<b>').replace('[/B]', '</b>');
    l[19513] = escapeHTML(l[19513]).replace('[A]', '<a href="mailto:support@mega.nz">').replace('[/A]', '</a>')
        .replace('%1', 2)
        .replace('%2', '<span class="user-email"></span>').replace('[B]', '<b>').replace('[/B]', '</b>');
    l[19514] = escapeHTML(l[19514]).replace('[A]', '<a href="mailto:support@mega.nz">').replace('[/A]', '</a>')
        .replace('%1', 2)
        .replace('%2', '<span class="user-email"></span>').replace('[B]', '<b>').replace('[/B]', '</b>');
    l[19661] = escapeHTML(l[19661]).replace(
        '[A]',
        '<a href="'
        + l.mega_help_host
        + '/installs-apps/desktop-syncing" class="clickurl" rel="noreferrer" target="_blank">'
    ).replace('[/A]', '</a>');
    l[19685] = escapeHTML(l[19685]).replace('[S]', '<span class="bold">').replace('[/S]', '</span>');
    l[19691] = escapeHTML(l[19691]).replace('[S]', '<span class="bold">').replace('[/S]', '</span>');
    l[19834] = escapeHTML(l[19834]).replace('[A]', '<a class="red" href="mailto:support@mega.nz">')
        .replace('[/A]', '</a>');
    l[19835] = escapeHTML(l[19835]).replace('[A]', '<a class="red" href="mailto:support@mega.nz">')
        .replace('[/A]', '</a>');
    l[19840] = escapeHTML(l[19840]).replace('[A]', '<a class="toResetLink">').replace('[/A]', '</a>');
    l[19843] = escapeHTML(l[19843]).replace('[A]', '<a class="red" href="mailto:support@mega.nz">')
        .replace('[/A]', '</a>');
    l[23052] = escapeHTML(l[23052]).replace('[A]', '<a class="red" href="mailto:business@mega.nz">')
        .replace('[/A]', '</a>');
    l[19849] = escapeHTML(l[19849]).replace('[A]', '<a class="red clickurl" href="/recovery">').replace('[/A]', '</a>');
    l[19851] = escapeHTML(l[19851]).replace('[B]', '<strong class="warning-text">').replace('[/B]', '</strong>');
    l[19857] = escapeHTML(l[19857]).replace('[BR]', '<br>');
    l[20015] = escapeHTML(l[20015])
        .replace('[A]', '<a target="_blank" class="red" rel="noopener noreferrer" href="https://127.0.0.1/keybackup">')
        .replace('[/A]', '</a>');
    l[20189] = escapeHTML(l[20189]).replace('[B]', '<b>').replace('[/B]', '</b>');
    l[20192] = escapeHTML(l[20192]).replace('[B]', '<b>').replace('[/B]', '</b>');
    l[20193] = escapeHTML(l[20193]).replace('[B]', '<b>').replace('[/B]', '</b>');
    l[20194] = escapeHTML(l[20194]).replace('[B]', '<b>').replace('[/B]', '</b>');
    l[20195] = escapeHTML(l[20195]).replace('[B]', '<b>').replace('[/B]', '</b>');
    l[23708] = escapeHTML(l[23708]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l[23709] = escapeHTML(l[23709]).replace('[B]', '').replace('[/B]', '');
    l['23789.s'] = escapeHTML(l[23789]).replace('%1', '<span></span>');
    l['23790.s'] = escapeHTML(l[23790]).replace('%1', '<span></span>');

    // Mobile only
    if (is_mobile) {
        l[16306] = escapeHTML(l[16306]).replace('[A]', '<span class="gotorub">').replace('[/A]', '</span>');
        l[20197] = escapeHTML(l[20197]).replace('[S1]', '<span class="used">').replace('[/S1]', '</span>\n')
            .replace('[S2]', '')
            .replace('[/S2]', '\n').replace('[S3]', '<span class="total">').replace('[/S3]', '</span>\n')
            .replace('$1', '0').replace('$2', '0') + '<br>';
        l[20220] = escapeHTML(l[20220]).replace('%1', '<span class="mobile user-number js-user-phone-number"></span>');
    }
    else {
        // Desktop only
        l[16306] = escapeHTML(l[16306])
            .replace('[A]', '<a href="/fm/rubbish" class="clickurl gotorub">').replace('[/A]', '</a>');
        l[20197] = escapeHTML(l[20197]).replace('[S1]', '<span class="size-txt">').replace('[/S1]', '</span>')
            .replace('[S2]', '<span class="of-txt">').replace('[/S2]', '</span>\n')
            .replace('[S3]', '<span class="pecents-txt">').replace('[/S3]', '</span>\n<span class="gb-txt">GB</span>')
            .replace('$1', '0 MB').replace('$2', '0');
    }

    l[20223] = escapeHTML(l[20223]).replace('%1', '24');  // 24 hours

    // Keep the word 'a' with the previous word by using non breaking space (TR76417)
    if (lang === 'es') {
        l[20217] = escapeHTML(l[20217]).replace(' a:', '&nbsp;a:');
    }
    l[20552] = escapeHTML(l[20552]).replace('[Br]', '<br>');
    l[20553] = escapeHTML(l[20553]).replace('[S]', '<strong>').replace('[/S]', '</strong>');
    l[20588] = escapeHTML(l[20588])
        .replace('[A]', '<a class="clickurl" href="https://mega.io/security" target="_blank">')
        .replace('[/A]', '</a>');
    l[20592] = escapeHTML(l[20592]).replace('[A1]', '').replace('[/A1]', '')
        .replace('[A2]', '<a target="_blank" rel="noopener noreferrer" href="https://127.0.0.1/SecurityWhitepaper.pdf">')
        .replace('[/A2]', '</a>');
    l[20609] = escapeHTML(l[20609])
        .replace('[A]', '<a class="clickurl" href="https://mega.io/desktop" target="_blank">')
        .replace('[/A]', '</a>');
    l[20650] = escapeHTML(l[20650]).replace(/\[S]/g, '<span>').replace(/\[\/S]/g, '</span>')
        .replace('[A]', '<a href="/repay" class="clickurl">').replace('[/A]', '</a>');
    l['20635.a'] = escapeHTML(l[20635])
        .replace('[A]', '<a class="clickurl" href="/register" data-eventid="99797">')
        .replace('[/A]', '</a>');
    l[20635] = escapeHTML(l[20635]).replace('[A]', '<a>').replace('[/A]', '</a>');
    l[20713] = escapeHTML(l[20713]).replace('[B]%1[/B]', '<b>%1</b>');
    l[20714] = escapeHTML(l[20714])
        .replace('[B1]%1[/B1]', '<b class="plan-time">%1</b>')
        .replace('[B2]%2[/B2]', '<b class="plan-name">%2</b>');
    l[20756] = escapeHTML(l[20756]).replace('[S]', '<span>').replace('[/S]', '</span>');
    l[20757] = escapeHTML(l[20757]).replace('[S]', '<span>').replace('[/S]', '</span>');
    l[20759] = escapeHTML(l[20759]).replace('[B]%1[/B]', '<b>%1</b>');
    l[20846] = escapeHTML(l[20846])
        .replace('[A]', '<a href="https://127.0.0.1/linux/repo/" target="_blank" class="download-all-link">')
        .replace('[/A]', '</a>');
    l[20923] = escapeHTML(l[20923]).replace('[S]', '<span>').replace('[/S]', '</span>');
    l[20924] = escapeHTML(l[20924]);
    l[20932] = escapeHTML(l[20932]).replace('[R/]', '<sup>&reg;</sup>');
    l[20959] = escapeHTML(l[20959]).replace('[A]', '<a class="red" href="https://127.0.0.1/SecurityWhitepaper.pdf" '
        + 'target="_blank" rel="noopener noreferrer">')
        .replace('[/A]', '</a>');
    l['20975.b'] = escapeHTML(l[20975])
        .replace('[B]', '<b class="txt-dark">').replace('[/B]', '</b>')
        .replace('[A]', '<a href="https://mega.io/security" class="clickurl green" target="_blank">')
        .replace('[/A]', '</a>');
    l[20975] = escapeHTML(l[20975]).replace('[B]', '<b class="txt-dark">').replace('[/B]', '</b>')
        .replace('[A]', '<a href="https://mega.io/security" class="clickurl red txt-bold" target="_blank">')
        .replace('[/A]', '</a>');
    l[23748] = escapeHTML(l[23748]).replace('[B]', '<b class="txt-dark">').replace('[/B]', '</b>')
        .replace('[A]', '<a href="https://mega.io/security" class="clickurl red txt-bold" target="_blank">')
        .replace('[/A]', '</a>');
    l[22074] = escapeHTML(l[22074]).replace('[S]', '<span class="purchase">').replace('[/S]', '</span>');
    l[22077] = escapeHTML(l[22077]).replace('[S]', '<span class="green strong">').replace('[S]', '</span>');
    l[22248] = escapeHTML(l[22248]).replace(/\[S]/g, '<strong>').replace(/\[\/S]/g, '</strong>');
    l[22685] = escapeHTML(l[22685]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l[22687] = escapeHTML(l[22687]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l[22688] = escapeHTML(l[22688]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l[22689] = escapeHTML(l[22689]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l[22696] = escapeHTML(l[22696]).replace('[A]', '<a class="clickurl" href="/pro">').replace('[/A]', '</a>')
        .replace('[S]', '<span class="no-buisness">').replace('[/S]', '</span>');
    l[22700] = escapeHTML(l[22700]).replace('[S]', '<i class="sprite-fm-mono icon-up"></i><span>')
        .replace('[/S]', '</span>').replace('%1', '');
    l[22723] = escapeHTML(l[22723]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l['22725.m'] = escapeHTML(l[22725]).replace('[B]', '<strong>').replace('[/B]', '*</strong>');
    l[22725] = escapeHTML(l[22725]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l['22726.m'] = escapeHTML(l[22726]).replace('[B]', '<strong>').replace('[/B]', '*</strong>');
    l[22726] = escapeHTML(l[22726]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l[22764] = escapeHTML(l[22764]).replace('[S]', '<span class="calc-price-week">').replace('[/S]', '</span>')
        .replace('%1', '');
    l['22771.a'] = escapeHTML(l[22771]).replace('[B]', '').replace('[/B]', '');
    l[22771] = escapeHTML(l[22771]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l['22772.a'] = escapeHTML(l[22772]).replace('[B]', '').replace('[/B]', '');
    l[22772] = escapeHTML(l[22772]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l[22773] = escapeHTML(l[22773]).replace('[B]', '').replace('[/B]', '');
    l[22786] = escapeHTML(l[22786]).replace('[A]', '<a href="/pro" class="clickurl">').replace('[/A]', '</a>');
    l[22791] = escapeHTML(l[22791]).replace('[A]', '<a class="to-aff-dash">').replace('[/A]', '</a>');
    l[22793] = escapeHTML(l[22793]).replace('[A1]', '<a class="clickurl" href="/business">').replace('[/A1]', '</a>')
        .replace('[A2]', '<a class="clickurl" href="/pro">').replace('[/A2]', '</a>');
    l[22795] = escapeHTML(l[22795]).replace('[A]', '<a class="to-aff-dash">').replace('[/A]', '</a>')
        .replace(/\[BR]/g, '<br/>');
    l[22796] = escapeHTML(l[22796]).replace('[A]', '<a href="/contact" class="clickurl" target="_blank">')
        .replace('[/A]', '</a>');
    l[22898] = escapeHTML(l[22898]).replace('[A]', '<a class="clickurl" href="https://mega.io/mobile" target="_blank">')
        .replace('[/A]', '</a>')
        .replace('[BR]', '<br>');
    l[22900] = escapeHTML(l[22900]).replace('[A]', '<a class="reg-success-change-email-btn">').replace('[/A]', '</a>');
    l['23062.k'] = escapeHTML(l[23062]).replace('[%s]', l[7049]);
    l[23067] = escapeHTML(l[23067]).replace('[S]', '<span class="num">').replace('[/S]', '</span>')
        .replace('%1', '<span></span>');
    l[23068] = escapeHTML(l[23068]).replace('[S]', '<span class="num">').replace('[/S]', '</span>')
        .replace('%1', '<span></span>');
    l[23069] = escapeHTML(l[23069]).replace('[S]', '<span class="num">').replace('[/S]', '</span>')
        .replace('%1', '<span></span>');
    l.about_countries_info_text = escapeHTML(l.about_countries_info_text)
        .replace('[S]', '<span class="num">').replace('[/S]', '</span>')
        .replace('%1', '<span></span>');
    l[23120] = escapeHTML(l[23120]);
    l[23126] = escapeHTML(l[23126]).replace(/\[BR]/g, '<br/>');
    let referral_program_rules = '';
    const breaks = '[BR][BR]';
    const referralProgramStrings = [
        l.referral_program_rules_p0,
        '[BR]',
        l.referral_program_rules_l0,
        l.referral_program_rules_l1,
        l.referral_program_rules_l2,
        '[BR]',
        l.referral_program_rules_p1,
        breaks,
        l.referral_program_rules_p2,
        breaks,
        l.referral_program_rules_p3,
        breaks,
        l.referral_program_rules_p4,
        breaks,
        l.referral_program_rules_p5,
        breaks,
        l.referral_program_rules_p6,
        breaks,
        l.referral_program_rules_p7,
        breaks,
        l.referral_program_rules_p8,
        breaks,
        l.referral_program_rules_p9,
        breaks,
        l.referral_program_rules_p10,
        breaks,
        l.referral_program_rules_p11,
        breaks,
        l.referral_program_rules_p12,
        breaks,
        l.referral_program_rules_p13,
        breaks,
        l.referral_program_rules_p14,
        breaks,
        l.referral_program_rules_p15,
        breaks,
        l.referral_program_rules_p16,
        breaks,
        l.referral_program_rules_p17
    ];
    for (let i = 0; i < referralProgramStrings.length; i++){
        referral_program_rules += referralProgramStrings[i];
    }
    l['referral_program_rules.d'] = escapeHTML(referral_program_rules)
        .replace(/\[P]/g, '').replace(/\[\/P]/g, '')
        .replace(/\[L]/g, '<i class="sprite-fm-mono icon-check"></i><div class="affiliate-guide info">')
        .replace(/\[\/L]/g, '</div>')
        .replace(/\[BR]/g, '<br>')
        .replace(/\[A]/g, '<a class="clickurl" href="https://mega.io/terms" target="_blank">')
        .replace(/\[\/A]/g, '</a>');
    l['referral_program_rules.m'] = escapeHTML(referral_program_rules)
        .replace(/\[P]/g, '<div class="mobile button-block no-bg"><div class="mobile label-info no-icon">')
        .replace(/\[\/P]/g, '</div></div>')
        .replace(/\[L]/g, '<div class="mobile button-block no-bg"><div class="mobile fm-icon green-tick">' +
            '</div><div class="mobile label-info">').replace(/\[\/L]/g, '</div></div>')
        .replace(/\[BR]/g, '')
        .replace(/\[A]/g, '<a class="clickurl" href="https://mega.io/terms" target="_blank">')
        .replace(/\[\/A]/g, '</a>');
    l[23214] = escapeHTML(l[23214]).replace('[A]', '<a class="fm-affiliate guide-dialog to-rules">')
        .replace('[/A]', '</a>');
    l[23243] = escapeHTML(l[23243])
        .replace('[A]', '<a href="https://mega.io/terms" class="clickurl" target="_blank">')
        .replace('[/A]', '</a>');
    l[23263] = escapeHTML(l[23263]).replace('[A]', '<a>').replace('[/A]', '</a>');
    l[23332] = escapeHTML(l[23332]).replace('[A1]', '<a href="/cmd" target="_blank" class="clickurl">')
        .replace('[/A1]', '</a>')
        .replace('[A2]', '<a class="link-qnap" href="https://www.qnap.com/en/app_center/' +
            '?qts=4.3&kw=megacmd&type_choose=&cat_choose=" target="_blank" rel="noopener noreferrer">')
        .replace('[/A2]', '</a>')
        .replace('[A3]', '<a class="link-synology" href="https://www.synology.com/en-nz/dsm/packages/MEGAcmd' +
            '" target="_blank" rel="noopener noreferrer">')
        .replace('[/A3]', '</a>');
    l[23354] = escapeHTML(l[23354]).replace('[A]', '<a href="/pro" class="clickurl">')
        .replace('[/A]', '</a>');
    l[23370] = escapeHTML(l[23370]).replace('[A]', '<a class="mailto" href="mailto:support@mega.nz">')
        .replace('[/A]', '</a>');
    l[23371] = escapeHTML(l[23371]).replace('[A]', '<a class="mailto" href="mailto:support@mega.nz">')
        .replace('[/A]', '</a>');
    l[23372] = escapeHTML(l[23372]).replace('[A]', '<a class="mailto" href="mailto:support@mega.nz">')
        .replace('[/A]', '</a>');
    l[23373] = escapeHTML(l[23373]).replace('[A]', '<a class="mailto" href="mailto:support@mega.nz">')
        .replace('[/A]', '</a>');
    l[23376] = escapeHTML(l[23376]).replace('[A]', '<a href="/security" class="clickurl" target="_blank">')
        .replace('[/A]', '</a>');
    l[24074] = escapeHTML(l[24074]).replace('[A]', '<a>').replace('[/A]', '</a>');
    l[24141] = escapeHTML(l[24141])
        .replace(
            '[A]',
            `<a class="red" href="https://blog.mega.io/mega-adds-two-factor-authentication" target="_blank">`)
        .replace('[/A]', '</a>');
    l[24431] = escapeHTML(l[24431]).replace('[A]', '<a href="/repay" class="clickurl">').replace('[/A]', '</a>')
        .replace('[S]', '<span>').replace('[/S]', '</span>');
    l[24440] = escapeHTML(l[24440]).replace('[B]', '<strong>').replace('[/B]', '</strong>');
    l[24408] = escapeHTML(l[24408]).replace('[A]', '<a href="/fm" class="clickurl">').replace('[/A]', '</a>');
    l[24409] = escapeHTML(l[24409]).replace('[A]', '<a href="/register" class="clickurl">').replace('[/A]', '</a>');
    l[24547] = escapeHTML(l[24547]).replace('[A1]', '<a target="_blank" href="/sourcecode" class="clickurl">')
        .replace('[/A1]', '</a>')
        .replace('[A2]', '<a target="_blank" href="/security" class="clickurl">')
        .replace('[/A2]', '</a>')
        .replace(/\[S]/g, '<span>').replace(/\[\/S]/g, '</span>')
        .replace(/\[BR]/g, '<br/>');
    l[24708] = escapeHTML(l[24708]).replace('%s', '" * / : < > ? \\ |');
    l[24852] = escapeHTML(l[24852])
        .replace('[A]', '<a target="_blank" class="green-link" href="https://blog.mega.io">')
        .replace('[/A]', '</a>');
    l.achievem_dialogfootertext = escapeHTML(l.achievem_dialogfootertext)
        .replace('[A]', '<a href="/pro" class="clickurl">')
        .replace('[/A]', '</a>');
    l.achievem_pagedesc = escapeHTML(l.achievem_pagedesc)
        .replace('[S]', '<span>')
        .replace('[/S]', '</span>');
    l.achievem_storagetitle = escapeHTML(l.achievem_storagetitle)
        .replace('[S]', '<span>')
        .replace('[/S]', '</span>');
    l.bsn_calc_min_storage = escapeHTML(l.bsn_calc_min_storage)
        .replace('[BR]', '<br>');
    l.bsn_calc_min_transfer = escapeHTML(l.bsn_calc_min_transfer)
        .replace('[BR]', '<br>');
    l.bsn_calc_total = escapeHTML(l.bsn_calc_total)
        .replace('[S]', '<span>')
        .replace('[/S]', '</span>')
        .replace('%1', '');
    l.bsn_page_plan_price = escapeHTML(l.bsn_page_plan_price)
        .replace('[S]', '<span>')
        .replace('[/S]', '</span>')
        .replace('%1', '');
    l.bsn_plan_users = escapeHTML(l.bsn_plan_users).replace('%1', '<span></span>');
    l.bsn_plan_storage = escapeHTML(l.bsn_plan_storage).replace('%1', '<span></span>');
    l.bsn_plan_transfer = escapeHTML(l.bsn_plan_transfer).replace('%1', '<span></span>');
    l.bsn_plan_more_users = escapeHTML(l.bsn_plan_more_users)
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>')
        .replace('%1', '');
    l.bsn_plan_more_storage = escapeHTML(l.bsn_plan_more_storage)
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>')
        .replace('%1', '');
    l.bsn_plan_more_transfer = escapeHTML(l.bsn_plan_more_transfer)
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>')
        .replace('%1', '');
    l.bsn_versioning_info = escapeHTML(l.bsn_versioning_info)
        .replace('[S]', '<span>')
        .replace('[/S]', '</span>')
        .replace('[BR]', '<br>');
    l.bsn_backup_info = escapeHTML(l.bsn_backup_info)
        .replace('[S]', '<span>')
        .replace('[/S]', '</span>')
        .replace('[BR]', '<br>');
    l.bsn_meetings_info = escapeHTML(l.bsn_meetings_info)
        .replace('[S]', '<span>')
        .replace('[/S]', '</span>')
        .replace('[BR]', '<br>');
    l.onboard_v4_control_finished = escapeHTML(l.onboard_v4_control_finished)
        .replace('[S]', '<span>').replace('[/S]', '</span>')
        .replace(
            '[A]',
            '<a class="clickurl" href="' + l.mega_help_host + '" target="_blank">'
        ).replace('[/A]', '</a>');
    l.recovery_web_step_2 = escapeHTML(l.recovery_web_step_2)
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>');
    l.recovery_ios_step_2 = escapeHTML(l.recovery_ios_step_2)
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>');
    l.warning_has_subs_with_3p = escapeHTML(l.warning_has_subs_with_3p)
        .replace('[A1]', '<a class="red" href="mailto:support@mega.nz">').replace('[/A1]', '</a>')
        .replace(
            '[A2]',
            '<a class="red" target="_blank" href="'
            + l.mega_help_host
            + '/plans-storage/payments-billing/cancel-mobile-subscription'
            + '#:~:text=with%20the%20Appstore-,Android%20/%20Google,-Learn%20here%20how'
            + '">'
        )
        .replace('[/A2]', '</a>')
        .replace(
            '[A3]',
            '<a class="red" target="_blank" href="'
            + l.mega_help_host
            + '/plans-storage/payments-billing/cancel-mobile-subscription'
            + '#:~:text=your%20device%20type.-,iOS,-Learn%20here%20how'
            + '">'
        )
        .replace('[/A3]', '</a>');
    l.redeem_etoomany = escapeHTML(l.redeem_etoomany)
        .replace('[A]', `<a class="clickurl" href="/support">`)
        .replace('[/A]', '</a>');
    l.extensions_top_btn_info = escapeHTML(l.extensions_top_btn_info).replace(/\[R\/]/g, '<sup>&reg;</sup>');
    l.extensions_avbl_desktop = escapeHTML(l.extensions_avbl_desktop).replace('[A1]', '<a href="" class="red a1"></a>');
    l.extensions_avbl_mobile = escapeHTML(l.extensions_avbl_mobile).replace(/\[S]/g, '<strong>')
        .replace(/\[\/S]/g, '</strong>');
    l.copy_to_my_backups = escapeHTML(l.copy_to_my_backups)
        .replace('[A]', '<a>').replace('[/A]', '</a>');
    l.backup_read_only_wrng = escapeHTML(l.backup_read_only_wrng)
        .replace('[S]', '<span>')
        .replace('[/S]', '</span>');
    l.cookie_banner_txt = escapeHTML(l.cookie_banner_txt)
        .replace('[A]', '<a href="/cookie" class="clickurl" target="_blank">')
        .replace('[/A]', '</a>');
    l.cookie_banner_txt_upd_cookies = escapeHTML(l.cookie_banner_txt_upd_cookies)
        .replace('[A]', '<a href="/cookie" class="clickurl" target="_blank">')
        .replace('[/A]', '</a>');
    l.backup_pcs_info = escapeHTML(l.backup_pcs_info)
        .replace('[A]', '<a>').replace('[/A]', '</a>');
    l.backup_mobiles_info = escapeHTML(l.backup_mobiles_info)
        .replace('[A]', '<a>').replace('[/A]', '</a>');

    l.ri_s4_header = escapeHTML(l.ri_s4_header)
        .replace('[A1]', '<h1>')
        .replace('[/A1]', '</h1>')
        .replace('[A2]', '<h2>')
        .replace('[/A2]', '</h2>');
    l.ri_s4_subheader = escapeHTML(l.ri_s4_subheader)
        .replace('%1', '&#8364 1,000')
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>');
    l.ri_s4_card1_desc = escapeHTML(l.ri_s4_card1_desc)
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>');
    l.ri_s4_card3_desc = escapeHTML(l.ri_s4_card3_desc)
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>');
    l.ri_s4_card4_desc = escapeHTML(l.ri_s4_card4_desc)
        .replace('%1', '&#8364 2.99')
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>');
    l.ri_s4_card5_desc = escapeHTML(l.ri_s4_card5_desc)
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>');
    l.ri_s4_betat_header = escapeHTML(l.ri_s4_betat_header)
        .replace('%1', '&#8364 1,000');
    l.ri_s4_regf_q6_ans1 = escapeHTML(l.ri_s4_regf_q6_ans1)
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>');
    l.ri_s4_regf_q6_ans2 = escapeHTML(l.ri_s4_regf_q6_ans2)
        .replace('[B]', '<strong>')
        .replace('[/B]', '</strong>');
    l.ri_s4_regf_success = escapeHTML(l.ri_s4_regf_success)
        .replace('[BR]', '<br>');
    l.about_vision_desc = escapeHTML(l.about_vision_desc)
        .replace(/\[S]/g, '<span>')
        .replace(/\[\/S]/g, '</span>');
    l.about_vision_title = escapeHTML(l.about_vision_title)
        .replace(/\[S]/g, '<span>')
        .replace(/\[\/S]/g, '</span>');
    l.about_contributors = escapeHTML(l.about_contributors)
        .replace(/\[S]/g, '<span>')
        .replace(/\[\/S]/g, '</span>');
    // cant reduce size
    l.jobs_opportunity_invert_card_desc = escapeHTML(l.jobs_opportunity_invert_card_desc)
        .replace(/\[BR]/g, '<br>');
    l.jobs_grow_invert_card_desc = escapeHTML(l.jobs_grow_invert_card_desc)
        .replace('[BR]', '<br>');
    l.about_job_expressions_txt = escapeHTML(l.about_job_expressions_txt)
        .replace('[BR]', '<br>');
    ['empty_call_dlg_text', 'empty_call_dlg_text_min', 'empty_call_dlg_text_sec'].forEach(s => {
        // Prevent double escaping
        l[s] = escapeHTML(`${l[s]}`.replace(/&gt;/g, '>'))
            .replace(/\[S1]/g, '<span class="stay-dlg-counter">')
            .replace(/\[\/S1]/g, '</span>')
            .replace(/\[S2]/g, '<div class="stay-dlg-subtext">')
            .replace(/\[\/S2]/g, '</div>');
    });
    l.meeting_empty_call_desc_1 = escapeHTML(l.meeting_empty_call_desc_1)
        .replace(/\[P]/g, '<div>')
        .replace(/\[\/P]/g, '</div>');
    l.backup_download_recovery_key = escapeHTML(l.backup_setup_2fa_recovery_key)
        .replace('[D1]', '')
        .replace('[/D1]', ' ')
        .replace('[D2]', '(')
        .replace('[/D2]', ')');
    l.backup_setup_2fa_recovery_key = escapeHTML(l.backup_setup_2fa_recovery_key)
        .replace('[D1]', '<div class="recovery-key-name">')
        .replace('[/D1]', '</div>')
        .replace('[D2]', '<div class="recovery-key-size">')
        .replace('[/D2]', '</div>');
    l.no_email_try_again = escapeHTML(l.no_email_try_again).replace('[A]', '<a class="try-again">')
        .replace('[/A]', '</a>');
    l.contact_support_email = escapeHTML(l.contact_support_email)
        .replace('[A]', '<a class="mailto" href="mailto:support@mega.nz">')
        .replace('[/A]', '</a>');
    l.s4_url_obj_level_subtxt = escapeHTML(l.s4_url_obj_level_subtxt)
        .replace(
            '[A]',
            `<a class="clickurl" target="_blank" href="${l.mega_help_host}`
            + `/megas4/s4-buckets/change-bucket-object-url-access">`
        ).replace('[/A]', '</a>');
    l.s4_url_grant_subtxt = escapeHTML(l.s4_url_grant_subtxt)
        .replace(
            '[A]',
            `<a class="clickurl" target="_blank" href="${l.mega_help_host}`
            + `/megas4/s4-buckets/change-bucket-object-url-access">`
        ).replace('[/A]', '</a>');
    l.s4_url_deny_subtxt = escapeHTML(l.s4_url_deny_subtxt)
        .replace(
            '[A]',
            `<a class="clickurl" target="_blank" href="${l.mega_help_host}`
            + `/megas4/s4-buckets/change-bucket-object-url-access">`
        ).replace('[/A]', '</a>');
    l.s4_invalid_bucket_name = escapeHTML(l.s4_invalid_bucket_name)
        .replace(
            '[A]',
            `<a class="clickurl" target="_blank" href="${l.mega_help_host}`
            + `/megas4/s4-buckets/bucket-naming-conventions">`
        ).replace('[/A]', '</a>');
    l.s4_bkt_access_granted_tip = escapeHTML(l.s4_bkt_access_granted_tip)
        .replace(
            '[A]',
            `<a class="clickurl" target="_blank" href="${l.mega_help_host}`
            + `/megas4/s4-buckets/change-bucket-object-url-access">`
        ).replace('[/A]', '</a>');
    l.s4_bkt_access_denied_tip = escapeHTML(l.s4_bkt_access_denied_tip)
        .replace(
            '[A]',
            `<a class="clickurl" target="_blank" href="${l.mega_help_host}`
            + `/megas4/s4-buckets/change-bucket-object-url-access">`
        ).replace('[/A]', '</a>');
    l.s4_bkt_access_origin_tip = escapeHTML(l.s4_bkt_access_origin_tip)
        .replace(
            '[A]',
            `<a class="clickurl" target="_blank" href="${l.mega_help_host}`
            + `/megas4/s4-buckets/change-bucket-object-url-access">`
        ).replace('[/A]', '</a>');
    l.s4_obj_access_granted_tip = escapeHTML(l.s4_obj_access_granted_tip)
        .replace(
            '[A]',
            `<a class="clickurl" target="_blank" href="${l.mega_help_host}`
            + `/megas4/s4-buckets/change-bucket-object-url-access">`
        ).replace('[/A]', '</a>');
    l.s4_obj_access_denied_tip = escapeHTML(l.s4_obj_access_denied_tip)
        .replace(
            '[A]',
            `<a class="clickurl" target="_blank" href="${l.mega_help_host}`
            + `/megas4/s4-buckets/change-bucket-object-url-access">`
        ).replace('[/A]', '</a>');
    l.pro_flexi_expired_banner = escapeHTML(l.pro_flexi_expired_banner)
        .replace('[A]', '<a href="/repay" class="clickurl">').replace('[/A]', '</a>')
        .replace('[S]', '<span>').replace('[/S]', '</span>');
    l.pro_flexi_grace_period_banner = escapeHTML(l.pro_flexi_grace_period_banner)
        .replace(/\[S]/g, '<span>').replace(/\[\/S]/g, '</span>')
        .replace('[A]', '<a href="/repay" class="clickurl">').replace('[/A]', '</a>');
    l.transfer_quota_pct = escapeHTML(l.transfer_quota_pct).replace('[S]', '<span>').replace('[/S]', '</span>');
    l.pr_I_III_365_days = escapeHTML(l.pr_I_III_365_days).replace("[S]", "<span>").replace("[/S]", "</span>");
    l.pr_lite_90_days = escapeHTML(l.pr_lite_90_days).replace("[S]", "<span>").replace("[/S]", "</span>");
    l.pr_save_tip = escapeHTML(l.pr_save_tip).replace('[S]', '<span>').replace('[/S]', '</span>');
    l.emoji_suggestion_instruction = escapeHTML(l.emoji_suggestion_instruction)
        .replace(/\[S]/g, '<strong>')
        .replace(/\[\/S]/g, '</strong>')
        .replace('[i1]', '<i class="small-icon tab-icon"></i>')
        .replace('[i2]', '<i class="small-icon enter-icon left-pad"></i>');

    l.file_request_upload_empty = escapeHTML(l.file_request_upload_empty)
        .replace('[A]', '<a class="upload-btn block-empty-upload-link" href="#">')
        .replace('[/A]', '</a>');
    l.file_request_upload_caption_2 = escapeHTML(l.file_request_upload_caption_2)
        .replace('[A]', '<a target="_blank" href="https://help.mega.io/files-folders/sharing/upload-file-request">')
        .replace('[/A]', '</a>');
    l.redemption_support_email = escapeHTML(l.redemption_support_email)
        .replace('[S]', '<span>').replace('[/S]', '</span>');
    l.estimated_price_text_min_50 = escapeHTML(l.estimated_price_text_min_50)
        .replace('[S]', '<span>').replace('[/S]', '</span>');

    // TODO: Combine all of these limited dl strings to be done at once in a new array?
    l.dl_limited_tq_mini = escapeHTML(l.dl_limited_tq_mini)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="get-more-quota">')
        .replace('[S3]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');
    l.dl_limited_tq_free = escapeHTML(l.dl_limited_tq_free)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="get-more-quota">')
        .replace('[S3]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');

    l.dl_tq_exceeded_mini = escapeHTML(l.dl_tq_exceeded_mini)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="get-more-quota">')
        .replace('[S3]', '<span class="upgrade-option">')
        .replace('[S4]', '<span class="bullet-separator">')
        .replace('[S5]', '<span class="wait-option">')
        .replace('[S6]', '<span class="countdown hidden">')
        .replace('[S7]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');
    l.dl_tq_exceeded_free = escapeHTML(l.dl_tq_exceeded_free)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="get-more-quota">')
        .replace('[S3]', '<span class="upgrade-option">')
        .replace('[S4]', '<span class="bullet-separator">')
        .replace('[S5]', '<span class="wait-option">')
        .replace('[S6]', '<span class="countdown hidden">')
        .replace('[S7]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');
    l.dl_tq_exceeded_pro = escapeHTML(l.dl_tq_exceeded_pro)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span>')
        .replace('[S3]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');
    l.dl_tq_exceeded_pro3 = escapeHTML(l.dl_tq_exceeded_pro3)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span>')
        .replace('[S3]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');

    l.stream_media_tq_exceeded_mini = escapeHTML(l.stream_media_tq_exceeded_mini)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="get-more-quota">')
        .replace('[S3]', '<span class="upgrade-option">')
        .replace('[S4]', '<span class="bullet-separator">')
        .replace('[S5]', '<span>')
        .replace('[S6]', '<span class="countdown hidden">')
        .replace('[S7]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');
    l.stream_media_tq_exceeded_free = escapeHTML(l.stream_media_tq_exceeded_free)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="get-more-quota">')
        .replace('[S3]', '<span class="upgrade-option">')
        .replace('[S4]', '<span class="bullet-separator">')
        .replace('[S5]', '<span>')
        .replace('[S6]', '<span class="countdown hidden">')
        .replace('[S7]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');
    l.stream_media_tq_exceeded_pro = escapeHTML(l.stream_media_tq_exceeded_pro)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="get-more-quota">')
        .replace('[S3]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');
    l.stream_media_tq_exceeded_pro3 = escapeHTML(l.stream_media_tq_exceeded_pro3)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="get-more-quota">')
        .replace('[S3]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');

    l.streaming_tq_exc_mini_desktop = escapeHTML(l.streaming_tq_exc_mini_desktop)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="upgrade-option">')
        .replace('[S3]', '<span>')
        .replace('[S4]', '<span class="countdown hidden">')
        .replace('[S5]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');
    l.streaming_tq_exc_free_desktop = escapeHTML(l.streaming_tq_exc_free_desktop)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="upgrade-to-pro">')
        .replace('[S3]', '<span>')
        .replace('[S4]', '<span class="countdown hidden">')
        .replace('[S5]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');

    l.dl_tq_exc_mini_desktop = escapeHTML(l.dl_tq_exc_mini_desktop)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="upgrade-option">')
        .replace('[S3]', '<span>')
        .replace('[S4]', '<span class="countdown hidden">')
        .replace('[S5]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');
    l.dl_tq_exc_free_desktop = escapeHTML(l.dl_tq_exc_free_desktop)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span>')
        .replace('[S3]', '<span>')
        .replace('[S4]', '<span class="countdown hidden">')
        .replace('[S5]', '<span class="learn-more">')
        .replace(/\[\/S\d]/g, '</span>');
    l.dl_tq_exceeded_more_mini = escapeHTML(l.dl_tq_exceeded_more_mini)
        .replace('[A]',
                 `<a target="_blank" href="https://help.mega.io/plans-storage/space-storage/transfer-quota">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span>')
        .replace('[S3]', '<span>')
        .replace(/\[\/S\d]/g, '</span>');

    l.manage_link_export_link_text = escapeHTML(l.manage_link_export_link_text)
        .replace('[A]', '<a target="_blank" href="https://help.mega.io/files-folders/sharing/encrypted-links">')
        .replace('[/A]', '</a>');
    l.terms_dialog_text = escapeHTML(l.terms_dialog_text)
        .replace('[A]', '<a href="https://mega.io/terms" target="_blank" rel="noopener noreferrer">')
        .replace('[/A]', '</a>');
    l.browser_memory_full = escapeHTML(l.browser_memory_full)
        .replace('[A]', '<a class="anchor-link" href="mailto:support@mega.nz">')
        .replace('[/A]', '</a>');

    const megaLiteHelpCenterLink = 'https://help.mega.io/files-folders/view-move/mega-lite';
    l.in_mega_lite_mode_banner = escapeHTML(l.in_mega_lite_mode_banner)
        .replace('[A]', `<a class="clickurl" href="${megaLiteHelpCenterLink}" target="_blank">`)
        .replace('[/A]', '</a>');

    l.blocked_rsn_terminated = escapeHTML(l.blocked_rsn_terminated)
        .replace('[A]', '<a href="https://mega.io/terms" target="_blank" rel="noopener noreferrer">')
        .replace('[/A]', '</a>')
        .replace('[BR]', '<br><br>');
    l.blocked_rsn_copyright = escapeHTML(l.blocked_rsn_copyright).replace('[BR]', '<br><br>');
    const faqLink = 'https://help.mega.io/plans-storage/space-storage/transfer-quota';
    l.pricing_page_faq_answer_1 = escapeHTML(l.pricing_page_faq_answer_1)
        .replace('[A]', `<a href="${faqLink}" target="_blank" rel="noopener noreferrer">`)
        .replace('[/A]', '</a>');
    l.pricing_page_faq_answer_3 = escapeHTML(l.pricing_page_faq_answer_3)
        .replace('[A]', `<a href="${faqLink}" target="_blank" rel="noopener noreferrer">`)
        .replace('[/A]', '</a>');
    const welcDialogURL = '/fm/account/plan/purchase-history';
    l.welcome_dialog_active_check = escapeHTML(l.welcome_dialog_active_check)
        .replace('[A]', `<a class="clickurl" href="${welcDialogURL}" target="_self" rel="noopener noreferrer">`)
        .replace('[/A]', '</a>');
    const recoveryKeyLink = 'https://help.mega.io/accounts/password-management/recovery-key';
    l.password_changed_more_info = escapeHTML(l.password_changed_more_info)
        .replace('[A]', `<a class="anchor-link" href="${recoveryKeyLink}" target="_blank" rel="noopener noreferrer">`)
        .replace('[/A]', '</a>');
    l.s4_voucher_terms = escapeHTML(l.s4_voucher_terms)
        .replace('[A]', '<a class="clickurl" href="https://mega.io/s4-terms" target="_blank">')
        .replace('[/A]', '</a>');

    const rewindHelpLink = 'https://help.mega.io/files-folders/rewind/how-do-i-use-rewind';
    const rewindLinkAttr = 'target="_blank" class="clickurl" rel="noopener noreferrer"';
    l.rewind_upg_content_free = escapeHTML(l.rewind_upg_content_free)
        .replace('[A]', `<a ${rewindLinkAttr} href="${rewindHelpLink}">`)
        .replace('[/A]', '</a>')
        .replace('[BR]', '<br />');
    l.rewind_upg_content_pro_lite = escapeHTML(l.rewind_upg_content_pro_lite)
        .replace('[A]', `<a ${rewindLinkAttr} href="${rewindHelpLink}">`)
        .replace('[/A]', '</a>')
        .replace('[BR]', '<br />');
    l.rewind_upg_content_pro_flexi = escapeHTML(l.rewind_upg_content_pro_flexi)
        .replace('[A]', `<a ${rewindLinkAttr} href="${rewindHelpLink}">`)
        .replace('[/A]', '</a>')
        .replace('[BR]', '<br />');

    l.two_fa_download_app = escapeHTML(l.two_fa_download_app)
        .replace('[A]', '<a href="">')
        .replace('[/A]', '</a>');

    l.recovery_key_blurb = escapeHTML(l.recovery_key_blurb)
        .replace('[A]', `<a href="${recoveryKeyLink}" target="_blank">`)
        .replace('[/A]', '</a>')
        .replace('[S1]', '<span>')
        .replace('[S2]', '<span class="hc-article-link">')
        .replace(/\[\/S\d]/g, '</span>');

    l.want_more_storage_prompt = escapeHTML(l.want_more_storage_prompt)
        .replace('[A]', '<a class="clickurl" href="/pro" target="_blank">')
        .replace('[/A]', '</a>');
    l.how_it_works_blurb = escapeHTML(l.how_it_works_blurb)
        .replace('[UL]', '<ul>').replace('[/UL]', '</ul>')
        .replace(/\[LI]/g, '<li class="">').replace(/\[\/LI]/g, '</li>');

    l.account_reset_email_info = escapeHTML(l.account_reset_email_info)
        .replace('[A]', '<a href="mailto:support@mega.nz" class="primary-link">').replace('[/A]', '</a>');
    l.account_reset_details = escapeHTML(l.account_reset_details).replace('[B]', '<b>').replace('[/B]', '</b>');

    l.file_request_overlay_blurb = escapeHTML(l.file_request_overlay_blurb)
        .replace(/\[S\d]/g, '<span>')
        .replace(/\[\/S\d]/g, '</span>');

    l.logout_recovery_key = escapeHTML(l.logout_recovery_key)
        .replace('[A]', `<a href="${recoveryKeyLink}" target="_blank">`)
        .replace('[/A]', '</a>');

    l.invite_subject_text = escapeHTML(encodeURIComponent(l.invite_subject_text));
    l.available_commission_tip = escapeHTML(l.available_commission_tip)
        .replace('[A]', '<a class="clickurl" href="/pro">').replace('[/A]', '</a>');

    l.etd_link_removed_body = escapeHTML(l.etd_link_removed_body)
        .replace('[A1]', `<a href="https://mega.io/terms" target="_blank">`)
        .replace('[/A1]', '</a>')
        .replace('[A2]', `<a href="https://mega.io/takedown" target="_blank">`)
        .replace('[/A2]', '</a>')
        .replace('[P]', '<h3 class="sub-header">')
        .replace('[/P]', '</h3>');

    l.s4_s3_prefix_example = escapeHTML(l.s4_s3_prefix_example)
        .replace(/\[S]/g, '<span>')
        .replace(/\[\/S]/g, '</span>');

    l.s4_iam_prefix_example = escapeHTML(l.s4_iam_prefix_example)
        .replace(/\[S]/g, '<span>')
        .replace(/\[\/S]/g, '</span>');

    l.content_removed = escapeHTML(l.content_removed)
        .replace('[A]', '<a class="clickurl" href="https://mega.io/takedown" target="_blank">')
        .replace('[/A]', '</a>');

    l.pr_save_up_to = escapeHTML(l.pr_save_up_to).replace('[S]', '').replace('[/S]', '');

    l.view_upgrade_pro_dialog_desc = escapeHTML(l.view_upgrade_pro_dialog_desc)
        .replace('[S1]', '<span class="monthly-price">')
        .replace('[S2]', '<span class="asterisk hidden">')
        .replace(/\[\/S\d]/g, '</span>');

    l.trusted_users_worldwide = escapeHTML(l.trusted_users_worldwide)
        .replace('[S1]', '<span class="trusted-by">')
        .replace('[S2]', '<span class="users-value">')
        .replace('[S3]', '<span class="users-worldwide">')
        .replace(/\[\/S\d]/g, '</span>');

    l.rewind_select_date_pro = escapeHTML(l.rewind_select_date_pro)
        .replace('[BR]', '<br />')
        .replace('[A]', `<a ${rewindLinkAttr} href="${rewindHelpLink}">`)
        .replace('[/A]', '</a>');

    l.rewind_upgrade_info_text = escapeHTML(l.rewind_upgrade_info_text)
        .replace('[A1]', '<a class="rewind-sidebar-upgrade-action clickurl" href="/pro">')
        .replace('[/A1]', '</a>')
        .replace('[A2]', `<a ${rewindLinkAttr} href="${rewindHelpLink}">`)
        .replace('[/A2]', '</a>');

    const common = [
        15536, 16107, 16119, 16120, 16136, 16304, 16313, 16316, 16358, 16360, 16361, 16394, 18228, 18268, 18282,
        18284, 18285, 18286, 18287, 18289, 18290, 18291, 18294, 18295, 18296, 18297, 18298, 18302, 18303, 18304,
        18305, 18314, 18315, 18316, 18419, 19807, 19808, 19810, 19811, 19812, 19813, 19814, 19854, 19821, 20402,
        20462, 20969, 20970, 20971, 20973, 22667, 22668, 22674, 22669, 22671, 22672, 22784, 22789,
        23351, 23524, 23534, 23296, 23299, 23304, 23819, 24077, 24097, 24099, 24139, 24540, 24542, 24543, 24544,
        24680, 24849, 24850,

        // Non numeric ids
        'bsn_calc_min_users',
        'pro_flexi_account_suspended_description',
        'cannot_leave_share_content',
        'available_commission_tip',
        'pending_commission_tip',
        'commission_amount_tip',
        'go_to_pro'
    ];
    for (let i = common.length; i--;) {
        var num = common[i];

        l[num] = escapeHTML(l[num])
            .replace(/\[S\]/g, '<span>').replace(/\[\/S\]/g, '</span>')
            .replace(/\[P\]/g, '<p>').replace(/\[\/P\]/g, '</p>')
            .replace(/\[B\]/g, '<b>').replace(/\[\/B\]/g, '</b>')
            .replace(/\[I\]/g, '<i>').replace(/\[\/I\]/g, '</i>')
            .replace(/\[BR\]/g, '<br/>')
            .replace(/\[Br]/g, '<br/>')
            .replace(/\[A\]/g, '<a href="/pro" class="clickurl">').replace(/\[\/A\]/g, '</a>');
    }

    l.year = new Date().getFullYear();
    date_months = [
        l[408], l[409], l[410], l[411], l[412], l[413],
        l[414], l[415], l[416], l[417], l[418], l[419]
    ].map(escapeHTML);

    // Set the Locale based the language that is selected. (Required for accurate string comparisons).
    // If the locale has been remapped, apply the remap.
    locale = lang;
    if (remappedLangLocales.hasOwnProperty(locale)) {
        locale = remappedLangLocales[locale];
    }
});

/** @property mega.intl */
lazy(mega, 'intl', function _() {
    'use strict';
    const ns = Object.create(null);
    const Intl = window.Intl || {};
    if (!Intl.NumberFormat) {
        // weak silly polyfill
        Intl.NumberFormat = function mIntlNumberFormat() { /* dummy */ };
        Intl.NumberFormat.prototype = {
            constructor: Intl.NumberFormat,
            format: (n) => parseFloat(n).toString(),
            formatToParts: function(n) {
                const [i, f] = this.format(n).split(/[,.]/);
                return [
                    {type: 'integer', value: i | 0}, {type: 'decimal', value: '.'}, {type: 'fraction', value: f | 0}
                ];
            }
        };
        // @todo add Collator whenever needed.
    }

    /** @property mega.intl.number */
    lazy(ns, 'number', function() {
        return this.get('NumberFormat', {minimumFractionDigits: 2});
    });

    /** @property mega.intl.bitcoin */
    lazy(ns, 'bitcoin', function() {
        return this.get('NumberFormat', {minimumFractionDigits: 8});
    });

    /** @property mega.intl.collator */
    lazy(ns, 'collator', function() {
        return this.get('Collator');
    });

    /** @property mega.intl.decimal */
    lazy(ns, 'decimal', function() {
        return this.get('NumberFormat');
    });

    /** @property mega.intl.decimalSeparator */
    lazy(ns, 'decimalSeparator', function() {
        const value = tryCatch(() => this.number.formatToParts(1.1).find(obj => obj.type === 'decimal').value, false)();
        return value || '.';
    });

    /** @property mega.intl.locale */
    lazy(ns, 'locale', function() {
        const locale = window.locale || window.lang;
        const navLocales = Array.isArray(navigator.languages)
            && navigator.languages.filter(l => l !== locale && l.startsWith(locale))[0];

        // @todo Polyfill Intl.Locale() and return an instance of it instead?
        return navLocales && this.test(navLocales) || this.test(locale) || 'en';
    });

    /** @function mega.intl.get */
    ns.get = function(type, options) {
        let intl;

        tryCatch(() => {
            intl = new Intl[type](this.locale.replace('ar', 'en'), options);
        }, false)();

        return intl || new Intl[type]();
    };

    /** @function mega.intl.compare */
    ns.compare = function(a, b) {
        // compares two strings according to the sort order of the current locale.
        return this.collator.compare(a, b);
    };

    /** @function mega.intl.reset */
    ns.reset = function() {
        delete mega.intl;
        lazy(mega, 'intl', _);
    };

    /** @function mega.intl.test */
    ns.test = locale => tryCatch(() => Intl.NumberFormat.supportedLocalesOf(locale)[0], false)();
    // @todo ^ does this return the canonical even in browsers not supporting Intl.getCanonicalLocales() ?

    return ns;
});

/**
 * Returns the remapped language code (correct for Transifex) for the users selected lang
 *
 * @returns {string} The language code.
 */
function getTransifexLangCode() {
    'use strict';

    switch (lang) {
        case 'br': return 'pt';
        case 'cn': return 'zh_CN';
        case 'ct': return 'zh_TW';
        case 'jp': return 'ja';
        case 'kr': return 'ko';
        default: return lang;
    }
}

/**
 * Apply any remapping of internal language codes to what should be shown in the UI
 *
 * @param {string} [langCode] The two character language code used internally by webclient
 * @returns {string} The two character language code that should be displayed to the user
 */
function getRemappedLangCode(langCode) {
    'use strict';

    langCode = langCode || lang;
    const remaps = {
        br: 'pt',
        cn: 'sc',
        ct: 'tc',
    };

    if (remaps[langCode]) {
        return remaps[langCode];
    }
    return langCode;
}

/**
 * Calculate MD5 checksum utility function taken from the pdf.js library at
 * https://github.com/mozilla/pdf.js/blob/3f33fbf8cf1d7eb5f29de32288ebaa4dd4922501/src/core/crypto.js#L78
 *
 * Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @param {BufferSource|String} data
 * @param {Number} [offset]
 * @param {Number} [length]
 * @returns {Uint8Array}
 * @name md5sum
 * @memberOf window
 */
lazy(self, 'md5sum', () => {
    'use strict';
    const r = new Uint8Array([
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
        9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
        16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
        15, 21,
    ]);

    const k = new Int32Array([
        -680876936, -389564586, 606105819, -1044525330, -176418897, 1200080426,
        -1473231341, -45705983, 1770035416, -1958414417, -42063, -1990404162,
        1804603682, -40341101, -1502002290, 1236535329, -165796510, -1069501632,
        643717713, -373897302, -701558691, 38016083, -660478335, -405537848,
        568446438, -1019803690, -187363961, 1163531501, -1444681467, -51403784,
        1735328473, -1926607734, -378558, -2022574463, 1839030562, -35309556,
        -1530992060, 1272893353, -155497632, -1094730640, 681279174, -358537222,
        -722521979, 76029189, -640364487, -421815835, 530742520, -995338651,
        -198630844, 1126891415, -1416354905, -57434055, 1700485571, -1894986606,
        -1051523, -2054922799, 1873313359, -30611744, -1560198380, 1309151649,
        -145523070, -1120210379, 718787259, -343485551,
    ]);

    const te = new TextEncoder();

    return (data, offset, length) => {
        let h0 = 1732584193;
        let h1 = -271733879;
        let h2 = -1732584194;
        let h3 = 271733878;

        if (typeof data === 'string') {
            data = te.encode(data);
        }
        else if (data instanceof ArrayBuffer) {
            data = new Uint8Array(data);
        }

        if (offset === undefined) {
            offset = data.byteOffset;
        }
        if (length === undefined) {
            length = data.byteLength;
        }

        // pre-processing
        const paddedLength = length + 72 & ~63; // data + 9 extra bytes
        const padded = new Uint8Array(paddedLength);
        let i, j;
        for (i = 0; i < length; ++i) {
            padded[i] = data[offset++];
        }
        padded[i++] = 0x80;

        const n = paddedLength - 8;
        while (i < n) {
            padded[i++] = 0;
        }
        padded[i++] = length << 3 & 0xff;
        padded[i++] = length >> 5 & 0xff;
        padded[i++] = length >> 13 & 0xff;
        padded[i++] = length >> 21 & 0xff;
        padded[i++] = length >>> 29 & 0xff;
        padded[i++] = 0;
        padded[i++] = 0;
        padded[i++] = 0;
        const w = new Int32Array(16);
        for (i = 0; i < paddedLength;) {
            for (j = 0; j < 16; ++j, i += 4) {
                w[j] =
                    padded[i] |
                    padded[i + 1] << 8 |
                    padded[i + 2] << 16 |
                    padded[i + 3] << 24;
            }
            let a = h0;
            let b = h1;
            let c = h2;
            let d = h3;
            let f;
            let g;
            for (j = 0; j < 64; ++j) {
                if (j < 16) {
                    f = b & c | ~b & d;
                    g = j;
                }
                else if (j < 32) {
                    f = d & b | ~d & c;
                    g = 5 * j + 1 & 15;
                }
                else if (j < 48) {
                    f = b ^ c ^ d;
                    g = 3 * j + 5 & 15;
                }
                else {
                    f = c ^ (b | ~d);
                    g = 7 * j & 15;
                }
                const tmp = d;
                const rotateArg = a + f + k[j] + w[g] | 0;
                const rotate = r[j];
                d = c;
                c = b;
                b = b + (rotateArg << rotate | rotateArg >>> 32 - rotate) | 0;
                a = tmp;
            }
            h0 = h0 + a | 0;
            h1 = h1 + b | 0;
            h2 = h2 + c | 0;
            h3 = h3 + d | 0;
        }

        // prettier-ignore
        return new Uint8Array([
            h0 & 0xFF, h0 >> 8 & 0xFF, h0 >> 16 & 0xFF, h0 >>> 24 & 0xFF,
            h1 & 0xFF, h1 >> 8 & 0xFF, h1 >> 16 & 0xFF, h1 >>> 24 & 0xFF,
            h2 & 0xFF, h2 >> 8 & 0xFF, h2 >> 16 & 0xFF, h2 >>> 24 & 0xFF,
            h3 & 0xFF, h3 >> 8 & 0xFF, h3 >> 16 & 0xFF, h3 >>> 24 & 0xFF
        ]);
    };
});
