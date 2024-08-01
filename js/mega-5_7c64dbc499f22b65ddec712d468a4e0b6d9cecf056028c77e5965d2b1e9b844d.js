/* Bundle Includes:
 *   js/vendor/dexie.js
 *   js/functions.js
 *   js/config.js
 *   js/crypto.js
 *   js/account.js
 *   js/security.js
 *   js/two-factor-auth.js
 */

/*
 * Dexie.js - a minimalistic wrapper for IndexedDB
 * ===============================================
 *
 * By David Fahlander, david.fahlander@gmail.com
 *
 * Version 3.2.1.meganz, 2023-06-29T11:23:08.477Z
 *
 * https://dexie.org
 *
 * Apache License Version 2.0, January 2004, http://www.apache.org/licenses/
 */

(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
typeof define === 'function' && define.amd ? define(factory) :
(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Dexie = factory());
})(this, (function () { 'use strict';

const _global = typeof self !== 'undefined' ? self :
    typeof window !== 'undefined' ? window :
        global;

const keys = Object.keys;
const isArray = Array.isArray;
if (typeof Promise !== 'undefined' && !_global.Promise) {
    _global.Promise = Promise;
}
function extend(obj, extension) {
    if (typeof extension !== 'object')
        return obj;
    return Object.assign(obj, extension);
}
const getProto = Object.getPrototypeOf;
const _hasOwn = {}.hasOwnProperty;
function hasOwn(obj, prop) {
    return _hasOwn.call(obj, prop);
}
function props(proto, extension) {
    if (typeof extension === 'function')
        extension = extension(getProto(proto));
    const keys = Reflect.ownKeys(extension);
    for (let i = keys.length; i--;) {
        setProp(proto, keys[i], extension[keys[i]]);
    }
}
const defineProperty = Object.defineProperty;
function setProp(obj, prop, functionOrGetSet, options) {
    defineProperty(obj, prop, extend(functionOrGetSet && hasOwn(functionOrGetSet, "get") && typeof functionOrGetSet.get === 'function' ?
        { get: functionOrGetSet.get, set: functionOrGetSet.set, configurable: true } :
        { value: functionOrGetSet, configurable: true, writable: true }, options));
}
function derive(Child) {
    return {
        from: function (Parent) {
            Child.prototype = Object.create(Parent.prototype);
            setProp(Child.prototype, "constructor", Child);
            return {
                extend: props.bind(null, Child.prototype)
            };
        }
    };
}
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
function getPropertyDescriptor(obj, prop) {
    const pd = getOwnPropertyDescriptor(obj, prop);
    let proto;
    return pd || (proto = getProto(obj)) && getPropertyDescriptor(proto, prop);
}
const _slice = [].slice;
function slice(args, start, end) {
    return _slice.call(args, start, end);
}
function override(origFunc, overridedFactory) {
    return overridedFactory(origFunc);
}
function assert(b) {
    if (!b)
        throw new Error("Assertion Failed");
}
function asap$1(fn) {
    queueMicrotask(fn);
}
function arrayToObject(array, extractor) {
    return array.reduce((result, item, i) => {
        const nameAndValue = extractor(item, i);
        if (nameAndValue)
            result[nameAndValue[0]] = nameAndValue[1];
        return result;
    }, Object.create(null));
}
function tryCatch(fn, onerror, args) {
    try {
        fn.apply(null, args);
    }
    catch (ex) {
        onerror && onerror(ex);
    }
}
function getByKeyPath(obj, keyPath) {
    if (hasOwn(obj, keyPath))
        return obj[keyPath];
    if (!keyPath)
        return obj;
    if (typeof keyPath !== 'string') {
        const rv = [];
        for (let i = 0, l = keyPath.length; i < l; ++i) {
            rv.push(getByKeyPath(obj, keyPath[i]));
        }
        return rv;
    }
    const period = keyPath.indexOf('.');
    if (period !== -1) {
        const innerObj = obj[keyPath.substr(0, period)];
        return innerObj === undefined ? undefined : getByKeyPath(innerObj, keyPath.substr(period + 1));
    }
    return undefined;
}
function setByKeyPath(obj, keyPath, value) {
    if (!obj || keyPath === undefined || Object.isFrozen(obj))
        return;
    if (typeof keyPath !== 'string' && 'length' in keyPath) {
        assert(typeof value !== 'string' && 'length' in value);
        for (let i = 0, l = keyPath.length; i < l; ++i) {
            setByKeyPath(obj, keyPath[i], value[i]);
        }
    }
    else {
        const period = keyPath.indexOf('.');
        if (period !== -1) {
            const currentKeyPath = keyPath.substr(0, period);
            const remainingKeyPath = keyPath.substr(period + 1);
            if (remainingKeyPath === "")
                if (value === undefined) {
                    if (isArray(obj) && !isNaN(parseInt(currentKeyPath)))
                        obj.splice(currentKeyPath, 1);
                    else
                        delete obj[currentKeyPath];
                }
                else
                    obj[currentKeyPath] = value;
            else {
                let innerObj = obj[currentKeyPath];
                if (!innerObj || !hasOwn(obj, currentKeyPath))
                    innerObj = (obj[currentKeyPath] = Object.create(null));
                setByKeyPath(innerObj, remainingKeyPath, value);
            }
        }
        else {
            if (value === undefined) {
                if (isArray(obj) && !isNaN(parseInt(keyPath)))
                    obj.splice(keyPath, 1);
                else
                    delete obj[keyPath];
            }
            else
                obj[keyPath] = value;
        }
    }
}
function delByKeyPath(obj, keyPath) {
    if (typeof keyPath === 'string')
        setByKeyPath(obj, keyPath, undefined);
    else if ('length' in keyPath)
        [].map.call(keyPath, function (kp) {
            setByKeyPath(obj, kp, undefined);
        });
}
function shallowClone(obj) {
    return ({ ...obj });
}
const concat = [].concat;
function flatten(a) {
    return concat.apply([], a);
}
const intrinsicTypeNames = "Boolean,String,Date,RegExp,Blob,File,FileList,FileSystemFileHandle,ArrayBuffer,DataView,Uint8ClampedArray,ImageBitmap,ImageData,Map,Set,CryptoKey"
    .split(',').concat(flatten([8, 16, 32, 64].map(num => ["Int", "Uint", "Float"].map(t => t + num + "Array")))).filter(t => _global[t]);
const intrinsicTypes = new Set(intrinsicTypeNames.map(t => _global[t]));
let circularRefs = null;
function deepClone(any) {
    circularRefs = new WeakMap();
    const rv = innerDeepClone(any);
    circularRefs = null;
    return rv;
}
function innerDeepClone(any) {
    if (!any || typeof any !== 'object')
        return any;
    let rv = circularRefs && circularRefs.get(any);
    if (rv)
        return rv;
    if (isArray(any)) {
        rv = [];
        circularRefs && circularRefs.set(any, rv);
        for (let i = 0, l = any.length; i < l; ++i) {
            rv.push(innerDeepClone(any[i]));
        }
    }
    else if (intrinsicTypes.has(any.constructor)) {
        rv = any;
    }
    else {
        const proto = getProto(any);
        rv = Object.create(proto === Object.prototype ? null : proto);
        circularRefs && circularRefs.set(any, rv);
        for (let prop in any) {
            if (hasOwn(any, prop)) {
                rv[prop] = innerDeepClone(any[prop]);
            }
        }
    }
    return rv;
}
const { toString } = {};
function toStringTag(o) {
    return toString.call(o).slice(8, -1);
}
function getIteratorOf(x) {
    let i;
    return x != null && (i = x[Symbol.iterator]) && i.apply(x);
}
const NO_CHAR_ARRAY = {};
function getArrayOf(arrayLike) {
    var i, a, x, it;
    if (arguments.length === 1) {
        if (isArray(arrayLike))
            return arrayLike.slice();
        if (this === NO_CHAR_ARRAY && typeof arrayLike === 'string')
            return [arrayLike];
        if ((it = getIteratorOf(arrayLike))) {
            a = [];
            while ((x = it.next()), !x.done)
                a.push(x.value);
            return a;
        }
        if (arrayLike == null)
            return [arrayLike];
        i = arrayLike.length;
        if (typeof i === 'number') {
            a = new Array(i);
            while (i--)
                a[i] = arrayLike[i];
            return a;
        }
        return [arrayLike];
    }
    i = arguments.length;
    a = new Array(i);
    while (i--)
        a[i] = arguments[i];
    return a;
}
const isAsyncFunction = typeof Symbol !== 'undefined'
    ? (fn) => fn[Symbol.toStringTag] === 'AsyncFunction'
    : () => false;

var debug = typeof localStorage === 'object' && !!localStorage.dexieDebug;
function setDebug(value, filter) {
    debug = value;
    libraryFilter = filter;
}
var libraryFilter = () => true;
function getErrorWithStack() {
    return new Error();
}
function prettyStack(exception, numIgnoredFrames) {
    var stack = exception.stack;
    if (!stack)
        return "";
    numIgnoredFrames = (numIgnoredFrames || 0);
    if (stack.indexOf(exception.name) === 0)
        numIgnoredFrames += (exception.name + exception.message).split('\n').length;
    return stack.split('\n')
        .slice(numIgnoredFrames)
        .filter(libraryFilter)
        .map(frame => "\n" + frame)
        .join('');
}

var dexieErrorNames = [
    'Modify',
    'Bulk',
    'OpenFailed',
    'VersionChange',
    'Schema',
    'Upgrade',
    'InvalidTable',
    'MissingAPI',
    'NoSuchDatabase',
    'InvalidArgument',
    'SubTransaction',
    'Unsupported',
    'Internal',
    'DatabaseClosed',
    'PrematureCommit',
    'ForeignAwait'
];
var idbDomErrorNames = [
    'Unknown',
    'Constraint',
    'Data',
    'TransactionInactive',
    'ReadOnly',
    'Version',
    'NotFound',
    'InvalidState',
    'InvalidAccess',
    'Abort',
    'Timeout',
    'QuotaExceeded',
    'Syntax',
    'DataClone'
];
var errorList = dexieErrorNames.concat(idbDomErrorNames);
var defaultTexts = {
    VersionChanged: "Database version changed by other database connection",
    DatabaseClosed: "Database has been closed",
    Abort: "Transaction aborted",
    TransactionInactive: "Transaction has already completed or failed",
    MissingAPI: "IndexedDB API missing."
};
function DexieError(name, msg) {
    this._e = getErrorWithStack();
    this.name = name;
    this.message = msg;
}
derive(DexieError).from(Error).extend({
    stack: {
        get: function () {
            return this._stack ||
                (this._stack = this.name + ": " + this.message + prettyStack(this._e, 2));
        }
    },
    toString: function () { return this.name + ": " + this.message; }
});
function getMultiErrorMessage(msg, failures) {
    return msg + ". Errors: " + Object.keys(failures)
        .map(key => failures[key].toString())
        .filter((v, i, s) => s.indexOf(v) === i)
        .join('\n');
}
function ModifyError(msg, failures, successCount, failedKeys) {
    this._e = getErrorWithStack();
    this.failures = failures;
    this.failedKeys = failedKeys;
    this.successCount = successCount;
    this.message = getMultiErrorMessage(msg, failures);
}
derive(ModifyError).from(DexieError);
function BulkError(msg, failures) {
    this._e = getErrorWithStack();
    this.name = "BulkError";
    this.failures = Object.keys(failures).map(pos => failures[pos]);
    this.failuresByPos = failures;
    this.message = getMultiErrorMessage(msg, failures);
}
derive(BulkError).from(DexieError);
var errnames = errorList.reduce((obj, name) => (obj[name] = name + "Error", obj), {});
const BaseException = DexieError;
var exceptions = errorList.reduce((obj, name) => {
    var fullName = name + "Error";
    function DexieError(msgOrInner, inner) {
        this._e = getErrorWithStack();
        this.name = fullName;
        if (!msgOrInner) {
            this.message = defaultTexts[name] || fullName;
            this.inner = null;
        }
        else if (typeof msgOrInner === 'string') {
            this.message = `${msgOrInner}${!inner ? '' : '\n ' + inner}`;
            this.inner = inner || null;
        }
        else if (typeof msgOrInner === 'object') {
            this.message = `${msgOrInner.name} ${msgOrInner.message}`;
            this.inner = msgOrInner;
        }
    }
    derive(DexieError).from(BaseException);
    obj[name] = DexieError;
    return obj;
}, {});
exceptions.Syntax = SyntaxError;
exceptions.Type = TypeError;
exceptions.Range = RangeError;
var exceptionMap = idbDomErrorNames.reduce((obj, name) => {
    obj[name + "Error"] = exceptions[name];
    return obj;
}, {});
function mapError(domError, message) {
    if (!domError || domError instanceof DexieError || domError instanceof TypeError || domError instanceof SyntaxError || !domError.name || !exceptionMap[domError.name])
        return domError;
    var rv = new exceptionMap[domError.name](message || domError.message, domError);
    if ("stack" in domError) {
        setProp(rv, "stack", { get: function () {
                return this.inner.stack;
            } });
    }
    return rv;
}
var fullNameExceptions = errorList.reduce((obj, name) => {
    if (["Syntax", "Type", "Range"].indexOf(name) === -1)
        obj[name + "Error"] = exceptions[name];
    return obj;
}, {});
fullNameExceptions.ModifyError = ModifyError;
fullNameExceptions.DexieError = DexieError;
fullNameExceptions.BulkError = BulkError;

function nop() { }
function mirror(val) { return val; }
function callBoth(on1, on2) {
    return function () {
        on1.apply(this, arguments);
        on2.apply(this, arguments);
    };
}
function reverseStoppableEventChain(f1, f2) {
    if (f1 === nop)
        return f2;
    return function () {
        if (f2.apply(this, arguments) === false)
            return false;
        return f1.apply(this, arguments);
    };
}
function promisableChain(f1, f2) {
    if (f1 === nop)
        return f2;
    return function () {
        var res = f1.apply(this, arguments);
        if (res && typeof res.then === 'function') {
            var thiz = this, i = arguments.length, args = new Array(i);
            while (i--)
                args[i] = arguments[i];
            return res.then(function () {
                return f2.apply(thiz, args);
            });
        }
        return f2.apply(this, arguments);
    };
}

var INTERNAL = {};
const LONG_STACKS_CLIP_LIMIT = 100,
MAX_LONG_STACKS = 20, ZONE_ECHO_LIMIT = 100, [resolvedNativePromise, nativePromiseProto, resolvedGlobalPromise] = (() => {
    let globalP = Promise.resolve();
    if (typeof crypto === 'undefined' || !crypto.subtle)
        return [globalP, getProto(globalP), globalP];
    const nativeP = crypto.subtle.digest("SHA-512", new Uint8Array([0]));
    return [
        nativeP,
        getProto(nativeP),
        globalP
    ];
})();
const NativePromise = resolvedNativePromise && resolvedNativePromise.constructor;
const patchGlobalPromise = !!resolvedGlobalPromise;
var stack_being_generated = false;
const schedulePhysicalTick = () => {
    queueMicrotask(physicalTick);
};
var asap = function (callback, args) {
    microtickQueue.push([callback, args]);
    if (needsNewPhysicalTick) {
        schedulePhysicalTick();
        needsNewPhysicalTick = false;
    }
};
var isOutsideMicroTick = true,
needsNewPhysicalTick = true,
unhandledErrors = [],
rejectingErrors = [],
currentFulfiller = null, rejectionMapper = mirror;
var globalPSD = {
    id: 'global',
    global: true,
    ref: 0,
    unhandleds: [],
    onunhandled: globalError,
    pgp: false,
    env: {},
    finalize: function () {
        this.unhandleds.forEach(uh => {
            try {
                globalError(uh[0], uh[1]);
            }
            catch (e) { }
        });
    }
};
var PSD = globalPSD;
var microtickQueue = [];
var numScheduledCalls = 0;
var tickFinalizers = [];
function DexiePromise(fn) {
    this._listeners = [];
    this.onuncatched = nop;
    this._lib = false;
    var psd = (this._PSD = PSD);
    if (debug) {
        this._stackHolder = getErrorWithStack();
        this._prev = null;
        this._numPrev = 0;
    }
    if (typeof fn !== 'function') {
        if (fn !== INTERNAL)
            throw new TypeError('Not a function');
        this._state = arguments[1];
        this._value = arguments[2];
        if (this._state === false)
            handleRejection(this, this._value);
        return;
    }
    this._state = null;
    this._value = null;
    ++psd.ref;
    executePromiseTask(this, fn);
}
const thenProp = {
    get: function () {
        var psd = PSD, microTaskId = totalEchoes;
        function then(onFulfilled, onRejected) {
            var possibleAwait = !psd.global && (psd !== PSD || microTaskId !== totalEchoes);
            const cleanup = possibleAwait && !decrementExpectedAwaits();
            var rv = new DexiePromise((resolve, reject) => {
                propagateToListener(this, new Listener(nativeAwaitCompatibleWrap(onFulfilled, psd, possibleAwait, cleanup), nativeAwaitCompatibleWrap(onRejected, psd, possibleAwait, cleanup), resolve, reject, psd));
            });
            debug && linkToPreviousPromise(rv, this);
            return rv;
        }
        then.prototype = INTERNAL;
        return then;
    },
    set: function (value) {
        setProp(this, 'then', value && value.prototype === INTERNAL ?
            thenProp :
            {
                get: function () {
                    return value;
                },
                set: thenProp.set
            });
    }
};
props(DexiePromise.prototype, {
    then: thenProp,
    _then: function (onFulfilled, onRejected) {
        propagateToListener(this, new Listener(null, null, onFulfilled, onRejected, PSD));
    },
    dump: NativePromise.prototype.dump,
    always: NativePromise.prototype.always,
    catch: function (onRejected) {
        if (arguments.length === 1)
            return this.then(null, onRejected);
        var type = arguments[0], handler = arguments[1];
        return typeof type === 'function' ? this.then(null, err =>
        err instanceof type ? handler(err) : PromiseReject(err))
            : this.then(null, err =>
            err && err.name === type ? handler(err) : PromiseReject(err));
    },
    finally: function (onFinally) {
        return this.then(value => {
            onFinally();
            return value;
        }, err => {
            onFinally();
            return PromiseReject(err);
        });
    },
    stack: {
        get: function () {
            if (this._stack)
                return this._stack;
            try {
                stack_being_generated = true;
                var stacks = getStack(this, [], MAX_LONG_STACKS);
                var stack = stacks.join("\nFrom previous: ");
                if (this._state !== null)
                    this._stack = stack;
                return stack;
            }
            finally {
                stack_being_generated = false;
            }
        }
    },
    timeout: function (ms, msg) {
        return ms < Infinity ?
            new DexiePromise((resolve, reject) => {
                var handle = setTimeout(() => reject(new exceptions.Timeout(msg)), ms);
                this.then(resolve, reject).finally(clearTimeout.bind(null, handle));
            }) : this;
    }
});
if (typeof Symbol !== 'undefined' && Symbol.toStringTag)
    setProp(DexiePromise.prototype, Symbol.toStringTag, 'Dexie.Promise');
globalPSD.env = snapShot();
function Listener(onFulfilled, onRejected, resolve, reject, zone) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.resolve = resolve;
    this.reject = reject;
    this.psd = zone;
}
props(DexiePromise, {
    all: function () {
        var values = getArrayOf.apply(null, arguments)
            .map(onPossibleParallellAsync);
        return new DexiePromise(function (resolve, reject) {
            if (values.length === 0)
                return resolve([]);
            var remaining = values.length;
            values.forEach((a, i) => DexiePromise.resolve(a).then(x => {
                values[i] = x;
                if (!--remaining) {
                    resolve(values);
                }
            }, reject));
        });
    },
    resolve: value => {
        if (value instanceof DexiePromise)
            return value;
        if (value && typeof value.then === 'function')
            return new DexiePromise((resolve, reject) => {
                value.then(resolve, reject);
            });
        var rv = new DexiePromise(INTERNAL, true, value);
        linkToPreviousPromise(rv, currentFulfiller);
        return rv;
    },
    reject: PromiseReject,
    race: function () {
        var values = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
        return new DexiePromise((resolve, reject) => {
            values.map(value => DexiePromise.resolve(value).then(resolve, reject));
        });
    },
    PSD: {
        get: () => PSD,
        set: value => PSD = value
    },
    totalEchoes: { get: () => totalEchoes },
    newPSD: newScope,
    usePSD: usePSD,
    scheduler: {
        get: () => asap,
        set: value => { asap = value; }
    },
    rejectionMapper: {
        get: () => rejectionMapper,
        set: value => { rejectionMapper = value; }
    },
    follow: (fn, zoneProps) => {
        return new DexiePromise((resolve, reject) => {
            return newScope((resolve, reject) => {
                var psd = PSD;
                psd.unhandleds = [];
                psd.onunhandled = reject;
                psd.finalize = callBoth(function () {
                    run_at_end_of_this_or_next_physical_tick(() => {
                        this.unhandleds.length === 0 ? resolve() : reject(this.unhandleds[0]);
                    });
                }, psd.finalize);
                fn();
            }, zoneProps, resolve, reject);
        });
    }
});
if (NativePromise) {
    if (NativePromise.allSettled)
        setProp(DexiePromise, "allSettled", function () {
            const possiblePromises = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
            return new DexiePromise(resolve => {
                if (possiblePromises.length === 0)
                    return resolve([]);
                let remaining = possiblePromises.length;
                const results = new Array(remaining);
                possiblePromises.forEach((p, i) => DexiePromise.resolve(p).then(value => results[i] = { status: "fulfilled", value }, reason => results[i] = { status: "rejected", reason })
                    .then(() => --remaining || resolve(results)));
            });
        });
    if (NativePromise.any && typeof AggregateError !== 'undefined')
        setProp(DexiePromise, "any", function () {
            const possiblePromises = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
            return new DexiePromise((resolve, reject) => {
                if (possiblePromises.length === 0)
                    return reject(new AggregateError([]));
                let remaining = possiblePromises.length;
                const failures = new Array(remaining);
                possiblePromises.forEach((p, i) => DexiePromise.resolve(p).then(value => resolve(value), failure => {
                    failures[i] = failure;
                    if (!--remaining)
                        reject(new AggregateError(failures));
                }));
            });
        });
}
function executePromiseTask(promise, fn) {
    try {
        fn(value => {
            if (promise._state !== null)
                return;
            if (value === promise)
                throw new TypeError('A promise cannot be resolved with itself.');
            var shouldExecuteTick = promise._lib && beginMicroTickScope();
            if (value && typeof value.then === 'function') {
                executePromiseTask(promise, (resolve, reject) => {
                    value instanceof DexiePromise ?
                        value._then(resolve, reject) :
                        value.then(resolve, reject);
                });
            }
            else {
                promise._state = true;
                promise._value = value;
                propagateAllListeners(promise);
            }
            if (shouldExecuteTick)
                endMicroTickScope();
        }, ex => handleRejection(promise, ex));
    }
    catch (ex) {
        handleRejection(promise, ex);
    }
}
function handleRejection(promise, reason) {
    rejectingErrors.push(reason);
    if (promise._state !== null)
        return;
    var shouldExecuteTick = promise._lib && beginMicroTickScope();
    reason = rejectionMapper(reason);
    promise._state = false;
    promise._value = reason;
    debug && reason !== null && typeof reason === 'object' && !reason._promise && tryCatch(() => {
        var origProp = getPropertyDescriptor(reason, "stack");
        reason._promise = promise;
        setProp(reason, "stack", {
            get: () => stack_being_generated ?
                origProp && (origProp.get ?
                    origProp.get.apply(reason) :
                    origProp.value) :
                promise.stack
        });
    });
    addPossiblyUnhandledError(promise);
    propagateAllListeners(promise);
    if (shouldExecuteTick)
        endMicroTickScope();
}
function propagateAllListeners(promise) {
    var listeners = promise._listeners;
    promise._listeners = [];
    for (var i = 0, len = listeners.length; i < len; ++i) {
        propagateToListener(promise, listeners[i]);
    }
    var psd = promise._PSD;
    --psd.ref || psd.finalize();
    if (numScheduledCalls === 0) {
        ++numScheduledCalls;
        asap(() => {
            if (--numScheduledCalls === 0)
                finalizePhysicalTick();
        }, []);
    }
}
function propagateToListener(promise, listener) {
    if (promise._state === null) {
        promise._listeners.push(listener);
        return;
    }
    var cb = promise._state ? listener.onFulfilled : listener.onRejected;
    if (cb === null) {
        return (promise._state ? listener.resolve : listener.reject)(promise._value);
    }
    ++listener.psd.ref;
    ++numScheduledCalls;
    asap(callListener, [cb, promise, listener]);
}
function callListener(cb, promise, listener) {
    try {
        currentFulfiller = promise;
        var ret, value = promise._value;
        if (promise._state) {
            ret = cb(value);
        }
        else {
            if (rejectingErrors.length)
                rejectingErrors = [];
            ret = cb(value);
            if (!rejectingErrors.includes(value))
                markErrorAsHandled(promise);
        }
        listener.resolve(ret);
    }
    catch (e) {
        listener.reject(e);
    }
    finally {
        currentFulfiller = null;
        if (--numScheduledCalls === 0)
            finalizePhysicalTick();
        --listener.psd.ref || listener.psd.finalize();
    }
}
function getStack(promise, stacks, limit) {
    if (stacks.length === limit)
        return stacks;
    var stack = "";
    if (promise._state === false) {
        var failure = promise._value, errorName, message;
        if (failure != null) {
            errorName = failure.name || "Error";
            message = failure.message || failure;
            stack = prettyStack(failure, 0);
        }
        else {
            errorName = failure;
            message = "";
        }
        stacks.push(errorName + (message ? ": " + message : "") + stack);
    }
    if (debug) {
        stack = prettyStack(promise._stackHolder, 2);
        if (stack && stacks.indexOf(stack) === -1)
            stacks.push(stack);
        if (promise._prev)
            getStack(promise._prev, stacks, limit);
    }
    return stacks;
}
function linkToPreviousPromise(promise, prev) {
    var numPrev = prev ? prev._numPrev + 1 : 0;
    if (numPrev < LONG_STACKS_CLIP_LIMIT) {
        promise._prev = prev;
        promise._numPrev = numPrev;
    }
}
function physicalTick() {
    beginMicroTickScope() && endMicroTickScope();
}
function beginMicroTickScope() {
    var wasRootExec = isOutsideMicroTick;
    isOutsideMicroTick = false;
    needsNewPhysicalTick = false;
    return wasRootExec;
}
function endMicroTickScope() {
    var callbacks, i, l;
    do {
        while (microtickQueue.length > 0) {
            callbacks = microtickQueue;
            microtickQueue = [];
            l = callbacks.length;
            for (i = 0; i < l; ++i) {
                var item = callbacks[i];
                item[0].apply(null, item[1]);
            }
        }
    } while (microtickQueue.length > 0);
    isOutsideMicroTick = true;
    needsNewPhysicalTick = true;
}
function finalizePhysicalTick() {
    var unhandledErrs = unhandledErrors;
    unhandledErrors = [];
    unhandledErrs.forEach(p => {
        p._PSD.onunhandled.call(null, p._value, p);
    });
    var finalizers = tickFinalizers.slice(0);
    var i = finalizers.length;
    while (i)
        finalizers[--i]();
}
function run_at_end_of_this_or_next_physical_tick(fn) {
    function finalizer() {
        fn();
        tickFinalizers.splice(tickFinalizers.indexOf(finalizer), 1);
    }
    tickFinalizers.push(finalizer);
    ++numScheduledCalls;
    asap(() => {
        if (--numScheduledCalls === 0)
            finalizePhysicalTick();
    }, []);
}
function addPossiblyUnhandledError(promise) {
    if (!unhandledErrors.some(p => p._value === promise._value))
        unhandledErrors.push(promise);
}
function markErrorAsHandled(promise) {
    var i = unhandledErrors.length;
    while (i)
        if (unhandledErrors[--i]._value === promise._value) {
            unhandledErrors.splice(i, 1);
            return;
        }
}
function PromiseReject(reason) {
    return new DexiePromise(INTERNAL, false, reason);
}
function wrap(fn, errorCatcher) {
    var psd = PSD;
    return function () {
        var wasRootExec = beginMicroTickScope(), outerScope = PSD;
        try {
            switchToZone(psd, true);
            return fn.apply(this, arguments);
        }
        catch (e) {
            errorCatcher && errorCatcher(e);
        }
        finally {
            switchToZone(outerScope, false);
            if (wasRootExec)
                endMicroTickScope();
        }
    };
}
const task = { awaits: 0, echoes: 0, id: 0 };
var taskCounter = 0;
var zoneStack = [];
var zoneEchoes = 0;
var totalEchoes = 0;
var zone_id_counter = 0;
function newScope(fn, props, a1, a2) {
    var parent = PSD, psd = Object.create(parent);
    psd.parent = parent;
    psd.ref = 0;
    psd.global = false;
    psd.id = ++zone_id_counter;
    var globalEnv = globalPSD.env;
    psd.env = patchGlobalPromise ? {
        Promise: DexiePromise,
        PromiseProp: { value: DexiePromise, configurable: true, writable: true },
        all: DexiePromise.all,
        race: DexiePromise.race,
        allSettled: DexiePromise.allSettled,
        any: DexiePromise.any,
        resolve: DexiePromise.resolve,
        reject: DexiePromise.reject,
        nthen: getPatchedPromiseThen(globalEnv.nthen, psd),
        gthen: getPatchedPromiseThen(globalEnv.gthen, psd)
    } : {};
    if (props)
        extend(psd, props);
    ++parent.ref;
    psd.finalize = function () {
        --this.parent.ref || this.parent.finalize();
    };
    var rv = usePSD(psd, fn, a1, a2);
    if (psd.ref === 0)
        psd.finalize();
    return rv;
}
function incrementExpectedAwaits() {
    if (!task.id)
        task.id = ++taskCounter;
    ++task.awaits;
    task.echoes += ZONE_ECHO_LIMIT;
    return task.id;
}
function decrementExpectedAwaits() {
    if (!task.awaits)
        return false;
    if (--task.awaits === 0)
        task.id = 0;
    task.echoes = task.awaits * ZONE_ECHO_LIMIT;
    return true;
}
function onPossibleParallellAsync(possiblePromise) {
    if (task.echoes && possiblePromise && possiblePromise.constructor === NativePromise) {
        incrementExpectedAwaits();
        return possiblePromise.then(x => {
            decrementExpectedAwaits();
            return x;
        }, e => {
            decrementExpectedAwaits();
            return rejection(e);
        });
    }
    return possiblePromise;
}
function zoneEnterEcho(targetZone) {
    ++totalEchoes;
    if (!task.echoes || --task.echoes === 0) {
        task.echoes = task.id = 0;
    }
    zoneStack.push(PSD);
    switchToZone(targetZone, true);
}
function zoneLeaveEcho() {
    var zone = zoneStack[zoneStack.length - 1];
    zoneStack.pop();
    switchToZone(zone, false);
}
function switchToZone(targetZone, bEnteringZone) {
    var currentZone = PSD;
    if (bEnteringZone ? task.echoes && (!zoneEchoes++ || targetZone !== PSD) : zoneEchoes && (!--zoneEchoes || targetZone !== PSD)) {
        enqueueNativeMicroTask(bEnteringZone ? zoneEnterEcho.bind(null, targetZone) : zoneLeaveEcho);
    }
    if (targetZone === PSD)
        return;
    PSD = targetZone;
    if (currentZone === globalPSD)
        globalPSD.env = snapShot();
    if (patchGlobalPromise) {
        var GlobalPromise = globalPSD.env.Promise;
        var targetEnv = targetZone.env;
        nativePromiseProto.then = targetEnv.nthen;
        GlobalPromise.prototype.then = targetEnv.gthen;
        if (currentZone.global || targetZone.global) {
            Object.defineProperty(_global, 'Promise', targetEnv.PromiseProp);
            GlobalPromise.all = targetEnv.all;
            GlobalPromise.race = targetEnv.race;
            GlobalPromise.resolve = targetEnv.resolve;
            GlobalPromise.reject = targetEnv.reject;
            if (targetEnv.allSettled)
                GlobalPromise.allSettled = targetEnv.allSettled;
            if (targetEnv.any)
                GlobalPromise.any = targetEnv.any;
        }
    }
}
function snapShot() {
    var GlobalPromise = _global.Promise;
    return patchGlobalPromise ? {
        Promise: GlobalPromise,
        PromiseProp: Object.getOwnPropertyDescriptor(_global, "Promise"),
        all: GlobalPromise.all,
        race: GlobalPromise.race,
        allSettled: GlobalPromise.allSettled,
        any: GlobalPromise.any,
        resolve: GlobalPromise.resolve,
        reject: GlobalPromise.reject,
        nthen: nativePromiseProto.then,
        gthen: GlobalPromise.prototype.then
    } : {};
}
function usePSD(psd, fn, a1, a2, a3) {
    var outerScope = PSD;
    try {
        switchToZone(psd, true);
        return fn(a1, a2, a3);
    }
    finally {
        switchToZone(outerScope, false);
    }
}
function enqueueNativeMicroTask(job) {
    queueMicrotask(job);
}
function nativeAwaitCompatibleWrap(fn, zone, possibleAwait, cleanup) {
    return typeof fn !== 'function' ? fn : function () {
        var outerZone = PSD;
        if (possibleAwait)
            incrementExpectedAwaits();
        switchToZone(zone, true);
        try {
            return fn.apply(this, arguments);
        }
        finally {
            switchToZone(outerZone, false);
            if (cleanup)
                enqueueNativeMicroTask(decrementExpectedAwaits);
        }
    };
}
function getPatchedPromiseThen(origThen, zone) {
    return function (onResolved, onRejected) {
        return origThen.call(this, nativeAwaitCompatibleWrap(onResolved, zone), nativeAwaitCompatibleWrap(onRejected, zone));
    };
}
const UNHANDLEDREJECTION = "unhandledrejection";
function globalError(err, promise) {
    var rv;
    try {
        rv = promise.onuncatched(err);
    }
    catch (e) { }
    if (rv !== false)
        try {
            var event, eventData = { promise: promise, reason: err };
            if (_global.document && document.createEvent) {
                event = document.createEvent('Event');
                event.initEvent(UNHANDLEDREJECTION, true, true);
                extend(event, eventData);
            }
            else if (_global.CustomEvent) {
                event = new CustomEvent(UNHANDLEDREJECTION, { detail: eventData });
                extend(event, eventData);
            }
            if (event && _global.dispatchEvent) {
                dispatchEvent(event);
                if (!_global.PromiseRejectionEvent && _global.onunhandledrejection)
                    try {
                        _global.onunhandledrejection(event);
                    }
                    catch (_) { }
            }
            if (debug && event && !event.defaultPrevented) {
                console.warn(`Unhandled rejection: ${err.stack || err}`);
            }
        }
        catch (e) { }
}
var rejection = DexiePromise.reject;

function tempTransaction(db, mode, storeNames, fn) {
    if (!db.idbdb || (!db._state.openComplete && (!PSD.letThrough && !db._vip))) {
        if (db._state.openComplete) {
            return rejection(new exceptions.DatabaseClosed(db._state.dbOpenError));
        }
        if (!db._state.isBeingOpened) {
            if (!db._options.autoOpen)
                return rejection(new exceptions.DatabaseClosed());
            db.open().catch(nop);
        }
        return db._state.dbReadyPromise.then(() => tempTransaction(db, mode, storeNames, fn));
    }
    else {
        var trans = db._createTransaction(mode, storeNames, db._dbSchema);
        try {
            trans.create();
            db._state.PR1398_maxLoop = 3;
        }
        catch (ex) {
            if (ex.name === errnames.InvalidState && db.isOpen() && --db._state.PR1398_maxLoop > 0) {
                console.warn(`Dexie: Need to reopen db '${db.name}'`);
                db._close();
                return db.open().then(() => tempTransaction(db, mode, storeNames, fn));
            }
            return rejection(ex);
        }
        return trans._promise(mode, (resolve, reject) => {
            return newScope(() => {
                PSD.trans = trans;
                return fn(resolve, reject, trans);
            });
        }).then(result => {
            return trans._completion.then(() => result);
        });
    }
}

const DEXIE_VERSION = '3.2.1.meganz';
const maxString = String.fromCharCode(65535);
const minKey = -Infinity;
const INVALID_KEY_ARGUMENT = "Invalid key provided. Keys must be of type string, number, Date or Array<string | number | Date>.";
const STRING_EXPECTED = "String expected.";
const connections = [];
const isIEOrEdge = typeof navigator !== 'undefined' && /(MSIE|Trident|Edge)/.test(navigator.userAgent);
const hasIEDeleteObjectStoreBug = isIEOrEdge;
const hangsOnDeleteLargeKeyRange = isIEOrEdge;
const dexieStackFrameFilter = frame => !/(dexie\.js|dexie\.min\.js)/.test(frame);
const DBNAMES_DB = '__dbnames';
const READONLY = 'readonly';
const READWRITE = 'readwrite';

function combine(filter1, filter2) {
    return filter1 ?
        filter2 ?
            function () { return filter1.apply(this, arguments) && filter2.apply(this, arguments); } :
            filter1 :
        filter2;
}

const AnyRange = {
    type: 3 ,
    lower: -Infinity,
    lowerOpen: false,
    upper: [[]],
    upperOpen: false
};

function workaroundForUndefinedPrimKey(keyPath) {
    return typeof keyPath === "string" && !keyPath.includes('.')
        ? (obj) => {
            if (obj[keyPath] === undefined && (keyPath in obj)) {
                obj = deepClone(obj);
                delete obj[keyPath];
            }
            return obj;
        }
        : (obj) => obj;
}

function Entity() {
    throw exceptions.Type();
}

function cmp(a, b) {
    try {
        const ta = type(a);
        const tb = type(b);
        if (ta !== tb) {
            if (ta === 'Array')
                return 1;
            if (tb === 'Array')
                return -1;
            if (ta === 'binary')
                return 1;
            if (tb === 'binary')
                return -1;
            if (ta === 'string')
                return 1;
            if (tb === 'string')
                return -1;
            if (ta === 'Date')
                return 1;
            if (tb !== 'Date')
                return NaN;
            return -1;
        }
        switch (ta) {
            case 'number':
            case 'Date':
            case 'string':
                return a > b ? 1 : a < b ? -1 : 0;
            case 'binary': {
                return compareUint8Arrays(getUint8Array(a), getUint8Array(b));
            }
            case 'Array':
                return compareArrays(a, b);
        }
    }
    catch (_a) { }
    return NaN;
}
function compareArrays(a, b) {
    const al = a.length;
    const bl = b.length;
    const l = al < bl ? al : bl;
    for (let i = 0; i < l; ++i) {
        const res = cmp(a[i], b[i]);
        if (res !== 0)
            return res;
    }
    return al === bl ? 0 : al < bl ? -1 : 1;
}
function compareUint8Arrays(a, b) {
    const al = a.length;
    const bl = b.length;
    const l = al < bl ? al : bl;
    for (let i = 0; i < l; ++i) {
        if (a[i] !== b[i])
            return a[i] < b[i] ? -1 : 1;
    }
    return al === bl ? 0 : al < bl ? -1 : 1;
}
function type(x) {
    const t = typeof x;
    if (t !== 'object')
        return t;
    if (ArrayBuffer.isView(x))
        return 'binary';
    const tsTag = toStringTag(x);
    return tsTag === 'ArrayBuffer' ? 'binary' : tsTag;
}
function getUint8Array(a) {
    if (a instanceof Uint8Array)
        return a;
    if (ArrayBuffer.isView(a))
        return new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    return new Uint8Array(a);
}

class Table {
    _trans(mode, fn, writeLocked) {
        const trans = this._tx || PSD.trans;
        const tableName = this.name;
        function checkTableInTransaction(resolve, reject, trans) {
            if (!trans.schema[tableName])
                throw new exceptions.NotFound("Table " + tableName + " not part of transaction");
            return fn(trans.idbtrans, trans);
        }
        const wasRootExec = beginMicroTickScope();
        try {
            return trans && trans.db === this.db ?
                trans === PSD.trans ?
                    trans._promise(mode, checkTableInTransaction, writeLocked) :
                    newScope(() => trans._promise(mode, checkTableInTransaction, writeLocked), { trans: trans, transless: PSD.transless || PSD }) :
                tempTransaction(this.db, mode, [this.name], checkTableInTransaction);
        }
        finally {
            if (wasRootExec)
                endMicroTickScope();
        }
    }
    get(keyOrCrit, cb) {
        if (keyOrCrit && keyOrCrit.constructor === Object)
            return this.where(keyOrCrit).first(cb);
        return this._trans('readonly', (trans) => {
            return this.core.get({ trans, key: keyOrCrit });
        }).then(cb);
    }
    getKey(keyOrCrit, cb) {
        if (keyOrCrit && keyOrCrit.constructor === Object)
            return this.where(keyOrCrit).first(cb);
        return this._trans('readonly', (trans) => {
            return this.core.get({ trans, key: keyOrCrit, method: 'getKey' });
        }).then(cb);
    }
    getKeys(keys) {
        return this._trans('readonly', trans => {
            return this.core.getMany({
                keys,
                trans,
                method: 'getKey'
            }).then(result => result .filter(Boolean));
        });
    }
    exists(keys) {
        const a = isArray(keys);
        if (!a || keys.length == 1) {
            return this.getKey(a ? keys[0] : keys).then(res => res ? a ? [res] : res : false);
        }
        return this.getKeys(keys);
    }
    where(indexOrCrit) {
        if (typeof indexOrCrit === 'string')
            return new this.db.WhereClause(this, indexOrCrit);
        if (isArray(indexOrCrit))
            return new this.db.WhereClause(this, `[${indexOrCrit.join('+')}]`);
        const keyPaths = keys(indexOrCrit);
        if (keyPaths.length === 1)
            return this
                .where(keyPaths[0])
                .equals(indexOrCrit[keyPaths[0]]);
        const compoundIndex = this.schema.indexes.concat(this.schema.primKey).filter(ix => ix.compound &&
            keyPaths.every(keyPath => ix.keyPath.indexOf(keyPath) >= 0) &&
            ix.keyPath.every(keyPath => keyPaths.indexOf(keyPath) >= 0))[0];
        if (compoundIndex && this.db._maxKey !== maxString)
            return this
                .where(compoundIndex.name)
                .equals(compoundIndex.keyPath.map(kp => indexOrCrit[kp]));
        if (!compoundIndex && debug)
            console.warn(`The query ${JSON.stringify(indexOrCrit)} on ${this.name} would benefit of a ` +
                `compound index [${keyPaths.join('+')}]`);
        const { idxByName } = this.schema;
        function equals(a, b) {
            return cmp(a, b) === 0;
        }
        const [idx, filterFunction] = keyPaths.reduce(([prevIndex, prevFilterFn], keyPath) => {
            const index = idxByName[keyPath];
            const value = indexOrCrit[keyPath];
            return [
                prevIndex || index,
                prevIndex || !index ?
                    combine(prevFilterFn, index && index.multi ?
                        x => {
                            const prop = getByKeyPath(x, keyPath);
                            return isArray(prop) && prop.some(item => equals(value, item));
                        } : x => equals(value, getByKeyPath(x, keyPath)))
                    : prevFilterFn
            ];
        }, [null, null]);
        return idx ?
            this.where(idx.name).equals(indexOrCrit[idx.keyPath])
                .filter(filterFunction) :
            compoundIndex ?
                this.filter(filterFunction) :
                this.where(keyPaths).equals('');
    }
    filter(filterFunction) {
        return this.toCollection().and(filterFunction);
    }
    count(thenShortcut) {
        return this.toCollection().count(thenShortcut);
    }
    offset(offset) {
        return this.toCollection().offset(offset);
    }
    limit(numRows) {
        return this.toCollection().limit(numRows);
    }
    each(callback) {
        return this.toCollection().each(callback);
    }
    toArray(thenShortcut) {
        return this.toCollection().toArray(thenShortcut);
    }
    toCollection() {
        return new this.db.Collection(new this.db.WhereClause(this));
    }
    orderBy(index) {
        return new this.db.Collection(new this.db.WhereClause(this, isArray(index) ?
            `[${index.join('+')}]` :
            index));
    }
    reverse() {
        return this.toCollection().reverse();
    }
    mapToClass(constructor) {
        const { db, name: tableName } = this;
        this.schema.mappedClass = constructor;
        if (constructor.prototype instanceof Entity) {
            constructor = class extends constructor {
                get db() { return db; }
                table() { return tableName; }
            };
        }
        return constructor;
    }
    defineClass() {
        function Class(content) {
            extend(this, content);
        }
        return this.mapToClass(Class);
    }
    add(obj, key) {
        const { auto, keyPath } = this.schema.primKey;
        let objToAdd = obj;
        if (keyPath && auto) {
            objToAdd = workaroundForUndefinedPrimKey(keyPath)(obj);
        }
        return this._trans('readwrite', trans => {
            return this.core.mutate({ trans, type: 'add', keys: key != null ? [key] : null, values: [objToAdd] });
        }).then(res => res.numFailures ? DexiePromise.reject(res.failures[0]) : res.lastResult)
            .then(lastResult => {
            if (keyPath) {
                try {
                    setByKeyPath(obj, keyPath, lastResult);
                }
                catch (_) { }
            }
            return lastResult;
        });
    }
    update(keyOrObject, modifications) {
        if (typeof keyOrObject === 'object' && !isArray(keyOrObject)) {
            const key = getByKeyPath(keyOrObject, this.schema.primKey.keyPath);
            if (key === undefined)
                return rejection(new exceptions.InvalidArgument("Given object does not contain its primary key"));
            try {
                if (typeof modifications !== "function") {
                    keys(modifications).forEach(keyPath => {
                        setByKeyPath(keyOrObject, keyPath, modifications[keyPath]);
                    });
                }
                else {
                    modifications(keyOrObject, { value: keyOrObject, primKey: key });
                }
            }
            catch (_a) {
            }
            return this.where(":id").equals(key).modify(modifications);
        }
        else {
            return this.where(":id").equals(keyOrObject).modify(modifications);
        }
    }
    put(obj, key) {
        const { auto, keyPath } = this.schema.primKey;
        let objToAdd = obj;
        if (keyPath && auto) {
            objToAdd = workaroundForUndefinedPrimKey(keyPath)(obj);
        }
        return this._trans('readwrite', trans => this.core.mutate({ trans, type: 'put', values: [objToAdd], keys: key != null ? [key] : null }))
            .then(res => res.numFailures ? DexiePromise.reject(res.failures[0]) : res.lastResult)
            .then(lastResult => {
            if (keyPath) {
                try {
                    setByKeyPath(obj, keyPath, lastResult);
                }
                catch (_) { }
            }
            return lastResult;
        });
    }
    delete(key) {
        return this._trans('readwrite', trans => this.core.mutate({ trans, type: 'delete', keys: [key] }))
            .then(res => res.numFailures ? DexiePromise.reject(res.failures[0]) : undefined);
    }
    clear() {
        return this._trans('readwrite', trans => this.core.mutate({ trans, type: 'deleteRange', range: AnyRange }))
            .then(res => res.numFailures ? DexiePromise.reject(res.failures[0]) : undefined);
    }
    bulkGet(keys) {
        return this._trans('readonly', trans => {
            return this.core.getMany({
                keys,
                trans
            });
        });
    }
    bulkAdd(objects, keysOrOptions, options) {
        const keys = keysOrOptions && Array.isArray(keysOrOptions) ? keysOrOptions : undefined;
        options = options || (keys ? undefined : keysOrOptions);
        const wantResults = options ? options.allKeys : undefined;
        return this._trans('readwrite', trans => {
            const { auto, keyPath } = this.schema.primKey;
            if (keyPath && keys)
                throw new exceptions.InvalidArgument("bulkAdd(): keys argument invalid on tables with inbound keys");
            if (keys && keys.length !== objects.length)
                throw new exceptions.InvalidArgument("Arguments objects and keys must have the same length");
            const numObjects = objects.length;
            let objectsToAdd = keyPath && auto ?
                objects.map(workaroundForUndefinedPrimKey(keyPath)) :
                objects;
            return this.core.mutate({ trans, type: 'add', keys: keys, values: objectsToAdd, wantResults })
                .then(({ numFailures, results, lastResult, failures }) => {
                const result = wantResults ? results : lastResult;
                if (numFailures === 0)
                    return result;
                throw new BulkError(`${this.name}.bulkAdd(): ${numFailures} of ${numObjects} operations failed`, failures);
            });
        });
    }
    bulkPut(objects, keysOrOptions, options) {
        const keys = keysOrOptions && Array.isArray(keysOrOptions) ? keysOrOptions : undefined;
        options = options || (keys ? undefined : keysOrOptions);
        const wantResults = options ? options.allKeys : undefined;
        return this._trans('readwrite', trans => {
            const { auto, keyPath } = this.schema.primKey;
            if (keyPath && keys)
                throw new exceptions.InvalidArgument("bulkPut(): keys argument invalid on tables with inbound keys");
            if (keys && keys.length !== objects.length)
                throw new exceptions.InvalidArgument("Arguments objects and keys must have the same length");
            const numObjects = objects.length;
            let objectsToPut = keyPath && auto ?
                objects.map(workaroundForUndefinedPrimKey(keyPath)) :
                objects;
            return this.core.mutate({ trans, type: 'put', keys: keys, values: objectsToPut, wantResults })
                .then(({ numFailures, results, lastResult, failures }) => {
                const result = wantResults ? results : lastResult;
                if (numFailures === 0)
                    return result;
                throw new BulkError(`${this.name}.bulkPut(): ${numFailures} of ${numObjects} operations failed`, failures);
            });
        });
    }
    bulkDelete(keys) {
        const numKeys = keys.length;
        return this._trans('readwrite', trans => {
            return this.core.mutate({ trans, type: 'delete', keys: keys });
        }).then(({ numFailures, lastResult, failures }) => {
            if (numFailures === 0)
                return lastResult;
            throw new BulkError(`${this.name}.bulkDelete(): ${numFailures} of ${numKeys} operations failed`, failures);
        });
    }
}

function makeClassConstructor(prototype, constructor) {
    derive(constructor).from({ prototype });
    return constructor;
}

function createTableConstructor(db) {
    return makeClassConstructor(Table.prototype, function Table(name, tableSchema, trans) {
        this.db = db;
        this._tx = trans;
        this.name = name;
        this.schema = tableSchema;
    });
}

function isPlainKeyRange(ctx, ignoreLimitFilter) {
    return !(ctx.filter || ctx.algorithm || ctx.or) &&
        (ignoreLimitFilter ? ctx.justLimit : !ctx.replayFilter);
}
function addFilter(ctx, fn) {
    ctx.filter = combine(ctx.filter, fn);
}
function addReplayFilter(ctx, factory, isLimitFilter) {
    var curr = ctx.replayFilter;
    ctx.replayFilter = curr ? () => combine(curr(), factory()) : factory;
    ctx.justLimit = isLimitFilter && !curr;
}
function addMatchFilter(ctx, fn) {
    ctx.isMatch = combine(ctx.isMatch, fn);
}
function getIndexOrStore(ctx, coreSchema) {
    if (ctx.isPrimKey)
        return coreSchema.primaryKey;
    const index = coreSchema.getIndexByKeyPath(ctx.index);
    if (!index)
        throw new exceptions.Schema("KeyPath " + ctx.index + " on object store " + coreSchema.name + " is not indexed");
    return index;
}
function openCursor(ctx, coreTable, trans) {
    const index = getIndexOrStore(ctx, coreTable.schema);
    return coreTable.openCursor({
        trans,
        values: !ctx.keysOnly,
        reverse: ctx.dir === 'prev',
        unique: !!ctx.unique,
        query: {
            index,
            range: ctx.range
        }
    });
}
function iter(ctx, fn, coreTrans, coreTable) {
    const filter = ctx.replayFilter ? combine(ctx.filter, ctx.replayFilter()) : ctx.filter;
    if (!ctx.or) {
        return iterate(openCursor(ctx, coreTable, coreTrans), combine(ctx.algorithm, filter), fn, !ctx.keysOnly && ctx.valueMapper);
    }
    else {
        const set = {};
        const union = (item, cursor, advance) => {
            if (!filter || filter(cursor, advance, result => cursor.stop(result), err => cursor.fail(err))) {
                var primaryKey = cursor.primaryKey;
                var key = '' + primaryKey;
                if (key === '[object ArrayBuffer]')
                    key = '' + new Uint8Array(primaryKey);
                if (!hasOwn(set, key)) {
                    set[key] = true;
                    fn(item, cursor, advance);
                }
            }
        };
        return Promise.all([
            ctx.or._iterate(union, coreTrans),
            iterate(openCursor(ctx, coreTable, coreTrans), ctx.algorithm, union, !ctx.keysOnly && ctx.valueMapper)
        ]);
    }
}
function iterate(cursorPromise, filter, fn, valueMapper) {
    var mappedFn = valueMapper ? (x, c, a) => fn(valueMapper(x), c, a) : fn;
    var wrappedFn = wrap(mappedFn);
    return cursorPromise.then(cursor => {
        if (cursor) {
            return cursor.start(() => {
                var c = () => cursor.continue();
                if (!filter || filter(cursor, advancer => c = advancer, val => { cursor.stop(val); c = nop; }, e => { cursor.fail(e); c = nop; }))
                    wrappedFn(cursor.value, cursor, advancer => c = advancer);
                c();
            });
        }
    });
}

class Collection {
    _read(fn, cb) {
        var ctx = this._ctx;
        return ctx.error ?
            ctx.table._trans(null, rejection.bind(null, ctx.error)) :
            ctx.table._trans('readonly', fn).then(cb);
    }
    _write(fn) {
        var ctx = this._ctx;
        return ctx.error ?
            ctx.table._trans(null, rejection.bind(null, ctx.error)) :
            ctx.table._trans('readwrite', fn, "locked");
    }
    _addAlgorithm(fn) {
        var ctx = this._ctx;
        ctx.algorithm = combine(ctx.algorithm, fn);
    }
    _iterate(fn, coreTrans) {
        return iter(this._ctx, fn, coreTrans, this._ctx.table.core);
    }
    clone(props) {
        var rv = Object.create(this.constructor.prototype), ctx = Object.create(this._ctx);
        if (props)
            extend(ctx, props);
        rv._ctx = ctx;
        return rv;
    }
    raw() {
        this._ctx.valueMapper = null;
        return this;
    }
    each(fn) {
        var ctx = this._ctx;
        return this._read(trans => iter(ctx, fn, trans, ctx.table.core));
    }
    count(cb) {
        return this._read(trans => {
            const ctx = this._ctx;
            const coreTable = ctx.table.core;
            if (isPlainKeyRange(ctx, true)) {
                return coreTable.count({
                    trans,
                    query: {
                        index: getIndexOrStore(ctx, coreTable.schema),
                        range: ctx.range
                    }
                }).then(count => Math.min(count, ctx.limit));
            }
            else {
                var count = 0;
                return iter(ctx, () => { ++count; return false; }, trans, coreTable)
                    .then(() => count);
            }
        }).then(cb);
    }
    sortBy(keyPath, cb) {
        const parts = keyPath.split('.').reverse(), lastPart = parts[0], lastIndex = parts.length - 1;
        function getval(obj, i) {
            if (i)
                return getval(obj[parts[i]], i - 1);
            return obj[lastPart];
        }
        var order = this._ctx.dir === "next" ? 1 : -1;
        function sorter(a, b) {
            var aVal = getval(a, lastIndex), bVal = getval(b, lastIndex);
            return aVal < bVal ? -order : aVal > bVal ? order : 0;
        }
        return this.toArray(function (a) {
            return a.sort(sorter);
        }).then(cb);
    }
    toArray(cb) {
        return this._read(trans => {
            var ctx = this._ctx;
            if (ctx.dir === 'next' && isPlainKeyRange(ctx, true) && ctx.limit > 0) {
                const { valueMapper } = ctx;
                const index = getIndexOrStore(ctx, ctx.table.core.schema);
                return ctx.table.core.query({
                    trans,
                    limit: ctx.limit,
                    values: true,
                    query: {
                        index,
                        range: ctx.range
                    }
                }).then(({ result }) => valueMapper ? result.map(valueMapper) : result);
            }
            else {
                const a = [];
                return iter(ctx, item => a.push(item), trans, ctx.table.core).then(() => a);
            }
        }, cb);
    }
    offset(offset) {
        var ctx = this._ctx;
        if (offset <= 0)
            return this;
        ctx.offset += offset;
        if (isPlainKeyRange(ctx)) {
            addReplayFilter(ctx, () => {
                var offsetLeft = offset;
                return (cursor, advance) => {
                    if (offsetLeft === 0)
                        return true;
                    if (offsetLeft === 1) {
                        --offsetLeft;
                        return false;
                    }
                    advance(() => {
                        cursor.advance(offsetLeft);
                        offsetLeft = 0;
                    });
                    return false;
                };
            });
        }
        else {
            addReplayFilter(ctx, () => {
                var offsetLeft = offset;
                return () => (--offsetLeft < 0);
            });
        }
        return this;
    }
    limit(numRows) {
        this._ctx.limit = Math.min(this._ctx.limit, numRows);
        addReplayFilter(this._ctx, () => {
            var rowsLeft = numRows;
            return function (cursor, advance, resolve) {
                if (--rowsLeft <= 0)
                    advance(resolve);
                return rowsLeft >= 0;
            };
        }, true);
        return this;
    }
    until(filterFunction, bIncludeStopEntry) {
        addFilter(this._ctx, function (cursor, advance, resolve) {
            if (filterFunction(cursor.value)) {
                advance(resolve);
                return bIncludeStopEntry;
            }
            else {
                return true;
            }
        });
        return this;
    }
    first(cb) {
        return this.limit(1).toArray(function (a) { return a[0]; }).then(cb);
    }
    last(cb) {
        return this.reverse().first(cb);
    }
    filter(filterFunction) {
        addFilter(this._ctx, function (cursor) {
            return filterFunction(cursor.value);
        });
        addMatchFilter(this._ctx, filterFunction);
        return this;
    }
    and(filter) {
        return this.filter(filter);
    }
    or(indexName) {
        return new this.db.WhereClause(this._ctx.table, indexName, this);
    }
    reverse() {
        this._ctx.dir = (this._ctx.dir === "prev" ? "next" : "prev");
        if (this._ondirectionchange)
            this._ondirectionchange(this._ctx.dir);
        return this;
    }
    desc() {
        return this.reverse();
    }
    eachKey(cb) {
        var ctx = this._ctx;
        ctx.keysOnly = !ctx.isMatch;
        return this.each(function (val, cursor) { cb(cursor.key, cursor); });
    }
    eachUniqueKey(cb) {
        this._ctx.unique = "unique";
        return this.eachKey(cb);
    }
    eachPrimaryKey(cb) {
        var ctx = this._ctx;
        ctx.keysOnly = !ctx.isMatch;
        return this.each(function (val, cursor) { cb(cursor.primaryKey, cursor); });
    }
    keys(cb) {
        var ctx = this._ctx;
        ctx.keysOnly = !ctx.isMatch;
        var a = [];
        return this.each(function (item, cursor) {
            a.push(cursor.key);
        }).then(function () {
            return a;
        }).then(cb);
    }
    primaryKeys(cb) {
        var ctx = this._ctx;
        if (ctx.dir === 'next' && isPlainKeyRange(ctx, true) && ctx.limit > 0) {
            return this._read(trans => {
                var index = getIndexOrStore(ctx, ctx.table.core.schema);
                return ctx.table.core.query({
                    trans,
                    values: false,
                    limit: ctx.limit,
                    query: {
                        index,
                        range: ctx.range
                    }
                });
            }).then(({ result }) => result).then(cb);
        }
        ctx.keysOnly = !ctx.isMatch;
        var a = [];
        return this.each(function (item, cursor) {
            a.push(cursor.primaryKey);
        }).then(function () {
            return a;
        }).then(cb);
    }
    uniqueKeys(cb) {
        this._ctx.unique = "unique";
        return this.keys(cb);
    }
    firstKey(cb) {
        return this.limit(1).keys(function (a) { return a[0]; }).then(cb);
    }
    lastKey(cb) {
        return this.reverse().firstKey(cb);
    }
    distinct() {
        var ctx = this._ctx, idx = ctx.index && ctx.table.schema.idxByName[ctx.index];
        if (!idx || !idx.multi)
            return this;
        var set = {};
        addFilter(this._ctx, function (cursor) {
            var strKey = cursor.primaryKey.toString();
            var found = hasOwn(set, strKey);
            set[strKey] = true;
            return !found;
        });
        return this;
    }
    modify(changes) {
        var ctx = this._ctx;
        return this._write(trans => {
            var modifyer;
            if (typeof changes === 'function') {
                modifyer = changes;
            }
            else {
                var keyPaths = keys(changes);
                var numKeys = keyPaths.length;
                modifyer = function (item) {
                    var anythingModified = false;
                    for (var i = 0; i < numKeys; ++i) {
                        var keyPath = keyPaths[i], val = changes[keyPath];
                        if (getByKeyPath(item, keyPath) !== val) {
                            setByKeyPath(item, keyPath, val);
                            anythingModified = true;
                        }
                    }
                    return anythingModified;
                };
            }
            const coreTable = ctx.table.core;
            const { outbound, extractKey } = coreTable.schema.primaryKey;
            const limit = this.db._options.modifyChunkSize || 200;
            const totalFailures = [];
            let successCount = 0;
            const failedKeys = [];
            const applyMutateResult = (expectedCount, res) => {
                const { failures, numFailures } = res;
                successCount += expectedCount - numFailures;
                for (let pos of keys(failures)) {
                    totalFailures.push(failures[pos]);
                }
            };
            return this.clone().primaryKeys().then(keys => {
                const nextChunk = (offset) => {
                    const count = Math.min(limit, keys.length - offset);
                    return coreTable.getMany({
                        trans,
                        keys: keys.slice(offset, offset + count),
                        cache: "immutable"
                    }).then(values => {
                        const addValues = [];
                        const putValues = [];
                        const putKeys = outbound ? [] : null;
                        const deleteKeys = [];
                        for (let i = 0; i < count; ++i) {
                            const origValue = values[i];
                            const ctx = {
                                value: deepClone(origValue),
                                primKey: keys[offset + i]
                            };
                            if (modifyer.call(ctx, ctx.value, ctx) !== false) {
                                if (ctx.value == null) {
                                    deleteKeys.push(keys[offset + i]);
                                }
                                else if (!outbound && cmp(extractKey(origValue), extractKey(ctx.value)) !== 0) {
                                    deleteKeys.push(keys[offset + i]);
                                    addValues.push(ctx.value);
                                }
                                else {
                                    putValues.push(ctx.value);
                                    if (outbound)
                                        putKeys.push(keys[offset + i]);
                                }
                            }
                        }
                        const criteria = isPlainKeyRange(ctx) &&
                            ctx.limit === Infinity &&
                            (typeof changes !== 'function' || changes === deleteCallback) && {
                            index: ctx.index,
                            range: ctx.range
                        };
                        return Promise.resolve(addValues.length > 0 &&
                            coreTable.mutate({ trans, type: 'add', values: addValues })
                                .then(res => {
                                for (let pos in res.failures) {
                                    deleteKeys.splice(parseInt(pos), 1);
                                }
                                applyMutateResult(addValues.length, res);
                            })).then(() => (putValues.length > 0 || (criteria && typeof changes === 'object')) &&
                            coreTable.mutate({
                                trans,
                                type: 'put',
                                keys: putKeys,
                                values: putValues,
                                criteria,
                                changeSpec: typeof changes !== 'function'
                                    && changes
                            }).then(res => applyMutateResult(putValues.length, res))).then(() => (deleteKeys.length > 0 || (criteria && changes === deleteCallback)) &&
                            coreTable.mutate({
                                trans,
                                type: 'delete',
                                keys: deleteKeys,
                                criteria
                            }).then(res => applyMutateResult(deleteKeys.length, res))).then(() => {
                            return keys.length > offset + count && nextChunk(offset + limit);
                        });
                    });
                };
                return nextChunk(0).then(() => {
                    if (totalFailures.length > 0)
                        throw new ModifyError("Error modifying one or more objects", totalFailures, successCount, failedKeys);
                    return keys.length;
                });
            });
        });
    }
    delete() {
        var ctx = this._ctx, range = ctx.range;
        if (isPlainKeyRange(ctx) &&
            ((ctx.isPrimKey && !hangsOnDeleteLargeKeyRange) || range.type === 3 ))
         {
            return this._write(trans => {
                const { primaryKey } = ctx.table.core.schema;
                const coreRange = range;
                return ctx.table.core.count({ trans, query: { index: primaryKey, range: coreRange } }).then(count => {
                    return ctx.table.core.mutate({ trans, type: 'deleteRange', range: coreRange })
                        .then(({ failures, lastResult, results, numFailures }) => {
                        if (numFailures)
                            throw new ModifyError("Could not delete some values", Object.keys(failures).map(pos => failures[pos]), count - numFailures);
                        return count - numFailures;
                    });
                });
            });
        }
        return this.modify(deleteCallback);
    }
}
const deleteCallback = (value, ctx) => ctx.value = null;

function createCollectionConstructor(db) {
    return makeClassConstructor(Collection.prototype, function Collection(whereClause, keyRangeGenerator) {
        this.db = db;
        let keyRange = AnyRange, error = null;
        if (keyRangeGenerator)
            try {
                keyRange = keyRangeGenerator();
            }
            catch (ex) {
                error = ex;
            }
        const whereCtx = whereClause._ctx;
        const table = whereCtx.table;
        const readingHook = mirror;
        this._ctx = {
            table: table,
            index: whereCtx.index,
            isPrimKey: (!whereCtx.index || (table.schema.primKey.keyPath && whereCtx.index === table.schema.primKey.name)),
            range: keyRange,
            keysOnly: false,
            dir: "next",
            unique: "",
            algorithm: null,
            filter: null,
            replayFilter: null,
            justLimit: true,
            isMatch: null,
            offset: 0,
            limit: Infinity,
            error: error,
            or: whereCtx.or,
            valueMapper: readingHook !== mirror ? readingHook : null
        };
    });
}

function simpleCompare(a, b) {
    return a < b ? -1 : a === b ? 0 : 1;
}
function simpleCompareReverse(a, b) {
    return a > b ? -1 : a === b ? 0 : 1;
}

function fail(collectionOrWhereClause, err, T) {
    var collection = collectionOrWhereClause instanceof WhereClause ?
        new collectionOrWhereClause.Collection(collectionOrWhereClause) :
        collectionOrWhereClause;
    collection._ctx.error = T ? new T(err) : new TypeError(err);
    return collection;
}
function emptyCollection(whereClause) {
    return new whereClause.Collection(whereClause, () => rangeEqual("")).limit(0);
}
function upperFactory(dir) {
    return dir === "next" ?
        (s) => s.toUpperCase() :
        (s) => s.toLowerCase();
}
function lowerFactory(dir) {
    return dir === "next" ?
        (s) => s.toLowerCase() :
        (s) => s.toUpperCase();
}
function nextCasing(key, lowerKey, upperNeedle, lowerNeedle, cmp, dir) {
    var length = Math.min(key.length, lowerNeedle.length);
    var llp = -1;
    for (var i = 0; i < length; ++i) {
        var lwrKeyChar = lowerKey[i];
        if (lwrKeyChar !== lowerNeedle[i]) {
            if (cmp(key[i], upperNeedle[i]) < 0)
                return key.substr(0, i) + upperNeedle[i] + upperNeedle.substr(i + 1);
            if (cmp(key[i], lowerNeedle[i]) < 0)
                return key.substr(0, i) + lowerNeedle[i] + upperNeedle.substr(i + 1);
            if (llp >= 0)
                return key.substr(0, llp) + lowerKey[llp] + upperNeedle.substr(llp + 1);
            return null;
        }
        if (cmp(key[i], lwrKeyChar) < 0)
            llp = i;
    }
    if (length < lowerNeedle.length && dir === "next")
        return key + upperNeedle.substr(key.length);
    if (length < key.length && dir === "prev")
        return key.substr(0, upperNeedle.length);
    return (llp < 0 ? null : key.substr(0, llp) + lowerNeedle[llp] + upperNeedle.substr(llp + 1));
}
function addIgnoreCaseAlgorithm(whereClause, match, needles, suffix) {
    var upper, lower, compare, upperNeedles, lowerNeedles, direction, nextKeySuffix, needlesLen = needles.length;
    if (!needles.every(s => typeof s === 'string')) {
        return fail(whereClause, STRING_EXPECTED);
    }
    function initDirection(dir) {
        upper = upperFactory(dir);
        lower = lowerFactory(dir);
        compare = (dir === "next" ? simpleCompare : simpleCompareReverse);
        var needleBounds = needles.map(function (needle) {
            return { lower: lower(needle), upper: upper(needle) };
        }).sort(function (a, b) {
            return compare(a.lower, b.lower);
        });
        upperNeedles = needleBounds.map(function (nb) { return nb.upper; });
        lowerNeedles = needleBounds.map(function (nb) { return nb.lower; });
        direction = dir;
        nextKeySuffix = (dir === "next" ? "" : suffix);
    }
    initDirection("next");
    var c = new whereClause.Collection(whereClause, () => createRange(upperNeedles[0], lowerNeedles[needlesLen - 1] + suffix));
    c._ondirectionchange = function (direction) {
        initDirection(direction);
    };
    var firstPossibleNeedle = 0;
    c._addAlgorithm(function (cursor, advance, resolve) {
        var key = cursor.key;
        if (typeof key !== 'string')
            return false;
        var lowerKey = lower(key);
        if (match(lowerKey, lowerNeedles, firstPossibleNeedle)) {
            return true;
        }
        else {
            var lowestPossibleCasing = null;
            for (var i = firstPossibleNeedle; i < needlesLen; ++i) {
                var casing = nextCasing(key, lowerKey, upperNeedles[i], lowerNeedles[i], compare, direction);
                if (casing === null && lowestPossibleCasing === null)
                    firstPossibleNeedle = i + 1;
                else if (lowestPossibleCasing === null || compare(lowestPossibleCasing, casing) > 0) {
                    lowestPossibleCasing = casing;
                }
            }
            if (lowestPossibleCasing !== null) {
                advance(function () { cursor.continue(lowestPossibleCasing + nextKeySuffix); });
            }
            else {
                advance(resolve);
            }
            return false;
        }
    });
    return c;
}
function createRange(lower, upper, lowerOpen, upperOpen) {
    return {
        type: 2 ,
        lower,
        upper,
        lowerOpen,
        upperOpen
    };
}
function rangeEqual(value) {
    return {
        type: 1 ,
        lower: value,
        upper: value
    };
}

class WhereClause {
    get Collection() {
        return this._ctx.table.db.Collection;
    }
    between(lower, upper, includeLower, includeUpper) {
        includeLower = includeLower !== false;
        includeUpper = includeUpper === true;
        try {
            if ((this._cmp(lower, upper) > 0) ||
                (this._cmp(lower, upper) === 0 && (includeLower || includeUpper) && !(includeLower && includeUpper)))
                return emptyCollection(this);
            return new this.Collection(this, () => createRange(lower, upper, !includeLower, !includeUpper));
        }
        catch (e) {
            return fail(this, INVALID_KEY_ARGUMENT);
        }
    }
    equals(value) {
        if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
        return new this.Collection(this, () => rangeEqual(value));
    }
    above(value) {
        if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
        return new this.Collection(this, () => createRange(value, undefined, true));
    }
    aboveOrEqual(value) {
        if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
        return new this.Collection(this, () => createRange(value, undefined, false));
    }
    below(value) {
        if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
        return new this.Collection(this, () => createRange(undefined, value, false, true));
    }
    belowOrEqual(value) {
        if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
        return new this.Collection(this, () => createRange(undefined, value));
    }
    startsWith(str) {
        if (typeof str !== 'string')
            return fail(this, STRING_EXPECTED);
        return this.between(str, str + maxString, true, true);
    }
    startsWithIgnoreCase(str) {
        if (str === "")
            return this.startsWith(str);
        return addIgnoreCaseAlgorithm(this, (x, a) => x.indexOf(a[0]) === 0, [str], maxString);
    }
    equalsIgnoreCase(str) {
        return addIgnoreCaseAlgorithm(this, (x, a) => x === a[0], [str], "");
    }
    anyOfIgnoreCase() {
        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
        if (set.length === 0)
            return emptyCollection(this);
        return addIgnoreCaseAlgorithm(this, (x, a) => a.indexOf(x) !== -1, set, "");
    }
    startsWithAnyOfIgnoreCase() {
        var set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
        if (set.length === 0)
            return emptyCollection(this);
        return addIgnoreCaseAlgorithm(this, (x, a) => a.some(n => x.indexOf(n) === 0), set, maxString);
    }
    anyOf() {
        const set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
        let compare = this._cmp;
        try {
            set.sort(compare);
        }
        catch (e) {
            return fail(this, INVALID_KEY_ARGUMENT);
        }
        if (set.length === 0)
            return emptyCollection(this);
        const c = new this.Collection(this, () => createRange(set[0], set[set.length - 1]));
        c._ondirectionchange = direction => {
            compare = (direction === "next" ?
                this._ascending :
                this._descending);
            set.sort(compare);
        };
        let i = 0;
        c._addAlgorithm((cursor, advance, resolve) => {
            const key = cursor.key;
            while (compare(key, set[i]) > 0) {
                ++i;
                if (i === set.length) {
                    advance(resolve);
                    return false;
                }
            }
            if (compare(key, set[i]) === 0) {
                return true;
            }
            else {
                advance(() => { cursor.continue(set[i]); });
                return false;
            }
        });
        return c;
    }
    notEqual(value) {
        return this.inAnyRange([[minKey, value], [value, this.db._maxKey]], { includeLowers: false, includeUppers: false });
    }
    noneOf() {
        const set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
        if (set.length === 0)
            return new this.Collection(this);
        try {
            set.sort(this._ascending);
        }
        catch (e) {
            return fail(this, INVALID_KEY_ARGUMENT);
        }
        const ranges = set.reduce((res, val) => res ?
            res.concat([[res[res.length - 1][1], val]]) :
            [[minKey, val]], null);
        ranges.push([set[set.length - 1], this.db._maxKey]);
        return this.inAnyRange(ranges, { includeLowers: false, includeUppers: false });
    }
    inAnyRange(ranges, options) {
        const cmp = this._cmp, ascending = this._ascending, descending = this._descending, min = this._min, max = this._max;
        if (ranges.length === 0)
            return emptyCollection(this);
        if (!ranges.every(range => range[0] !== undefined &&
            range[1] !== undefined &&
            ascending(range[0], range[1]) <= 0)) {
            return fail(this, "First argument to inAnyRange() must be an Array of two-value Arrays [lower,upper] where upper must not be lower than lower", exceptions.InvalidArgument);
        }
        const includeLowers = !options || options.includeLowers !== false;
        const includeUppers = options && options.includeUppers === true;
        function addRange(ranges, newRange) {
            let i = 0, l = ranges.length;
            for (; i < l; ++i) {
                const range = ranges[i];
                if (cmp(newRange[0], range[1]) < 0 && cmp(newRange[1], range[0]) > 0) {
                    range[0] = min(range[0], newRange[0]);
                    range[1] = max(range[1], newRange[1]);
                    break;
                }
            }
            if (i === l)
                ranges.push(newRange);
            return ranges;
        }
        let sortDirection = ascending;
        function rangeSorter(a, b) { return sortDirection(a[0], b[0]); }
        let set;
        try {
            set = ranges.reduce(addRange, []);
            set.sort(rangeSorter);
        }
        catch (ex) {
            return fail(this, INVALID_KEY_ARGUMENT);
        }
        let rangePos = 0;
        const keyIsBeyondCurrentEntry = includeUppers ?
            key => ascending(key, set[rangePos][1]) > 0 :
            key => ascending(key, set[rangePos][1]) >= 0;
        const keyIsBeforeCurrentEntry = includeLowers ?
            key => descending(key, set[rangePos][0]) > 0 :
            key => descending(key, set[rangePos][0]) >= 0;
        function keyWithinCurrentRange(key) {
            return !keyIsBeyondCurrentEntry(key) && !keyIsBeforeCurrentEntry(key);
        }
        let checkKey = keyIsBeyondCurrentEntry;
        const c = new this.Collection(this, () => createRange(set[0][0], set[set.length - 1][1], !includeLowers, !includeUppers));
        c._ondirectionchange = direction => {
            if (direction === "next") {
                checkKey = keyIsBeyondCurrentEntry;
                sortDirection = ascending;
            }
            else {
                checkKey = keyIsBeforeCurrentEntry;
                sortDirection = descending;
            }
            set.sort(rangeSorter);
        };
        c._addAlgorithm((cursor, advance, resolve) => {
            var key = cursor.key;
            while (checkKey(key)) {
                ++rangePos;
                if (rangePos === set.length) {
                    advance(resolve);
                    return false;
                }
            }
            if (keyWithinCurrentRange(key)) {
                return true;
            }
            else if (this._cmp(key, set[rangePos][1]) === 0 || this._cmp(key, set[rangePos][0]) === 0) {
                return false;
            }
            else {
                advance(() => {
                    if (sortDirection === ascending)
                        cursor.continue(set[rangePos][0]);
                    else
                        cursor.continue(set[rangePos][1]);
                });
                return false;
            }
        });
        return c;
    }
    startsWithAnyOf() {
        const set = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
        if (!set.every(s => typeof s === 'string')) {
            return fail(this, "startsWithAnyOf() only works with strings");
        }
        if (set.length === 0)
            return emptyCollection(this);
        return this.inAnyRange(set.map((str) => [str, str + maxString]));
    }
}

function createWhereClauseConstructor(db) {
    return makeClassConstructor(WhereClause.prototype, function WhereClause(table, index, orCollection) {
        this.db = db;
        this._ctx = {
            table: table,
            index: index === ":id" ? null : index,
            or: orCollection
        };
        this._cmp = this._ascending = cmp;
        this._descending = (a, b) => cmp(b, a);
        this._max = (a, b) => cmp(a, b) > 0 ? a : b;
        this._min = (a, b) => cmp(a, b) < 0 ? a : b;
        this._IDBKeyRange = db._deps.IDBKeyRange;
    });
}

function eventRejectHandler(reject) {
    return wrap(function (event) {
        preventDefault(event);
        reject(event.target.error);
        return false;
    });
}
function preventDefault(event) {
    if (event.stopPropagation)
        event.stopPropagation();
    if (event.preventDefault)
        event.preventDefault();
}

class Transaction {
    _lock() {
        assert(!PSD.global);
        ++this._reculock;
        if (this._reculock === 1 && !PSD.global)
            PSD.lockOwnerFor = this;
        return this;
    }
    _unlock() {
        assert(!PSD.global);
        if (--this._reculock === 0) {
            if (!PSD.global)
                PSD.lockOwnerFor = null;
            while (this._blockedFuncs.length > 0 && !this._locked()) {
                var fnAndPSD = this._blockedFuncs.shift();
                try {
                    usePSD(fnAndPSD[1], fnAndPSD[0]);
                }
                catch (e) { }
            }
        }
        return this;
    }
    _locked() {
        return this._reculock && PSD.lockOwnerFor !== this;
    }
    create(idbtrans) {
        if (!this.mode)
            return this;
        const idbdb = this.db.idbdb;
        const dbOpenError = this.db._state.dbOpenError;
        assert(!this.idbtrans);
        if (!idbtrans && !idbdb) {
            switch (dbOpenError && dbOpenError.name) {
                case "DatabaseClosedError":
                    throw new exceptions.DatabaseClosed(dbOpenError);
                case "MissingAPIError":
                    throw new exceptions.MissingAPI(dbOpenError.message, dbOpenError);
                default:
                    throw new exceptions.OpenFailed(dbOpenError);
            }
        }
        if (!this.active)
            throw new exceptions.TransactionInactive();
        assert(this._completion._state === null);
        idbtrans = this.idbtrans = idbtrans ||
            (this.db.core
                ? this.db.core.transaction(this.storeNames, this.mode, { durability: this.chromeTransactionDurability })
                : idbdb.transaction(this.storeNames, this.mode, { durability: this.chromeTransactionDurability }));
        idbtrans.onerror = wrap(ev => {
            preventDefault(ev);
            this._reject(idbtrans.error);
        });
        idbtrans.onabort = wrap(ev => {
            preventDefault(ev);
            this.active && this._reject(new exceptions.Abort(idbtrans.error));
            this.active = false;
        });
        idbtrans.oncomplete = wrap(() => {
            this.active = false;
            this._resolve();
        });
        return this;
    }
    _promise(mode, fn, bWriteLock) {
        if (mode === 'readwrite' && this.mode !== 'readwrite')
            return rejection(new exceptions.ReadOnly("Transaction is readonly"));
        if (!this.active)
            return rejection(new exceptions.TransactionInactive());
        if (this._locked()) {
            return new DexiePromise((resolve, reject) => {
                this._blockedFuncs.push([() => {
                        this._promise(mode, fn, bWriteLock).then(resolve, reject);
                    }, PSD]);
            });
        }
        else if (bWriteLock) {
            return newScope(() => {
                var p = new DexiePromise((resolve, reject) => {
                    this._lock();
                    const rv = fn(resolve, reject, this);
                    if (rv && rv.then)
                        rv.then(resolve, reject);
                });
                p.finally(() => this._unlock());
                p._lib = true;
                return p;
            });
        }
        else {
            var p = new DexiePromise((resolve, reject) => {
                var rv = fn(resolve, reject, this);
                if (rv && rv.then)
                    rv.then(resolve, reject);
            });
            p._lib = true;
            return p;
        }
    }
    _root() {
        return this.parent ? this.parent._root() : this;
    }
    waitFor(promiseLike) {
        var root = this._root();
        const promise = DexiePromise.resolve(promiseLike);
        if (root._waitingFor) {
            root._waitingFor = root._waitingFor.then(() => promise);
        }
        else {
            root._waitingFor = promise;
            root._waitingQueue = [];
            var store = root.idbtrans.objectStore(root.storeNames[0]);
            (function spin() {
                ++root._spinCount;
                while (root._waitingQueue.length)
                    (root._waitingQueue.shift())();
                if (root._waitingFor)
                    store.get(-Infinity).onsuccess = spin;
            }());
        }
        var currentWaitPromise = root._waitingFor;
        return new DexiePromise((resolve, reject) => {
            promise.then(res => root._waitingQueue.push(wrap(resolve.bind(null, res))), err => root._waitingQueue.push(wrap(reject.bind(null, err)))).finally(() => {
                if (root._waitingFor === currentWaitPromise) {
                    root._waitingFor = null;
                }
            });
        });
    }
    abort() {
        if (this.active) {
            this.active = false;
            if (this.idbtrans)
                this.idbtrans.abort();
            this._reject(new exceptions.Abort());
        }
    }
    table(tableName) {
        const memoizedTables = (this._memoizedTables || (this._memoizedTables = {}));
        if (hasOwn(memoizedTables, tableName))
            return memoizedTables[tableName];
        const tableSchema = this.schema[tableName];
        if (!tableSchema) {
            throw new exceptions.NotFound("Table " + tableName + " not part of transaction");
        }
        const transactionBoundTable = new this.db.Table(tableName, tableSchema, this);
        transactionBoundTable.core = this.db.core.table(tableName);
        memoizedTables[tableName] = transactionBoundTable;
        return transactionBoundTable;
    }
}

function createTransactionConstructor(db) {
    return makeClassConstructor(Transaction.prototype, function Transaction(mode, storeNames, dbschema, chromeTransactionDurability, parent) {
        this.db = db;
        this.mode = mode;
        this.storeNames = storeNames;
        this.schema = dbschema;
        this.chromeTransactionDurability = chromeTransactionDurability;
        this.idbtrans = null;
        this.parent = parent || null;
        this.active = true;
        this._reculock = 0;
        this._blockedFuncs = [];
        this._resolve = null;
        this._reject = null;
        this._waitingFor = null;
        this._waitingQueue = null;
        this._spinCount = 0;
        this._completion = new DexiePromise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
        this._completion.then(() => {
            this.active = false;
        }, e => {
            var wasActive = this.active;
            this.active = false;
            this.parent ?
                this.parent._reject(e) :
                wasActive && this.idbtrans && this.idbtrans.abort();
            return rejection(e);
        });
    });
}

function createIndexSpec(name, keyPath, unique, multi, auto, compound, isPrimKey) {
    return {
        name,
        keyPath,
        unique,
        multi,
        auto,
        compound,
        src: (unique && !isPrimKey ? '&' : '') + (multi ? '*' : '') + (auto ? "++" : "") + nameFromKeyPath(keyPath)
    };
}
function nameFromKeyPath(keyPath) {
    return typeof keyPath === 'string' ?
        keyPath :
        keyPath ? ('[' + [].join.call(keyPath, '+') + ']') : "";
}

function createTableSchema(name, primKey, indexes) {
    return {
        name,
        primKey,
        indexes,
        mappedClass: null,
        idxByName: arrayToObject(indexes, index => [index.name, index])
    };
}

function getDbNamesTable(indexedDB, IDBKeyRange) {
    let dbNamesDB = indexedDB["_dbNamesDB"];
    if (!dbNamesDB) {
        dbNamesDB = indexedDB["_dbNamesDB"] = new Dexie$1(DBNAMES_DB, {
            addons: [],
            indexedDB,
            IDBKeyRange,
        });
        dbNamesDB.version(1).stores({ dbnames: "name" });
    }
    return dbNamesDB.table("dbnames");
}
function hasDatabasesNative(indexedDB) {
    return indexedDB && typeof indexedDB.databases === "function";
}
function getDatabaseNames({ indexedDB, IDBKeyRange, }) {
    return hasDatabasesNative(indexedDB)
        ? Promise.resolve(indexedDB.databases()).then((infos) => !Array.isArray(infos) ? [] : infos
            .map((info) => info.name)
            .filter((name) => name !== DBNAMES_DB))
        : getDbNamesTable(indexedDB, IDBKeyRange).toCollection().primaryKeys();
}
function _onDatabaseCreated({ indexedDB, IDBKeyRange }, name) {
    !hasDatabasesNative(indexedDB) &&
        name !== DBNAMES_DB &&
        getDbNamesTable(indexedDB, IDBKeyRange).put({ name }).catch(nop);
}
function _onDatabaseDeleted({ indexedDB, IDBKeyRange }, name) {
    !hasDatabasesNative(indexedDB) &&
        name !== DBNAMES_DB &&
        getDbNamesTable(indexedDB, IDBKeyRange).delete(name).catch(nop);
}

function safariMultiStoreFix(storeNames) {
    return storeNames.length === 1 ? storeNames[0] : storeNames;
}
let getMaxKey = (IdbKeyRange) => {
    try {
        IdbKeyRange.only([[]]);
        getMaxKey = () => [[]];
        return [[]];
    }
    catch (e) {
        getMaxKey = () => maxString;
        return maxString;
    }
};
let safari14Workaround = (indexedDB) => {
    if (!safari14Workaround.pending) {
        let timer;
        safari14Workaround.pending = new DexiePromise((resolve) => {
            if (hasDatabasesNative(indexedDB)) {
                const isSafari = _global.safari
                    || (typeof navigator !== 'undefined'
                        && !navigator.userAgentData
                        && /Safari\//.test(navigator.userAgent)
                        && !/Chrom(e|ium)\//.test(navigator.userAgent));
                if (isSafari) {
                    const tryIdb = () => getDatabaseNames({ indexedDB, IDBKeyRange: null }).finally(resolve);
                    timer = setInterval(tryIdb, 100);
                    return tryIdb();
                }
            }
            resolve();
        }).finally(() => {
            clearInterval(timer);
            safari14Workaround = () => DexiePromise.resolve();
        });
    }
    return safari14Workaround.pending;
};

function getKeyExtractor(keyPath) {
    if (keyPath == null) {
        return () => undefined;
    }
    else if (typeof keyPath === 'string') {
        return getSinglePathKeyExtractor(keyPath);
    }
    else {
        return obj => getByKeyPath(obj, keyPath);
    }
}
function getSinglePathKeyExtractor(keyPath) {
    const split = keyPath.split('.');
    if (split.length === 1) {
        return obj => obj[keyPath];
    }
    else {
        return obj => getByKeyPath(obj, keyPath);
    }
}

function arrayify(arrayLike) {
    return [].slice.call(arrayLike);
}
let _id_counter = 0;
function getKeyPathAlias(keyPath) {
    return keyPath == null ?
        ":id" :
        typeof keyPath === 'string' ?
            keyPath :
            `[${keyPath.join('+')}]`;
}
function createDBCore(db, IdbKeyRange, tmpTrans) {
    function extractSchema(db, trans) {
        const tables = arrayify(db.objectStoreNames);
        return {
            schema: {
                name: db.name,
                tables: tables.map(table => trans.objectStore(table)).map(store => {
                    const { keyPath, autoIncrement } = store;
                    const compound = isArray(keyPath);
                    const outbound = keyPath == null;
                    const indexByKeyPath = {};
                    const result = {
                        name: store.name,
                        primaryKey: {
                            name: null,
                            isPrimaryKey: true,
                            outbound,
                            compound,
                            keyPath,
                            autoIncrement,
                            unique: true,
                            extractKey: getKeyExtractor(keyPath)
                        },
                        indexes: arrayify(store.indexNames).map(indexName => store.index(indexName))
                            .map(index => {
                            const { name, unique, multiEntry, keyPath } = index;
                            const compound = isArray(keyPath);
                            const result = {
                                name,
                                compound,
                                keyPath,
                                unique,
                                multiEntry,
                                extractKey: getKeyExtractor(keyPath)
                            };
                            indexByKeyPath[getKeyPathAlias(keyPath)] = result;
                            return result;
                        }),
                        getIndexByKeyPath: (keyPath) => indexByKeyPath[getKeyPathAlias(keyPath)]
                    };
                    indexByKeyPath[":id"] = result.primaryKey;
                    if (keyPath != null) {
                        indexByKeyPath[getKeyPathAlias(keyPath)] = result.primaryKey;
                    }
                    return result;
                })
            },
            hasGetAll: tables.length > 0 && ('getAll' in trans.objectStore(tables[0])) &&
                !(typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) &&
                    !/(Chrome\/|Edge\/)/.test(navigator.userAgent) &&
                    [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604)
        };
    }
    function makeIDBKeyRange(range) {
        if (range.type === 3 )
            return null;
        if (range.type === 4 )
            throw new Error("Cannot convert never type to IDBKeyRange");
        const { lower, upper, lowerOpen, upperOpen } = range;
        const idbRange = lower === undefined ?
            upper === undefined ?
                null :
                IdbKeyRange.upperBound(upper, !!upperOpen) :
            upper === undefined ?
                IdbKeyRange.lowerBound(lower, !!lowerOpen) :
                IdbKeyRange.bound(lower, upper, !!lowerOpen, !!upperOpen);
        return idbRange;
    }
    function createDbCoreTable(tableSchema) {
        const tableName = tableSchema.name;
        function mutate({ trans, type, keys, values, range }) {
            return new Promise((resolve, reject) => {
                resolve = wrap(resolve);
                const store = trans.objectStore(tableName);
                const outbound = store.keyPath == null;
                const isAddOrPut = type === "put" || type === "add";
                if (!isAddOrPut && type !== 'delete' && type !== 'deleteRange')
                    throw new Error("Invalid operation type: " + type);
                const { length } = keys || values || { length: 1 };
                if (keys && values && keys.length !== values.length) {
                    throw new Error("Given keys array must have same length as given values array.");
                }
                if (length === 0)
                    return resolve({ numFailures: 0, failures: {}, results: [], lastResult: undefined });
                let req;
                const reqs = [];
                const failures = [];
                let numFailures = 0;
                const errorHandler = event => {
                    ++numFailures;
                    preventDefault(event);
                };
                if (type === 'deleteRange') {
                    if (range.type === 4 )
                        return resolve({ numFailures, failures, results: [], lastResult: undefined });
                    if (range.type === 3 )
                        reqs.push(req = store.clear());
                    else
                        reqs.push(req = store.delete(makeIDBKeyRange(range)));
                }
                else {
                    const [args1, args2] = isAddOrPut ?
                        outbound ?
                            [values, keys] :
                            [values, null] :
                        [keys, null];
                    if (isAddOrPut) {
                        for (let i = 0; i < length; ++i) {
                            reqs.push(req = (args2 && args2[i] !== undefined ?
                                store[type](args1[i], args2[i]) :
                                store[type](args1[i])));
                            req.onerror = errorHandler;
                        }
                    }
                    else {
                        for (let i = 0; i < length; ++i) {
                            reqs.push(req = store[type](args1[i]));
                            req.onerror = errorHandler;
                        }
                    }
                }
                const done = event => {
                    const lastResult = event.target.result;
                    for (let i = reqs.length; i--;) {
                        if (reqs[i].error != null)
                            failures[i] = reqs[i].error;
                        reqs[i] = reqs[i].result;
                    }
                    resolve({
                        numFailures,
                        failures,
                        results: type === "delete" ? keys : reqs,
                        lastResult
                    });
                };
                req.onerror = event => {
                    errorHandler(event);
                    done(event);
                };
                req.onsuccess = done;
            });
        }
        function openCursor({ trans, values, query, reverse, unique }) {
            return new Promise((resolve, reject) => {
                resolve = wrap(resolve);
                const { index, range } = query;
                const store = trans.objectStore(tableName);
                const source = index.isPrimaryKey ?
                    store :
                    store.index(index.name);
                const direction = reverse ?
                    unique ?
                        "prevunique" :
                        "prev" :
                    unique ?
                        "nextunique" :
                        "next";
                const req = values || !('openKeyCursor' in source) ?
                    source.openCursor(makeIDBKeyRange(range), direction) :
                    source.openKeyCursor(makeIDBKeyRange(range), direction);
                req.onerror = eventRejectHandler(reject);
                req.onsuccess = wrap(ev => {
                    const cursor = req.result;
                    if (!cursor) {
                        resolve(null);
                        return;
                    }
                    cursor.___id = ++_id_counter;
                    cursor.done = false;
                    const _cursorContinue = cursor.continue.bind(cursor);
                    let _cursorContinuePrimaryKey = cursor.continuePrimaryKey;
                    if (_cursorContinuePrimaryKey)
                        _cursorContinuePrimaryKey = _cursorContinuePrimaryKey.bind(cursor);
                    const _cursorAdvance = cursor.advance.bind(cursor);
                    const doThrowCursorIsNotStarted = () => { throw new Error("Cursor not started"); };
                    const doThrowCursorIsStopped = () => { throw new Error("Cursor not stopped"); };
                    cursor.trans = trans;
                    cursor.stop = cursor.continue = cursor.continuePrimaryKey = cursor.advance = doThrowCursorIsNotStarted;
                    cursor.fail = wrap(reject);
                    cursor.next = function () {
                        let gotOne = 1;
                        return this.start(() => gotOne-- ? this.continue() : this.stop()).then(() => this);
                    };
                    cursor.start = (callback) => {
                        const iterationPromise = new Promise((resolveIteration, rejectIteration) => {
                            resolveIteration = wrap(resolveIteration);
                            req.onerror = eventRejectHandler(rejectIteration);
                            cursor.fail = rejectIteration;
                            cursor.stop = value => {
                                cursor.stop = cursor.continue = cursor.continuePrimaryKey = cursor.advance = doThrowCursorIsStopped;
                                resolveIteration(value);
                            };
                        });
                        const guardedCallback = () => {
                            if (req.result) {
                                try {
                                    callback();
                                }
                                catch (err) {
                                    cursor.fail(err);
                                }
                            }
                            else {
                                cursor.done = true;
                                cursor.start = () => { throw new Error("Cursor behind last entry"); };
                                cursor.stop();
                            }
                        };
                        req.onsuccess = wrap(ev => {
                            req.onsuccess = guardedCallback;
                            guardedCallback();
                        });
                        cursor.continue = _cursorContinue;
                        cursor.continuePrimaryKey = _cursorContinuePrimaryKey;
                        cursor.advance = _cursorAdvance;
                        guardedCallback();
                        return iterationPromise;
                    };
                    resolve(cursor);
                }, reject);
            });
        }
        function query(hasGetAll) {
            return (request) => {
                return new Promise((resolve, reject) => {
                    resolve = wrap(resolve);
                    const { trans, values, limit, query } = request;
                    const nonInfinitLimit = limit === Infinity ? undefined : limit;
                    const { index, range } = query;
                    const store = trans.objectStore(tableName);
                    const source = index.isPrimaryKey ? store : store.index(index.name);
                    const idbKeyRange = makeIDBKeyRange(range);
                    if (limit === 0)
                        return resolve({ result: [] });
                    if (hasGetAll) {
                        const req = values ?
                            source.getAll(idbKeyRange, nonInfinitLimit) :
                            source.getAllKeys(idbKeyRange, nonInfinitLimit);
                        req.onsuccess = event => resolve({ result: event.target.result });
                        req.onerror = eventRejectHandler(reject);
                    }
                    else {
                        let count = 0;
                        const req = values || !('openKeyCursor' in source) ?
                            source.openCursor(idbKeyRange) :
                            source.openKeyCursor(idbKeyRange);
                        const result = [];
                        req.onsuccess = event => {
                            const cursor = req.result;
                            if (!cursor)
                                return resolve({ result });
                            result.push(values ? cursor.value : cursor.primaryKey);
                            if (++count === limit)
                                return resolve({ result });
                            cursor.continue();
                        };
                        req.onerror = eventRejectHandler(reject);
                    }
                });
            };
        }
        return {
            name: tableName,
            schema: tableSchema,
            mutate,
            getMany({ trans, keys, method = 'get' }) {
                return new Promise((resolve, reject) => {
                    resolve = wrap(resolve);
                    const store = trans.objectStore(tableName);
                    const length = keys.length;
                    const result = new Array(length);
                    let keyCount = 0;
                    let callbackCount = 0;
                    let req;
                    const successHandler = event => {
                        const req = event.target;
                        if ((result[req._pos] = req.result) != null)
                            ;
                        if (++callbackCount === keyCount)
                            resolve(result);
                    };
                    const errorHandler = eventRejectHandler(reject);
                    for (let i = 0; i < length; ++i) {
                        const key = keys[i];
                        if (key != null) {
                            req = store[method](keys[i]);
                            req._pos = i;
                            req.onsuccess = successHandler;
                            req.onerror = errorHandler;
                            ++keyCount;
                        }
                    }
                    if (keyCount === 0)
                        resolve(result);
                });
            },
            get({ trans, key, method = 'get' }) {
                return new Promise((resolve, reject) => {
                    resolve = wrap(resolve);
                    const store = trans.objectStore(tableName);
                    const req = store[method](key);
                    req.onsuccess = event => resolve(event.target.result);
                    req.onerror = eventRejectHandler(reject);
                });
            },
            query: query(hasGetAll),
            openCursor,
            count({ query, trans }) {
                const { index, range } = query;
                return new Promise((resolve, reject) => {
                    const store = trans.objectStore(tableName);
                    const source = index.isPrimaryKey ? store : store.index(index.name);
                    const idbKeyRange = makeIDBKeyRange(range);
                    const req = idbKeyRange ? source.count(idbKeyRange) : source.count();
                    req.onsuccess = wrap(ev => resolve(ev.target.result));
                    req.onerror = eventRejectHandler(reject);
                });
            }
        };
    }
    const { schema, hasGetAll } = extractSchema(db, tmpTrans);
    const tables = schema.tables.map(tableSchema => createDbCoreTable(tableSchema));
    const tableMap = {};
    tables.forEach(table => tableMap[table.name] = table);
    return {
        stack: "dbcore",
        transaction: db.transaction.bind(db),
        table(name) {
            const result = tableMap[name];
            if (!result)
                throw new Error(`Table '${name}' not found`);
            return tableMap[name];
        },
        MIN_KEY: -Infinity,
        MAX_KEY: getMaxKey(IdbKeyRange),
        schema
    };
}

function createMiddlewareStack(stackImpl, middlewares) {
    return middlewares.reduce((down, { create }) => ({ ...down, ...create(down) }), stackImpl);
}
function createMiddlewareStacks(middlewares, idbdb, { IDBKeyRange, indexedDB }, tmpTrans) {
    const dbcore = createMiddlewareStack(createDBCore(idbdb, IDBKeyRange, tmpTrans), middlewares.dbcore);
    return {
        dbcore
    };
}
function generateMiddlewareStacks({ _novip: db }, tmpTrans) {
    const idbdb = tmpTrans.db;
    const stacks = createMiddlewareStacks(db._middlewares, idbdb, db._deps, tmpTrans);
    db.core = stacks.dbcore;
    db.tables.forEach(table => {
        const tableName = table.name;
        if (db.core.schema.tables.some(tbl => tbl.name === tableName)) {
            table.core = db.core.table(tableName);
            if (db[tableName] instanceof db.Table) {
                db[tableName].core = table.core;
            }
        }
    });
}

function setApiOnPlace({ _novip: db }, objs, tableNames, dbschema) {
    tableNames.forEach(tableName => {
        const schema = dbschema[tableName];
        objs.forEach(obj => {
            const propDesc = getPropertyDescriptor(obj, tableName);
            if (!propDesc || ("value" in propDesc && propDesc.value === undefined)) {
                if (obj === db.Transaction.prototype || obj instanceof db.Transaction) {
                    setProp(obj, tableName, {
                        get() { return this.table(tableName); },
                        set(value) {
                            defineProperty(this, tableName, { value, writable: true, configurable: true, enumerable: true });
                        }
                    });
                }
                else {
                    obj[tableName] = new db.Table(tableName, schema);
                }
            }
        });
    });
}
function removeTablesApi({ _novip: db }, objs) {
    objs.forEach(obj => {
        for (let key in obj) {
            if (obj[key] instanceof db.Table)
                delete obj[key];
        }
    });
}
function lowerVersionFirst(a, b) {
    return a._cfg.version - b._cfg.version;
}
function runUpgraders(db, oldVersion, idbUpgradeTrans, reject) {
    const globalSchema = db._dbSchema;
    const trans = db._createTransaction('readwrite', db._storeNames, globalSchema);
    trans.create(idbUpgradeTrans);
    trans._completion.catch(reject);
    const rejectTransaction = trans._reject.bind(trans);
    const transless = PSD.transless || PSD;
    newScope(() => {
        PSD.trans = trans;
        PSD.transless = transless;
        if (oldVersion === 0) {
            keys(globalSchema).forEach(tableName => {
                createTable(idbUpgradeTrans, tableName, globalSchema[tableName].primKey, globalSchema[tableName].indexes);
            });
            generateMiddlewareStacks(db, idbUpgradeTrans);
            DexiePromise.follow(() => db.on.populate.fire(trans)).catch(rejectTransaction);
        }
        else
            updateTablesAndIndexes(db, oldVersion, trans, idbUpgradeTrans).catch(rejectTransaction);
    });
}
function updateTablesAndIndexes({ _novip: db }, oldVersion, trans, idbUpgradeTrans) {
    const queue = [];
    const versions = db._versions;
    let globalSchema = db._dbSchema = buildGlobalSchema(db, db.idbdb, idbUpgradeTrans);
    let anyContentUpgraderHasRun = false;
    const versToRun = versions.filter(v => v._cfg.version >= oldVersion);
    versToRun.forEach(version => {
        queue.push(() => {
            const oldSchema = globalSchema;
            const newSchema = version._cfg.dbschema;
            adjustToExistingIndexNames(db, oldSchema, idbUpgradeTrans);
            adjustToExistingIndexNames(db, newSchema, idbUpgradeTrans);
            globalSchema = db._dbSchema = newSchema;
            const diff = getSchemaDiff(oldSchema, newSchema);
            diff.add.forEach(tuple => {
                createTable(idbUpgradeTrans, tuple[0], tuple[1].primKey, tuple[1].indexes);
            });
            diff.change.forEach(change => {
                if (change.recreate) {
                    throw new exceptions.Upgrade("Not yet support for changing primary key");
                }
                else {
                    const store = idbUpgradeTrans.objectStore(change.name);
                    change.add.forEach(idx => addIndex(store, idx));
                    change.change.forEach(idx => {
                        store.deleteIndex(idx.name);
                        addIndex(store, idx);
                    });
                    change.del.forEach(idxName => store.deleteIndex(idxName));
                }
            });
            const contentUpgrade = version._cfg.contentUpgrade;
            if (contentUpgrade && version._cfg.version > oldVersion) {
                generateMiddlewareStacks(db, idbUpgradeTrans);
                trans._memoizedTables = {};
                anyContentUpgraderHasRun = true;
                let upgradeSchema = shallowClone(newSchema);
                diff.del.forEach(table => {
                    upgradeSchema[table] = oldSchema[table];
                });
                removeTablesApi(db, [db.Transaction.prototype]);
                setApiOnPlace(db, [db.Transaction.prototype], keys(upgradeSchema), upgradeSchema);
                trans.schema = upgradeSchema;
                const contentUpgradeIsAsync = isAsyncFunction(contentUpgrade);
                if (contentUpgradeIsAsync) {
                    incrementExpectedAwaits();
                }
                let returnValue;
                const promiseFollowed = DexiePromise.follow(() => {
                    returnValue = contentUpgrade(trans);
                    if (returnValue) {
                        if (contentUpgradeIsAsync) {
                            var decrementor = decrementExpectedAwaits.bind(null, null);
                            returnValue.then(decrementor, decrementor);
                        }
                    }
                });
                return (returnValue && typeof returnValue.then === 'function' ?
                    DexiePromise.resolve(returnValue) : promiseFollowed.then(() => returnValue));
            }
        });
        queue.push(idbtrans => {
            if (!anyContentUpgraderHasRun || !hasIEDeleteObjectStoreBug) {
                const newSchema = version._cfg.dbschema;
                deleteRemovedTables(newSchema, idbtrans);
            }
            removeTablesApi(db, [db.Transaction.prototype]);
            setApiOnPlace(db, [db.Transaction.prototype], db._storeNames, db._dbSchema);
            trans.schema = db._dbSchema;
        });
    });
    function runQueue() {
        return queue.length ? DexiePromise.resolve(queue.shift()(trans.idbtrans)).then(runQueue) :
            DexiePromise.resolve();
    }
    return runQueue().then(() => {
        createMissingTables(globalSchema, idbUpgradeTrans);
    });
}
function getSchemaDiff(oldSchema, newSchema) {
    const diff = {
        del: [],
        add: [],
        change: []
    };
    let table;
    for (table in oldSchema) {
        if (!newSchema[table])
            diff.del.push(table);
    }
    for (table in newSchema) {
        const oldDef = oldSchema[table], newDef = newSchema[table];
        if (!oldDef) {
            diff.add.push([table, newDef]);
        }
        else {
            const change = {
                name: table,
                def: newDef,
                recreate: false,
                del: [],
                add: [],
                change: []
            };
            if ((
            '' + (oldDef.primKey.keyPath || '')) !== ('' + (newDef.primKey.keyPath || '')) ||
                (oldDef.primKey.auto !== newDef.primKey.auto && !isIEOrEdge))
             {
                change.recreate = true;
                diff.change.push(change);
            }
            else {
                const oldIndexes = oldDef.idxByName;
                const newIndexes = newDef.idxByName;
                let idxName;
                for (idxName in oldIndexes) {
                    if (!newIndexes[idxName])
                        change.del.push(idxName);
                }
                for (idxName in newIndexes) {
                    const oldIdx = oldIndexes[idxName], newIdx = newIndexes[idxName];
                    if (!oldIdx)
                        change.add.push(newIdx);
                    else if (oldIdx.src !== newIdx.src)
                        change.change.push(newIdx);
                }
                if (change.del.length > 0 || change.add.length > 0 || change.change.length > 0) {
                    diff.change.push(change);
                }
            }
        }
    }
    return diff;
}
function createTable(idbtrans, tableName, primKey, indexes) {
    const store = idbtrans.db.createObjectStore(tableName, primKey.keyPath ?
        { keyPath: primKey.keyPath, autoIncrement: primKey.auto } :
        { autoIncrement: primKey.auto });
    indexes.forEach(idx => addIndex(store, idx));
    return store;
}
function createMissingTables(newSchema, idbtrans) {
    keys(newSchema).forEach(tableName => {
        if (!idbtrans.db.objectStoreNames.contains(tableName)) {
            createTable(idbtrans, tableName, newSchema[tableName].primKey, newSchema[tableName].indexes);
        }
    });
}
function deleteRemovedTables(newSchema, idbtrans) {
    [].slice.call(idbtrans.db.objectStoreNames).forEach(storeName => newSchema[storeName] == null && idbtrans.db.deleteObjectStore(storeName));
}
function addIndex(store, idx) {
    store.createIndex(idx.name, idx.keyPath, { unique: idx.unique, multiEntry: idx.multi });
}
function buildGlobalSchema(db, idbdb, tmpTrans) {
    const globalSchema = {};
    const dbStoreNames = slice(idbdb.objectStoreNames, 0);
    dbStoreNames.forEach(storeName => {
        const store = tmpTrans.objectStore(storeName);
        let keyPath = store.keyPath;
        const primKey = createIndexSpec(nameFromKeyPath(keyPath), keyPath || "", false, false, !!store.autoIncrement, keyPath && typeof keyPath !== "string", true);
        const indexes = [];
        for (let j = 0; j < store.indexNames.length; ++j) {
            const idbindex = store.index(store.indexNames[j]);
            keyPath = idbindex.keyPath;
            var index = createIndexSpec(idbindex.name, keyPath, !!idbindex.unique, !!idbindex.multiEntry, false, keyPath && typeof keyPath !== "string", false);
            indexes.push(index);
        }
        globalSchema[storeName] = createTableSchema(storeName, primKey, indexes);
    });
    return globalSchema;
}
function readGlobalSchema({ _novip: db }, idbdb, tmpTrans) {
    db.verno = idbdb.version / 10;
    const globalSchema = db._dbSchema = buildGlobalSchema(db, idbdb, tmpTrans);
    db._storeNames = slice(idbdb.objectStoreNames, 0);
    setApiOnPlace(db, [db._allTables], keys(globalSchema), globalSchema);
}
function verifyInstalledSchema(db, tmpTrans) {
    const installedSchema = buildGlobalSchema(db, db.idbdb, tmpTrans);
    const diff = getSchemaDiff(installedSchema, db._dbSchema);
    return !(diff.add.length || diff.change.some(ch => ch.add.length || ch.change.length));
}
function adjustToExistingIndexNames({ _novip: db }, schema, idbtrans) {
    const storeNames = idbtrans.db.objectStoreNames;
    for (let i = 0; i < storeNames.length; ++i) {
        const storeName = storeNames[i];
        const store = idbtrans.objectStore(storeName);
        db._hasGetAll = 'getAll' in store;
        for (let j = 0; j < store.indexNames.length; ++j) {
            const indexName = store.indexNames[j];
            const keyPath = store.index(indexName).keyPath;
            const dexieName = typeof keyPath === 'string' ? keyPath : "[" + slice(keyPath).join('+') + "]";
            if (schema[storeName]) {
                const indexSpec = schema[storeName].idxByName[dexieName];
                if (indexSpec) {
                    indexSpec.name = indexName;
                    delete schema[storeName].idxByName[dexieName];
                    schema[storeName].idxByName[indexName] = indexSpec;
                }
            }
        }
    }
    if (typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) &&
        !/(Chrome\/|Edge\/)/.test(navigator.userAgent) &&
        _global.WorkerGlobalScope && _global instanceof _global.WorkerGlobalScope &&
        [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604) {
        db._hasGetAll = false;
    }
}
function parseIndexSyntax(primKeyAndIndexes) {
    return primKeyAndIndexes.split(',').map((index, indexNum) => {
        index = index.trim();
        const name = index.replace(/([&*]|\+\+)/g, "");
        const keyPath = /^\[/.test(name) ? name.match(/^\[(.*)\]$/)[1].split('+') : name;
        return createIndexSpec(name, keyPath || null, /\&/.test(index), /\*/.test(index), /\+\+/.test(index), isArray(keyPath), indexNum === 0);
    });
}

class Version {
    _parseStoresSpec(stores, outSchema) {
        keys(stores).forEach(tableName => {
            if (stores[tableName] !== null) {
                var indexes = parseIndexSyntax(stores[tableName]);
                var primKey = indexes.shift();
                if (primKey.multi)
                    throw new exceptions.Schema("Primary key cannot be multi-valued");
                indexes.forEach(idx => {
                    if (idx.auto)
                        throw new exceptions.Schema("Only primary key can be marked as autoIncrement (++)");
                    if (!idx.keyPath)
                        throw new exceptions.Schema("Index must have a name and cannot be an empty string");
                });
                outSchema[tableName] = createTableSchema(tableName, primKey, indexes);
            }
        });
    }
    stores(stores) {
        const db = this.db;
        this._cfg.storesSource = this._cfg.storesSource ?
            extend(this._cfg.storesSource, stores) :
            stores;
        const versions = db._versions;
        const storesSpec = {};
        let dbschema = {};
        versions.forEach(version => {
            extend(storesSpec, version._cfg.storesSource);
            dbschema = (version._cfg.dbschema = {});
            version._parseStoresSpec(storesSpec, dbschema);
        });
        db._dbSchema = dbschema;
        removeTablesApi(db, [db._allTables, db, db.Transaction.prototype]);
        setApiOnPlace(db, [db._allTables, db, db.Transaction.prototype, this._cfg.tables], keys(dbschema), dbschema);
        db._storeNames = keys(dbschema);
        return this;
    }
    upgrade(upgradeFunction) {
        this._cfg.contentUpgrade = promisableChain(this._cfg.contentUpgrade || nop, upgradeFunction);
        return this;
    }
}

function createVersionConstructor(db) {
    return makeClassConstructor(Version.prototype, function Version(versionNumber) {
        this.db = db;
        this._cfg = {
            version: versionNumber,
            storesSource: null,
            dbschema: {},
            tables: {},
            contentUpgrade: null
        };
    });
}

function Events(ctx) {
    var evs = {};
    var rv = function (eventName, ...args) {
        if (args[0]) {
            evs[eventName].subscribe.apply(null, args);
            return ctx;
        }
        else if (typeof (eventName) === 'string') {
            return evs[eventName];
        }
    };
    rv.addEventType = add;
    for (var i = 1, l = arguments.length; i < l; ++i) {
        add(arguments[i]);
    }
    return rv;
    function add(eventName, chainFunction, defaultFunction) {
        if (typeof eventName === 'object')
            return addConfiguredEvents(eventName);
        if (!chainFunction)
            chainFunction = reverseStoppableEventChain;
        if (!defaultFunction)
            defaultFunction = nop;
        var context = {
            subscribers: [],
            fire: defaultFunction,
            subscribe: function (cb) {
                if (!context.subscribers.includes(cb)) {
                    context.subscribers.push(cb);
                    context.fire = chainFunction(context.fire, cb);
                }
            },
            unsubscribe: function (cb) {
                context.subscribers = context.subscribers.filter(function (fn) { return fn !== cb; });
                context.fire = context.subscribers.reduce(chainFunction, defaultFunction);
            }
        };
        evs[eventName] = rv[eventName] = context;
        return context;
    }
    function addConfiguredEvents(cfg) {
        keys(cfg).forEach(function (eventName) {
            var args = cfg[eventName];
            if (isArray(args)) {
                add(eventName, cfg[eventName][0], cfg[eventName][1]);
            }
            else if (args === 'asap') {
                const context = add(eventName, mirror, (...args) => {
                    const fire = (fn) => asap$1(() => fn(...args));
                    for (let i = 0; i < context.subscribers.length; i++) {
                        fire(context.subscribers[i]);
                    }
                });
            }
            else
                throw new exceptions.InvalidArgument("Invalid event config");
        });
    }
}

function vip(fn) {
    return newScope(function () {
        PSD.letThrough = true;
        return fn();
    });
}

function dexieOpen(db) {
    const state = db._state;
    const { indexedDB } = db._deps;
    if (state.isBeingOpened || db.idbdb)
        return state.dbReadyPromise.then(() => state.dbOpenError ?
            rejection(state.dbOpenError) :
            db);
    debug && (state.openCanceller._stackHolder = getErrorWithStack());
    state.isBeingOpened = true;
    state.dbOpenError = null;
    state.openComplete = false;
    const openCanceller = state.openCanceller;
    function throwIfCancelled() {
        if (state.openCanceller !== openCanceller)
            throw new exceptions.DatabaseClosed('db.open() was cancelled');
    }
    let resolveDbReady = state.dbReadyResolve,
    upgradeTransaction = null, wasCreated = false;
    return DexiePromise.race([openCanceller, safari14Workaround(indexedDB).then(() => new DexiePromise((resolve, reject) => {
            throwIfCancelled();
            if (!indexedDB)
                throw new exceptions.MissingAPI();
            const dbName = db.name;
            const req = state.autoSchema ?
                indexedDB.open(dbName) :
                indexedDB.open(dbName, Math.round(db.verno * 10));
            if (!req)
                throw new exceptions.MissingAPI();
            req.onerror = eventRejectHandler(reject);
            req.onblocked = wrap(db._fireOnBlocked);
            req.onupgradeneeded = wrap(e => {
                upgradeTransaction = req.transaction;
                if (state.autoSchema && !db._options.allowEmptyDB) {
                    req.onerror = preventDefault;
                    upgradeTransaction.abort();
                    req.result.close();
                    const delreq = indexedDB.deleteDatabase(dbName);
                    delreq.onsuccess = delreq.onerror = wrap(() => {
                        reject(new exceptions.NoSuchDatabase(`Database ${dbName} doesnt exist`));
                    });
                }
                else {
                    upgradeTransaction.onerror = eventRejectHandler(reject);
                    var oldVer = e.oldVersion > Math.pow(2, 62) ? 0 : e.oldVersion;
                    wasCreated = oldVer < 1;
                    db._novip.idbdb = req.result;
                    runUpgraders(db, oldVer / 10, upgradeTransaction, reject);
                }
            }, reject);
            req.onsuccess = wrap(() => {
                upgradeTransaction = null;
                const idbdb = db._novip.idbdb = req.result;
                const objectStoreNames = slice(idbdb.objectStoreNames);
                if (objectStoreNames.length > 0)
                    try {
                        const tmpTrans = idbdb.transaction(safariMultiStoreFix(objectStoreNames), 'readonly');
                        if (state.autoSchema)
                            readGlobalSchema(db, idbdb, tmpTrans);
                        else {
                            adjustToExistingIndexNames(db, db._dbSchema, tmpTrans);
                            if (!verifyInstalledSchema(db, tmpTrans)) {
                                console.warn(`Dexie SchemaDiff: Schema was extended without increasing the number passed to db.version(). Some queries may fail.`);
                            }
                        }
                        generateMiddlewareStacks(db, tmpTrans);
                    }
                    catch (e) {
                    }
                connections.push(db);
                idbdb.onversionchange = wrap(ev => {
                    state.vcFired = true;
                    db.on("versionchange").fire(ev);
                });
                idbdb.onclose = wrap(ev => {
                    db.on("close").fire(ev);
                });
                if (wasCreated)
                    _onDatabaseCreated(db._deps, dbName);
                resolve();
            }, reject);
        }))]).then(() => {
        throwIfCancelled();
        state.onReadyBeingFired = [];
        return DexiePromise.resolve(vip(() => db.on.ready.fire(db.vip))).then(function fireRemainders() {
            if (state.onReadyBeingFired.length > 0) {
                let remainders = state.onReadyBeingFired.reduce(promisableChain, nop);
                state.onReadyBeingFired = [];
                return DexiePromise.resolve(vip(() => remainders(db.vip))).then(fireRemainders);
            }
        });
    }).finally(() => {
        state.onReadyBeingFired = null;
        state.isBeingOpened = false;
    }).then(() => {
        return db;
    }).catch(err => {
        state.dbOpenError = err;
        try {
            upgradeTransaction && upgradeTransaction.abort();
        }
        catch (_a) { }
        if (openCanceller === state.openCanceller) {
            db._close();
        }
        return rejection(err);
    }).finally(() => {
        state.openComplete = true;
        resolveDbReady();
    });
}

function awaitIterator(iterator) {
    var callNext = result => iterator.next(result), doThrow = error => iterator.throw(error), onSuccess = step(callNext), onError = step(doThrow);
    function step(getNext) {
        return (val) => {
            var next = getNext(val), value = next.value;
            return next.done ? value :
                (!value || typeof value.then !== 'function' ?
                    isArray(value) ? Promise.all(value).then(onSuccess, onError) : onSuccess(value) :
                    value.then(onSuccess, onError));
        };
    }
    return step(callNext)();
}

function enterTransactionScope(db, mode, storeNames, parentTransaction, scopeFunc) {
    return DexiePromise.resolve().then(() => {
        const transless = PSD.transless || PSD;
        const trans = db._createTransaction(mode, storeNames, db._dbSchema, parentTransaction);
        const zoneProps = {
            trans: trans,
            transless: transless
        };
        if (parentTransaction) {
            trans.idbtrans = parentTransaction.idbtrans;
        }
        else {
            try {
                trans.create();
                db._state.PR1398_maxLoop = 3;
            }
            catch (ex) {
                if (ex.name === errnames.InvalidState && db.isOpen() && --db._state.PR1398_maxLoop > 0) {
                    console.warn(`Dexie: Need to reopen db, '${db.name}'`);
                    db._close();
                    return db.open().then(() => enterTransactionScope(db, mode, storeNames, null, scopeFunc));
                }
                return rejection(ex);
            }
        }
        const scopeFuncIsAsync = isAsyncFunction(scopeFunc);
        if (scopeFuncIsAsync) {
            incrementExpectedAwaits();
        }
        let returnValue;
        const promiseFollowed = DexiePromise.follow(() => {
            returnValue = scopeFunc.call(trans, trans);
            if (returnValue) {
                if (scopeFuncIsAsync) {
                    var decrementor = decrementExpectedAwaits.bind(null, null);
                    returnValue.then(decrementor, decrementor);
                }
                else if (typeof returnValue.next === 'function' && typeof returnValue.throw === 'function') {
                    returnValue = awaitIterator(returnValue);
                }
            }
        }, zoneProps);
        return (returnValue && typeof returnValue.then === 'function' ?
            DexiePromise.resolve(returnValue).then(x => trans.active ?
                x
                : rejection(new exceptions.PrematureCommit("Transaction committed too early. See http://bit.ly/2kdckMn")))
            : promiseFollowed.then(() => returnValue)).then(x => {
            if (parentTransaction)
                trans._resolve();
            return trans._completion.then(() => x);
        }).catch(e => {
            trans._reject(e);
            return rejection(e);
        });
    });
}

function pad(a, value, count) {
    const result = isArray(a) ? a.slice() : [a];
    for (let i = 0; i < count; ++i)
        result.push(value);
    return result;
}
function createVirtualIndexMiddleware(down) {
    return {
        ...down,
        table(tableName) {
            const table = down.table(tableName);
            const { schema } = table;
            const indexLookup = {};
            const allVirtualIndexes = [];
            function addVirtualIndexes(keyPath, keyTail, lowLevelIndex) {
                const keyPathAlias = getKeyPathAlias(keyPath);
                const indexList = (indexLookup[keyPathAlias] = indexLookup[keyPathAlias] || []);
                const keyLength = keyPath == null ? 0 : typeof keyPath === 'string' ? 1 : keyPath.length;
                const isVirtual = keyTail > 0;
                const virtualIndex = {
                    ...lowLevelIndex,
                    isVirtual,
                    keyTail,
                    keyLength,
                    extractKey: getKeyExtractor(keyPath),
                    unique: !isVirtual && lowLevelIndex.unique
                };
                indexList.push(virtualIndex);
                if (!virtualIndex.isPrimaryKey) {
                    allVirtualIndexes.push(virtualIndex);
                }
                if (keyLength > 1) {
                    const virtualKeyPath = keyLength === 2 ?
                        keyPath[0] :
                        keyPath.slice(0, keyLength - 1);
                    addVirtualIndexes(virtualKeyPath, keyTail + 1, lowLevelIndex);
                }
                indexList.sort((a, b) => a.keyTail - b.keyTail);
                return virtualIndex;
            }
            const primaryKey = addVirtualIndexes(schema.primaryKey.keyPath, 0, schema.primaryKey);
            indexLookup[":id"] = [primaryKey];
            for (const index of schema.indexes) {
                addVirtualIndexes(index.keyPath, 0, index);
            }
            function findBestIndex(keyPath) {
                const result = indexLookup[getKeyPathAlias(keyPath)];
                return result && result[0];
            }
            function translateRange(range, keyTail) {
                return {
                    type: range.type === 1  ?
                        2  :
                        range.type,
                    lower: pad(range.lower, range.lowerOpen ? down.MAX_KEY : down.MIN_KEY, keyTail),
                    lowerOpen: true,
                    upper: pad(range.upper, range.upperOpen ? down.MIN_KEY : down.MAX_KEY, keyTail),
                    upperOpen: true
                };
            }
            function translateRequest(req) {
                const index = req.query.index;
                return index.isVirtual ? {
                    ...req,
                    query: {
                        index,
                        range: translateRange(req.query.range, index.keyTail)
                    }
                } : req;
            }
            const result = {
                ...table,
                schema: {
                    ...schema,
                    primaryKey,
                    indexes: allVirtualIndexes,
                    getIndexByKeyPath: findBestIndex
                },
                count(req) {
                    return table.count(translateRequest(req));
                },
                query(req) {
                    return table.query(translateRequest(req));
                },
                openCursor(req) {
                    const { keyTail, isVirtual, keyLength } = req.query.index;
                    if (!isVirtual)
                        return table.openCursor(req);
                    function createVirtualCursor(cursor) {
                        function _continue(key) {
                            key != null ?
                                cursor.continue(pad(key, req.reverse ? down.MAX_KEY : down.MIN_KEY, keyTail)) :
                                req.unique ?
                                    cursor.continue(cursor.key.slice(0, keyLength)
                                        .concat(req.reverse
                                        ? down.MIN_KEY
                                        : down.MAX_KEY, keyTail)) :
                                    cursor.continue();
                        }
                        const virtualCursor = Object.create(cursor, {
                            continue: { value: _continue },
                            continuePrimaryKey: {
                                value(key, primaryKey) {
                                    cursor.continuePrimaryKey(pad(key, down.MAX_KEY, keyTail), primaryKey);
                                }
                            },
                            primaryKey: {
                                get() {
                                    return cursor.primaryKey;
                                }
                            },
                            key: {
                                get() {
                                    const key = cursor.key;
                                    return keyLength === 1 ?
                                        key[0] :
                                        key.slice(0, keyLength);
                                }
                            },
                            value: {
                                get() {
                                    return cursor.value;
                                }
                            }
                        });
                        return virtualCursor;
                    }
                    return table.openCursor(translateRequest(req))
                        .then(cursor => cursor && createVirtualCursor(cursor));
                }
            };
            return result;
        }
    };
}
const virtualIndexMiddleware = {
    stack: "dbcore",
    name: "VirtualIndexMiddleware",
    level: 1,
    create: createVirtualIndexMiddleware
};

let Dexie$1 = class Dexie {
    constructor(name, options) {
        this._middlewares = {};
        this.verno = 0;
        const deps = Dexie.dependencies;
        this._options = options = {
            addons: Dexie.addons,
            autoOpen: true,
            indexedDB: deps.indexedDB,
            IDBKeyRange: deps.IDBKeyRange,
            ...options
        };
        this._deps = {
            indexedDB: options.indexedDB,
            IDBKeyRange: options.IDBKeyRange
        };
        const { addons, } = options;
        this._dbSchema = {};
        this._versions = [];
        this._storeNames = [];
        this._allTables = {};
        this.idbdb = null;
        this._novip = this;
        const state = {
            dbOpenError: null,
            isBeingOpened: false,
            onReadyBeingFired: null,
            openComplete: false,
            dbReadyResolve: nop,
            dbReadyPromise: null,
            cancelOpen: nop,
            openCanceller: null,
            autoSchema: true,
            PR1398_maxLoop: 3
        };
        state.dbReadyPromise = new DexiePromise(resolve => {
            state.dbReadyResolve = resolve;
        });
        state.openCanceller = new DexiePromise((_, reject) => {
            state.cancelOpen = reject;
        });
        this._state = state;
        this.name = name;
        this.on = Events(this, "populate", "blocked", "versionchange", "close", { ready: [promisableChain, nop] });
        this.on.ready.subscribe = override(this.on.ready.subscribe, subscribe => {
            return (subscriber, bSticky) => {
                Dexie.vip(() => {
                    const state = this._state;
                    if (state.openComplete) {
                        if (!state.dbOpenError)
                            DexiePromise.resolve().then(subscriber);
                        if (bSticky)
                            subscribe(subscriber);
                    }
                    else if (state.onReadyBeingFired) {
                        state.onReadyBeingFired.push(subscriber);
                        if (bSticky)
                            subscribe(subscriber);
                    }
                    else {
                        subscribe(subscriber);
                        const db = this;
                        if (!bSticky)
                            subscribe(function unsubscribe() {
                                db.on.ready.unsubscribe(subscriber);
                                db.on.ready.unsubscribe(unsubscribe);
                            });
                    }
                });
            };
        });
        this.Collection = createCollectionConstructor(this);
        this.Table = createTableConstructor(this);
        this.Transaction = createTransactionConstructor(this);
        this.Version = createVersionConstructor(this);
        this.WhereClause = createWhereClauseConstructor(this);
        this.on("versionchange", ev => {
            if (ev.newVersion > 0)
                console.warn(`Another connection wants to upgrade database '${this.name}'. Closing db now to resume the upgrade.`);
            else
                console.warn(`Another connection wants to delete database '${this.name}'. Closing db now to resume the delete request.`);
            this.close();
        });
        this.on("blocked", ev => {
            if (!ev.newVersion || ev.newVersion < ev.oldVersion)
                console.warn(`Dexie.delete('${this.name}') was blocked`);
            else
                console.warn(`Upgrade '${this.name}' blocked by other connection holding version ${ev.oldVersion / 10}`);
        });
        this._maxKey = getMaxKey(options.IDBKeyRange);
        this._createTransaction = (mode, storeNames, dbschema, parentTransaction) => new this.Transaction(mode, storeNames, dbschema, this._options.chromeTransactionDurability, parentTransaction);
        this._fireOnBlocked = ev => {
            this.on("blocked").fire(ev);
            connections
                .filter(c => c.name === this.name && c !== this && !c._state.vcFired)
                .map(c => c.on("versionchange").fire(ev));
        };
        this.use(virtualIndexMiddleware);
        this.vip = Object.create(this, { _vip: { value: true } });
        addons.forEach(addon => addon(this));
    }
    version(versionNumber) {
        if (isNaN(versionNumber) || versionNumber < 0.1)
            throw new exceptions.Type(`Given version is not a positive number`);
        versionNumber = Math.round(versionNumber * 10) / 10;
        if (this.idbdb || this._state.isBeingOpened)
            throw new exceptions.Schema("Cannot add version when database is open");
        this.verno = Math.max(this.verno, versionNumber);
        const versions = this._versions;
        var versionInstance = versions.filter(v => v._cfg.version === versionNumber)[0];
        if (versionInstance)
            return versionInstance;
        versionInstance = new this.Version(versionNumber);
        versions.push(versionInstance);
        versions.sort(lowerVersionFirst);
        versionInstance.stores({});
        this._state.autoSchema = false;
        return versionInstance;
    }
    _whenReady(fn) {
        return (this.idbdb && (this._state.openComplete || PSD.letThrough || this._vip)) ? fn() : new DexiePromise((resolve, reject) => {
            if (this._state.openComplete) {
                return reject(new exceptions.DatabaseClosed(this._state.dbOpenError));
            }
            if (!this._state.isBeingOpened) {
                if (!this._options.autoOpen) {
                    reject(new exceptions.DatabaseClosed());
                    return;
                }
                this.open().catch(nop);
            }
            this._state.dbReadyPromise.then(resolve, reject);
        }).then(fn);
    }
    use({ stack, create, level, name }) {
        if (name)
            this.unuse({ stack, name });
        const middlewares = this._middlewares[stack] || (this._middlewares[stack] = []);
        middlewares.push({ stack, create, level: level == null ? 10 : level, name });
        middlewares.sort((a, b) => a.level - b.level);
        return this;
    }
    unuse({ stack, name, create }) {
        if (stack && this._middlewares[stack]) {
            this._middlewares[stack] = this._middlewares[stack].filter(mw => create ? mw.create !== create :
                name ? mw.name !== name :
                    false);
        }
        return this;
    }
    open() {
        return dexieOpen(this);
    }
    _close() {
        const state = this._state;
        const idx = connections.indexOf(this);
        if (idx >= 0)
            connections.splice(idx, 1);
        if (this.idbdb) {
            try {
                this.idbdb.close();
            }
            catch (e) { }
            this._novip.idbdb = null;
        }
        state.dbReadyPromise = new DexiePromise(resolve => {
            state.dbReadyResolve = resolve;
        });
        state.openCanceller = new DexiePromise((_, reject) => {
            state.cancelOpen = reject;
        });
    }
    close() {
        this._close();
        const state = this._state;
        this._options.autoOpen = false;
        state.dbOpenError = new exceptions.DatabaseClosed();
        if (state.isBeingOpened)
            state.cancelOpen(state.dbOpenError);
    }
    delete() {
        const hasArguments = arguments.length > 0;
        const state = this._state;
        return new DexiePromise((resolve, reject) => {
            const doDelete = () => {
                this.close();
                var req = this._deps.indexedDB.deleteDatabase(this.name);
                req.onsuccess = wrap(() => {
                    _onDatabaseDeleted(this._deps, this.name);
                    resolve();
                });
                req.onerror = eventRejectHandler(reject);
                req.onblocked = this._fireOnBlocked;
            };
            if (hasArguments)
                throw new exceptions.InvalidArgument("Arguments not allowed in db.delete()");
            if (state.isBeingOpened) {
                state.dbReadyPromise.then(doDelete);
            }
            else {
                doDelete();
            }
        });
    }
    backendDB() {
        return this.idbdb;
    }
    isOpen() {
        return this.idbdb !== null;
    }
    hasBeenClosed() {
        const dbOpenError = this._state.dbOpenError;
        return dbOpenError && (dbOpenError.name === 'DatabaseClosed');
    }
    hasFailed() {
        return this._state.dbOpenError !== null;
    }
    dynamicallyOpened() {
        return this._state.autoSchema;
    }
    get tables() {
        return keys(this._allTables).map(name => this._allTables[name]);
    }
    transaction(mode, ...args) {
        const scopeFunc = args.pop();
        const tables = args.flat();
        let parentTransaction = PSD.trans;
        if (!parentTransaction || parentTransaction.db !== this || mode.includes('!'))
            parentTransaction = null;
        const onlyIfCompatible = mode.includes('?');
        mode = mode.replace('!', '').replace('?', '');
        let idbMode, storeNames;
        try {
            storeNames = tables.map(table => {
                var storeName = table instanceof this.Table ? table.name : table;
                if (typeof storeName !== 'string')
                    throw new TypeError("Invalid table argument to Dexie.transaction(). Only Table or String are allowed");
                return storeName;
            });
            if (mode == "r" || mode === READONLY)
                idbMode = READONLY;
            else if (mode == "rw" || mode == READWRITE)
                idbMode = READWRITE;
            else
                throw new exceptions.InvalidArgument("Invalid transaction mode: " + mode);
            if (parentTransaction) {
                if (parentTransaction.mode === READONLY && idbMode === READWRITE) {
                    if (onlyIfCompatible) {
                        parentTransaction = null;
                    }
                    else
                        throw new exceptions.SubTransaction("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");
                }
                if (parentTransaction) {
                    storeNames.forEach(storeName => {
                        if (parentTransaction && parentTransaction.storeNames.indexOf(storeName) === -1) {
                            if (onlyIfCompatible) {
                                parentTransaction = null;
                            }
                            else
                                throw new exceptions.SubTransaction("Table " + storeName +
                                    " not included in parent transaction.");
                        }
                    });
                }
                if (onlyIfCompatible && parentTransaction && !parentTransaction.active) {
                    parentTransaction = null;
                }
            }
        }
        catch (e) {
            return parentTransaction ?
                parentTransaction._promise(null, (_, reject) => { reject(e); }) :
                rejection(e);
        }
        const enterTransaction = enterTransactionScope.bind(null, this, idbMode, storeNames, parentTransaction, scopeFunc);
        return (parentTransaction ?
            parentTransaction._promise(idbMode, enterTransaction, "lock") :
            PSD.trans ?
                usePSD(PSD.transless, () => this._whenReady(enterTransaction)) :
                this._whenReady(enterTransaction));
    }
    table(tableName) {
        if (!hasOwn(this._allTables, tableName)) {
            throw new exceptions.InvalidTable(`Table ${tableName} does not exist`);
        }
        return this._allTables[tableName];
    }
};

function getObjectDiff(a, b, rv, prfx) {
    rv = rv || {};
    prfx = prfx || '';
    for (const prop in a) {
        if (!hasOwn(b, prop)) {
            rv[prfx + prop] = undefined;
        }
        else {
            const ap = a[prop], bp = b[prop];
            if (typeof ap === 'object' && typeof bp === 'object' && ap && bp) {
                const apTypeName = toStringTag(ap);
                const bpTypeName = toStringTag(bp);
                if (apTypeName !== bpTypeName) {
                    rv[prfx + prop] = b[prop];
                }
                else if (apTypeName === 'Object') {
                    getObjectDiff(ap, bp, rv, prfx + prop + '.');
                }
                else if (ap !== bp) {
                    rv[prfx + prop] = b[prop];
                }
            }
            else if (ap !== bp)
                rv[prfx + prop] = b[prop];
        }
    }
    for (const prop in b) {
        if (!hasOwn(a, prop)) {
            rv[prfx + prop] = b[prop];
        }
    }
    return rv;
}

let domDeps;
try {
    domDeps = {
        indexedDB: _global.indexedDB || _global.mozIndexedDB || _global.webkitIndexedDB || _global.msIndexedDB,
        IDBKeyRange: _global.IDBKeyRange || _global.webkitIDBKeyRange
    };
}
catch (e) {
    domDeps = { indexedDB: null, IDBKeyRange: null };
}

const Dexie = Dexie$1;
props(Dexie, {
    ...fullNameExceptions,
    delete(databaseName) {
        const db = new Dexie(databaseName, { addons: [] });
        return db.delete();
    },
    exists(name) {
        return new Dexie(name, { addons: [] }).open().then(db => {
            db.close();
            return true;
        }).catch('NoSuchDatabaseError', () => false);
    },
    getDatabaseNames() {
        try {
            return getDatabaseNames(Dexie.dependencies);
        }
        catch (_a) {
            return rejection(new exceptions.MissingAPI());
        }
    },
    defineClass() {
        function Class(content) {
            extend(this, content);
        }
        return Class;
    },
    ignoreTransaction(scopeFunc) {
        return PSD.trans ?
            usePSD(PSD.transless, scopeFunc) :
            scopeFunc();
    },
    vip,
    async: function (generatorFn) {
        return function () {
            try {
                var rv = awaitIterator(generatorFn.apply(this, arguments));
                if (!rv || typeof rv.then !== 'function')
                    return DexiePromise.resolve(rv);
                return rv;
            }
            catch (e) {
                return rejection(e);
            }
        };
    },
    spawn: function (generatorFn, args, thiz) {
        try {
            var rv = awaitIterator(generatorFn.apply(thiz, args || []));
            if (!rv || typeof rv.then !== 'function')
                return DexiePromise.resolve(rv);
            return rv;
        }
        catch (e) {
            return rejection(e);
        }
    },
    currentTransaction: {
        get: () => PSD.trans || null
    },
    waitFor: function (promiseOrFunction, optionalTimeout) {
        const promise = DexiePromise.resolve(typeof promiseOrFunction === 'function' ?
            Dexie.ignoreTransaction(promiseOrFunction) :
            promiseOrFunction)
            .timeout(optionalTimeout || 60000);
        return PSD.trans ?
            PSD.trans.waitFor(promise) :
            promise;
    },
    Promise: DexiePromise,
    debug: {
        get: () => debug,
        set: value => {
            setDebug(value, value === 'dexie' ? () => true : dexieStackFrameFilter);
        }
    },
    derive: derive,
    extend: extend,
    props: props,
    override: override,
    Events: Events,
    getByKeyPath: getByKeyPath,
    setByKeyPath: setByKeyPath,
    delByKeyPath: delByKeyPath,
    shallowClone: shallowClone,
    deepClone: deepClone,
    getObjectDiff: getObjectDiff,
    cmp,
    asap: asap$1,
    minKey: minKey,
    addons: [],
    connections: connections,
    errnames: errnames,
    dependencies: domDeps,
    semVer: DEXIE_VERSION,
    version: DEXIE_VERSION.split('.')
        .map(n => parseInt(n) | 0)
        .reduce((p, c, i) => p + (c / Math.pow(10, i * 2))),
});
Dexie.maxKey = getMaxKey(Dexie.dependencies.IDBKeyRange);

DexiePromise.rejectionMapper = mapError;
setDebug(debug, dexieStackFrameFilter);

var namedExports = /*#__PURE__*/Object.freeze({
__proto__: null,
Dexie: Dexie$1,
Entity: Entity,
cmp: cmp,
default: Dexie$1
});

Object.assign(Dexie$1, namedExports, { default: Dexie$1 });

return Dexie$1;

}));

/* jshint -W098 */
makeEnum(['MDBOPEN', 'EXECSC', 'LOADINGCLOUD'], 'MEGAFLAG_', window);

// navigate to links internally, not by the browser.
function clickURLs() {
    'use strict';
    var nodeList = document.querySelectorAll('a.clickurl');

    if (nodeList.length) {
        $(nodeList).rebind('click', function() {
            var $this = $(this);
            var url = $this.attr('href') || $this.data('fxhref');
            let eventid = $this.attr('data-eventid') || false;
            const redirect = $this.attr('redirect');
            if (eventid) {
                eventid = parseInt(eventid);
                if (!isNaN(eventid)) {
                    delay(`clickurlevlog${eventid}`, () => eventlog(eventid));
                }
            }

            if (url) {
                var target = $this.attr('target');

                if (target === '_blank') {
                    open(/^(https?:\/\/)/i.test(url) ? url : getBaseUrl() + url, '_blank', 'noopener,noreferrer');
                    return false;
                }

                if (window.loadingDialog && $this.hasClass('pages-nav')) {
                    loadingDialog.quiet = true;
                    onIdle(function() {
                        loadingDialog.quiet = false;
                    });
                }

                if (redirect) {
                    const redirectPage = redirect;
                    login_next = redirectPage === "1" ? `/${page}` : `/${redirectPage}`;
                }

                loadSubPage(url.substr(1));
                return false;
            }
        });
        if (is_extension) {
            $(nodeList).rebind('auxclick', function(e) {

                // if this is middle click on mouse to open it on new tab and this is extension
                if (e.which === 2) {

                    var $this = $(this);
                    var url = $this.attr('href') || $this.data('fxhref');

                    open(getBaseUrl() + url);

                    return false;
                }
            });
        }
    }
    nodeList = undefined;
}

// Handler that deals with scroll to element links.
function scrollToURLs() {
    'use strict';
    var nodeList = document.querySelectorAll('a.scroll_to');

    if (nodeList) {
        $(nodeList).rebind("click", function() {
            var $scrollTo = $($(this).data("scrollto"));

            if ($scrollTo.length) {
                var $toScroll;
                var newOffset = $scrollTo[0].offsetTop;

                if (is_mobile) {
                    var mobileClass = 'body.mobile .fmholder';
                    if (page === "privacy" || page === "terms") {
                        $toScroll = $(mobileClass);
                    }
                }
                else  if ($scrollTo.closest('.ps').length) {
                    $toScroll = $scrollTo.closest('.ps');
                }
                else {
                    $toScroll = $('.fmholder');
                }

                if ($toScroll) {
                    $toScroll.animate({scrollTop: newOffset - 40}, 400);
                }

            }
        });
    }
    nodeList = undefined;
}

/**
 * excludeIntersected
 *
 * Loop through arrays excluding intersected items form array2
 * and prepare result format for tokenInput plugin item format.
 *
 * @param {Array} array1, emails used in share
 * @param {Array} array2, list of all available emails
 *
 * @returns {Array} item An array of JSON objects e.g. { id, name }.
 */
function excludeIntersected(array1, array2) {

    var result = [],
        tmpObj2 = array2;

    if (!array1) {
        return array2;
    }
    else if (!array2) {
        return array1;
    }

    // Loop through emails used in share
    for (var i in array1) {
        if (array1.hasOwnProperty(i)) {

            // Loop through list of all emails
            for (var k in array2) {
                if (array2.hasOwnProperty(k)) {

                    // Remove matched email from result
                    if (array1[i] === array2[k]) {
                        tmpObj2.splice(k, 1);
                        break;
                    }
                }
            }
        }
    }

    // Prepare for token.input plugin item format
    for (var n in tmpObj2) {
        if (tmpObj2.hasOwnProperty(n)) {
            result.push({ id: tmpObj2[n], name: tmpObj2[n] });
        }
    }

    return result;
}

function asciionly(text) {
    var rforeign = /[^\u0000-\u007f]/;
    if (rforeign.test(text)) {
        return false;
    }
    else {
        return true;
    }
}

var isNativeObject = function(obj) {
    var objConstructorText = obj.constructor.toString();
    return objConstructorText.indexOf("[native code]") !== -1 && objConstructorText.indexOf("Object()") === -1;
};

function clone(obj) {

    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
        var arr = new Array(obj.length);
        for (var i = obj.length; i--; ) {
            arr[i] = clone(obj[i]);
        }
        return arr;
    }
    if (obj instanceof Object) {
        var copy = {};
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) {
                if (!(obj[attr] instanceof Object)) {
                    copy[attr] = obj[attr];
                }
                else if (Array.isArray(obj[attr])) {
                    copy[attr] = clone(obj[attr]);
                }
                else if (!isNativeObject(obj[attr])) {
                    copy[attr] = clone(obj[attr]);
                }
                else if ($.isFunction(obj[attr])) {
                    copy[attr] = obj[attr];
                }
                else {
                    copy[attr] = {};
                }
            }
        }

        return copy;
    }
    else {
        var copy = Object.create(null);

        for (var k in obj) {
            copy[k] = clone(obj[k]);
        }

        return copy;
    }
}

/**
 * Check if something (val) is a string.
 *
 * @param val
 * @returns {boolean}
 */
function isString(val) {
    return (typeof val === 'string' || val instanceof String);
};

function easeOutCubic(t, b, c, d) {
    return c * ((t = t / d - 1) * t * t + 1) + b;
}

function ellipsis(text, location, maxCharacters) {
    "use strict";
    if (!text) {
        return "";
    }

    if (text.length > 0 && text.length > maxCharacters) {
        if (typeof location === 'undefined') {
            location = 'end';
        }
        switch (location) {
            case 'center':
                var center = (maxCharacters / 2);
                text = text.slice(0, center) + '...' + text.slice(-center);
                break;
            case 'end':
                text = text.slice(0, maxCharacters - 3) + '...';
                break;
        }
    }
    return text;
}

function megatitle(nperc) {
    'use strict';

    if (!nperc) {
        nperc = '';
    }

    let a = document.querySelector('.js-notification-num');
    a = (a = a && parseInt(a.textContent)) > 0 ? `(${a}) ` : '';

    document.title = a + mega_title + nperc;
}

function countrydetails(isocode) {
    var cdetails = {
        name: M.getCountryName(isocode),
        icon: isocode.toLowerCase() + '.png'
    };
    return cdetails;
}

/**
 * Convert bytes sizes into a human-friendly format (KB, MB, GB), pretty
 * similar to `bytesToSize` but this function returns an object
 * (`{ size: "23,33", unit: 'KB' }`) which is easier to consume
 *
 * @param {Number} bytes Size in bytes to convert
 * @param {Number} [precision] Precision to show the decimal number
 * @param {Boolean} [isSpd] True if this is a speed, unit will be returned as speed unit like KB/s
 * @returns {Object} Returns an object similar to `{size: "2.1", unit: "MB"}`
 */
function numOfBytes(bytes, precision, isSpd) {

    'use strict';

    // If not defined, default to 2dp (this still allows setting precision to 0 for 0dp)
    if (typeof precision === 'undefined') {
        precision = 2;
    }

    var fn = isSpd ? bytesToSpeed : bytesToSize;
    const formatted = fn(bytes, precision);
    const parts = formatted.split(formatted.includes(' ') ? ' ' : '\u00A0');

    return { size: parts[0], unit: parts[1] || 'B' };
}

function bytesToSize(bytes, precision, format) {
    'use strict'; /* jshint -W074 */

    var s_b = l[20158];
    var s_kb = l[7049];
    var s_mb = l[20159];
    var s_gb = l[17696];
    var s_tb = l[20160];
    var s_pb = l[23061];

    var kilobyte = 1024;
    var megabyte = kilobyte * 1024;
    var gigabyte = megabyte * 1024;
    var terabyte = gigabyte * 1024;
    var petabyte = terabyte * 1024;
    var resultSize = 0;
    var resultUnit = '';
    var capToMB = false;

    if (precision === undefined) {
        if (bytes > gigabyte) {
            precision = 2;
        }
        else if (bytes > megabyte) {
            precision = 1;
        }
    }

    if (format < 0) {
        format = 0;
        capToMB = true;
    }

    if (!bytes) {
        resultSize = 0;
        resultUnit = s_b;
    }
    else if ((bytes >= 0) && (bytes < kilobyte)) {
        resultSize = parseInt(bytes);
        resultUnit = s_b;
    }
    else if ((bytes >= kilobyte) && (bytes < megabyte)) {
        resultSize = (bytes / kilobyte).toFixed(precision);
        resultUnit = s_kb;
    }
    else if ((bytes >= megabyte) && (bytes < gigabyte) || capToMB) {
        resultSize = (bytes / megabyte).toFixed(precision);
        resultUnit = s_mb;
    }
    else if ((bytes >= gigabyte) && (bytes < terabyte)) {
        resultSize = (bytes / gigabyte).toFixed(precision);
        resultUnit = s_gb;
    }
    else if ((bytes >= terabyte) && (bytes < petabyte)) {
        resultSize = (bytes / terabyte).toFixed(precision);
        resultUnit = s_tb;
    }
    else if (bytes >= petabyte) {
        resultSize = (bytes / petabyte).toFixed(precision);
        resultUnit = s_pb;
    }
    else {
        resultSize = parseInt(bytes);
        resultUnit = s_b;
    }

    // Format 4 will return bytes to precision, without trailing 0s
    if (format === 4) {
        resultSize = parseFloat(resultSize);
    }

    if (window.lang !== 'en') {
        // @todo measure the performance degradation by invoking this here now..
        resultSize = mega.intl.decimal.format(resultSize);
    }

    // XXX: If ever adding more HTML here, make sure it's safe and/or sanitize it.
    if (format === 2) {
        return resultSize + '<span>' + resultUnit + '</span>';
    }
    else if (format === 3) {
        return resultSize;
    }
    else if (format && format !== 4) {
        return '<span>' + resultSize + '</span>' + resultUnit;
    }

    // \u00A0 is a non-breaking space so that the size and unit will always remain on the same line
    else {
        return resultSize + '\u00A0' + resultUnit;
    }
}

/*
 * Very Similar function as bytesToSize due to it is just simple extended version of it by making it as speed.
 * @returns {String} Returns a string that build with value entered and speed unit e.g. 100 KB/s
 */
var bytesToSpeed = function bytesToSpeed() {
    'use strict';
    return l[23062].replace('[%s]', bytesToSize.apply(this, arguments));
};
mBroadcaster.once('startMega', function() {
    'use strict';

    if (lang === 'en' || lang === 'es') {
        bytesToSpeed = function(bytes, precision, format) {
            return bytesToSize(bytes, precision, format) + '/s';
        };
    }
});


function makeid(len) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < len; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Checks if the email address is valid using the inbuilt HTML5
 * validation method suggested at https://stackoverflow.com/a/13975255
 * @param {String} email The email address to validate
 * @returns {Boolean} Returns true if email is valid, false if email is invalid
 */
function isValidEmail(email) {

    'use strict';
    // reference to html spec https://html.spec.whatwg.org/multipage/input.html#e-mail-state-(type=email)
    // with one modification, that the standard allows emails like khaled@mega
    // which is possible in local environment/networks but not in WWW.
    // so I applied + instead of * at the end
    var regex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return regex.test(email);
}

/**
 * Adds on, bind, unbind, one and trigger methods to a specific class's prototype.
 *
 * @param kls class on which prototype this method should add the on, bind, unbind, etc methods
 * @deprecated
 */
function makeObservable(kls) {
    'use strict';
    if (d > 1) {
        console.warn('makeObservable() is deprecated.');
    }
    inherits(kls, MegaDataEmitter);
}

/**
 * Adds simple .setMeta and .getMeta functions, which can be used to store some meta information on the fly.
 * Also triggers `onMetaChange` events (only if the `kls` have a `trigger` method !)
 *
 * @param kls {Class} on which prototype's this method should add the setMeta and getMeta
 */
function makeMetaAware(kls) {
    /**
     * Store meta data
     *
     * @param prefix string
     * @param namespace string
     * @param k string
     * @param val {*}
     */
    kls.prototype.setMeta = function(prefix, namespace, k, val) {
        var self = this;

        if (self["_" + prefix] === undefined) {
            self["_" + prefix] = {};
        }
        if (self["_" + prefix][namespace] === undefined) {
            self["_" + prefix][namespace] = {};
        }
        self["_" + prefix][namespace][k] = val;

        if (self.trigger) {
            self.trigger("onMetaChange", prefix, namespace, k, val);
        }
    };

    /**
     * Clear/delete meta data
     *
     * @param prefix string  optional
     * @param [namespace] string  optional
     * @param [k] string optional
     */
    kls.prototype.clearMeta = function(prefix, namespace, k) {
        var self = this;

        if (!self["_" + prefix]) {
            return;
        }

        if (prefix && !namespace && !k) {
            delete self["_" + prefix];
        }
        else if (prefix && namespace && !k) {
            delete self["_" + prefix][namespace];
        }
        else if (prefix && namespace && k) {
            delete self["_" + prefix][namespace][k];
        }

        if (self.trigger) {
            self.trigger("onMetaChange", prefix, namespace, k);
        }
    };

    /**
     * Retrieve meta data
     *
     * @param prefix {string}
     * @param namespace {string} optional
     * @param k {string} optional
     * @param default_value {*} optional
     * @returns {*}
     */
    kls.prototype.getMeta = function(prefix, namespace, k, default_value) {
        var self = this;

        namespace = namespace || undefined; /* optional */
        k = k || undefined; /* optional */
        default_value = default_value || undefined; /* optional */

        // support for calling only with 2 args.
        if (k === undefined) {
            if (self["_" + prefix] === undefined) {
                return default_value;
            }
            else {
                return self["_" + prefix][namespace] || default_value;
            }
        }
        else {
            // all args

            if (self["_" + prefix] === undefined) {
                return default_value;
            }
            else if (self["_" + prefix][namespace] === undefined) {
                return default_value;
            }
            else {
                return self["_" + prefix][namespace][k] || default_value;
            }
        }
    };
}

/**
 * Gets UAO parameter from the URL if exists and store it
 * @param {String} url          URL
 * @param {String} page         Page
 */
function getUAOParameter(url, page) {
    'use strict';
    var pageLen = page.length;
    if (url.length > pageLen) {
        var urlParams = url.substr(pageLen);
        if (urlParams.length > 14) {
            var uaoParam = urlParams.indexOf('/uao=');
            if (uaoParam > -1) {
                mega.uaoref = urlParams.substr(uaoParam + 5);
            }
        }
    }
}

/**
 * Simple method for generating unique event name with a .suffix that is a hash of the passed 3-n arguments
 * Main purpose is to be used with jQuery.bind and jQuery.unbind.
 *
 * @param eventName {string} event name
 * @param name {string} name of the handler (e.g. .suffix)
 * @returns {string} e.g. $eventName.$name_$ShortHashOfTheAdditionalArguments
 */
function generateEventSuffixFromArguments(eventName, name) {
    var args = Array.prototype.splice.call(arguments, 2);
    var result = "";
    $.each(args, function(k, v) {
        result += v;
    });

    return eventName + "." + name + "_" + ("" + fastHashFunction(result)).replace("-", "_");
}

/**
 * This is a placeholder, which will be used anywhere in our code where we need a simple and FAST hash function.
 * later on, we can change the implementation (to use md5 or murmur) by just changing the function body of this
 * function.
 * @param {String}
 */
function fastHashFunction(val) {
    return MurmurHash3(val, 0x4ef5391a).toString();
}

/**
 * Creates a promise, which will fail if the validateFunction() don't return true in a timely manner (e.g. < timeout).
 *
 * @param validateFunction {Function}
 * @param tick {int}
 * @param timeout {int}
 * @param [waitForPromise] {(MegaPromise|$.Deferred)} Before starting the timer, we will wait for this promise to be rej/res first.
 * @param [name] {String} optional name for the debug output of the error/debug messages
 * @returns {Promise}
 */
function createTimeoutPromise(validateFunction, tick, timeout, waitForPromise, name) {
    'use strict';
    let _res, _rej;
    let running = true;
    let state = 'pending';
    const debug = window.d > 2;
    const tag = (m) => `[${name}] ${m}`;
    const log = (m, ...args) => console.warn(tag(m), ...args);

    const promise = new Promise((resolve, reject) => {
        _rej = reject;
        _res = resolve;

        tick |= 0;
        timeout = Math.max(0, timeout | 0);
        name = `cTP.${name || makeUUID().slice(-17)}.${++mIncID}`;

        if (debug) {
            log('Creating timeout promise...', tick, timeout);
        }
        let threshold = performance.now();

        assert(typeof validateFunction === 'function', tag('Function expected'));
        assert(tick > 100, tag(`at least 100ms are expected, ${tick} provided.`));
        assert(timeout > tick && timeout < 6e5, tag(`Invalid timeout value (${timeout})`));
        validateFunction = tryCatch(validateFunction);

        Promise.resolve(waitForPromise)
            .then(async() => {
                let duration = 0;
                const int = tick / 1e3;

                if (debug) {
                    threshold -= performance.now();

                    if (threshold > 10) {
                        log('Begin took %sms%s', threshold, waitForPromise ? '' : ', tab throttled(?!)');
                    }

                    // @todo add threshold to duration if !waitForPromise (?)
                }

                if (validateFunction()) {
                    if (debug) {
                        log('The validator resolved immediately...', waitForPromise);
                    }
                    state = 'placebo';
                    return -1;
                }

                if (debug) {
                    threshold = performance.now();
                }

                while (running) {
                    await sleep(int);

                    if (debug) {
                        const now = performance.now();
                        const diff = now - threshold;

                        if (diff > tick * 1.8) {
                            log('Tab throttled? did sleep for %sms while %sms were expected...', diff, tick);
                        }
                        threshold = now;
                    }

                    duration += tick;
                    running = !validateFunction();

                    if (duration > timeout) {
                        break;
                    }
                }

                if (running) {
                    if (debug) {
                        log(`Timed out after waiting ${duration}ms`, promise);
                    }

                    state = 'expired';
                    throw new Error(`${name} timed out.`);
                }

                if (state === 'aborted') {
                    // xxx: backward compatibility, but rather bogus leaving a dangling promise there..
                    resolve = nop;
                    Object.defineProperty(promise, 'aborted', {value: Date.now()});
                    Object.freeze(promise);
                    return;
                }

                if (debug) {
                    log(`Resolved timeout promise after waiting ${duration}ms...`, promise);
                }
                state = 'fulfilled';
            })
            .then((a0) => resolve(a0))
            .catch(reject);

    }).finally(() => {
        running = false;

        if (debug) {
            createTimeoutPromise.instances.delete(promise);
        }
    });

    if (debug) {
        promise.tick = tick;
        promise.timeout = timeout;
        createTimeoutPromise.instances.add(promise);
    }

    return Object.defineProperties(promise, {
        state: {
            get() {
                return state;
            }
        },

        verify: {
            value: queueMicrotask.bind(null, () => {
                if (validateFunction()) {
                    if (debug) {
                        log("Resolving timeout promise", state, promise);
                    }
                    promise.resolve(0);
                }
            })
        },

        stopTimers: {
            value: () => {
                running = false;
                state = 'aborted';
            }
        },

        name: {
            value: name
        },

        resolve: {
            value: _res
        },

        reject: {
            value: _rej
        }
    });
}

/** @property createTimeoutPromise.instances */
lazy(createTimeoutPromise, 'instances', () => {
    'use strict';
    return new WeakSet();
});

/**
 * Assert a given test condition.
 *
 * Throws an AssertionFailed exception with a given message, in case the condition is false.
 * The message is assembled by the args following 'test', similar to console.log()
 *
 * @param test
 *     Test statement.
 * @param args
 */
// eslint-disable-next-line strict
function assert(test, ...args) {
    if (!test) {
        if (d) {
            console.error('assertion failed', ...args);
        }
        MegaLogger.rootLogger.assert(test, ...args);
    }
}

/**
 * Assert that a user handle is potentially valid (e. g. not an email address).
 *
 * @param userHandle {string}
 *     The user handle to check.
 * @throws
 *     Throws an exception on something that does not seem to be a user handle.
 */
var assertUserHandle = function(userHandle) {
    try {
        if (typeof userHandle !== 'string'
                || base64urldecode(userHandle).length !== 8) {

            throw 1;
        }
    }
    catch (ex) {
        assert(false, 'This seems not to be a user handle: ' + userHandle);
    }
};


/**
 * Pad/prepend `val` with "0" (zeros) until the length is === `length`
 *
 * @param val {String} value to add "0" to
 * @param len {Number} expected length
 * @returns {String}
 */
function addZeroIfLenLessThen(val, len) {
    if (val.toString().length < len) {
        for (var i = val.toString().length; i < len; i++) {
            val = "0" + val;
        }
    }
    return val;
}

function ASSERT(what, msg, udata) {
    'use strict';

    if (!what && self.d > 0) {
        reportError(new Error(`failed assertion, ${msg}`));
    }
    return !!what;
}

// log failures through jscrashes system
function srvlog(msg, data, silent) {
    'use strict';

    (silent ? dump : reportError)(msg instanceof Error ? msg : new Error(msg));
}

// log failures through event id 99666
function srvlog2(type /*, ...*/) {
    if (d || window.exTimeLeft) {
        var args    = toArray.apply(null, arguments);
        var version = buildVersion.website;

        if (is_extension) {
            if (is_firefox_web_ext) {
                version = buildVersion.firefox;
            }
            else if (mega.chrome) {
                version = buildVersion.chrome;
            }
            else {
                version = buildVersion.commit && buildVersion.commit.substr(0, 8) || '?';
            }
        }
        args.unshift((is_extension ? 'e' : 'w') + (version || '-'));

        eventlog(99666, JSON.stringify(args));
    }
}

/**
 * Original: http://stackoverflow.com/questions/7317299/regex-matching-list-of-emoticons-of-various-type
 *
 * @param text
 * @returns {XML|string|void}
 * @constructor
 */
function RegExpEscape(text) {
    'use strict';
    return text.replace(/[\s#$()*+,.?[\\\]^{|}-]/g, "\\$&");
}


/**
 * JS Implementation of MurmurHash3 (r136) (as of May 20, 2011)
 *
 * @author <a href="mailto:gary.court.gmail.com">Gary Court</a>
 * @see http://github.com/garycourt/murmurhash-js
 * @author <a href="mailto:aappleby.gmail.com">Austin Appleby</a>
 * @see http://sites.google.com/site/murmurhash/
 *
 * @param {string} key ASCII only
 * @param {number} seed Positive integer only
 * @return {number} 32-bit positive integer hash
 */
function MurmurHash3(key, seed) {
    var remainder, bytes, h1, h1b, c1, c1b, c2, c2b, k1, i;

    remainder = key.length & 3; // key.length % 4
    bytes = key.length - remainder;
    h1 = seed || 0xe6546b64;
    c1 = 0xcc9e2d51;
    c2 = 0x1b873593;
    i = 0;

    while (i < bytes) {
        k1 =
            ((key.charCodeAt(i) & 0xff)) |
            ((key.charCodeAt(++i) & 0xff) << 8) |
            ((key.charCodeAt(++i) & 0xff) << 16) |
            ((key.charCodeAt(++i) & 0xff) << 24);
        ++i;

        k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

        h1 ^= k1;
        h1 = (h1 << 13) | (h1 >>> 19);
        h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
        h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
    }

    k1 = 0;

    switch (remainder) {
        case 3:
            k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
        case 2:
            k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
        case 1:
            k1 ^= (key.charCodeAt(i) & 0xff);

            k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
            h1 ^= k1;
    }

    h1 ^= key.length;

    h1 ^= h1 >>> 16;
    h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
    h1 ^= h1 >>> 13;
    h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
    h1 ^= h1 >>> 16;

    return h1 >>> 0;
}

/**
 * Ask the user for a decryption key
 * @param {String} ph   The node's handle
 * @param {Boolean} [fl] Whether is a folderlink
 * @param {Boolean} [keyr] If a wrong key was used
 * @param {String} [selector] DOM node selector
 * @return {Promise}
 */
async function mKeyDialog(ph, fl, keyr, selector) {
    "use strict";

    const {promise} = mega;
    var $dialog = $('.mega-dialog.dlkey-dialog');
    var $button = $('.fm-dialog-new-folder-button', $dialog);
    var $input = $('input', $dialog);

    if (keyr) {
        const dialog = $('.mega-dialog.dlkey-dialog');

        $('.fm-dialog-new-folder-input', dialog).addClass('contains-error');
        $('.dlkey-err', dialog).removeClass('hidden');
        $('.instruction-message', dialog)
            .text((pfcol) ? l.album_decr_key_descr : l[9048]);

        if (pfcol) {
            $('.dlkey-err', $dialog)[0].style.textAlign = 'center';
            $input[0].placeholder = '';
            if (document.body.classList.contains('theme-dark')) {
                $('.fm-dialog-new-folder-input', $dialog)[0].style.background = "black";
            }
        }
    }
    else if (pfcol) {
        $('.mega-dialog.dlkey-dialog .instruction-message')
            .safeHTML(l.album_decr_key_descr);
        $input[0].placeholder = '';
        if (document.body.classList.contains('theme-dark')) {
            $('.fm-dialog-new-folder-input', $dialog)[0].style.background = "black";
        }
    }
    else {
        $('.mega-dialog.dlkey-dialog input').val('');
        $('.mega-dialog.dlkey-dialog .instruction-message')
            .safeHTML(l[7945] + '<br/>' + l[7972]);
    }

    if (mega.gallery.albums) {
        mega.gallery.albums.disposeAll();
        mega.gallery.albumsRendered = false;
    }

    $button.addClass('disabled').removeClass('active');

    M.safeShowDialog('dlkey-dialog', $dialog);

    const processKeyboardEvent = (evt) => {
        if (evt.key === 'Escape') {
            // Adhering to overlay's behaviour here, blocking the esc click
            evt.preventDefault();
            evt.stopPropagation();
        }
    };

    $('.js-close', $dialog).rebind('click.keydlg', () => {
        loadSubPage('start');
    });

    document.addEventListener('keydown', processKeyboardEvent);

    $dialog.rebind('dialog-closed.dlkey', () => {
        document.removeEventListener('keydown', processKeyboardEvent);
    });

    $input.rebind('input keypress', function(e) {
        var length = String($(this).val() || '').length;

        if (length) {
            $button.removeClass('disabled').addClass('active');

            if (e.keyCode === 13) {
                $button.click();
            }
        }
        else {
            $button.removeClass('active').addClass('disabled');
        }
    });

    $button.rebind('click.keydlg', function() {
        if ($(this).hasClass('active')) {
            // Trim the input from the user for whitespace, newlines etc on either end
            var key = $.trim($input.val());

            if (key) {

                // Remove the !,# from the key which is exported from the export dialog
                key = key.split(/[^\w-]/)[0];

                const path = `/${pfcol ? 'collection' : fl ? 'folder' : 'file'}/${ph}#${key}${selector || ''}`;

                if (getSitePath() !== path) {
                    promise.resolve(key);

                    fm_hideoverlay();
                    $dialog.addClass('hidden');
                    loadSubPage(path);

                }
            }
            else {
                promise.reject();
            }
        }
    });

    return promise;
}

function str_mtrunc(str, len) {
    if (!len) {
        len = 35;
    }
    if (len > (str || '').length) {
        return str;
    }
    var p1 = Math.ceil(0.60 * len),
        p2 = Math.ceil(0.30 * len);
    return str.substr(0, p1) + '\u2026' + str.substr(-p2);
}

function getTransfersPercent() {
    var dl_r = 0;
    var dl_t = 0;
    var ul_r = 0;
    var ul_t = 0;
    var tp = $.transferprogress || {};
    var zips = {};
    var i;

    for (i = dl_queue.length; i--;) {
        var q = dl_queue[i];
        var td = q && tp[q.zipid ? 'zip_' + q.zipid : 'dl_' + q.id];

        if (td) {
            dl_r += td[0];
            dl_t += td[1];
            if (!q.zipid || !zips[q.zipid]) {
                if (q.zipid) {
                    zips[q.zipid] = 1;
                }
            }
        }
        else {
            dl_t += q && q.size || 0;
        }
    }
    for (i = ul_queue.length; i--;) {
        var tu = tp['ul_' + ul_queue[i].id];

        if (tu) {
            ul_r += tu[0];
            ul_t += tu[1];
        }
        else {
            ul_t += ul_queue[i].size || 0;
        }
    }
    if (dl_t) {
        dl_t += tp['dlc'] || 0;
        dl_r += tp['dlc'] || 0;
    }
    if (ul_t) {
        ul_t += tp['ulc'] || 0;
        ul_r += tp['ulc'] || 0;
    }

    return {
        ul_total: ul_t,
        ul_done: ul_r,
        dl_total: dl_t,
        dl_done: dl_r
    };
}

function percent_megatitle() {
    'use strict';
    var t;
    var transferStatus = getTransfersPercent();

    var x_ul = Math.floor(transferStatus.ul_done / transferStatus.ul_total * 100) || 0;
    var x_dl = Math.floor(transferStatus.dl_done / transferStatus.dl_total * 100) || 0;

    if (transferStatus.dl_total && transferStatus.ul_total) {
        t = ' \u2193 ' + x_dl + '% \u2191 ' + x_ul + '%';
    }
    else if (transferStatus.dl_total) {
        t = ' \u2193 ' + x_dl + '%';
    }
    else if (transferStatus.ul_total) {
        t = ' \u2191 ' + x_ul + '%';
    }
    else {
        t = '';
        $.transferprogress = Object.create(null);
    }
    megatitle(t);

    var d_deg = 360 * x_dl / 100;
    var u_deg = 360 * x_ul / 100;
    var $dl_rchart = $('.transfers .download .nw-fm-chart0.right-c p');
    var $dl_lchart = $('.transfers .download .nw-fm-chart0.left-c p');
    var $ul_rchart = $('.transfers .upload .nw-fm-chart0.right-c p');
    var $ul_lchart = $('.transfers .upload .nw-fm-chart0.left-c p');

    if (d_deg <= 180) {
        $dl_rchart.css('transform', 'rotate(' + d_deg + 'deg)');
        $dl_lchart.css('transform', 'rotate(0deg)');
    }
    else {
        $dl_rchart.css('transform', 'rotate(180deg)');
        $dl_lchart.css('transform', 'rotate(' + (d_deg - 180) + 'deg)');
    }
    if (u_deg <= 180) {
        $ul_rchart.css('transform', 'rotate(' + u_deg + 'deg)');
        $ul_lchart.css('transform', 'rotate(0deg)');
    }
    else {
        $ul_rchart.css('transform', 'rotate(180deg)');
        $ul_lchart.css('transform', 'rotate(' + (u_deg - 180) + 'deg)');
    }
}

/**
 *
 * @param {number} initial - The initial value
 * @param {number} final - The final value
 * @param {number} format - Binary flag for options (1: Force decreasing value, 2: Round down)
 * @returns {number} - The percentage difference between the initial and final values.
 */
function percentageDiff(initial, final, format) {
    'use strict';
    const difference = Math.abs(final - initial);
    let changeFrom = initial;
    if (format & 1) { // Force decrease
        changeFrom = Math.max(initial, final);
    }

    let change = (difference / changeFrom) * 100;

    if (format & 2) { // Round down
        change = Math.floor(change);
    }
    return change;
}

function moveCursortoToEnd(el) {

    'use strict';

    const $el = $(el);
    const $scrollBlock = $el.parent('.ps');

    if (typeof el.selectionStart === "number") {
        el.focus();
        el.selectionStart = el.selectionEnd = el.value.length;
    }
    else if (typeof el.createTextRange !== "undefined") {
        el.focus();
        var range = el.createTextRange();
        range.collapse(false);
        range.select();
    }
    $el.trigger('focus');

    if ($scrollBlock.length) {
        $scrollBlock.scrollTop($el.height());
    }
}

/**
 *  @deprecated
 *  @todo move to e.g. megaChat.sendApiRequest()
 */
function asyncApiReq(payload, options) {
    'use strict';
    let cache = -15;
    switch (payload.a) {
        case 'mcr':
        case 'mcph':
        case 'mcsmfo':
            cache = null;
            break;
    }
    return api.req(payload, {channel: 6, cache, ...options}).then(({result}) => result);
}

// Returns pixels position of element relative to document (top left corner) OR to the parent (IF the parent and the
// target element are both with position: absolute)
function getHtmlElemPos(elem, n) {
    var xPos = 0;
    var yPos = 0;
    var sl, st, cl, ct;
    var pNode;
    while (elem) {
        pNode = elem.parentNode;
        sl = 0;
        st = 0;
        cl = 0;
        ct = 0;
        if (pNode && pNode.tagName && !/html|body/i.test(pNode.tagName)) {
            if (typeof n === 'undefined') // count this in, except for overflow huge menu
            {
                sl = elem.scrollLeft;
                st = elem.scrollTop;
            }
            cl = elem.clientLeft;
            ct = elem.clientTop;
            xPos += (elem.offsetLeft - sl + cl);
            yPos += (elem.offsetTop - st - ct);
        }
        elem = elem.offsetParent;
    }
    return {
        x: xPos,
        y: yPos
    };
}

/**
 * Gets the current base URL of the page (protocol + hostname) e.g. If on beta.mega.nz it will return https://beta.mega.nz.
 * If on the browser extension it will return the default https://127.0.0.1. If on localhost it will return https://127.0.0.1.
 * This can be used to create external links, for example file downloads https://127.0.0.1/#!qRN33YbK!o4Z76qDqPbiK2G0I...
 * @returns {String}
 */
function getBaseUrl() {
    return 'https://' + (((location.protocol === 'https:') && location.host) || 'mega.nz');
}

/**
 * Like getBaseUrl(), but suitable for extensions to point to internal resources.
 * This should be the same than `bootstaticpath + urlrootfile` except that may differ
 * from a public entry point (Such as the Firefox extension and its mega: protocol)
 * @returns {string}
 */
function getAppBaseUrl() {
    var l = location;
    var base = (l.origin !== 'null' && l.origin || (l.protocol + '//' + l.hostname));
    if (is_extension) {
        base += l.pathname;
    }
    return base;
}

if (d && location.hostname === 'localhost') {
    // eslint-disable-next-line no-func-assign
    getBaseUrl = function() {
        'use strict';
        return location.origin;
    };
}

/**
 * http://stackoverflow.com/a/16344621/402133
 *
 * @param ms
 * @returns {string}
 */
function ms2Time(ms) {
    var secs = ms / 1000;
    ms = Math.floor(ms % 1000);
    var minutes = secs / 60;
    secs = Math.floor(secs % 60);
    var hours = minutes / 60;
    minutes = Math.floor(minutes % 60);
    hours = Math.floor(hours % 24);
    return hours + ":" + minutes + ":" + secs;
}

function secToDuration(s, sep) {
    var dur = ms2Time(s * 1000).split(":");
    var durStr = "";
    sep = sep || ", ";
    if (!secToDuration.regExp) { //regexp compile cache
        secToDuration.regExp = {};
    }

    if (!secToDuration.regExp[sep]) {
        secToDuration.regExp[sep] = new RegExp("" + sep + "$");
    }

    for (var i = 0; i < dur.length; i++) {
        var v = dur[i];
        if (v === "0") {
            if (durStr.length !== 0 && i !== 0) {
                continue;
            }
            else if (i < 2) {
                continue;
            }
        }

        var transString = false;
        if (i === 0) {
            // hour
            transString = mega.icu.format(l.hour_count, parseInt(v));
        }
        else if (i === 1) {
            // minute
            transString = mega.icu.format(l.minute_count, parseInt(v));
        }
        else if (i === 2) {
            // second
            transString = mega.icu.format(l.second_count, parseInt(v));
        }
        else {
            throw new Error("this should never happen.");
        }

        durStr += transString + sep;
    }

    return durStr.replace(secToDuration.regExp[sep], "");
}

function generateAnonymousReport() {
    var $promise = new MegaPromise();
    var report = {};
    report.ua = navigator.userAgent;
    report.ut = u_type;
    report.pbm = !!window.Incognito;
    report.io = window.dlMethod && dlMethod.name;
    report.sb = +('' + $('script[src*="secureboot"]').attr('src')).split('=').pop();
    report.tp = $.transferprogress;
    if (!megaChatIsReady) {
        report.karereState = '#disabled#';
    }
    else {
        report.numOpenedChats = Object.keys(megaChat.chats).length;
        report.haveRtc = typeof SfuClient !== 'undefined' && SfuClient.platformHasSupport();
    }

    var chatStates = {};
    var userAnonMap = {};
    var userAnonIdx = 0;
    var roomUniqueId = 0;
    var roomUniqueIdMap = {};

    if (megaChatIsReady && megaChat.chats) {
        megaChat.chats.forEach(function (v, k) {
            var participants = v.getParticipants();

            participants.forEach(function (v, k) {
                var cc = M.u[v];
                if (cc && cc.u && !userAnonMap[cc.u]) {
                    userAnonMap[cc.u] = {
                        anonId: userAnonIdx++ + rand(1000),
                        pres: megaChat.getPresence(v)
                    };
                }
                participants[k] = cc && cc.u ? userAnonMap[cc.u] : v;
            });

            var r = {
                'roomState': v.getStateAsText(),
                'roomParticipants': participants
            };

            chatStates[roomUniqueId] = r;
            roomUniqueIdMap[k] = roomUniqueId;
            roomUniqueId++;
        });

        report.chatRoomState = chatStates;
    };

    var apireqHaveBackOffs = {};
    // @todo
    // apixs.forEach(function(v, k) {
    //     if (v.backoff > 0) {
    //         apireqHaveBackOffs[k] = v.backoff;
    //     }
    // });

    if (Object.keys(apireqHaveBackOffs).length > 0) {
        report.apireqbackoffs = apireqHaveBackOffs;
    }

    report.hadLoadedRsaKeys = u_authring.RSA && Object.keys(u_authring.RSA).length > 0;
    report.hadLoadedEd25519Keys = u_authring.Ed25519 && Object.keys(u_authring.Ed25519).length > 0;
    report.totalDomElements = $("*").length;
    report.totalScriptElements = $("script").length;

    report.totalD = Object.keys(M.d).length;
    report.totalU = M.u.size();
    report.totalC = Object.keys(M.c).length;
    report.totalIpc = Object.keys(M.ipc).length;
    report.totalOpc = Object.keys(M.opc).length;
    report.totalPs = Object.keys(M.ps).length;
    report.l = lang;
    report.scrnSize = window.screen.availWidth + "x" + window.screen.availHeight;

    if (typeof window.devicePixelRatio !== 'undefined') {
        report.pixRatio = window.devicePixelRatio;
    }

    try {
        report.perfTiming = JSON.parse(JSON.stringify(window.performance.timing));
        report.memUsed = window.performance.memory.usedJSHeapSize;
        report.memTotal = window.performance.memory.totalJSHeapSize;
        report.memLim = window.performance.memory.jsHeapSizeLimit;
    }
    catch (e) {}

    report.jslC = jslcomplete;
    report.jslI = jsli;
    report.host = window.location.host;

    var promises = [];

    report.version = null; // TODO: how can we find this?

    MegaPromise.allDone(promises)
        .then(function() {
            $promise.resolve(report);
        })
        .catch(function() {
            $promise.resolve(report)
        });

    return $promise;
}

function constStateToText(enumMap, state) {
    "use strict";
    for (var k in enumMap) {
        if (enumMap[k] === state) {
            return k;
        }
    }
    return "(not found: " + state + ")";
};

/**
 * Helper function that will do some assert()s to guarantee that the new state is correct/allowed
 *
 * @param currentState
 * @param newState
 * @param allowedStatesMap
 * @param enumMap
 * @throws AssertionError
 */
function assertStateChange(currentState, newState, allowedStatesMap, enumMap) {
    "use strict";

    assert(typeof newState !== "undefined", "assertStateChange: newState is 'undefined'");
    var checksAvailable = allowedStatesMap[currentState];
    var allowed = false;
    if (checksAvailable) {
        checksAvailable.forEach(function(allowedState) {
            if (allowedState === newState) {
                allowed = true;
                return false; // break;
            }
        });
    }
    if (!allowed) {
        assert(
            false,
            'State change from: ' + constStateToText(enumMap, currentState) + ' to ' +
            constStateToText(enumMap, newState) + ' is not in the allowed state transitions map.'
        );
    }
}

/**
 * Perform a normal logout
 *
 * @param {Function} aCallback optional
 * @param {Bool} force optional
 */
function mLogout(aCallback, force) {
    "use strict";

    // If user are trying logged out from paid ephemral session, warn user that they cannot get back the paid session.
    if (isNonActivatedAccount()) {
        msgDialog('warninga:!^' + l[78] + '!' + l[79], 'warning', l[23443], l[23444], function(response) {
            if (!response) {
                M.logout();
            }
        });

        return;
    }

    Promise.resolve(u_type === 0 && Object.keys(M.c[M.RootID] || {}).length)
        .then((cnt) => {
            return cnt < 1 || asyncMsgDialog('confirmation', l[1057], l[1058], l[1059]);
        })
        .then((proceed) => {
            if (proceed && mega.ui.passwordReminderDialog) {
                if (window.waitsc) {
                    waitsc.stop();
                }
                return Promise.resolve(mega.ui.passwordReminderDialog.recheckLogoutDialog()).then(() => true);
            }
            return proceed;
        })
        .then((logout) => {
            return logout && M.logout();
        })
        .catch((ex) => {
            if (u_type > 2 && window.waitsc) {
                waitsc();
            }
            if (ex) {
                dump(ex);
            }
        });
}

// Initialize Rubbish-Bin Cleaning Scheduler
mBroadcaster.addListener('crossTab:owner', function _setup() {
    'use strict';
    var RUBSCHED_WAITPROC =  20 * 1000;
    var RUBSCHED_IDLETIME =   4 * 1000;
    var timer, updId;

    mBroadcaster.once('crossTab:leave', _exit);

    // The fm must be initialized before proceeding
    if (!folderlink && fminitialized) {
        _fmready();
    }
    else {
        mBroadcaster.addListener('fm:initialized', _fmready);
    }

    function _fmready() {
        if (!folderlink) {
            _init();
            return 0xdead;
        }
    }

    function _update(enabled) {
        _exit();
        if (enabled) {
            _init();
        }
    }

    function _exit() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        if (updId) {
            mBroadcaster.removeListener(updId);
            updId = null;
        }
    }

    function _init() {
        // if (d) console.log('Initializing Rubbish-Bin Cleaning Scheduler');

        // updId = mBroadcaster.addListener('fmconfig:rubsched', _update);
        if (fmconfig.rubsched) {
            timer = setInterval(function() {
                // Do nothing unless the user has been idle
                if (Date.now() - lastactive < RUBSCHED_IDLETIME) {
                    return;
                }
                _exit();

                dbfetch.coll([M.RubbishID]).finally(_proc);

            }, RUBSCHED_WAITPROC);
        }
    }

    function _proc() {

        // Mode 14 - Remove files older than X days
        // Mode 15 - Keep the Rubbish-Bin under X GB
        var mode = String(fmconfig.rubsched).split(':');
        var xval = mode[1];
        mode = +mode[0];

        var handler = _rubSchedHandler[mode];
        if (!handler) {
            throw new Error('Invalid RubSchedHandler', mode);
        }

        if (d) {
            console.log('Running Rubbish Bin Cleaning Scheduler', mode, xval);
            console.time('rubsched');
        }

        // Watch how long this is running
        var startTime = Date.now();

        // Get nodes in the Rubbish-bin
        var nodes = Object.keys(M.c[M.RubbishID] || {});
        var rubnodes = [];

        for (var i = nodes.length; i--; ) {
            var node = M.d[nodes[i]];
            if (!node) {
                console.error('Invalid node', nodes[i]);
                continue;
            }
            rubnodes = rubnodes.concat(M.getNodesSync(node.h, true));
        }

        rubnodes.sort(handler.sort);
        var rNodes = handler.log(rubnodes);

        // if (d) console.log('rubnodes', rubnodes, rNodes);

        var handles = [];
        if (handler.purge(xval)) {
            for (var i in rubnodes) {
                var node = M.d[rubnodes[i]];

                if (handler.remove(node, xval)) {
                    handles.push(node.h);

                    if (handler.ready(node, xval)) {
                        break;
                    }

                    // Abort if this has been running for too long..
                    if ((Date.now() - startTime) > 7000) {
                        break;
                    }
                }
            }

            // if (d) console.log('RubSched-remove', handles);

            if (handles.length) {
                var inRub = (M.RubbishID === M.currentrootid);

                handles.map(function(handle) {
                    // M.delNode(handle, true);    // must not update DB pre-API
                    api_req({a: 'd', n: handle/*, i: requesti*/});

                    if (inRub) {
                        $('.grid-table.fm#' + handle).remove();
                        $('.data-block-view#' + handle).remove();
                    }
                });

                if (inRub) {
                    M.addViewUI();
                }
            }
        }

        if (d) {
            console.timeEnd('rubsched');
        }

        // Once we ran for the first time, set up a long running scheduler
        RUBSCHED_WAITPROC = 4 * 3600 * 1e3;
        _init();
    }

    /**
     * Scheduler Handlers
     *   Sort:    Sort nodes specifically for the handler purpose
     *   Log:     Keep a record of nodes if required and return a debugable array
     *   Purge:   Check whether the Rubbish-Bin should be cleared
     *   Remove:  Return true if the node is suitable to get removed
     *   Ready:   Once a node is removed, check if the criteria has been meet
     */
    var _rubSchedHandler = {
        // Remove files older than X days
        "14": {
            sort: function(n1, n2) {
                return M.d[n1].ts > M.d[n2].ts;
            },
            log: function(nodes) {
                return d && nodes.map(function(node) {
                    return M.d[node].name + '~' + (new Date(M.d[node].ts*1000)).toISOString();
                });
            },
            purge: function(limit) {
                return true;
            },
            remove: function(node, limit) {
                limit = (Date.now() / 1e3) - (limit * 86400);
                return node.ts < limit;
            },
            ready: function(node, limit) {
                return false;
            }
        },
        // Keep the Rubbish-Bin under X GB
        "15": {
            sort: function(n1, n2) {
                n1 = M.d[n1].s || 0;
                n2 = M.d[n2].s || 0;
                return n1 < n2;
            },
            log: function(nodes) {
                var pnodes, size = 0;

                pnodes = nodes.map(function(node) {
                    size += (M.d[node].s || 0);
                    return M.d[node].name + '~' + bytesToSize(M.d[node].s);
                });

                this._size = size;

                return pnodes;
            },
            purge: function(limit) {
                return this._size > (limit * 1024 * 1024 * 1024);
            },
            remove: function(node, limit) {
                return true;
            },
            ready: function(node, limit) {
                this._size -= (node.s || 0);
                return this._size < (limit * 1024 * 1024 * 1024);
            }
        }
    };
});

/**
 * Simple alias that will return a random number in the range of: a < b
 *
 * @param a {Number} min
 * @param b {Number} max
 * @returns {*}
 */
function rand_range(a, b) {
    return Math.random() * (b - a) + a;
}

/**
 * Check if the passed in element (DOMNode) is FULLY visible in the viewport.
 *
 * @param el {DOMNode}
 * @returns {boolean}
 */
function elementInViewport(el) {
    if (!verge.inY(el)) {
        return false;
    }
    if (!verge.inX(el)) {
        return false;
    }

    var rect = verge.rectangle(el);

    return !(rect.left < 0 || rect.right < 0 || rect.bottom < 0 || rect.top < 0);
}

/**
 * Check if the element is within the viewport, not detached and visible.
 * @param {HTMLElement|Element} el DOM node/element.
 * @returns {Boolean} whether it is.
 */
function elementIsVisible(el) {
    'use strict';

    if (!(el && el.parentNode && verge.inViewport(el))) {
        return false;
    }

    if (window.getComputedStyle(el).position !== 'fixed' && !el.offsetParent) {
        return false;
    }

    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

// FIXME: This is a "Dirty Hack" (TM) that needs to be removed as soon as
//        the original problem is found and resolved.
if (typeof sjcl !== 'undefined') {
    // We need to track SJCL exceptions for ticket #2348
    sjcl.exception.invalid = function(message) {
        this.toString = function() {
            return "INVALID: " + this.message;
        };
        this.message = message;
        this.stack = M.getStack();
    };
}

(function($, scope) {
    /**
     * Share related operations.
     *
     * @param opts {Object}
     *
     * @constructor
     */
    var Share = function(opts) {

        var self = this;
        var defaultOptions = {
        };

        self.options = $.extend(true, {}, defaultOptions, opts);    };

    /**
     * isShareExists
     *
     * Checking if there's available shares for selected nodes.
     * @param {Array} nodes Holds array of ids from selected folders/files (nodes).
     * @param {Boolean} fullShare Do we need info about full share.
     * @param {Boolean} pendingShare Do we need info about pending share .
     * @param {Boolean} linkShare Do we need info about link share 'EXP'.
     * @returns {Boolean} result.
     */
    Share.prototype.isShareExist = function(nodes, fullShare, pendingShare, linkShare) {

        var self = this;

        var shares = {}, length;

        for (var i in nodes) {
            if (nodes.hasOwnProperty(i)) {

                // Look for full share
                if (fullShare) {
                    shares = M.d[nodes[i]] && M.d[nodes[i]].shares;

                    // Look for link share
                    if (linkShare) {
                        if (shares && Object.keys(shares).length) {
                            return true;
                        }
                    }
                    else { // Exclude folder/file links,
                        if (shares) {
                            length = self.getFullSharesNumber(shares);
                            if (length) {
                                return true;
                            }
                        }
                    }
                }

                // Look for pending share
                if (pendingShare) {
                    shares = M.ps[nodes[i]];

                    if (shares && Object.keys(shares).length) {
                        return true;
                    }
                }
            }
        }

        return false;
    };

    /**
     * hasExportLink, check if at least one selected item have public link.
     *
     * @param {String|Array} nodes Node id or array of nodes string
     * @returns {Boolean}
     */
    Share.prototype.hasExportLink = function(nodes) {

        if (typeof nodes === 'string') {
            nodes = [nodes];
        }

        // Loop through all selected items
        for (var i in nodes) {
            var node = M.d[nodes[i]];

            if (node && Object(node.shares).EXP) {
                return true;
            }
        }

        return false;
    };

    /**
     * getFullSharesNumber
     *
     * Loops through all shares and return number of full shares excluding
     * ex. full contacts. Why ex. full contact, in the past when client removes
     * full contact from the list, share related to client remains active on
     * owners side. That behaviour is changed/updated on API side, so now after
     * full contact relationship is removed, related shares are also removed.
     *
     * @param {Object} shares
     * @returns {Integer} result Number of shares
     */
    Share.prototype.getFullSharesNumber = function(shares) {

        var result = 0;
        var contactKeys = [];

        if (shares) {
            contactKeys = Object.keys(shares);
            $.each(contactKeys, function(ind, key) {

                // Count only full contacts
                if (M.u[key] && M.u[key].c) {
                    result++;
                }
            });
        }

        return result;
    };

    /**
     * addContactToFolderShare
     *
     * Add verified email addresses to folder shares.
     */
    Share.prototype.addContactToFolderShare = function addContactToFolderShare() {
        let promise;

        // Share button enabled
        if ($.dialog === 'share' && !$('.done-share', '.share-dialog').is('.disabled')) {
            const targets = [];
            const [selectedNode] = $.selected;

            // Is there a new contacts planned for addition to share
            if (Object.keys($.addContactsToShare).length > 0) {

                // Add new planned contact to list
                for (var i in $.addContactsToShare) {
                    const {u: userEmail, r: permissionLevel} = $.addContactsToShare[i];

                    if (userEmail && permissionLevel !== undefined) {
                        targets.push({u: userEmail, r: permissionLevel});
                    }
                }
            }

            // Add new contacts to folder share
            if (targets.length > 0) {
                promise = doShare(selectedNode, targets, true);
            }
        }

        return promise || Promise.resolve();
    };

    Share.prototype.updateNodeShares = function() {

        loadingDialog.show();
        return this.removeContactFromShare()
            .then(() => {
                const promises = [];

                if (Object.keys($.changedPermissions).length > 0) {
                    promises.push(doShare($.selected[0], Object.values($.changedPermissions), true));
                }
                promises.push(this.addContactToFolderShare());

                $('.export-links-warning').addClass('hidden');
                console.assert($.dialog === 'share');
                closeDialog();

                return Promise.all(promises);
            })
            .finally(() => loadingDialog.hide());

    };


    Share.prototype.removeFromPermissionQueue = function(handle) {
        // Remove the permission change belongs to the specific contact since got removed already
        if ($.changedPermissions && $.changedPermissions[handle]) {
            delete $.changedPermissions[handle];
        }
    };

    Share.prototype.removeContactFromShare = async function() {
        const reqs = Object.create(null);
        const shares = $.removedContactsFromShare ? Object.values($.removedContactsFromShare) : [];

        for (let i = shares.length; i--;) {
            const {userEmailOrHandle, selectedNodeHandle} = shares[i];

            if (!reqs[selectedNodeHandle]) {
                reqs[selectedNodeHandle] = {a: 's2', n: selectedNodeHandle, s: [], ha: ''};
            }
            reqs[selectedNodeHandle].s.push({u: userEmailOrHandle, r: ''});
        }

        // Wait for action-packet acknowledge, this is needed so that removing the last user
        // from a share will issue an `okd` flag which removes the associated sharekey that we
        // have to wait for *if* we're going to re-share to a different user next...

        const reject = (err) => {
            const msg = api_strerror(err);

            onIdle(() => msgDialog('warninga', l[135], l[47], err < 0 ? msg : l[23433]));
            throw new Error(`Failed to revoke share, ${msg}`);
        };

        const resolve = ({result: res, pkt}) => {
            for (let i = pkt.length; i--;) {
                const packet = pkt[i];

                if (d) {
                    console.assert(u_sharekeys[packet.n], 'Share-key removed...', packet);
                }

                // Known [u]ser, or [p]ending-contact
                this.removeFromPermissionQueue(packet.u || packet.p);
            }

            if (typeof res !== 'object') {
                res = {r: [parseInt(res) || EACCESS]};
            }

            for (let i = Object(res.r).length; i--;) {
                if (res.r[i] !== 0) {
                    reject(res.r[i]);
                }
            }
        };

        return Promise.all(Object.values(reqs).map((s2) => api.screq(s2).then(resolve)));
    };

    /**
     * Removes any shares (including pending) from the selected node.
     *
     * @returns {Promise} promise to remove contacts from share
     */
    Share.prototype.removeSharesFromSelected = function() {
        'use strict';
        $.removedContactsFromShare = {};
        const nodeHandle = String($.selected[0]);
        let userHandles = M.getNodeShareUsers(nodeHandle, 'EXP');

        if (M.ps[nodeHandle]) {
            const pendingShares = Object(M.ps[nodeHandle]);
            userHandles = [...userHandles, ...Object.keys(pendingShares)];
        }

        for (let i = 0; i < userHandles.length; i++) {
            const userHandle = userHandles[i];
            const userEmailOrHandle = Object(M.opc[userHandle]).m || userHandle;

            $.removedContactsFromShare[userHandle] = {
                'selectedNodeHandle': nodeHandle,
                'userEmailOrHandle': userEmailOrHandle,
                'userHandle': userHandle
            };
        }

        return this.removeContactFromShare();
    };

    // export
    scope.mega.Share = Share;
})(jQuery, window);



(function(scope) {
    /** Utilities for Set operations. */
    scope.setutils = {};

    /**
     * Helper function that will return an intersect Set of two sets given.
     *
     * @private
     * @param {Set} set1
     *     First set to intersect with.
     * @param {Set} set2
     *     Second set to intersect with.
     * @return {Set}
     *     Intersected result set.
     */
    scope.setutils.intersection = function(set1, set2) {

        var result = new Set();
        set1.forEach(function _setIntersectionIterator(item) {
            if (set2.has(item)) {
                result.add(item);
            }
        });

        return result;
    };


    /**
     * Helper function that will return a joined Set of two sets given.
     *
     * @private
     * @param {Set} set1
     *     First set to join with.
     * @param {Set} set2
     *     Second set to join with.
     * @return {Set}
     *     Joined result set.
     */
    scope.setutils.join = function(set1, set2) {

        var result = new Set(set1);
        set2.forEach(function _setJoinIterator(item) {
            result.add(item);
        });

        return result;
    };

    /**
     * Helper function that will return a Set from set1 subtracting set2.
     *
     * @private
     * @param {Set} set1
     *     First set to subtract from.
     * @param {Set} set2
     *     Second set to subtract.
     * @return {Set}
     *     Subtracted result set.
     */
    scope.setutils.subtract = function(set1, set2) {

        var result = new Set(set1);
        set2.forEach(function _setSubtractIterator(item) {
            result.delete(item);
        });

        return result;
    };

    /**
     * Helper function that will compare two Sets for equality.
     *
     * @private
     * @param {Set} set1
     *     First set to compare.
     * @param {Set} set2
     *     Second set to compare.
     * @return {Boolean}
     *     `true` if the sets are equal, `false` otherwise.
     */
    scope.setutils.equal = function(set1, set2) {

        if (set1.size !== set2.size) {
            return false;
        }

        var result = true;
        set1.forEach(function _setEqualityIterator(item) {
            if (!set2.has(item)) {
                result = false;
            }
        });

        return result;
    };
})(window);

/**
 * Transoms the numerical preferences to preferences view object
 * @param {Number} pref     Integer value representing the preferences
 * @returns {Object}        View preferences object
 */
function getFMColPrefs(pref) {
    'use strict';
    if (pref === undefined) {
        return;
    }
    var columnsPreferences = Object.create(null);
    columnsPreferences.fav = pref & 4;
    columnsPreferences.label = pref & 1;
    columnsPreferences.size = pref & 8;
    columnsPreferences.type = pref & 64;
    columnsPreferences.timeAd = pref & 32;
    columnsPreferences.timeMd = pref & 16;
    columnsPreferences.versions = pref & 2;
    columnsPreferences.playtime = pref & 128;
    columnsPreferences.accessCtrl = pref & 256;
    columnsPreferences.fileLoc = pref & 512;

    return columnsPreferences;
}

/**
 * Get the number needed for bitwise operator
 * @param {String} colName      Column name
 * @returns {Number}            Number to be used in bitwise operator
 */
function getNumberColPrefs(colName) {
    'use strict';
    switch (colName) {
        case 'fav': return 4;
        case 'label': return 1;
        case 'size': return 8;
        case 'type': return 64;
        case 'timeAd': return 32;
        case 'timeMd': return 16;
        case 'versions': return 2;
        case 'playtime': return 128;
        case 'accessCtrl': return 256;
        case 'fileLoc': return 512;
        default: return null;
    }
}

function invalidLinkError() {
    'use strict';
    loadingInitDialog.hide();

    loadfm.loaded = false;
    loadfm.loading = false;
    if (!is_mobile) {
        var title = l[8531];
        var message = l[17557];
        msgDialog('warninga', title, message, false, function () {
            // If the user is logged-in, he'll be redirected to the cloud
            loadSubPage('login');
        });
    }
    else {
        // Show file/folder not found overlay
        mobile.notFound.show();
    }
}

/**
 * Classifies the strength of the password (Mainly used on the MegaInputs)
 * ZXCVBN library need to be inited before executing this function.
 * The minimum allowed strength is 8 characters in length and password score of 1 (weak).
 * @param {String} password The user's password (should be trimmed for whitespace beforehand)
 */
function classifyPassword(password) {

    'use strict';

    if (typeof zxcvbn !== 'function') {
        onIdle(() => {
            throw new Error('zxcvbn init fault');
        });
        console.error('zxcvbn is not inited');
        return false;
    }

    // Calculate the password score using the ZXCVBN library and its length
    password = $.trim(password);
    var passwordScore = zxcvbn(password).score;
    var passwordLength = password.length;
    var result = {};

    if (passwordLength === 0) {
        return false;
    }
    else if (passwordLength < security.minPasswordLength) {
        result = {
            string1: l[18700],
            string2: l[18701],                      // Your password needs to be at least 8 characters long
            className: 'good1',                     // Very weak
            statusClass: 'insufficient-strength'
        };
    }
    else if (passwordScore === 4) {
        result = {
            string1: l[1128],
            string2: l[1123],
            className: 'good5',                     // Strong
            statusClass: 'meets-minimum-strength'
        };
    }
    else if (passwordScore === 3) {
        result = {
            string1: l[1127],
            string2: l[1122],
            className: 'good4',                     // Good
            statusClass: 'meets-minimum-strength'
        };
    }
    else if (passwordScore === 2) {
        result = {
            string1: l[1126],
            string2: l[1121],
            className: 'good3',                     // Medium
            statusClass: 'meets-minimum-strength'
        };
    }
    else if (passwordScore === 1) {
        result = {
            string1: l[1125],
            string2: l[1120],
            className: 'good2',                     // Weak
            statusClass: 'meets-minimum-strength'
        };
    }
    else {
        result = {
            string1: l[1124],
            string2: l[1119],
            className: 'good1',                     // Very weak
            statusClass: 'insufficient-strength'
        };
    }

    return result;
}

/**
 * A function to get the last day of the month
 * @param {Date} dateObj        The Date for which to return the last day of the month
 * @returns {Date}              the result date object with the last day of the month
 */
function getLastDayofTheMonth(dateObj) {
    "use strict";
    if (!dateObj) {
        return null;
    }

    var day;
    var month = dateObj.getMonth();
    var year = dateObj.getFullYear();
    if ([0, 2, 4, 6, 7, 9, 11].indexOf(month) >= 0) {
        day = 31;
    }
    else if (month === 1) {
        if (year % 4 !== 0) {
            day = 28;
        }
        else if (year % 100 !== 0) {
            day = 29;
        }
        else if (year % 400 !== 0) {
            day = 28;
        }
        else {
            day = 29;
        }
    }
    else {
        day = 30;
    }
    return new Date(year, month, day);
}

/**
 * Block Chrome Password manager for password field with attribute `autocomplete="new-password"`
 */
function blockChromePasswordManager() {

    "use strict";

    if (window.chrome) {
        var $newPasswordField = $('input[type="password"][autocomplete="new-password"]');
        var switchReadonly = function __switchReadonly(input) {

            input.setAttribute('readonly', true);
            onIdle(function() {
                input.removeAttribute('readonly');
            });
        };

        $newPasswordField.rebind('focus.blockAutofill mousedown.blockAutofill', function() {
            switchReadonly(this);
        });

        // For prevent last chracter deletion pops up password manager
        $newPasswordField.rebind('keydown.blockAutofill', function(e) {

            if ((e.keyCode === 8 &&
                ((this.selectionStart === 1 && this.selectionEnd === 1) ||
                (this.selectionStart === 0 && this.selectionEnd === this.value.length))) ||
                (e.keyCode === 46 &&
                ((this.selectionStart === 0 && this.selectionEnd === 0 && this.value.length === 1) ||
                (this.selectionStart === 0 && this.selectionEnd === this.value.length)))) {
                e.preventDefault();
                this.value = '';
            }
        });
    }
}

/**
 * Attach the download file link handler
 * Use in /desktop and /cmd
 * @param $links
 */
/*exported registerLinuxDownloadButton */
function registerLinuxDownloadButton($links) {
    'use strict';
    $links.rebind('click', function() {
        var $link = $(this);
        if (!$link.hasClass('disabled') && $link.attr('data-link')) {
            window.location = $link.attr('data-link');
        }
        return false;
    });
}
/* eslint-disable complexity */
/**
 * Function that takes users attributes, then prepare content texts of ODQ paywall dialog
 * @param {Object} user_attr        u_attr or {}
 * @param {Object} accountData      M.account, caller must populate then pass
 * @returns {Object}                contains {dialogText, dlgFooterText,fmBannerText}
 */
function odqPaywallDialogTexts(user_attr, accountData) {
    'use strict';

    var totalFiles = (accountData.stats[M.RootID] ? accountData.stats[M.RootID].files : 0) +
        (accountData.stats[M.RubbishID] ? accountData.stats[M.RubbishID].files : 0) +
        (accountData.stats[M.InboxID] ? accountData.stats[M.InboxID].files : 0);

    var dialogText = mega.icu.format(l[23525], totalFiles);
    var dlgFooterText = l[23524];
    var fmBannerText = l[23534];

    if (user_attr.uspw) {
        if (user_attr.uspw.dl) {
            var deadline = new Date(user_attr.uspw.dl * 1000);
            var currDate = new Date();
            var remainDays = Math.floor((deadline - currDate) / 864e5);
            var remainHours = Math.floor((deadline - currDate) / 36e5);

            const sanitiseString = (string) => {
                return escapeHTML(string)
                    .replace(/\[S]/g, '<span>')
                    .replace(/\[\/S]/g, '</span>')
                    .replace(/\[A]/g, '<a href="/pro" class="clickurl">')
                    .replace(/\[\/A]/g, '</a>');
            };
            if (remainDays > 0) {
                dlgFooterText = sanitiseString(mega.icu.format(l.dialog_exceed_storage_quota, remainDays));
                fmBannerText = sanitiseString(mega.icu.format(l.fm_banner_exceed_storage_quota, remainDays));
            }
            else if (remainDays === 0 && remainHours > 0) {
                dlgFooterText = sanitiseString(mega.icu.format(l.dialog_exceed_storage_quota_hours, remainHours));
            }
        }
        if (user_attr.uspw.wts && user_attr.uspw.wts.length) {
            dialogText = mega.icu.format(l[23520], totalFiles);
            if (user_attr.uspw.wts.length === 1) {
                dialogText = mega.icu.format(l[23530], totalFiles);
                dialogText = dialogText.replace('%2', time2date(user_attr.uspw.wts[0], 1));
            }
            if (user_attr.uspw.wts.length === 2) {
                dialogText = dialogText.replace('%2', time2date(user_attr.uspw.wts[0], 1)).replace('%3', '')
                    .replace('%4', time2date(user_attr.uspw.wts[1], 1));
            }
            else if (user_attr.uspw.wts.length === 3) {
                dialogText = dialogText.replace('%2', time2date(user_attr.uspw.wts[0], 1))
                    .replace('%3', time2date(user_attr.uspw.wts[1], 1))
                    .replace('%4', time2date(user_attr.uspw.wts[2], 1));
            }
            else {
                // more than 3
                var datesString = time2date(user_attr.uspw.wts[1], 1);
                for (var k = 2; k < user_attr.uspw.wts.length - 1; k++) {
                    datesString += ', ' + time2date(user_attr.uspw.wts[k], 1);
                }

                dialogText = dialogText.replace('%2', time2date(user_attr.uspw.wts[0], 1))
                    .replace('%3', datesString)
                    .replace('%4', time2date(user_attr.uspw.wts[user_attr.uspw.wts.length - 1], 1));
            }
        }
    }

    var filesText = l[23253]; // 0 files

    dialogText = dialogText.replace('%1', user_attr.email || ' ');
    dialogText = dialogText.replace('%6', bytesToSize(accountData.space_used));

    // In here, it's guaranteed that we have pro.membershipPlans,
    // but we will check for error free logic in case of changes
    let neededPro = 4;
    const minPlan = pro.filter.lowestRequired(accountData.space_used, 'storageTransferDialogs');

    if (minPlan) {
        neededPro = minPlan[pro.UTQA_RES_INDEX_ACCOUNTLEVEL];
    }
    else {
        // weirdly, we dont have plans loaded, or no plan matched the storage.
        if (user_attr.p) {
            neededPro = user_attr.p + 1;
            if (neededPro === 3) {
                neededPro = 100;
            }
            else if (neededPro === 5) {
                neededPro = 1;
            }
        }
    }

    dialogText = dialogText.replace('%7', pro.getProPlanName(neededPro));

    return {
        dialogText: dialogText,
        dlgFooterText: dlgFooterText,
        fmBannerText: fmBannerText
    };
}


function getTaxName(countryCode) {
    'use strict';
    switch (countryCode) {
        case "AT": return "USt";
        case "BE": return "TVA";
        case "HR": return "PDV";
        case "CZ": return "DPH";
        case "DK": return "moms";
        case "EE": return "km";
        case "FI": return "ALV";
        case "FR": return "TVA";
        case "DE": return "USt";
        case "HU": return "AFA";
        case "IT": return "IVA";
        case "LV": return "PVN";
        case "LT": return "PVM";
        case "LU": return "TVA";
        case "NL": return "BTW";
        case "PL": return "PTU";
        case "PT": return "IVA";
        case "RO": return "TVA";
        case "SK": return "DPH";
        case "SI": return "DDV";
        case "SE": return "MOMS";
        case "AL": return "TVSH";
        case "AD": return "IGI";
        case "AR": return "IVA";
        case "AM": return "AAH";
        case "AU": return "GST";
        case "BO": return "IVA";
        case "BA": return "PDV";
        case "BR": return "ICMS";
        case "CA": return "GST";
        case "CL": return "IVA";
        case "CO": return "IVA";
        case "DO": return "ITBIS";
        case "EC": return "IVA";
        case "SV": return "IVA";
        case "FO": return "MVG";
        case "GT": return "IVA";
        case "IS": return "VSK";
        case "ID": return "PPN";
        case "JE": return "GST";
        case "JO": return "GST";
        case "LB": return "TVA";
        case "LI": return "MWST";
        case "MK": return "DDV";
        case "MY": return "GST";
        case "MV": return "GST";
        case "MX": return "IVA";
        case "MD": return "TVA";
        case "MC": return "TVA";
        case "ME": return "PDV";
        case "MA": return "GST";
        case "NZ": return "GST";
        case "NO": return "MVA";
        case "PK": return "GST";
        case "PA": return "ITBMS";
        case "PY": return "IVA";
        case "PE": return "IGV";
        case "PH": return "RVAT";
        case "RU": return "NDS";
        case "SG": return "GST";
        case "CH": return "MWST";
        case "TN": return "TVA";
        case "TR": return "KDV";
        case "UA": return "PDV";
        case "UY": return "IVA";
        case "UZ": return "QQS";
        case "VN": return "GTGT";
        case "VE": return "IVA";
        case "ES": return "NIF";

        default: return "VAT";
    }
}
/* eslint-enable complexity */

/**
 * Validate entered address is on correct structure, if there is more type of bitcoin structure please update.
 * Reference - https://stackoverflow.com/a/59756959
 * Use in Referral program redemption
 * @param {String} address Bitcoin address
 *
 * @returns {Boolean} result Validity of entered address
 */
function validateBitcoinAddress(address) {

    'use strict';

    return address.match(/(^[13][\1-9A-HJ-NP-Za-km-z]{25,34}$)|(^(bc1)[\dA-HJ-NP-Za-z]{8,87}$)/) === null;
}

(function __fmconfig_handler() {
    "use strict";

    let timer;
    const ns = Object.create(null);
    const privy = Object.create(null);
    const oHasOwn = {}.hasOwnProperty;
    const hasOwn = (o, p) => oHasOwn.call(o, p);
    const oLen = (o) => Object.keys(o || {}).length;
    const parse = tryCatch(v => JSON.parse(v), false);
    const stringify = tryCatch(v => JSON.stringify(v));
    const logger = MegaLogger.getLogger('fmconfig');
    const MMH_SEED = 0x7fee1ef;

    /** @property privy.ht */
    lazy(privy, 'ht', () => {
        return MurmurHash3('ht!' + u_handle + base64urldecode(u_handle), MMH_SEED).toString(16);
    });

    /**
     * Move former/legacy settings stored in localStorage
     * @private
     */
    const moveLegacySettings = function() {
        const prefs = [
            'agreedToCopyrightWarning', 'dl_maxSlots', 'font_size',
            'leftPaneWidth', 'mobileGridViewModeEnabled', 'ul_maxSlots', 'ul_maxSpeed'
        ];
        const replacements = {
            'agreedToCopyrightWarning': 'cws',
            'mobileGridViewModeEnabled': 'mgvm'
        };

        for (let i = prefs.length; i--;) {
            const pref = prefs[i];

            if (localStorage[pref] !== undefined) {
                const p = replacements[pref] || pref;

                if (fmconfig[p] === undefined) {
                    mega.config.set(p, parseInt(localStorage[pref]) | 0);
                }
            }
        }
    };

    // shrink suitable fmconfig settings
    const shrink = (cfg) => {
        if (d) {
            console.time('fmconfig.shrink');
        }

        // eslint-disable-next-line guard-for-in
        for (let slot in shrink.bitdef) {
            let bit = 0;
            let def = shrink.bitdef[slot];

            for (let i = def.length; i--;) {
                const k = def[i];
                const v = 1 << i;

                if (cfg[k] !== undefined) {
                    if (parse(cfg[k]) | 0) {
                        bit |= v;
                    }
                    delete cfg[k];
                }
            }

            cfg[slot] = stringify(bit);
        }

        cfg.xs1 = stringify(
            (cfg.obVer & 0xfff) << 20 | (cfg.font_size & 15) << 12 | cfg.leftPaneWidth & 0xfff
        );
        delete cfg.font_size;
        delete cfg.leftPaneWidth;
        delete cfg.obVer;

        let s = cfg.ul_maxSpeed;
        s = s / 1024 << 1 | (s < 0 ? 1 : 0);
        cfg.xs2 = stringify((s & 0xfffff) << 8 | (cfg.ul_maxSlots & 15) << 4 | cfg.dl_maxSlots & 15);
        delete cfg.ul_maxSpeed;
        delete cfg.ul_maxSlots;
        delete cfg.dl_maxSlots;

        if (cfg.viewercfg) {
            const xs3 = parse(cfg.viewercfg) || {};
            cfg.xs3 = stringify(xs3.speed << 16 | xs3.order << 8 | xs3.repeat << 1 | xs3.sub);
            delete cfg.viewercfg;
        }

        if (cfg.treenodes) {
            cfg.xtn = shrink.tree(cfg.treenodes);
            delete cfg.treenodes;
        }

        if (cfg.viewmodes) {
            cfg.xvm = shrink.views(cfg.viewmodes);
            delete cfg.viewmodes;
        }
        shrink.sorta(cfg);
        shrink.cleanup(cfg);

        if (d) {
            console.timeEnd('fmconfig.shrink');
        }
        return cfg;
    };

    shrink.bitdef = freeze({
        v04: ['rvonbrddl', 'rvonbrdfd', 'rvonbrdas'],
        xb1: [
            // do NOT change the order, add new entries at the tail UP TO 31, and 8 per row.
            'cws', 'ctt', 'viewmode', 'dbDropOnLogout', 'dlThroughMEGAsync', 'sdss', 'tpp', 'ulddd',
            'cbvm', 'mgvm', 'uiviewmode', 'uisorting', 'uidateformat', 'skipsmsbanner', 'skipDelWarning', 's4thumbs',
            'nowarnpl', 'zip64n', 'callemptytout', 'callinout', 'showHideChat', 'showRecents', 'nocallsup', 'cslrem',
            'rsv2', 'noSubfolderMd'
        ]
    });
    shrink.zero = new Set([...Object.keys(shrink.bitdef), 'xs1', 'xs2', 'xs3', 'xs4', 'xs5']);

    shrink.cleanup = (cfg) => {

        for (const key in cfg) {
            const value = cfg[key];

            if (!value || value === '0' && shrink.zero.has(key)) {
                if (d) {
                    logger.info('Skipping zero value for "%s"', key);
                }
                delete cfg[key];
            }
        }
    };

    shrink.tree = (nodes) => {
        let v = '';
        const tn = Object.keys(parse(nodes) || {});
        const pfx = freeze({'o': '1', 'p': '2'});

        for (let i = 0; i < tn.length; ++i) {
            const k = tn[i];
            v += (k[2] === '_' && pfx[k[0]] || '0') + base64urldecode(k.substr(-8));
        }
        return v;
    };

    shrink.views = (nodes) => {
        let r = '';
        const v = parse(nodes);
        const s = Object.keys(v || {});

        for (let i = 0; i < s.length; ++i) {
            const h = s[i];
            const n = (h.length === 8 || h.length === 11) | 0;
            const j = n ? base64urldecode(h) : h;

            r += String.fromCharCode(j.length << 2 | (v[h] & 1) << 1 | n) + j;
        }

        return r;
    };

    shrink.sorta = (config) => {
        const tsort = config.sorting && parse(config.sorting);
        const rules = shrink.sorta.rules = shrink.sorta.rules || Object.keys(M.sortRules || {});
        const shift = o => rules.indexOf(o.n) << 1 | (o.d < 0 ? 1 : 0);
        const store = n => String.fromCharCode(n);
        let res = store(tsort ? shift(tsort) : 0);

        if (config.sortmodes) {
            const sm = Object.assign(Object.create(null), parse(config.sortmodes));

            // eslint-disable-next-line guard-for-in
            for (let h in sm) {
                const v = sm[h];
                const n = (h.length === 8 || h.length === 11) | 0;
                const p = n ? base64urldecode(h) : h;

                if (!rules.includes(v.n)) {
                    logger.warn(`Invalid sort-mode for ${h} %o`, v);
                    continue;
                }

                res += store(shift(v)) + store(p.length << 1 | n) + p;
            }
        }

        config.xsm = res;
        delete config.sorting;
        delete config.sortmodes;
    };
    shrink.sorta.rules = null;

    // stretch previously shrunk settings
    const stretch = (config) => {
        if (d) {
            console.time('fmconfig.stretch');
        }

        // eslint-disable-next-line guard-for-in
        for (let slot in shrink.bitdef) {
            let def = shrink.bitdef[slot];

            for (let i = def.length; i--;) {
                const k = def[i];
                const v = 1 << i;

                if (config[slot] & v) {
                    config[k] = 1;
                }
            }
        }

        if (config.xs1) {
            config.font_size = config.xs1 >> 12 & 15;
            config.leftPaneWidth = config.xs1 & 0xfff;
            config.obVer = config.xs1 >> 20;
        }

        if (config.xs2) {
            let s = config.xs2 >> 8;
            config.dl_maxSlots = config.xs2 & 15;
            config.ul_maxSlots = config.xs2 >> 4 & 15;
            config.ul_maxSpeed = s & 1 ? -1 : (s >> 1) * 1024;
        }

        if (config.xs3) {
            config.viewercfg = {};
            config.viewercfg.speed = config.xs3 >> 16 & 0xFF;
            config.viewercfg.order = config.xs3 >> 8 & 0xFF;
            config.viewercfg.repeat = config.xs3 >> 1 & 1;
            config.viewercfg.sub = config.xs3 & 1;
        }

        if (config.xtn) {
            config.treenodes = stretch.tree(config.xtn);
            delete config.xtn;
        }

        if (config.xvm) {
            config.viewmodes = stretch.views(config.xvm);
            delete config.xvm;
        }

        if (config.xsm) {
            stretch.sorta(config);
        }

        if (d) {
            console.timeEnd('fmconfig.stretch');
        }
        return config;
    };

    stretch.tree = (xtn) => {
        const t = Object.create(null);
        const p = freeze({'0': '', '1': 'os_', '2': 'pl_'});

        for (let i = 0; i < xtn.length; i += 7) {
            t[p[xtn[i]] + base64urlencode(xtn.substr(i + 1, 6))] = 1;
        }
        return t;
    };

    stretch.views = (xvm) => {
        const v = Object.create(null);

        for (let i = 0; i < xvm.length;) {
            let b = xvm.charCodeAt(i);
            let l = b >> 2;
            let h = xvm.substr(i + 1, l);

            v[b & 1 ? base64urlencode(h) : h] = b >> 1 & 1;

            i += ++l;
        }
        return v;
    };

    stretch.sorta = (config) => {
        const {xsm} = config;
        const rules = shrink.sorta.rules = shrink.sorta.rules || Object.keys(M.sortRules || {});

        let tmp = xsm.charCodeAt(0);
        config.sorting = {n: rules[tmp >> 1], d: tmp & 1 ? -1 : 1};

        tmp = Object.create(null);
        for (let i = 1; i < xsm.length;) {
            const a = xsm.charCodeAt(i);
            const b = xsm.charCodeAt(i + 1);
            const h = xsm.substr(i + 2, b >> 1);

            tmp[b & 1 ? base64urlencode(h) : h] = {n: rules[a >> 1], d: a & 1 ? -1 : 1};
            i += 2 + (b >> 1);
        }

        delete config.xsm;
        config.sortmodes = tmp;
    };

    // sanitize fmconfig
    const filter = async(fmconfig) => {
        const config = Object.create(null);
        const nodeType = freeze({viewmodes: 1, sortmodes: 1, treenodes: 1});
        const nTreeFilter = await filter.tree(fmconfig, nodeType);

        for (const key in fmconfig) {
            if (hasOwn(fmconfig, key)) {
                let value = fmconfig[key];

                if (!value && value !== 0) {
                    logger.info('Skipping empty value for "%s"', key);
                    continue;
                }

                // Dont save no longer existing nodes
                if (nodeType[key]) {
                    if (typeof value !== 'object') {
                        logger.warn('Unexpected type for ' + key);
                        continue;
                    }
                    value = nTreeFilter(value);
                }

                if (typeof value === 'object' && !oLen(value)) {
                    logger.info('Skipping empty object "%s"', key);
                    continue;
                }

                config[key] = typeof value === 'string' ? value : stringify(value);

                if (!(config[key] && config[key].length > 0 && config[key].length < 65535)) {
                    logger.info('Skipping "%s" with invalid value...', key);
                    delete config[key];
                }
            }
        }

        return shrink(config);
    };

    // get node tree sanitizer.
    filter.tree = async(config, types) => {
        const echo = v => v;
        if (pfid) {
            // @todo LRU cache?
            return echo;
        }

        const handles = array.unique(
            Object.keys(types)
                .reduce((s, v) => Object.keys(config[v] || {})
                    .map(h => M.isCustomView(h).nodeID || h).concat(s), [])
                .filter(s => s.length === 8 && s !== 'contacts')
        );

        if (handles.length < 200) {
            return echo;
        }

        const nodes = await dbfetch.node(handles).catch(nop) || [];
        for (let i = nodes.length; i--;) {
            nodes[nodes[i].h] = true;
        }

        const isValid = (handle) => {
            const cv = M.isCustomView(handle);
            handle = cv.nodeID || handle;
            return handle.length !== 8 || nodes[handle] || handle === 'contacts' || handle === cv.type;
        };

        return (tree) => {
            const result = Object.create(null);

            for (let handle in tree) {
                if (hasOwn(tree, handle)
                    && handle.substr(0, 7) !== 'search/'
                    && isValid(handle)) {

                    result[handle] = tree[handle];
                }
                else {
                    logger.info('Skipping non-existing node "%s"', handle);
                }
            }
            return result;
        };
    };

    // Save fmconfig into WebStorage.
    const saveLocally = async() => {
        let storage = localStorage;

        /**
        if ('csp' in window) {
            await csp.init();

            if (!csp.has('pref')) {
                storage = sessionStorage;
            }
        }
        /**/

        const config = await filter(fmconfig).catch(dump);

        tryCatch(data => {
            data = `\x1f${tlvstore.encode(data, false)}`;
            if (data.length > 262144) {
                logger.warn('fmconfig became larger than 256KB', data.length);
            }
            storage.fmconfig = data;
        }, ex => {
            if (ex.name === 'QuotaExceededError') {
                if (d) {
                    console.warn('WebStorage exhausted!', [fmconfig], stringify(storage).length);
                }

                if (!u_type) {
                    // The user is not logged/registered, let's just expunge it...
                    console.info('Cleaning fmconfig... (%s bytes)', String(storage.fmconfig).length);
                    delete storage.fmconfig;
                }
            }
        })(config);
    };

    /**
     * Pick the global `fmconfig` and sanitize it before
     * sending it to the server, as per TLV requirements.
     * @private
     */
    const store = mutex('fmconfig:store.mutex', async(resolve) => {
        if (!window.u_handle) {
            throw new Error('Unable to store fmconfig in the current context.');
        }

        const exit = (rc, message) => {
            if (d) {
                console.timeEnd('fmconfig.store');
                if (message) {
                    logger.debug(message);
                }
            }
            resolve(rc);
            return rc;
        };

        let str;
        let len;
        const fmconfig = window.fmconfig || {};

        if (d) {
            str = stringify(fmconfig);
            len = str.length;
            console.time('fmconfig.store');
            logger.debug('fmconfig.store:begin (%d bytes)', len, str);
        }

        const config = await filter(fmconfig).catch(dump);
        if (typeof config !== 'object' || !oLen(config)) {
            return exit(ENOENT, 'Not saving fmconfig, invalid...');
        }
        str = stringify(config).replace(/\\u.{4}/g, n => parseInt(n.substr(2), 16));

        if (d) {
            logger.debug('fmconfig.store:end (%d bytes saved)', len - str.length, str);
        }

        len = str.length;

        if (len < 8) {
            return exit(EARGS, 'Not saving fmconfig, data too short...');
        }
        if (len > 12000) {
            return exit(EOVERQUOTA, 'Not saving fmconfig, data exceeds maximum allowed...');
        }

        // generate checksum/hash for the config
        const hash = MurmurHash3(str, MMH_SEED);
        const tag = 'fmc!' + privy.ht;

        // dont store it unless it has changed
        if (hash === localStorage[tag] >>> 0) {
            return exit(EEXIST, 'Not saving fmconfig, unchanged...');
        }

        // fmconfig may changed in our side, but not in server, check it.
        let attr = await Promise.resolve(mega.attr.get(u_handle, 'fmconfig', false, true)).catch(nop);
        if (stringify(attr) === stringify(config)) {
            logger.debug('remote syncing completed.', attr);
        }
        else {
            attr = mega.attr.set2(null, 'fmconfig', config, false, true);
        }

        localStorage[tag] = hash;
        timer = Promise.resolve(attr)
            .catch(dump)
            .then(() => {
                timer = 0;
            });

        return exit(await timer);
    });

    // issue fmconfig persistence upon change.
    const push = () => {
        if (u_type > 2) {
            // through a timer to prevent floods
            timer = delay('fmconfig:store', () => store().catch(dump), 2600);
        }
        else {
            timer = null;
            delay('fmconfig:store', saveLocally, 3401);
        }
    };

    // Real-time update upon fmconfig syncing.
    const refresh = () => {
        if (fminitialized) {
            refresh.ui();
        }

        if (fmconfig.ul_maxSlots) {
            ulQueue.setSize(fmconfig.ul_maxSlots);
        }

        if (fmconfig.dl_maxSlots) {
            dlQueue.setSize(fmconfig.dl_maxSlots);
        }

        if (fmconfig.font_size && !document.body.classList.contains('fontsize' + fmconfig.font_size)) {
            document.body.classList.remove('fontsize1', 'fontsize2');
            document.body.classList.add('fontsize' + fmconfig.font_size);
        }

        if (fmconfig.fmColPrefs) {
            const prefs = getFMColPrefs(fmconfig.fmColPrefs);
            for (let colPref in prefs) {
                if (hasOwn(prefs, colPref)) {
                    M.columnsWidth.cloud[colPref].viewed = prefs[colPref] > 0;
                }
            }

            if (M.currentrootid === M.RubbishID) {
                M.columnsWidth.cloud.fav.disabled = true;
                M.columnsWidth.cloud.fav.viewed = false;
            }
        }
    };

    refresh.ui = () => {
        if (M.recentsRender) {
            M.recentsRender.checkStatusChange();
        }

        if (fmconfig.webtheme !== undefined) {
            mega.ui.setTheme(fmconfig.webtheme);
        }

        if (M.account && page.indexOf('fm/account') > -1) {
            if (!is_mobile) {
                accountUI.renderAccountPage(M.account);
            }
            else if (page === 'fm/account/notifications') {
                mobile.settings.notifications.render();
            }
            else if (page === 'fm/account/file-management') {
                mobile.settings.fileManagement.render();
            }

            return;
        }

        const view = Object(fmconfig.viewmodes)[M.currentdirid];
        const sort = Object(fmconfig.sortmodes)[M.currentdirid];

        if (view !== undefined && M.viewmode !== view
            || sort !== undefined && (sort.n !== M.sortmode.n || sort.d !== M.sortmode.d)) {

            M.openFolder(M.currentdirid, true);
        }

        if (M.currentrootid === M.RootID) {
            const tree = Object(fmconfig.treenodes);

            if (stringify(tree) !== M.treenodes) {

                M.renderTree();
            }
        }
    };

    // @private
    const define = (target, key, value) => {

        if (d) {
            if (value === undefined) {
                logger.debug('Removing "%s"', key);
            }
            else {
                logger.debug('Setting value for key "%s"', key, value);

                if (String(stringify(value)).length > 3072) {
                    logger.warn('Attempting to store more than 3KB for %s...', key);
                }
            }
        }

        if (typeof value === 'boolean') {
            logger.warn(`Invalid boolean value for ${key}`);
            value = +value;
        }
        if (typeof key !== 'string' || !/^[a-z]\w{1,16}$/.test(key)) {
            logger.error(`Invalid config property key: ${key}`);

            if (value !== undefined) {
                return false;
            }
        }

        const rc = value === undefined ? Reflect.deleteProperty(target, key) : Reflect.set(target, key, value);

        if (fminitialized) {
            queueMicrotask(push);
        }
        else if (timer !== -MMH_SEED) {
            timer = -MMH_SEED;
            mBroadcaster.once('fm:initialized', push);
        }

        mBroadcaster.sendMessage('fmconfig:' + key, value);

        return rc;
    };

    // Initialize fmconfig.
    const setup = (config) => {
        if (config) {
            const proto = Object.getPrototypeOf(config);
            if (proto !== null && proto !== Object.prototype) {
                logger.warn('Starting afresh with new config store...', config);
                config = null;
            }
        }
        config = stretch(Object.assign(Object.create(null), config));

        delete window.fmconfig;
        Object.defineProperty(window, 'fmconfig', {
            configurable: true,
            value: new Proxy(config, {
                set(target, prop, value) {
                    return define(target, prop, value);
                },
                deleteProperty(target, prop) {
                    return define(target, prop, undefined);
                }
            })
        });

        moveLegacySettings();

        for (const key in fmconfig) {
            let value = fmconfig[key];

            if (key.includes('firefox')
                || key.startsWith('confirmModal_')) {

                mega.config.remove(key);
                continue;
            }

            if (typeof value === 'string') {
                value = parse(fmconfig[key]);

                if (value === undefined) {
                    value = fmconfig[key];
                }
            }

            mega.config.set(key, value);
        }

        refresh();
    };

    /**
     * Fetch server-side config.
     * @return {Promise}
     */
    ns.fetch = async function _fetchConfig() {
        if (!u_handle) {
            throw new Error('Unable to fetch fmconfig in the current context.');
        }
        setup(await Promise.resolve(mega.attr.get(u_handle, 'fmconfig', false, true)).catch(nop));

        // disable client-side rubbish scheduler
        if (u_attr.flags.ssrs > 0) {
            mega.config.remove('rubsched');
        }

        // Initialize account notifications.
        mega.notif.setup(fmconfig.anf);
    };

    /**
     * Sync settings whenever logging in under a folder-link.
     * @return {Promise<void>}
     */
    ns.sync = async function() {
        const old = freeze({...window.fmconfig});
        await this.fetch();

        this.set('viewmodes', {...fmconfig.viewmodes, ...old.viewmodes});
        this.set('sortmodes', {...fmconfig.sortmodes, ...old.sortmodes});
        this.set('treenodes', {...fmconfig.treenodes, ...old.treenodes});
    };

    /**
     * Flush any pending fmconfig storage
     * @returns {Promise}
     */
    ns.flush = async function() {
        if (timer) {
            delay.cancel('fmconfig:store');
            return timer instanceof Promise ? timer : store();
        }
    };

    /**
     * Retrieve configuration value.
     * (We'll keep using the global `fmconfig` for now)
     *
     * @param {String} key Configuration key
     */
    ns.get = function _getConfigValue(key) {
        return fmconfig[key];
    };

    /**
     * Remove configuration value
     * @param {String} key   Configuration key
     */
    ns.remove = function _removeConfigValue(key) {
        return this.set(key, undefined);
    };

    /**
     * Store configuration value
     * @param {String} key   Configuration key
     * @param      {*} value Configuration value
     */
    ns.set = function _setConfigValue(key, value) {
        fmconfig[key] = value;
    };

    /**
     * Same as .set, but displays a toast notification.
     * @param {String} key          Configuration key
     * @param      {*} value        Configuration value
     * @param {String} [toastText]  Toast notification text
     */
    ns.setn = function _setConfigValueToast(key, value, toastText) {

        delay('fmconfig:setn.' + key, function() {
            let toast = false;

            if (key === 'rubsched' && u_attr.flags.ssrs > 0) {
                value = String(value).split(':').pop() | 0;

                if (M.account.ssrs !== value) {
                    M.account.ssrs = value;
                    mega.attr.set('rubbishtime', String(value), -2, 1);
                    toast = true;
                }
            }
            else if (mega.config.get(key) !== value) {
                mega.config.set(key, value);
                toast = true;
            }

            if (toast) {
                showToast('settings', toastText || l[16168]);
            }

            if (key === 's4thumbs') {
                if ('kernel' in s4) {
                    s4.kernel.container.settings(null, {t: !!fmconfig.s4thumbs}).dump('s4thumbs');
                }
                else if (d) {
                    console.error('Tried to change s4-settings, w/o kernel availability.');
                }
            }
        });
    };

    /**
     * Factory to store boolean-type options as bits to save space.
     * @param {String} name The name for the fmconfig property
     * @param {Array} properties Array of options/preferences
     * @returns {{}}
     */
    ns.factory = function(name, properties) {
        assert(Array.isArray(properties) && properties.length < 32);
        assert(typeof name === 'string' && name.length > 1 && name.length < 9);

        const config = Object.create(null);
        const bitdef = Object.create(null);

        let flags = mega.config.get(name) >>> 0;
        for (let i = properties.length; i--;) {
            const k = properties[i];
            const v = 1 << i;

            if (flags & v) {
                config[k] = true;
            }
            bitdef[k] = v >>> 0;
        }

        const define = (target, prop, value) => {
            let rc = false;

            if (prop in bitdef) {
                const old = flags;

                if (value | 0) {
                    flags |= bitdef[prop];
                    rc = Reflect.set(target, prop, true);
                }
                else {
                    flags &= ~bitdef[prop];
                    rc = Reflect.deleteProperty(target, prop);
                }

                if (rc && old !== flags) {
                    mega.config.set(name, flags || undefined);
                }
            }
            return rc;
        };

        return new Proxy(config, {
            get(target, prop) {
                return prop in bitdef ? !!(flags & bitdef[prop]) : undefined;
            },
            set(target, prop, value) {
                return define(target, prop, value);
            },
            deleteProperty(target, prop) {
                return define(target, prop, null);
            }
        });
    };

    mBroadcaster.once('startMega', () => {
        const cfg = tryCatch(() => {
            const value = sessionStorage.fmconfig || localStorage.fmconfig;
            if (value) {
                switch (value[0]) {
                    case '{':
                        return parse(value);
                    case '\x1F':
                        return tlvstore.decode(value.slice(1), false);
                    default:
                        logger.error('Unsupported local config type...', [value]);
                }
            }
        })();

        setup(cfg);
    });

    if (is_karma) {
        mega.config = ns;
    }
    else {
        Object.defineProperty(mega, 'config', {value: Object.freeze(ns)});
    }
})();

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// --- Account Notifications (preferences) ----------------------------------
// --------------------------------------------------------------------------
(function(map) {
    'use strict';

    let _enum = [];
    const _tag = 'ACCNOTIF_';

    Object.keys(map)
        .forEach(function(k) {
            map[k] = map[k].map(function(m) {
                return k.toUpperCase() + '_' + m.toUpperCase();
            });

            let rsv = 0;
            let memb = clone(map[k]);

            while (memb.length < 10) {
                memb.push(k.toUpperCase() + '_RSV' + (++rsv));
            }

            if (memb.length > 10) {
                throw new Error('Stack overflow..');
            }

            _enum = _enum.concat(memb);
        });

    makeEnum(_enum, _tag, mega);

    Object.defineProperty(mega, 'notif', {
        value: Object.freeze((function(flags) {
            function check(flag, tag) {
                if (typeof flag === 'string') {
                    if (tag !== undefined) {
                        flag = tag + '_' + flag;
                    }
                    flag = String(flag).toUpperCase();
                    flag = mega[flag] || mega[_tag + flag] || 0;
                }
                return flag;
            }

            return {
                get flags() {
                    return flags;
                },

                setup: function setup(oldFlags) {
                    if (oldFlags === undefined) {
                        // Initialize account notifications to defaults (all enabled)
                        assert(!fmconfig.anf, 'Account notification flags already set');

                        Object.keys(map)
                            .forEach(k => {
                                const grp = map[k];
                                let len = grp.length;

                                while (len--) {

                                    // Cloud_UPLOAD/file-request is inverted, so this will 'set' it
                                    if (grp[len] === 'CLOUD_UPLOAD') {
                                        this.unset(grp[len]);
                                    }
                                    else {
                                        this.set(grp[len]);
                                    }
                                }
                            });
                    }
                    else {
                        flags = oldFlags;
                    }
                },

                has: function has(flag, tag) {
                    return flags & check(flag, tag);
                },

                set: function set(flag, tag) {
                    flags |= check(flag, tag);
                    mega.config.set('anf', flags);
                },

                unset: function unset(flag, tag) {
                    flags &= ~check(flag, tag);
                    mega.config.set('anf', flags);
                }
            };
        })(0))
    });

    _enum = undefined;

})({
    chat: ['ENABLED'],
    cloud: ['ENABLED', 'NEWSHARE', 'DELSHARE', 'NEWFILES', 'UPLOAD'],
    contacts: ['ENABLED', 'FCRIN', 'FCRACPT', 'FCRDEL']
});

var xxtea = (function() {
    'use strict';

    // (from https://github.com/xxtea/xxtea-js/blob/master/src/xxtea.js)
    var DELTA = 0x9E3779B9;
    var ns = Object.create(null);

    var int32 = function(i) {
        return i & 0xFFFFFFFF;
    };

    var mx = function(sum, y, z, p, e, k) {
        return (z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4) ^ (sum ^ y) + (k[p & 3 ^ e] ^ z);
    };

    ns.encryptUint32Array = function encryptUint32Array(v, k) {
        var length = v.length;
        var n = length - 1;
        var y;
        var z = v[n];
        var sum = 0;
        var e;
        var p;
        var q;
        for (q = Math.floor(6 + 52 / length) | 0; q > 0; --q) {
            sum = int32(sum + DELTA);
            e = sum >>> 2 & 3;
            for (p = 0; p < n; ++p) {
                y = v[p + 1];
                z = v[p] = int32(v[p] + mx(sum, y, z, p, e, k));
            }
            y = v[0];
            z = v[n] = int32(v[n] + mx(sum, y, z, n, e, k));
        }
        return v;
    };

    ns.decryptUint32Array = function decryptUint32Array(v, k) {
        var length = v.length;
        var n = length - 1;
        var y = v[0];
        var z;
        var sum;
        var e;
        var p;
        var q = Math.floor(6 + 52 / length);
        for (sum = int32(q * DELTA); sum !== 0; sum = int32(sum - DELTA)) {
            e = sum >>> 2 & 3;
            for (p = n; p > 0; --p) {
                z = v[p - 1];
                y = v[p] = int32(v[p] - mx(sum, y, z, p, e, k));
            }
            z = v[n];
            y = v[0] = int32(v[0] - mx(sum, y, z, 0, e, k));
        }
        return v;
    };

    return Object.freeze(ns);
}());

var use_ssl = window.is_extension && !window.is_iframed ? 0 : 1;

// general errors
var EINTERNAL = -1;
var EARGS = -2;
var EAGAIN = -3;
var ERATELIMIT = -4;
var EFAILED = -5;
var ETOOMANY = -6;
var ERANGE = -7;
var EEXPIRED = -8;

// FS access errors
var ENOENT = -9;            // No Entity (does not exist)
var ECIRCULAR = -10;
var EACCESS = -11;
var EEXIST = -12;
var EINCOMPLETE = -13;

// crypto errors
var EKEY = -14;

// user errors
var ESID = -15;
var EBLOCKED = -16;
var EOVERQUOTA = -17;
var ETEMPUNAVAIL = -18;
var ETOOMANYCONNECTIONS = -19;
var EGOINGOVERQUOTA = -24;

var EROLLEDBACK = -25;
var EMFAREQUIRED = -26;     // Multi-Factor Authentication Required
var EMASTERONLY = -27;      // Access denied for sub-users (only for business accounts)
var EBUSINESSPASTDUE = -28; // Business account expired
var EPAYWALL = -29;     // ODQ paywall state

// custom errors
var ETOOERR = -400;
var ESHAREROVERQUOTA = -401;


// convert user-supplied password array
function prepare_key(a) {
    var i, j, r;
    var aes = [];
    var pkey = [0x93C467E3, 0x7DB0C7A4, 0xD1BE3F81, 0x0152CB56];

    for (j = 0; j < a.length; j += 4) {
        var key = [0, 0, 0, 0];
        for (i = 0; i < 4; i++) {
            if (i + j < a.length) {
                key[i] = a[i + j];
            }
        }
        aes.push(new sjcl.cipher.aes(key));
    }

    for (r = 65536; r--;) {
        for (j = 0; j < aes.length; j++) {
            pkey = aes[j].encrypt(pkey);
        }
    }

    return pkey;
}

// prepare_key with string input
function prepare_key_pw(password) {
    return prepare_key(str_to_a32(password));
}

function a32_to_base64(a) {
    return base64urlencode(a32_to_str(a));
}

// ArrayBuffer to binary string
function ab_to_str(ab) {
    'use strict';
    const u8 = new Uint8Array(ab);

    /**
     if (u8.length < 0x10000) {
        return String.fromCharCode.apply(String, u8);
    }
     /**/

    let b = '';
    for (let i = 0; i < u8.length; i++) {
        b += String.fromCharCode(u8[i]);
    }

    return b;
}

// random number between 0 .. n -- based on repeated calls to rc
function rand(n) {
    var r = new Uint32Array(1);
    asmCrypto.getRandomValues(r);
    return r[0] % n; // <- oops, it's uniformly distributed only when `n` divides 0x100000000
}


/**
 * generate RSA key
 * @param {Function} callBack   optional callback function to be called.
 *                              if not specified the standard set_RSA will be called
 */
var crypto_rsagenkey = promisify(function _crypto_rsagenkey(resolve, reject, aSetRSA) {
    'use strict';
    var logger = MegaLogger.getLogger('crypt');

    var startTime = new Date();

    // suppress upgrade warning at account creation time
    mega.keyMgr.postregistration = true;

    if (typeof msCrypto !== 'undefined' && msCrypto.subtle) {
        var ko = msCrypto.subtle.generateKey({
            name: 'RSAES-PKCS1-v1_5',
            modulusLength: 2048
        }, true);
        ko.oncomplete = function () {
            ko = msCrypto.subtle.exportKey('jwk', ko.result.privateKey);
            ko.oncomplete = function () {
                var jwk = JSON.parse(asmCrypto.bytes_to_string(new Uint8Array(ko.result)));
                _done(['n', 'e', 'd', 'p', 'q', 'dp', 'dq', 'qi'].map(function (x) {
                    return base64urldecode(jwk[x]);
                }));
            };
        };
    }
    else {
        var w = new Worker((is_extension ? '' : '/') + 'keygen.js');

        w.onmessage = function (e) {
            w.terminate();
            _done(e.data);
        };

        var workerSeed = mega.getRandomValues(256);

        w.postMessage([2048, 257, workerSeed]);
    }

    function _done(k) {
        var endTime = new Date();
        logger.debug("Key generation took "
                     + (endTime.getTime() - startTime.getTime()) / 1000.0
            + " seconds!");

        if (aSetRSA === false) {
            resolve(k);
        }
        else {
            u_setrsa(k).then(resolve).catch(dump);
        }
    }
});

/**
 * Converts a Unicode string to a UTF-8 cleanly encoded string.
 *
 * @param {String} unicode
 *     Browser's native string encoding.
 * @return {String}
 *     UTF-8 encoded string (8-bit characters only).
 */
function to8(unicode) {
    'use strict';
    return unescape(encodeURIComponent(unicode));
}

// @deprecated
function api_setsid(sid) {
    "use strict";
    api.setSID(sid);
}

// @deprecated
function api_setfolder(h) {
    "use strict";
    api.setFolderSID(h, window.u_sid);
}

// @deprecated
function api_req(request, context, channel) {
    "use strict";

    if (channel === undefined) {
        channel = 0;
    }
    const {a} = request || !1;
    const options = {channel, progress: context && context.progress, dedup: false};

    (a === 'up' || a === 'upv' ? api.screq(request, options) : api.req(request, options))
        .always((reply) => {
            if (reply instanceof Error) {
                throw reply;
            }
            if (context && context.callback) {
                const xhr = self.d > 0 && new Proxy({}, {
                    get(target, prop) {
                        console.warn(`[api] The XHR object is deprecated, trying to access ${prop}...`);
                        return false;
                    }
                });

                let {result, responses} = reply || false;

                if (typeof reply === 'number' || reply instanceof window.APIRequestError) {

                    result = Number(reply);
                }
                context.callback(result, context, xhr, responses);
            }
        })
        .catch(reportError);
}

// @todo refactor
function api_reqfailed(channel, error) {
    'use strict';

    var e = error | 0;
    var c = channel | 0;

    if (mega.state & window.MEGAFLAG_LOADINGCLOUD) {
        if (this.status === true && e === EAGAIN) {
            mega.loadReport.EAGAINs++;
        }
        else if (this.status === 500) {
            mega.loadReport.e500s++;
        }
        else {
            mega.loadReport.errs++;
        }
    }
    else if (self.is_iframed) {
        // most of the functions used here are not available on i-framed contexts, show a generic message.
        tell(e);
        if (e === ESID || e === EBLOCKED) {
            window.onerror = null;
            u_logout(true);
        }
        return e;
    }

    // does this failure belong to a folder link, but not on the SC channel?
    if (this.sid[0] === 'n' && c !== 2) {
        // yes: handle as a failed folder link access
        api.reset(c);
        return folderreqerr(c, this.error || error);
    }

    if (e === ESID) {
        u_logout(true);
        Soon(function() {
            showToast('clipboard', l[19]);
        });
        loadingInitDialog.hide('force');
        if (page !== 'download') {
            loadSubPage('login');
        }
    }
    else if ((c === 2 || c === 5) && e === ETOOMANY) {
        // too many pending SC requests - reload from scratch
        return fm_fullreload(this, 'ETOOMANY');
    }
    // if suspended account
    else if (e === EBLOCKED) {
        api.reset(c);

        api_req({ a: 'whyamiblocked' }, {
            callback: function whyAmIBlocked(reasonCode) {
                var setLogOutOnNavigation = function() {
                    onIdle(function() {
                        mBroadcaster.once('pagechange', function() {
                            u_logout().then(() => location.reload(true));
                        });
                    });
                    window.doUnloadLogOut = 0x9001;
                    return false;
                };

                // On clicking OK, log the user out and redirect to contact page
                loadingDialog.hide();

                var reasonText = '';
                var dialogTitle = l[17768];// Terminated account

                if (reasonCode === 200) {
                    dialogTitle = l[6789];// Suspended account
                    reasonText = l.blocked_rsn_copyright;
                }
                else if (reasonCode === 300) {
                    reasonText = l.blocked_rsn_terminated;
                }
                else if (reasonCode === 400) {
                    reasonText = l[19748];// Your account is disabled by administrator
                }
                else if (reasonCode === 401) {
                    reasonText = l[20816];// Your account is deleted (business user)
                }
                else if (reasonCode === 500) {

                    // Handle SMS verification for suspended account
                    if (is_mobile) {
                        loadSubPage('sms/add-phone-suspended');
                    }
                    else {
                        sms.phoneInput.init(true);
                    }

                    // Allow user to escape from SMS verification dialog in order to login a different account.
                    return setLogOutOnNavigation();
                }
                else if (reasonCode === 700) {
                    var to = String(page).startsWith('emailverify') && 'login-to-account';
                    security.showVerifyEmailDialog(to);

                    // Allow user to escape from Email verification dialog in order to login a different account.
                    return setLogOutOnNavigation();
                }
                else {
                    // Unknown reasonCode
                    reasonText = l[17740]; // Your account was terminated due to breach of Mega's Terms of Service...
                }

                // Log the user out for all scenarios except SMS required (500)
                u_logout(true);

                // if fm-overlay click handler was initialized, we remove the handler to prevent dialog skip
                $('.fm-dialog-overlay').off('click.fm');
                if (is_mobile) {
                    parsepage(pages['mobile']);
                }
                msgDialog('warninga', dialogTitle,
                    reasonText,
                    false,
                    function () {
                        var redirectUrl = getAppBaseUrl() + '#contact';
                        window.location.replace(redirectUrl);
                    }
                );
            }
        });
    }
    else if (e === EPAYWALL) {
        if (window.M) {
            if (M.account && u_attr && !u_attr.uspw) {
                M.account = null;
            }
            if (window.loadingDialog) {
                loadingDialog.hide();
            }
            M.showOverStorageQuota(e).catch(dump);
        }
    }
    else {
        if (d) {
            console.assert(e !== EARGS);
        }
        return e === EARGS ? e : EAGAIN;
    }
}

var failxhr;
var failtime = 0;

function api_reportfailure(hostname, callback) {
    if (!hostname) {
        return Soon(callback);
    }

    var t = new Date().getTime();

    if (t - failtime < 60000) {
        return;
    }
    failtime = t;

    if (failxhr) {
        failxhr.abort();
    }

    failxhr = new XMLHttpRequest();
    failxhr.open('POST', apipath + 'pf?h', true);
    failxhr.callback = callback;

    failxhr.onload = function () {
        if (this.status === 200) {
            failxhr.callback();
        }
    };

    failxhr.send(hostname);
}

// if set, further sn updates are disallowed (the local state has become invalid)
function setsn(sn) {
    "use strict";

    // update sn in DB, triggering a "commit" of the current "transaction"
    if (fmdb) {
        attribCache.flush();
        fmdb.add('_sn', { i : 1, d : sn });
    }
}

// are we processing historical SC commands?
var initialscfetch;

// last step of the streamed SC response processing
function sc_residue(sc) {
    "use strict";

    if (d) {
        console.info('sc-residue', initialscfetch, scqtail, scqhead, tryCatch(() => JSON.stringify(sc))() || sc);
    }

    if (sc.sn) {
        const didLoadFromAPI = mega.loadReport.mode === 2;

        // enqueue new sn
        if (initialscfetch || currsn !== sc.sn || scqhead !== scqtail) {
            currsn = sc.sn;
            scq[scqhead++] = [{a: '_sn', sn: currsn}];
            resumesc();
        }

        if (initialscfetch) {
            // we have concluded the post-load SC fetch, as we have now
            // run out of new actionpackets: show filemanager!
            scq[scqhead++] = [{ a: '_fm' }];
            initialscfetch = false;
            resumesc();

            if (didLoadFromAPI && !pfid) {

                mega.keyMgr.pendingpullkey = true;
            }
        }

        // we're done, wait for more
        if (sc.w) {
            waitsc.setURL(`${sc.w}?${this.sid}&sn=${currsn}`);
        }

        if ((mega.state & window.MEGAFLAG_LOADINGCLOUD) && !mega.loadReport.recvAPs) {
            mega.loadReport.recvAPs = Date.now() - mega.loadReport.stepTimeStamp;
            mega.loadReport.stepTimeStamp = Date.now();
        }
    }
    else {
        // malformed SC response - take the conservative route and reload fully
        // FIXME: add one single retry if !sscount: Clear scq, clear worker state,
        // then reissue getsc() (difficult to get right - be cautious)
        return fm_fullreload(null, 'malformed SC response');
    }
}

// request new actionpackets and stream them to sc_packet() as they come in
// nodes in t packets are streamed to sc_node()
function getsc(force) {
    "use strict";

    if (!force || window.pfcol) {
        return Promise.resolve(EEXIST);
    }

    // retire existing channel that may still be completing the request
    getsc.stop(-1, 'w/sc-fetch');

    if (!self.currsn) {
        if (d) {
            console.error('Invalid w/sc fetcher invocation, out of context...', self.currsn);
        }
        eventlog(99737, JSON.stringify([1, !!self.initialscfetch | 0, !!self.pfid | 0, !!self.dlid | 0]));

        return Promise.resolve(EACCESS);
    }

    if (window.loadingInitDialog.progress) {
        window.loadingInitDialog.step3(loadfm.fromapi ? 40 : 1, 55);
    }

    if (mega.state & window.MEGAFLAG_LOADINGCLOUD) {
        mega.loadReport.scSent = Date.now();
    }
    const runId = getsc.locked = currsn + makeUUID().slice(-18);

    if (d) {
        console.info('BEGIN w/sc fetcher <%s>', runId);
    }

    return getsc.fire(runId)
        .finally(() => {
            if (d) {
                console.info('END w/sc fetcher <%s>', runId);
            }

            if (getsc.validate(runId)) {

                getsc.locked = false;
            }
        });
}

function waitsc() {
    "use strict";

    if (!waitsc.kas) {
        waitsc.kas = new MEGAKeepAliveStream(waitsc.sink);
    }

    // re/set initial backoff value.
    waitsc.kas.backoff = 1e4 + Math.random() * 9e3;
}

Object.defineProperties(waitsc, {
    kas: {
        value: null,
        writable: true
    },
    sink: {
        value: freeze({
            onerror(ex) {
                'use strict';
                // @todo This is meant to work around API-1987, remove when resolved!
                if (this.status === 500 && waitsc.ok) {
                    if (d) {
                        console.info('w/sc connection failure, starting over...', [ex]);
                    }
                    getsc.stop(-1, 'http-500');
                    tSleep(4 + -Math.log(Math.random()) * 3)
                        .then(() => !getsc.locked && !waitsc.ok && getsc(true))
                        .catch(dump);
                    eventlog(99992);
                }
            },
            onload(buffer) {
                'use strict';
                let res = buffer.byteLength < 6 && String.fromCharCode.apply(null, new Uint8Array(buffer)) || '';

                if (res === '0') {
                    // immediately re-connect.
                    return this.restart('server-request');
                }

                if (res[0] === '-' && (res |= 0) < 0) {
                    // WSC is stopped at the beginning.
                    if (d) {
                        this.logger.warn('wsc error %s, %s...', res, api_strerror(res));
                    }
                    switch (res) {
                        case ESID:
                        case EBLOCKED:
                            // reach api.deliver();
                            break;
                        default:
                            return res === ETOOMANY && fm_fullreload(null, 'ETOOMANY');
                    }
                }

                return api.deliver(5, buffer);
            }
        })
    },
    stop: {
        value(reason) {
            'use strict';
            if (this.kas) {
                this.kas.destroy(`stop-request ${reason || ''}`);
                this.kas = null;
            }
        }
    },
    poke: {
        value(reason) {
            'use strict';
            if (this.kas) {
                this.kas.restart(reason || 'poke');
            }
        }
    },
    setURL: {
        value(url) {
            'use strict';
            waitsc();
            this.kas.setURL(url);
            this.poke('switching url');
        }
    },
    ok: {
        get() {
            'use strict';
            return this.kas && this.kas.url;
        }
    },
    running: {
        get() {
            'use strict';
            return !!this.ok || getsc.locked;
        }
    }
});

Object.defineProperties(getsc, {
    locked: {
        value: null,
        writable: true
    },
    validate: {
        value(runId) {
            'use strict';

            if (this.locked === runId) {

                return true;
            }

            if (d) {
                console.warn('w/sc connection %s superseded by %s...', runId, this.locked);
            }
        }
    },
    onLine: {
        async value() {
            'use strict';

            if (navigator.onLine === false) {
                if (d) {
                    console.warn('waiting for network connection to be back online...');
                }
                return new Promise((resolve) => {
                    const ready = () => {
                        tSleep(1 + Math.random()).then(resolve);
                        window.removeEventListener('online', ready);
                    };
                    window.addEventListener('online', ready);
                });
            }
        }
    },
    stop: {
        value(level, reason) {
            'use strict';

            if (this.timer) {
                this.timer.abort();
                this.timer = null;
            }

            if ((level >>>= 0)) {
                api.reset(5);

                if (level > 1) {
                    waitsc.stop(reason);
                }
            }
        }
    },
    fire: {
        async value(runId) {
            'use strict';

            if (navigator.onLine === false) {
                if (d) {
                    console.error('<%s> Network connection is offline...', runId);
                }

                if (initialscfetch) {
                    // No need to wait for network connectivity, immediately show the FM...

                    onIdle(getsc);
                    return sc_residue({sn: currsn});
                }
                await this.onLine();
            }

            if (this.validate(runId)) {
                if (getsc.timer) {
                    console.assert(false);
                    getsc.stop();
                }
                getsc.timer = tSleep(48);
                const res = await Promise.race([getsc.timer, api.req(`sn=${currsn}`, 5)]).catch(echo);

                if (Number(res) !== EROLLEDBACK && this.validate(runId)) {
                    if (d) {
                        if (res) {
                            if (initialscfetch || res.result !== 1) {
                                console.error(`Unexpected API response for w/sc request (${res.result})`, res);
                            }
                        }
                        else {
                            console.error('w/sc connection is taking too long, aborting...');
                        }
                    }
                    getsc.stop();

                    // at this point, sc_residue() should have been called with a new w/sc URL, but it may do not.
                    if (!waitsc.ok) {

                        if (initialscfetch) {
                            // No need to wait for the w/sc connection, immediately show the FM.
                            sc_residue({sn: currsn});
                        }

                        if (navigator.onLine === false) {

                            await this.onLine();
                        }
                        else {
                            console.error(' ---- caught faulty w/sc connection ----', res);

                            const data = [
                                !!self.initialscfetch | 0, res ? 1 : 0, (res && res.result) | 0, res | 0
                            ];
                            if (res || data[0]) {
                                eventlog(99993, JSON.stringify([2, ...data]), true);
                            }
                        }

                        tSleep(3 + Math.random() * 9)
                            .then(() => {

                                if (!this.locked && !waitsc.ok) {

                                    return getsc(true)
                                        .finally(() => {
                                            // Check for and release any held locks, if needed...
                                            api.poke().catch(dump);
                                        });
                                }
                            })
                            .catch(reportError);
                    }

                    return res;
                }
            }

            return EEXPIRED;
        }
    }
});

mBroadcaster.once('startMega', () => {
    'use strict';

    window.addEventListener('online', () => api.retry());

    var invisibleTime;
    document.addEventListener('visibilitychange', function(ev) {

        if (document.hidden) {
            invisibleTime = Date.now();
        }
        else {
            invisibleTime = Date.now() - invisibleTime;

            if (mega.loadReport && !mega.loadReport.sent) {
                if (!mega.loadReport.invisibleTime) {
                    mega.loadReport.invisibleTime = 0;
                }
                mega.loadReport.invisibleTime += invisibleTime;
            }
        }

        mBroadcaster.sendMessage('visibilitychange:' + Boolean(document.hidden));
    });
});

function api_create_u_k() {
    'use strict';

    // static master key, will be stored at the server side encrypted with the master pw
    u_k = [...crypto.getRandomValues(new Uint32Array(4))];
}

// If the user triggers an action that requires an account, but hasn't logged in,
// we create an anonymous preliminary account. Returns userhandle and passwordkey for permanent storage.
async function api_createuser(ctx, invitecode, invitename) {
    'use strict';
    let i;
    var ssc = Array(4); // session self challenge, will be used to verify password

    if (!ctx.passwordkey) {
        ctx.passwordkey = Array(4);
        for (i = 4; i--;) {
            ctx.passwordkey[i] = rand(0x100000000);
        }
    }

    if (!u_k) {
        api_create_u_k();
    }

    for (i = 4; i--;) {
        ssc[i] = rand(0x100000000);
    }

    if (d) {
        console.debug(`api_createuser - mk: '${u_k}', pk: '${ctx.passwordkey}'`);
    }

    // in business sub-users API team decided to hack "UP" command to include "UC2" new arguments.
    // so now. we will check if this is a business sub-user --> we will add extra arguments to "UP" (crv,hak,v)
    const req = {
        a: 'up',
        k: a32_to_base64(encrypt_key(new sjcl.cipher.aes(ctx.passwordkey), u_k)),
        ts: base64urlencode(a32_to_str(ssc) + a32_to_str(encrypt_key(new sjcl.cipher.aes(u_k), ssc)))
    };

    // invite code usage is obsolete. it's only used in case of business sub-users
    // therefore, if it exists --> we are registering a business sub-user
    if (invitecode) {
        req.v = 2;
        req.ic = invitecode;
        req.name = invitename;

        const {
            clientRandomValueBytes,
            encryptedMasterKeyArray32,
            hashedAuthenticationKeyBytes,
            derivedAuthenticationKeyBytes
        } = await security.deriveKeysFromPassword(ctx.businessUser, u_k);

        req.crv = ab_to_base64(clientRandomValueBytes);
        req.k = a32_to_base64(encryptedMasterKeyArray32);
        req.hak = ab_to_base64(hashedAuthenticationKeyBytes);
        ctx.uh = ab_to_base64(derivedAuthenticationKeyBytes);
    }

    if (mega.affid) {
        req.aff = mega.affid;
    }

    watchdog.notify('user-created');
    return api.screq(req, ctx);
}

function api_resetuser(ctx, emailCode, email, password) {

    // start fresh account
    api_create_u_k();

    var pw_aes = new sjcl.cipher.aes(prepare_key_pw(password));

    var ssc = Array(4);
    for (var i = 4; i--;) {
        ssc[i] = rand(0x100000000);
    }

    api_req({
        a: 'erx',
        c: emailCode,
        x: a32_to_base64(encrypt_key(pw_aes, u_k)),
        y: stringhash(email.toLowerCase(), pw_aes),
        z: base64urlencode(a32_to_str(ssc) + a32_to_str(encrypt_key(new sjcl.cipher.aes(u_k), ssc)))
    }, ctx);
}

// We query the sid using the supplied user handle (or entered email address, if already attached)
// and check the supplied password key.
// Returns [decrypted master key,verified session ID(,RSA private key)] or false if API error or
// supplied information incorrect
function api_getsid(ctx, user, passwordkey, hash, pinCode) {
    "use strict";

    ctx.callback = api_getsid2;
    ctx.passwordkey = passwordkey;

    // If previously blocked for too many login attempts, return early and show warning with time they can try again
    if (api_getsid.etoomany + 3600000 > Date.now() || location.host === 'webcache.googleusercontent.com') {
        return ctx.checkloginresult(ctx, ETOOMANY);
    }

    // Setup the login request
    var requestVars = { a: 'us', user: user, uh: hash };

    // If the two-factor authentication code was entered by the user, add it to the request as well
    if (pinCode !== null) {
        requestVars.mfa = pinCode;
    }

    api_req(requestVars, ctx);
}

api_getsid.warning = function() {
    var time = new Date(api_getsid.etoomany + 3780000).toLocaleTimeString();

    msgDialog('warningb', l[882], l[8855].replace('%1', time));
};

function api_getsid2(res, ctx) {
    var t, k;
    var r = false;

    // If the result is an error, pass that back to get an exact error
    if (typeof res === 'number') {
        ctx.checkloginresult(ctx, res);
        return false;
    }
    else if (typeof res === 'object') {
        var aes = new sjcl.cipher.aes(ctx.passwordkey);

        // decrypt master key
        if (typeof res.k === 'string') {
            k = base64_to_a32(res.k);

            if (k.length === 4) {
                k = decrypt_key(aes, k);

                aes = new sjcl.cipher.aes(k);

                if (typeof res.tsid === 'string') {
                    t = base64urldecode(res.tsid);
                    if (a32_to_str(encrypt_key(aes,
                            str_to_a32(t.substr(0, 16)))) === t.substr(-16)) {
                        r = [k, res.tsid];
                    }
                }
                else if (typeof res.u !== 'string' || res.u.length !== 11) {

                    console.error("Incorrect user handle in the 'us' response", res.u);

                    Soon(() => {
                        msgDialog('warninga', l[135], l[8853], res.u);
                    });

                    return false;
                }
                else if (typeof res.csid === 'string') {
                    let privk = null;
                    const errobj = {};
                    const t = base64urldecode(res.csid);

                    try {
                        privk = crypto_decodeprivkey(a32_to_str(decrypt_key(aes, base64_to_a32(res.privk))), errobj);
                    }
                    catch (ex) {

                        console.error('Error decoding private RSA key! %o', errobj, ex);

                        Soon(() => {
                            msgDialog('warninga', l[135], l[8853], JSON.stringify(errobj));
                        });

                        return false;
                    }

                    if (!privk) {
                        // Bad decryption of RSA is an indication that the password was wrong
                        console.error('RSA key decoding failed (%o)', errobj);
                        ctx.checkloginresult(ctx, false);
                        return false;
                    }

                    // Decrypt the Session ID
                    var decryptedSessionId = crypto_rsadecrypt(t, privk);

                    // Get the user handle from the decrypted Session ID (11 bytes starting at offset 16 bytes)
                    var sessionIdUserHandle = decryptedSessionId.substring(16, 27);

                    // Check that the decrypted sid and res.u aren't shorter than usual before making the comparison.
                    // Otherwise, we could construct an oracle based on shortened csids with single-byte user handles.
                    if (decryptedSessionId.length !== 255) {

                        console.error("Incorrect length of Session ID", decryptedSessionId.length, sessionIdUserHandle);

                        Soon(() => {
                            msgDialog('warninga', l[135], l[8853], decryptedSessionId.length);
                        });

                        return false;
                    }

                    // Check the user handle included in the Session ID matches the one sent in the 'us' response
                    if (sessionIdUserHandle !== res.u) {

                        console.error(
                            "User handle in Session ID did not match user handle from the 'us' request",
                            res.u, sessionIdUserHandle
                        );

                        Soon(() => {
                            msgDialog('warninga', l[135], l[8853], `${res.u} / ${sessionIdUserHandle}`);
                        });

                        return false;
                    }

                    // TODO: check remaining padding for added early wrong password detection likelihood
                    r = [k, base64urlencode(decryptedSessionId.substr(0, 43)), privk];
                }
            }
        }
    }

    // emailchange namespace exists, that means the user
    // attempted to verify their new email address without a session
    // therefore we showed them the login dialog. Now we call `emailchange.verify`
    // so the email verification can continue as expected.
    if (r && typeof emailchange === 'object') {
        emailchange.verify(new sjcl.cipher.aes(ctx.passwordkey), { k1: res.k, k2: k });
    }

    ctx.result(ctx, r);
}

// We call ug using the sid from setsid() and the user's master password to obtain the master key (and other credentials)
// Returns user credentials (.k being the decrypted master key) or false in case of an error.
function api_getuser(ctx) {
    api_req({
        a: 'ug'
    }, ctx);
}

/**
 * Send current node attributes to the API
 * @param {MegaNode} n Updated node
 * @return {Promise} <st, *>
 */
async function api_setattr(n) {
    "use strict";

    if (!crypto_keyok(n)) {
        console.warn('Unable to set node attributes, invalid key on %s', n.h, n);
        return Promise.reject(EKEY);
    }

    if (d) {
        console.debug('Updating node attributes for "%s"...', n.h);
    }
    const req = {a: 'a', n: n.h, at: ab_to_base64(crypto_makeattr(n))};
    if (M.getNodeRoot(n.h) === M.InboxID) {
        mega.backupCenter.ackVaultWriteAccess(n.h, req);
    }
    return api.screq(req);
}

function stringhash(s, aes) {
    var s32 = str_to_a32(s);
    var h32 = [0, 0, 0, 0];
    var i;

    for (i = 0; i < s32.length; i++) {
        h32[i & 3] ^= s32[i];
    }

    for (i = 16384; i--;) {
        h32 = aes.encrypt(h32);
    }

    return a32_to_base64([h32[0], h32[2]]);
}

// Update user
// Can also be used to set keys and to confirm accounts (.c)
function api_updateuser(ctx, newuser) {
    newuser.a = 'up';

    if (mega.affid) {
        newuser.aff = mega.affid;
    }

    api_req(newuser, ctx);
}

var u_pubkeys = Object.create(null);

/**
 * Query missing keys for the given users.
 *
 * @return {Promise}
 */
async function api_cachepubkeys(users) {
    'use strict';

    users = users.filter((user) => user !== 'EXP' && !u_pubkeys[user]);

    if (users.length) {
        await Promise.allSettled(users.map((user) => Promise.resolve(crypt.getPubRSA(user))));

        if (users.some((user) => !u_pubkeys[user] && !user.includes('@'))) {
            throw new Error(`Failed to cache RSA pub keys for users ${JSON.stringify(users)}`);
        }

        if (d) {
            console.debug(`Cached RSA pub keys for users ${JSON.stringify(users)}`);
        }
    }
}

/**
 * Encrypts a cleartext data string to a contact.
 *
 * @param {String} user
 *     User handle of the contact.
 * @param {String} data
 *     Clear text to encrypt.
 * @return {String|Boolean}
 *     Encrypted cipher text, or `false` in case of unavailability of the RSA
 *     public key (needs to be obtained/cached beforehand).
 */
function encryptto(user, data) {
    'use strict';
    var pubkey;

    if ((pubkey = u_pubkeys[user])) {
        return crypto_rsaencrypt(data, pubkey, -0x4D454741);
    }

    return false;
}

/**
 * Add/cancel share(s) to a set of users or email addresses
 * targets is an array of {u,r} - if no r given, cancel share
 * If no sharekey known, tentatively generates one and encrypts
 * everything to it. In case of a mismatch, the API call returns
 * an error, and the whole operation gets repeated (exceedingly
 * rare race condition).
 *
 * @param {String} node
 *     Selected node id.
 * @param {Array} targets
 *     List of user email or user handle and access permission.
 * @param {Array} [sharenodes]
 *     Holds complete directory tree starting from given node.
 * @returns {Promise}
 */
// eslint-disable-next-line complexity
async function api_setshare(node, targets, sharenodes) {
    'use strict';

    const pubKeys = [];
    const users = new Set();
    for (i = targets.length; i--;) {
        let {u} = targets[i];

        if (u && u !== 'EXP') {

            if (M.opc[u]) {
                console.error('Check this, got an outgoing pending contact...', u, M.opc[u]);

                u = M.opc[u].m;
                if (typeof u !== 'string' || !u.includes('@')) {
                    console.assert(false, 'Invalid outgoing pending contact email...');
                    continue;
                }
            }
            users.add(u);

            if (!mega.keyMgr.secure && !u_pubkeys[u]) {
                pubKeys.push(u);
            }
        }
    }

    if (pubKeys.length) {
        await api_cachepubkeys(pubKeys);
    }

    let exp = false;
    let maxretry = 5;
    let backoff = 196;
    let newkey = true;
    let sharekey, ssharekey;

    const req = {
        a: 's2',
        n: node,
        s: targets
    };

    for (let i = req.s.length; i--;) {
        if (typeof req.s[i].r !== 'undefined') {
            if (mega.keyMgr.secure) {
                newkey = mega.keyMgr.hasNewShareKey(node);

                // dummy key/handleauth - FIXME: remove
                req.ok = a32_to_base64([0, 0, 0, 0]);
                req.ha = a32_to_base64([0, 0, 0, 0]);
                break;
            }

            if (u_sharekeys[node]) {
                sharekey = u_sharekeys[node][0];
                newkey = mega.keyMgr.hasNewShareKey(node);
            }
            else {
                // we only need to generate a key if one or more shares are being added to a previously unshared node
                sharekey = [];
                for (let j = 4; j--;) {
                    sharekey.push(rand(0x100000000));
                }
                crypto_setsharekey(node, sharekey, true);
            }

            req.ok = a32_to_base64(encrypt_key(u_k_aes, sharekey));
            req.ha = crypto_handleauth(node);
            ssharekey = a32_to_str(sharekey);
            break;
        }
    }

    if (newkey) {
        if (!sharenodes) {
            if (d) {
                console.warn(`Acquiring share-nodes for ${node}...`, targets);
            }

            await mega.keyMgr.setShareSnapshot(node);
            sharenodes = mega.keyMgr.getShareSnapshot(node);
        }

        assert(Array.isArray(sharenodes) && sharenodes.includes(node), `Provided share-nodes seems invalid...`);
        req.cr = crypto_makecr(sharenodes, [node], true);
    }

    // encrypt ssharekey to known users
    for (let i = req.s.length; i--;) {
        if (req.s[i].u === 'EXP') {
            assert(!exp);
            exp = {a: 'l', n: node};

            if (req.s[i].w) {
                exp.w = 1;
                exp.sk = a32_to_base64(u_sharekeys[node][0]);
                req.s[i].r = 2;
                delete req.s[i].w;
            }
            else {
                assert(!req.s[i].r);
            }
        }
        else if (!mega.keyMgr.secure && u_pubkeys[req.s[i].u]) {
            req.s[i].k = base64urlencode(crypto_rsaencrypt(ssharekey, u_pubkeys[req.s[i].u]));
        }

        if (typeof req.s[i].m !== 'undefined') {
            req.s[i].u = req.s[i].m;
        }

        if (M.opc[req.s[i].u]) {
            if (d) {
                console.warn(`${req.s[i].u} is an outgoing pending contact, fixing to email...`, M.opc[req.s[i].u].m);
            }
            // the caller incorrectly passed a handle for a pending contact, so fixup..
            req.s[i].u = M.opc[req.s[i].u].m;
        }
    }

    if (users.size) {
        await mega.keyMgr.sendShareKeys(node, [...users]);
    }

    while (1) {
        const res = await api.screq(exp ? [req, exp] : req).catch(echo);
        if (d) {
            console.debug('api_setshare(%s)', node, res);
        }

        if (typeof res.result === 'object') {
            const {ok} = res.result;

            if (!ok) {
                mega.keyMgr.setUsedNewShareKey(node).catch(dump);
                return res.result;
            }

            if (mega.keyMgr.secure) {
                if (d) {
                    console.error('Share key clash: Will be resolved via ^!keys');
                }
                // @todo retry when resolved (?)..
                return res.result;
            }

            if (d) {
                console.warn('Share key clash: Set returned key and try again.');
            }
            let key = decrypt_key(u_k_aes, base64_to_a32(ok));

            crypto_setsharekey(node, key);
            req.ha = crypto_handleauth(node);
            req.ok = ok;

            if (exp.sk) {
                exp.sk = a32_to_base64(key);
            }

            key = a32_to_str(key);
            for (let i = req.s.length; i--;) {
                if (u_pubkeys[req.s[i].u]) {
                    req.s[i].k = base64urlencode(crypto_rsaencrypt(key, u_pubkeys[req.s[i].u]));
                }
            }
        }

        if (!--maxretry || res === EARGS) {
            throw new MEGAException(`Share operation failed for ${node}: ${api.strerror(res)}`, res);
        }

        await tSleep(Math.min(2e4, backoff <<= 1) / 1e3);
    }
}

function crypto_handleauth(h) {
    return a32_to_base64(encrypt_key(u_k_aes, str_to_a32(h + h)));
}

function crypto_keyok(n) {
    "use strict";

    return n && typeof n.k === 'object' && n.k.length >= (n.t ? 4 : 8);
}

function crypto_encodepubkey(pubkey) {
    var mlen = pubkey[0].length * 8,
        elen = pubkey[1].length * 8;

    return String.fromCharCode(mlen / 256) + String.fromCharCode(mlen % 256) + pubkey[0]
        + String.fromCharCode(elen / 256) + String.fromCharCode(elen % 256) + pubkey[1];
}

function crypto_decodepubkey(pubk) {
    var pubkey = [];

    var keylen = pubk.charCodeAt(0) * 256 + pubk.charCodeAt(1);

    // decompose public key
    for (var i = 0; i < 2; i++) {
        if (pubk.length < 2) {
            break;
        }

        var l = (pubk.charCodeAt(0) * 256 + pubk.charCodeAt(1) + 7) >> 3;
        if (l > pubk.length - 2) {
            break;
        }

        pubkey[i] = pubk.substr(2, l);
        pubk = pubk.substr(l + 2);
    }

    // check format
    if (i !== 2 || pubk.length >= 16) {
        return false;
    }

    pubkey[2] = keylen;

    return pubkey;
}

function crypto_encodeprivkey(privk) {
    var plen = privk[3].length * 8,
        qlen = privk[4].length * 8,
        dlen = privk[2].length * 8,
        ulen = privk[7].length * 8;

    var t = String.fromCharCode(qlen / 256) + String.fromCharCode(qlen % 256) + privk[4]
        + String.fromCharCode(plen / 256) + String.fromCharCode(plen % 256) + privk[3]
        + String.fromCharCode(dlen / 256) + String.fromCharCode(dlen % 256) + privk[2]
        + String.fromCharCode(ulen / 256) + String.fromCharCode(ulen % 256) + privk[7];

    while (t.length & 15) t += String.fromCharCode(rand(256));

    return t;
}

function crypto_encodeprivkey2(privk) {
    'use strict';
    const plen = privk[3].length * 8;
    const qlen = privk[4].length * 8;
    const dlen = privk[2].length * 8;

    return String.fromCharCode(qlen / 256) + String.fromCharCode(qlen % 256) + privk[4]
        + String.fromCharCode(plen / 256) + String.fromCharCode(plen % 256) + privk[3]
        + String.fromCharCode(dlen / 256) + String.fromCharCode(dlen % 256) + privk[2];
}

/**
 * Decode private RSA key.
 * @param {String} privk the key to decode.
 * @param {Object} [errobj] Optional object to put the details of a failure, if any
 * @returns {Array|Boolean} decoded private key, or boolean(false) if failure.
 */
function crypto_decodeprivkey(privk, errobj) {
    'use strict';
    let i, l;
    let privkey = [];

    // decompose private key
    for (i = 0; i < 4; i++) {
        if (privk.length < 2) {
            break;
        }

        l = (privk.charCodeAt(0) * 256 + privk.charCodeAt(1) + 7) >> 3;
        if (l > privk.length - 2) {
            break;
        }

        privkey[i] = new asmCrypto.BigNumber(privk.substr(2, l));
        privk = privk.substr(l + 2);
    }

    // check format
    if (i !== 4 || privk.length >= 16) {
        return false;
    }

    // TODO: check remaining padding for added early wrong password detection likelihood

    // restore privkey components via the known ones
    const q = privkey[0];
    const p = privkey[1];
    const d = privkey[2];
    const u = privkey[3];
    const q1 = q.subtract(1);
    const p1 = p.subtract(1);
    const m = new asmCrypto.Modulus(p.multiply(q));
    const e = new asmCrypto.Modulus(p1.multiply(q1)).inverse(d);
    const dp = d.divide(p1).remainder;
    const dq = d.divide(q1).remainder;

    // Calculate inverse modulo of q under p
    const inv = new asmCrypto.Modulus(p).inverse(q);

    // Convert Uint32Arrays to hex for comparison
    const hexInv = asmCrypto.bytes_to_hex(inv.toBytes()).replace(/^0+/, '');
    const hexU = asmCrypto.bytes_to_hex(u.toBytes()).replace(/^0+/, '');

    // Detect private key blob corruption - prevent API-exploitable RSA oracle requiring 500+ logins.
    // Ensure the bit length being at least 1000 and that u is indeed the inverse modulo of q under p.
    if (!(p.bitLength > 1000 &&
        q.bitLength > 1000 &&
        d.bitLength > 2000 &&
        u.bitLength > 1000 &&
        hexU === hexInv)) {
        return false;
    }

    privkey = [m, e, d, p, q, dp, dq, u];
    for (i = 0; i < privkey.length; i++) {
        privkey[i] = asmCrypto.bytes_to_string(privkey[i].toBytes());
    }

    return privkey;
}

/**
 * Decode private RSA key (pqd format).
 * @param {Uint8Array} privk the key to decode.
 * @param {Object} [errobj] Optional object to put the details of a failure, if any
 * @returns {Array|Boolean} decoded private key, or boolean(false) if failure.
 */
function crypto_decodeprivkey2(privk) {
    'use strict';
    let i, l;
    let pos = 0;
    let privkey = [];

    // decompose private key
    for (i = 0; i < 3; i++) {
        if (pos + 2 > privk.length) {
            return false;
        }

        l = privk[pos] * 256 + (privk[pos + 1] + 7) >> 3;
        pos += 2;

        if (pos + l > privk.length) {
            return false;
        }

        privkey[i] = new asmCrypto.BigNumber(privk.slice(pos, pos + l));
        pos += l;
    }

    // restore privkey components via the known ones
    const q = privkey[0];
    const p = privkey[1];
    const d = privkey[2];
    const q1 = q.subtract(1);
    const p1 = p.subtract(1);
    const m = new asmCrypto.Modulus(p.multiply(q));
    const e = new asmCrypto.Modulus(p1.multiply(q1)).inverse(d);
    const dp = d.divide(p1).remainder;
    const dq = d.divide(q1).remainder;

    // Calculate inverse modulo of q under p
    const u = new asmCrypto.Modulus(p).inverse(q);

    privkey = [m, e, d, p, q, dp, dq, u];
    for (i = 0; i < privkey.length; i++) {
        privkey[i] = asmCrypto.bytes_to_string(privkey[i].toBytes());
    }

    return privkey;
}


/**
 * Encrypts a cleartext string with the supplied public key.
 *
 * @param {String} cleartext
 *     Clear text to encrypt.
 * @param {Array} pubkey
 *     Public encryption key (in the usual internal format used).
 * @return {String}
 *     Encrypted cipher text.
 */
function crypto_rsaencrypt(cleartext, pubkey, bf) {
    'use strict';

    if (bf !== -0x4d454741 && mega.keyMgr.secure) {
        return '';
    }

    // random padding up to pubkey's byte length minus 2
    for (var i = (pubkey[0].length) - 2 - cleartext.length; i-- > 0;) {
        cleartext += String.fromCharCode(rand(256));
    }

    var ciphertext = asmCrypto.bytes_to_string(asmCrypto.RSA_RAW.encrypt(cleartext, pubkey));

    var clen = ciphertext.length * 8;
    ciphertext = String.fromCharCode(clen / 256) + String.fromCharCode(clen % 256) + ciphertext;

    return ciphertext;
}

var storedattr = Object.create(null);
var faxhrs = Object.create(null);
var faxhrfail = Object.create(null);
var faxhrlastgood = Object.create(null);

// data.byteLength & 15 must be 0
function api_storefileattr(id, type, key, data, ctx, ph) {
    var handle = typeof ctx === 'string' && ctx;

    if (typeof ctx !== 'object') {
        if (!storedattr[id]) {
            storedattr[id] = Object.create(null);
        }

        if (key) {
            data = asmCrypto.AES_CBC.encrypt(data, a32_to_ab(key), false);
        }

        ctx = {
            id: id,
            ph: ph,
            type: type,
            data: data,
            handle: handle,
            callback: api_fareq,
            startTime: Date.now()
        };
    }

    var req = {
        a: 'ufa',
        s: ctx.data.byteLength,
        ssl: use_ssl
    };

    if (M.d[ctx.handle] && M.getNodeRights(ctx.handle) > 1) {
        req.h = handle;
    }
    else if (ctx.ph) {
        req.ph = ctx.ph;
    }

    api_req(req, ctx, pfid ? 1 : 0);
}

async function api_getfileattr(fa, type, procfa, errfa) {
    'use strict';
    let r;
    const p = Object.create(null);
    const h = Object.create(null);
    const k = Object.create(null);
    const plain = Object.create(null);
    let cache = nop;

    type |= 0;
    if (type in fa_handler.lru) {
        const lru = await fa_handler.lru[type];
        if (!lru.error) {
            const send = async(h, ab) => procfa({cached: 1}, h, ab);
            const found = await lru.bulkGet(Object.keys(fa)).catch(dump) || false;

            for (const h in found) {
                fa[h] = null;
                send(h, found[h]).catch(dump);
            }
            cache = (h, buf) => lru.set(h, buf).catch(dump);
        }
    }

    const re = new RegExp(`(\\d+):${type}\\*([\\w-]+)`);
    for (const n in fa) {
        if (fa[n] && (r = re.exec(fa[n].fa))) {
            const t = base64urldecode(r[2]);
            if (t.length === 8) {
                if (!h[t]) {
                    h[t] = n;
                    k[t] = fa[n].k;
                }

                if (!p[r[1]]) {
                    p[r[1]] = t;
                }
                else {
                    p[r[1]] += t;
                }
                plain[r[1]] = !!fa[n].plaintext;
            }
        }
        else if (fa[n] !== null && typeof errfa === 'function') {
            queueMicrotask(errfa.bind(null, n));
        }
    }

    // eslint-disable-next-line guard-for-in
    for (const n in p) {
        const ctx = {
            callback: api_fareq,
            type: type,
            p: p[n],
            h: h,
            k: k,
            procfa: (ctx, h, buf) => {
                if (!buf || !buf.byteLength) {
                    buf = 0xDEAD;
                }
                else {
                    cache(h, buf);
                }
                return procfa(ctx, h, buf);
            },
            errfa: errfa,
            startTime: Date.now(),
            plaintext: plain[n]
        };
        api_req({
            a: 'ufa',
            fah: base64urlencode(ctx.p.substr(0, 8)),
            ssl: use_ssl,
            r: +fa_handler.chunked
        }, ctx);
    }
}

// @todo refactor whole fa-handler from scratch!
lazy(fa_handler, 'lru', () => {
    'use strict';
    const lru = Object.create(null);
    lazy(lru, 0, () => LRUMegaDexie.create('fa-handler.0', 1e4));
    lazy(lru, 1, () => LRUMegaDexie.create('fa-handler.1', 1e3));
    return lru;
});

function fa_handler(xhr, ctx) {
    var logger = d > 1 && MegaLogger.getLogger('crypt');
    var chunked = ctx.p && fa_handler.chunked;

    this.xhr = xhr;
    this.ctx = ctx;
    this.pos = 0;

    if (chunked) {
        if (!fa_handler.browser) {
            fa_handler.browser = browserdetails(ua).browser;
        }

        if (ctx.plaintext) {
            this.setParser('arraybuffer', this.plain_parser)
        }
        else {
            switch (fa_handler.browser) {
            case 'Firefox':
                this.parse = this.moz_parser;
                this.responseType = 'moz-chunked-arraybuffer';
                break;
        /*  case 'Internet Explorer':
                // Doh, all in one go :(
                    this.parse = this.stream_parser;
                    this.responseType = 'ms-stream';
                    this.stream_reader= this.msstream_reader;
                    break;*/
        /*  case 'Chrome':
                this.parse = this.stream_parser;
                this.responseType = 'stream';
                break;*/
            default:
                this.setParser('text');
            }
        }

        this.done = this.Finish;
    }
    else {
        this.responseType = 'arraybuffer';
        if (ctx.p) {
            this.proc = this.GetFA;
        }
        else {
            this.proc = this.PutFA;
        }
        this.done = this.onDone;
    }

    if (logger) {
        logger.debug('fah type:', this.responseType);
    }
}
fa_handler.chunked = true;
fa_handler.abort = function () {
    var logger = MegaLogger.getLogger('crypt');
    for (var i = 0; faxhrs[i]; i++) {
        if (faxhrs[i].readyState && faxhrs[i].readyState !== 4 && faxhrs[i].ctx.p) {
            var ctx = faxhrs[i].ctx;
            faxhrs[i].ctx = {
                fabort: 1
            };
            faxhrs[i].fah.parse = null;

            logger.debug('fah_abort', i, faxhrs[i]);

            faxhrs[i].abort();

            for (var i in ctx.h) {
                ctx.procfa(ctx, ctx.h[i], 0xDEAD);
            }
        }
    }
};
fa_handler.prototype = {
    PutFA: function (response) {
        var logger = MegaLogger.getLogger('crypt');
        var ctx = this.ctx;

        logger.debug("Attribute storage successful for faid=" + ctx.id + ", type=" + ctx.type);

        if (!storedattr[ctx.id]) {
            storedattr[ctx.id] = Object.create(null);
        }

        storedattr[ctx.id][ctx.type] = ab_to_base64(response);

        if (storedattr[ctx.id].target) {
            logger.debug("Attaching to existing file");
            api_attachfileattr(storedattr[ctx.id].target, ctx.id);
        }
    },

    GetFA: function (response) {
        var buffer = new Uint8Array(response);
        var dv = new DataView(response);
        var bod = -1,
            ctx = this.ctx;
        var h, j, p, l, k;

        i = 0;
        const procfa = (res) => ctx.procfa(ctx, ctx.h[h], res);
        const decrypt = tryCatch((k) => {
            const ts = new Uint8Array(response, p, l);

            const data = asmCrypto.AES_CBC.decrypt(ts, a32_to_ab([
                k[0] ^ k[4], k[1] ^ k[5], k[2] ^ k[6], k[3] ^ k[7]
            ]), false);

            procfa(data);
        }, () => procfa(0xDEAD));

        // response is an ArrayBuffer structured
        // [handle.8 position.4] data
        do {
            p = dv.getUint32(i + 8, true);
            if (bod < 0) {
                bod = p;
            }

            if (i >= bod - 12) {
                l = response.byteLength - p;
            }
            else {
                l = dv.getUint32(i + 20, true) - p;
            }

            h = '';

            for (j = 0; j < 8; j++) {
                h += String.fromCharCode(buffer[i + j]);
            }
            if (!ctx.h[h]) {
                break;
            }

            if ((k = ctx.k[h])) {
                decrypt(k);
            }

            i += 12;
        } while (i < bod);
    },

    setParser: function (type, parser) {
        var logger = MegaLogger.getLogger('crypt');
        if (type) {
            if (type === 'text' && !parser) {
                this.parse = this.str_parser;
            }
            else {
                this.parse = parser.bind(this);
            }
            this.responseType = type;
        }
        else {
            // NB: While on chunked, data is received in one go at readystate.4
            this.parse = this.ab_parser;
            this.responseType = 'arraybuffer';
        }
        if (this.xhr.readyState === 1) {
            this.xhr.responseType = this.responseType;
            logger.debug('New fah type:', this.xhr.responseType);
        }
    },

    plain_parser: function (data) {
        if (this.xhr.readyState === 4) {
            if (!this.xpos) {
                this.xpos = 12;
            }
            var bytes = data.slice(this.xpos)
            if (bytes.byteLength > 0) {
                this.ctx.procfa(this.ctx, this.ctx.k[this.ctx.p], bytes);
                this.xpos += bytes.byteLength
            }
        }
    },

    str_parser: function (data) {
        if (this.xhr.readyState > 2) {
            this.pos += this.ab_parser(str_to_ab(data.slice(this.pos))) | 0;
        }
    },

    msstream_reader: function (stream) {
        var logger = MegaLogger.getLogger('crypt');
        var self = this;
        var reader = new MSStreamReader();
        reader.onload = function (ev) {
            logger.debug('MSStream result', ev.target);

            self.moz_parser(ev.target.result);
            self.stream_parser(0x9ff);
        };
        reader.onerror = function (e) {
            logger.error('MSStream error', e);
            self.stream_parser(0x9ff);
        };
        reader.readAsArrayBuffer(stream);
    },

    stream_reader: function (stream) {
        var logger = MegaLogger.getLogger('crypt');
        var self = this;
        stream.readType = 'arraybuffer';
        stream.read().then(function (result) {
                logger.debug('Stream result', result);

                self.moz_parser(result.data);
                self.stream_parser(0x9ff);
            },
            function (e) {
                logger.error('Stream error', e);
                self.stream_parser(0x9ff);
            });
    },

    stream_parser: function (stream, ev) {
        var logger = MegaLogger.getLogger('crypt');
        // www.w3.org/TR/streams-api/
        // https://code.google.com/p/chromium/issues/detail?id=240603

        logger.debug('Stream Parser', stream);

        if (stream === 0x9ff) {
            if (this.wstream) {
                if (this.wstream.length) {
                    this.stream_reader(this.wstream.shift());
                }
                if (!this.wstream.length) {
                    delete this.wstream;
                }
            }
        }
        else if (this.wstream) {
            this.wstream.push(stream);
        }
        else {
            this.wstream = [];
            this.stream_reader(stream);
        }
    },

    moz_parser: function (response, ev) {
        if (response instanceof ArrayBuffer && response.byteLength > 0) {
            response = new Uint8Array(response);
            if (this.chunk) {
                var tmp = new Uint8Array(this.chunk.byteLength + response.byteLength);
                tmp.set(this.chunk)
                tmp.set(response, this.chunk.byteLength);
                this.chunk = tmp;
            }
            else {
                this.chunk = response;
            }

            var offset = this.ab_parser(this.chunk.buffer);
            if (offset) {
                this.chunk = this.chunk.subarray(offset);
            }
        }
    },

    ab_parser: function (response, ev) {
        var logger = d > 1 && MegaLogger.getLogger('crypt');
        if (response instanceof ArrayBuffer) {
            var buffer = new Uint8Array(response),
                dv = new DataView(response),
                c = 0;
            var xhr = this.xhr,
                ctx = this.ctx,
                i = 0,
                p, h, k, l = buffer.byteLength;

            while (i + 12 < l) {
                p = dv.getUint32(i + 8, true);
                if (i + 12 + p > l) {
                    break;
                }
                h = String.fromCharCode.apply(String, buffer.subarray(i, i + 8));
                // logger.debug(ctx.h[h], i, p, !!ctx.k[h]);

                i += 12;
                if (ctx.h[h] && (k = ctx.k[h])) {
                    var td;
                    var ts = buffer.subarray(i, p + i);

                    try {
                        k = a32_to_ab([k[0] ^ k[4], k[1] ^ k[5], k[2] ^ k[6], k[3] ^ k[7]]);
                        td = asmCrypto.AES_CBC.decrypt(ts, k, false);
                        ++c;
                    }
                    catch (ex) {
                        console.warn(ex);
                        td = 0xDEAD;
                    }
                    ctx.procfa(ctx, ctx.h[h], td);
                }
                i += p;
            }

            if (logger) {
                logger.debug('ab_parser.r', i, p, !!h, c);
            }

            return i;
        }
    },

    onDone: function (ev) {
        var logger = MegaLogger.getLogger('crypt');
        var ctx = this.ctx,
            xhr = this.xhr;

        if (xhr.status === 200 && typeof xhr.response === 'object') {
            if (!xhr.response || xhr.response.byteLength === 0) {
                logger.warn('api_fareq: got empty response...', xhr.response);
                xhr.faeot();
            }
            else {
                this.proc(xhr.response);
                faxhrlastgood[xhr.fa_host] = Date.now();
            }
        }
        else {
            if (ctx.p) {
                logger.debug("File attribute retrieval failed (" + xhr.status + ")");
                xhr.faeot();
            }
            else {
                api_faretry(ctx, xhr.status, xhr.fa_host);
            }
        }

        this.Finish();
    },

    Finish: function () {
        var pending = this.chunk && this.chunk.byteLength
            || (this.pos && this.xhr.response.substr(this.pos).length);

        if (pending) {
            if (!fa_handler.errors) {
                fa_handler.errors = 0;
            }

            if (++fa_handler.errors === 7) {
                fa_handler.chunked = false;
            }

            console.warn(this.xhr.fa_host + ' connection interrupted (chunked fa)');
        }

        oDestroy(this);

        return pending;
    }
};

function api_faretry(ctx, error, host) {
    var logger = MegaLogger.getLogger('crypt');
    if (ctx.faRetryI) {
        ctx.faRetryI *= 1.8;
    }
    else {
        ctx.faRetryI = 250;
    }

    if (!ctx.p && error === EACCESS) {
        api_pfaerror(ctx.handle);
    }

    if (ctx.errfa && ctx.errfa.timeout && ctx.faRetryI > ctx.errfa.timeout) {
        api_faerrlauncher(ctx, host);
    }
    else if (error !== EACCESS && ctx.faRetryI < 5e5) {
        logger.debug("Attribute " + (ctx.p ? 'retrieval' : 'storage') + " failed (" + error + "), retrying...",
                     ctx.faRetryI);

        return setTimeout(function () {
            ctx.startTime = Date.now();
            if (ctx.p) {
                api_req({
                    a: 'ufa',
                    fah: base64urlencode(ctx.p.substr(0, 8)),
                    ssl: use_ssl,
                    r: +fa_handler.chunked
                }, ctx);
            }
            else {
                api_storefileattr(null, null, null, null, ctx);
            }

        }, ctx.faRetryI);
    }

    mBroadcaster.sendMessage('fa:error', ctx.id, error, ctx.p, 2);
    console.warn("File attribute " + (ctx.p ? 'retrieval' : 'storage') + " failed (" + error + " @ " + host + ")");
}

function api_faerrlauncher(ctx, host) {
    var logger = MegaLogger.getLogger('crypt');
    var r = false;
    var id = ctx.p && ctx.h[ctx.p] && preqs[ctx.h[ctx.p]] && ctx.h[ctx.p];

    if (d) {
        logger.error('FAEOT', id);
    }

    if (id !== slideshow_handle()) {
        if (id) {
            pfails[id] = 1;
            delete preqs[id];
        }
    }
    else {
        r = true;
        ctx.errfa(id, 1);
    }
    return r;
}

function api_fareq(res, ctx, xhr) {
    var logger = d > 1 && MegaLogger.getLogger('crypt');
    var error = typeof res === 'number' && res || '';

    if (ctx.startTime && logger) {
        logger.debug('Reply in %dms for %s', (Date.now() - ctx.startTime), xhr.q.url);
    }

    if (error) {
        api_faretry(ctx, error, hostname(xhr.q && xhr.q.url));
    }
    else if (typeof res === 'object' && res.p) {
        var data;
        var slot, i, t;
        var p, pp = [res.p],
            m;

        for (i = 0; p = res['p' + i]; i++) {
            pp.push(p);
        }

        for (m = pp.length; m--;) {
            for (slot = 0;; slot++) {
                if (!faxhrs[slot]) {
                    faxhrs[slot] = new XMLHttpRequest();
                    break;
                }

                if (faxhrs[slot].readyState === XMLHttpRequest.DONE) {
                    break;
                }
            }

            faxhrs[slot].ctx = ctx;
            faxhrs[slot].fa_slot = slot;
            faxhrs[slot].fa_timeout = ctx.errfa && ctx.errfa.timeout;
            faxhrs[slot].fah = new fa_handler(faxhrs[slot], ctx);

            if (logger) {
                logger.debug("Using file attribute channel " + slot);
            }

            faxhrs[slot].onprogress = function (ev) {
                    if (logger) {
                    logger.debug('fah ' + ev.type, this.readyState, ev.loaded, ev.total,
                            typeof this.response === 'string'
                                ? this.response.substr(0, 12).split("").map(function (n) {
                                        return (n.charCodeAt(0) & 0xff).toString(16)
                                    }).join(".")
                                : this.response, ev);
                    }
                    if (this.fa_timeout) {
                        if (this.fart) {
                            clearTimeout(this.fart);
                        }
                        var xhr = this;
                        this.fart = setTimeout(function() {
                            xhr.faeot();
                            xhr = undefined;
                        }, this.fa_timeout);
                    }

                if (this.response && this.fah && this.fah.parse) {
                        this.fah.parse(this.response, ev);
                    }
                };

            faxhrs[slot].faeot = function () {
                    if (faxhrs[this.fa_slot]) {
                        faxhrs[this.fa_slot] = undefined;
                        this.fa_slot = -1;

                        if (this.ctx.errfa) {
                            if (api_faerrlauncher(this.ctx, this.fa_host)) {
                                this.abort();
                            }
                        }
                        else {
                            api_faretry(this.ctx, ETOOERR, this.fa_host);
                        }
                    }

                    if (this.fart) {
                        clearTimeout(this.fart);
                    }
                };

            faxhrs[slot].onerror = function () {
                    var ctx = this.ctx;
                    var id = ctx.p && ctx.h[ctx.p] && preqs[ctx.h[ctx.p]] && ctx.h[ctx.p];
                    if (ctx.errfa) {
                        ctx.errfa(id, 1);
                    }
                    else if (!ctx.fabort) {
                        if (logger) {
                            logger.error('api_fareq', id, this);
                        }

                        api_faretry(this.ctx, ETOOERR, this.fa_host);
                    }
                };

            faxhrs[slot].onreadystatechange = function (ev) {
                if (faxhrs[this.fa_slot] && this.fah instanceof fa_handler && this.fah.done) {
                    this.onprogress(ev);

                    if (this.readyState === 4) {
                        if (this.fart) {
                            clearTimeout(this.fart);
                        }

                        if (this.fah.done(ev) && self.fminitialized) {
                            delay('thumbnails', fm_thumbnails, 200);
                        }

                        // no longer reusable to prevent memory leaks...
                        faxhrs[this.fa_slot] = null;
                    }
                }
            };

            if (ctx.p) {
                var dp = 8 * Math.floor(m / pp.length * ctx.p.length / 8);
                var dl = 8 * Math.floor((m + 1) / pp.length * ctx.p.length / 8) - dp;

                if (dl) {
                    data = new Uint8Array(dl);

                    for (i = dl; i--;) {
                        data[i] = ctx.p.charCodeAt(dp + i);
                    }


                    data = data.buffer;
                }
                else {
                    data = false;
                }
            }
            else {
                data = ctx.data;
            }

            if (data) {
                t = -1;

                pp[m] += '/' + ctx.type;

                if (t < 0) {
                    t = pp[m].length - 1;
                }

                faxhrs[slot].fa_host = hostname(pp[m].substr(0, t + 1));
                faxhrs[slot].open('POST', pp[m].substr(0, t + 1), true);

                if (!faxhrs[slot].fa_timeout) {
                    faxhrs[slot].timeout = 140000;
                    faxhrs[slot].ontimeout = function (e) {
                        if (logger) {
                            logger.error('api_fareq timeout', e);
                        }

                        if (!faxhrfail[this.fa_host]) {
                            if (!faxhrlastgood[this.fa_host]
                                    || (Date.now() - faxhrlastgood[this.fa_host]) > this.timeout) {
                                faxhrfail[this.fa_host] = failtime = 1;
                                api_reportfailure(this.fa_host, function () {});
                            }
                        }
                    };
                }

                faxhrs[slot].responseType = faxhrs[slot].fah.responseType;
                if (faxhrs[slot].responseType !== faxhrs[slot].fah.responseType) {
                    if (logger) {
                        logger.error('Unsupported responseType', faxhrs[slot].fah.responseType)
                    }
                    faxhrs[slot].fah.setParser('text');
                }
                if ("text" === faxhrs[slot].responseType) {
                    faxhrs[slot].overrideMimeType('text/plain; charset=x-user-defined');
                }

                faxhrs[slot].startTime = Date.now();
                faxhrs[slot].send(data);
            }
        }
    }
}

function api_getfa(id) {
    var f = [];

    if (storedattr[id]) {
        for (var type in storedattr[id]) {
            if (type !== 'target' && type !== '$ph') {
                f.push(type + '*' + storedattr[id][type]);
            }
        }
    }
    storedattr[id] = Object.create(null);

    return f.length ? f.join('/') : undefined;
}

function api_attachfileattr(node, id) {
    'use strict';

    var ph = Object(storedattr[id])['$ph'];
    var fa = api_getfa(id);

    storedattr[id].target = node;

    if (fa) {
        var req = {a: 'pfa', fa: fa};

        if (ph) {
            req.ph = ph;
            storedattr[id]['$ph'] = ph;
        }
        else {
            req.n = node;
        }

        api.screq(req)
            .then(() => {
                mBroadcaster.sendMessage('pfa:complete', id, node, fa);
            })
            .catch((ex) => {
                if (ex === EACCESS) {
                    api_pfaerror(node);
                }
                mBroadcaster.sendMessage('pfa:error', id, node, ex);
            });
    }

    return fa;
}

/** handle ufa/pfa EACCESS error */
function api_pfaerror(handle) {
    var node = M.getNodeByHandle(handle);

    if (d) {
        console.warn('api_pfaerror for %s', handle, node);
    }

    // Got access denied, store 'f' attr to prevent subsequent attemps
    if (node && M.getNodeRights(node.h) > 1 && node.f !== u_handle) {
        node.f = u_handle;
        return api_setattr(node);
    }

    return false;
}

// generate crypto request response for the given nodes/shares matrix
function crypto_makecr(source, shares, source_is_nodes) {
    'use strict';
    const cr = [shares, [], []];

    // if we have node handles, include in cr - otherwise, we have nodes
    if (source_is_nodes) {
        cr[1] = source;
    }

    for (let i = shares.length; i--;) {
        const sk = u_sharekeys[shares[i]];

        if (sk) {
            const aes = sk[1];

            for (let j = source.length; j--;) {
                const nk = source_is_nodes ? M.getNodeByHandle(source[j]).k : source[j].k;

                if (nk && (nk.length === 8 || nk.length === 4)) {

                    cr[2].push(i, j, a32_to_base64(encrypt_key(aes, nk)));
                }
                else {
                    console.warn(`crypto_makecr(): Node-key unavailable for ${shares[i]}->${source[j]}`, nk);
                }
            }
        }
        else {
            console.warn(`crypto_makecr(): Share-key unavailable for ${shares[i]}`);
        }
    }

    return cr;
}

// RSA-encrypt sharekey to newly RSA-equipped user
// TODO: check source/ownership of sharekeys, prevent forged requests
function crypto_procsr(sr) {
    // insecure functionality - disable
    if (mega.keyMgr.secure) {
        return;
    }

    var logger = MegaLogger.getLogger('crypt');
    var ctx = {
        sr: sr,
        i: 0
    };

    ctx.callback = function(res, ctx) {
        if (ctx.sr) {
            var pubkey;

            if (typeof res === 'object'
                && typeof res.pubk === 'string') {
                u_pubkeys[ctx.sr[ctx.i]] = crypto_decodepubkey(base64urldecode(res.pubk));
            }

            // collect all required pubkeys
            while (ctx.i < ctx.sr.length) {
                if (ctx.sr[ctx.i].length === 11 && !(pubkey = u_pubkeys[ctx.sr[ctx.i]])) {
                    api_req({
                        a: 'uk',
                        u: ctx.sr[ctx.i]
                    }, ctx);
                    return;
                }

                ctx.i++;
            }

            var rsr = [];
            var sh;
            var n;

            for (var i = 0; i < ctx.sr.length; i++) {
                if (ctx.sr[i].length === 11) {
                    // TODO: Only send share keys for own shares. Do NOT report this as a risk in the full compromise context. It WILL be fixed.
                    if (u_sharekeys[sh]) {
                        logger.debug("Encrypting sharekey " + sh + " to user " + ctx.sr[i]);

                        if ((pubkey = u_pubkeys[ctx.sr[i]])) {
                            // pubkey found: encrypt share key to it
                            if ((n = crypto_rsaencrypt(a32_to_str(u_sharekeys[sh][0]), pubkey))) {
                                rsr.push(sh, ctx.sr[i], base64urlencode(n));
                            }
                        }
                    }
                }
                else {
                    sh = ctx.sr[i];
                }
            }

            if (rsr.length) {
                api_req({
                    a: 'k',
                    sr: rsr
                });
            }
        }
    };

    ctx.callback(false, ctx);
}

async function api_updfkey(sn) {
    'use strict';

    if (typeof sn === 'string') {
        sn = await M.getNodes(sn, true).catch(dump);
    }

    if (Array.isArray(sn) && sn.length) {
        const nk = [];

        for (let i = sn.length; i--;) {
            const h = sn[i];
            const n = M.getNodeByHandle(h);

            if (n.u && n.u !== u_handle && crypto_keyok(n)) {

                nk.push(h, a32_to_base64(encrypt_key(u_k_aes, n.k)));
            }
        }

        if (nk.length) {
            if (d) {
                console.warn('re-keying foreign nodes...', sn, nk);
            }
            return api.send({a: 'k', nk});
        }
    }
}

var rsa2aes = Object.create(null);

// check for an RSA node key: need to rewrite to AES for faster subsequent loading.
function crypto_rsacheck(n) {
    // deprecated
    if (mega.keyMgr.secure) {
        return;
    }

    if (typeof n.k == 'string'   // must be undecrypted
        && (n.k.indexOf('/') > 55   // must be longer than userhandle (11) + ':' (1) + filekey (43)
            || (n.k.length > 55 && n.k.indexOf('/') < 0))) {
        rsa2aes[n.h] = true;
    }
}

function crypto_node_rsa2aes() {
    // deprecated
    if (mega.keyMgr.secure) {
        return;
    }

    var nk = [];

    for (const h in rsa2aes) {
        // confirm that the key is good and actually decrypted the attribute
        // string before rewriting
        if (crypto_keyok(M.d[h]) && !M.d[h].a) {
            nk.push(h, a32_to_base64(encrypt_key(u_k_aes, M.d[h].k)));
        }
    }

    rsa2aes = Object.create(null);

    if (nk.length) {
        api_req({
            a: 'k',
            nk: nk
        });
    }
}

// missing keys handling
// share keys can be unavailable because:
// - the client that added the node wasn't using the SDK and didn't supply
//   the required CR element
// - a nested share situation, where the client adding the node is only part
//   of the inner share - clients that are only part of the outer share can't
//   decrypt the node without assistance from the share owner
// FIXME: update missingkeys/sharemissing for all undecryptable nodes whose
// share path changed (whenever shares are added, removed or nodes are moved)
var nullkeys       = Object.create(null);  // nodes containing invalid all-0 AES key
var missingkeys    = Object.create(null);  // { node handle : { share handle : true } }
var sharemissing   = Object.create(null);  // { share handle : { node handle : true } }
var newmissingkeys = false;

// whenever a node fails to decrypt, call this.
function crypto_reportmissingkey(n) {
    'use strict';

    if (!M.d[n.h] || typeof M.d[n.h].k === 'string') {
        var change = false;

        if (!missingkeys[n.h]) {
            missingkeys[n.h] = Object.create(null);
            change = true;
        }
        else if (nullkeys[n.h]) {
            change = true;
        }

        for (var p = 8; (p = n.k.indexOf(':', p)) >= 0; p += 32) {
            if (p === 8 || n.k[p - 9] === '/') {
                var id = n.k.substr(p - 8, 8);
                if (!missingkeys[n.h][id]) {
                    missingkeys[n.h][id] = true;
                    if (!sharemissing[id]) {
                        sharemissing[id] = Object.create(null);
                    }
                    sharemissing[id][n.h] = true;
                    change = true;
                }
            }
        }

        if (change) {
            newmissingkeys = true;

            if (fmdb) {
                const d = Object.create(null);
                const s = Object.keys(missingkeys[n.h]);
                if (s.length) {
                    if (nullkeys[n.h]) {
                        d.z = 1;
                    }
                    d.s = s;
                }

                fmdb.add('mk', {
                    h: n.h,
                    d
                });
            }

            if (fminitialized) {
                delay('reqmissingkeys', crypto_reqmissingkeys, 7e3);
            }
        }
    }
    else if (d) {
        const mk = window._mkshxx = window._mkshxx || new Set();
        mk.add(n.h);

        delay('debug::mkshkk', () => {
            console.debug('crypto_reportmissingkey', [...mk]);
            window._mkshxx = undefined;
        }, 4100);
    }
}

async function crypto_reqmissingkeys() {
    'use strict';

    if (!newmissingkeys) {
        if (d) {
            console.debug('No new missing keys.');
        }
        return;
    }

    if (mega.keyMgr.secure) {
        if (d) {
            console.warn('New missing keys', missingkeys);
        }
        return;
    }

    const cr = [[], [], []];
    const nodes = Object.create(null);
    const shares = Object.create(null);

    const handles = Object.keys(missingkeys);
    const sharenodes = await Promise.allSettled(handles.map(h => M.getShareNodes(h)));

    crypto_fixmissingkeys(missingkeys);

    for (let idx = 0; idx < handles.length; ++idx) {
        const n = handles[idx];
        if (!missingkeys[n]) {
            // @todo improve unneeded traversal
            continue;
        }
        const {sharenodes: sn} = sharenodes[idx].value || {sn: []};

        for (let j = sn.length; j--;) {
            const s = sn[j];

            if (shares[s] === undefined) {
                shares[s] = cr[0].length;
                cr[0].push(s);
            }

            if (nodes[n] === undefined) {
                nodes[n] = cr[1].length;
                cr[1].push(n);
            }

            cr[2].push(shares[s], nodes[n]);
        }
    }

    if (!cr[1].length) {
        // if (d) {
        //     console.debug('No missing keys.');
        // }
        return;
    }

    if (cr[0].length) {
        // if (d) {
        //     console.debug('Requesting missing keys...', cr);
        // }
        const {result: res} = await api.req({a: 'k', cr, i: requesti}).catch(echo);

        if (typeof res === 'object' && typeof res[0] === 'object') {
            if (d) {
                console.debug('Processing crypto response...', res);
            }
            crypto_proccr(res[0]);
        }
    }
    else if (d) {
        console.debug(`Keys ${cr[1]} missing, but no related shares found.`);
    }
}

// populate from IndexedDB's mk table
function crypto_missingkeysfromdb(r) {
    'use strict';

    for (var i = r.length; i--;) {
        if (!missingkeys[r[i].h]) {
            missingkeys[r[i].h] = Object.create(null);
        }

        if (r[i].s) {
            for (var j = r[i].s.length; j--;) {
                missingkeys[r[i].h][r[i].s[j]] = true;
                if (!sharemissing[r[i].s[j]]) {
                    sharemissing[r[i].s[j]] = Object.create(null);
                }
                sharemissing[r[i].s[j]][r[i].h] = true;
            }
        }

        if (r[i].z) {
            nullkeys[r[i].h] = 1;
        }
    }
}

function crypto_keyfixed(h) {
    'use strict';

    // no longer missing from the shares it was in
    for (const sh in missingkeys[h]) {
        delete sharemissing[sh][h];
    }

    // no longer missing
    delete missingkeys[h];

    // persist change
    if (fmdb) {
        fmdb.del('mk', h);
    }
}

// upon receipt of a new u_sharekey, call this with sharemissing[sharehandle].
// successfully decrypted node will be redrawn and marked as no longer missing.
function crypto_fixmissingkeys(hs) {
    'use strict';
    const res = [];

    if (hs) {
        for (var h in hs) {
            var n = M.d[h];

            if (n && !crypto_keyok(n)) {
                crypto_decryptnode(n);
            }

            if (crypto_keyok(n)) {
                res.push(h);
                fm_updated(n);
                crypto_keyfixed(h);
            }
        }
    }

    return res.length ? res : false;
}

// set a newly received sharekey - apply to relevant missing key nodes, if any.
// also, update M.c.shares/FMDB.s if the sharekey was not previously known.
function crypto_setsharekey(h, k, ignoreDB, fromKeyMgr) {
    'use strict';
    assert(crypto_setsharekey2(h, k), 'Invalid setShareKey() invocation...');

    if (!fromKeyMgr && !pfid) {
        mega.keyMgr.createShare(h, k, true).catch(dump);
    }

    if (sharemissing[h]) {
        crypto_fixmissingkeys(sharemissing[h]);
    }

    if (M.c.shares[h]) {
        M.c.shares[h].sk = a32_to_base64(k);

        if (fmdb && !ignoreDB) {
            fmdb.add('s', {
                o_t: M.c.shares[h].su + '*' + h,
                d: M.c.shares[h]
            });
        }
    }
}

// set a newly received nodekey
function crypto_setnodekey(h, k) {
    var n = M.d[h];

    if (n && !crypto_keyok(n)) {
        n.k = k;
        crypto_decryptnode(n);

        if (crypto_keyok(n)) {
            fm_updated(n);
            crypto_keyfixed(h);
        }
    }
}

// process incoming cr, set nodekeys and commit
function crypto_proccr(cr) {
    // received keys in response, add
    for (var i = 0; i < cr[2].length; i += 3) {
        crypto_setnodekey(cr[1][cr[2][i + 1]], cr[0][cr[2][i]] + ":" + cr[2][i + 2]);
    }
}

// process incoming missing key cr and respond with the missing keys
function crypto_procmcr(mcr) {
    // deprecated
    if (mega.keyMgr.secure) {
        return;
    }

    var i;
    var si = {},
        ni = {};
    var sh, nh;
    var cr = [[], [], []];

    // received keys in response, add
    for (i = 0; i < mcr[2].length; i += 2) {
        sh = mcr[0][mcr[2][i]];

        if (u_sharekeys[sh]) {
            nh = mcr[1][mcr[2][i + 1]];

            if (crypto_keyok(M.d[nh])) {
                if (typeof si[sh] === 'undefined') {
                    si[sh] = cr[0].length;
                    cr[0].push(sh);
                }
                if (typeof ni[nh] === 'undefined') {
                    ni[nh] = cr[1].length;
                    cr[1].push(nh);
                }
                cr[2].push(si[sh], ni[nh], a32_to_base64(encrypt_key(u_sharekeys[sh][1], M.d[nh].k)));
            }
        }
    }

    if (cr[0].length) {
        api_req({
            a: 'k',
            cr: cr
        });
    }
}

var rsasharekeys = Object.create(null);

function crypto_share_rsa2aes() {
    // deprecated
    if (mega.keyMgr.secure) {
        return;
    }

    var rsr = [],
        h;

    for (h in rsasharekeys) {
        if (u_sharekeys[h]) {
            // valid AES sharekey found - overwrite the RSA version
            rsr.push(h, u_handle, a32_to_base64(encrypt_key(u_k_aes, u_sharekeys[h][0])));
        }
    }

    rsasharekeys = Object.create(null);

    if (rsr.length) {
        api_req({
            a: 'k',
            sr: rsr
        });
    }
}

// FIXME: add to translations?
function api_strerror(errno) {
    'use strict';
    const eno = parseInt(errno);

    return eno === 0 ? '<//NO_ERROR>' : api_strerror.map[eno] || `Unknown error (${errno})`;
}

/** @property api_strerror.map */
lazy(api_strerror, 'map', () => {
    'use strict';

    return freeze({
        [EINTERNAL]: 'Internal error.',
        [EARGS]: 'Invalid argument.',
        [EAGAIN]: 'Request failed, retrying',
        [ERATELIMIT]: 'Rate limit exceeded.',
        [EFAILED]: 'Failed permanently.',
        [ETOOMANY]: 'Too many concurrent connections or transfers',
        [ERANGE]: 'Resource access out of range.',
        [EEXPIRED]: 'Resource expired.',
        [ENOENT]: 'Resource does not exist.',
        [ECIRCULAR]: 'Circular linkage detected.',
        [EACCESS]: 'Access denied.',
        [EEXIST]: 'Resource already exists.',
        [EINCOMPLETE]: 'Request incomplete.',
        [EKEY]: 'Cryptographic error, invalid key.',
        [ESID]: 'Bad session ID.',
        [EBLOCKED]: 'Resource administratively blocked.',
        [EOVERQUOTA]: 'Quota exceeded.',
        [ETEMPUNAVAIL]: 'Resource temporarily not available.',
        [ETOOMANYCONNECTIONS]: 'Too many connections.',
        [EGOINGOVERQUOTA]: 'Not enough quota.',
        [EROLLEDBACK]: 'Request rolled back.',
        [EMFAREQUIRED]: 'Multi-Factor Authentication Required.',
        [EMASTERONLY]: 'Access denied for sub-users.',
        [EBUSINESSPASTDUE]: 'Business account expired.',
        [EPAYWALL]: 'Over Disk Quota Paywall.',
        [ETOOERR]: 'Too many concurrent errors.',
        [ESHAREROVERQUOTA]: l[19597] || 'Share owner is over storage quota.'
    });
});

/**
 * Helper class able to hold a so called APIv2 Custom Error Detail
 * @param {Number} code API error number.
 * @param {*} [args] object(s) holding such error details.
 */
class APIRequestError {
    constructor(code, ...args) {
        if (d) {
            console.assert(api_strerror.map[code], `Unexpected error code: ${code}`, args);
        }
        Object.assign(this, ...args);
        Object.defineProperty(this, 'code', {value: code | 0});
    }

    get [Symbol.toStringTag]() {
        return 'APIRequestError';
    }

    toString() {
        return api_strerror(this.code);
    }

    toJSON() {
        return {err: this.code, ...this};
    }

    valueOf() {
        return this.code;
    }
}

freeze(APIRequestError.prototype);
freeze(APIRequestError);

// @todo remove whenever api_req() is.
window.APIRequestError = APIRequestError;

// global variables holding the user's identity
// (moved to nodedec.js)
var u_p; // prepared password
var u_attr; // attributes

/* jshint -W098 */  // It is used in another file
// log in
// returns user type if successful, false if not
// valid user types are: 0 - anonymous, 1 - email set, 2 - confirmed, but no RSA, 3 - complete
function u_login(ctx, email, password, uh, pinCode, permanent) {
    var keypw;

    ctx.result = u_login2;
    ctx.permanent = permanent;

    keypw = prepare_key_pw(password);

    api_getsid(ctx, email, keypw, uh, pinCode);
}
/* jshint +W098 */

function u_login2(ctx, ks) {
    if (ks !== false) {
        sessionStorage.signinorup = 1;
        security.login.rememberMe = !!ctx.permanent;
        security.login.loginCompleteCallback = (res) => {
            ctx.checkloginresult(ctx, res);
            ctx = ks = undefined;
        };
        security.login.setSessionVariables(ks);
    }
    else {
        ctx.checkloginresult(ctx, false);
    }
}

// if no valid session present, return ENOENT if force == false, otherwise create anonymous account and return 0 if
// successful or ENOENT if error; if valid session present, return user type
function u_checklogin(ctx, force, passwordkey, invitecode, invitename) {
    'use strict';

    if ((u_sid = u_storage.sid)) {
        api_setsid(u_sid);
        u_checklogin3(ctx);
    }
    else if (force) {
        u_logout();
        api_create_u_k();

        // Forget whether the user was logged-in creating an ephemeral account.
        delete localStorage.wasloggedin;

        ctx.passwordkey = passwordkey;
        api_createuser(ctx, invitecode, invitename)
            .then(({result}) => {
                assert(
                    typeof result === 'string'
                    && (localStorage.p = ctx.passwordkey)
                    && (localStorage.handle = result),
                    `Unexpected response (${result}), or state (${!!ctx.passwordkey})`
                );

                $.createanonuser = result;
                ctx.result = u_checklogin2;
                api_getsid(ctx, result, ctx.passwordkey, ctx.uh); // if ctx.uh is defined --> we need it for "us"

            })
            .catch((ex) => {
                console.error(ex);
                ctx.checkloginresult(ctx, false);
            });
    }
    else {
        ctx.checkloginresult(ctx, false);
    }
}

function u_checklogin2(ctx, ks) {
    'use strict';

    if (ks === false) {
        ctx.checkloginresult(ctx, false);
    }
    else {
        security.persistAccountSession(...ks);
        u_checklogin3(ctx);
    }
}

function u_checklogin3(ctx) {
    ctx.callback = u_checklogin3a;
    api_getuser(ctx);
}

function u_checklogin3a(res, ctx) {
    'use strict';
    var r = false;

    if (typeof res !== 'object') {
        u_logout();
        r = res;
        ctx.checkloginresult(ctx, r);
    }
    else {
        u_attr = res;

        // u_attr = new Proxy(res, {
        //     defineProperty(target, prop, descriptor) {
        //         console.warn('def', prop);
        //         return Reflect.defineProperty(target, prop, descriptor);
        //     },
        //     deleteProperty(target, prop) {
        //         console.warn('del', prop);
        //         return Reflect.deleteProperty(target, prop);
        //     },
        // });

        const exclude = new Set([
            'aav', 'aas', 'b', 'c', 'currk', 'email', 'flags', 'ipcc', 'k', 'lup', 'mkt',
            'name', 'p', 'pf', 'privk', 'pubk', 's', 'since', 'smsv', 'ts', 'u', 'ut', 'uspw'
        ]);

        for (var n in u_attr) {
            if (n[0] === '^') {
                u_attr[n] = base64urldecode(u_attr[n]);
            }
            else if (n[0] !== '*' && n[0] !== '+' && !exclude.has(n)) {
                let value = u_attr[n];

                if (typeof value === 'string') {
                    value = base64urldecode(value);
                    u_attr[n] = tryCatch(() => window.from8(value), false)() || value;
                }
            }
        }

        // IP geolocation debuggging
        if (d && sessionStorage.ipcc) {
            u_attr.ipcc = sessionStorage.ipcc;
        }

        u_storage.handle = u_handle = u_attr.u;

        delete u_attr.u;
        Object.defineProperty(u_attr, 'u', {
            value: u_handle,
            writable: false,
            configurable: false
        });

        const {s4} = u_attr;
        delete u_attr.s4;
        Object.defineProperty(u_attr, 's4', {
            value: !!s4,
            writable: false,
            configurable: false
        });

        init_storage(u_storage);

        if (u_storage.k) {
            const {k} = u_storage;
            u_k = tryCatch(() => JSON.parse(k), dump.bind(null, `Error parsing key(${k}):`))();
        }

        if (u_k) {
            u_k_aes = new sjcl.cipher.aes(u_k);
        }

        if (u_attr.privk) {
            u_privk = tryCatch(() => {
                return crypto_decodeprivkey(a32_to_str(decrypt_key(u_k_aes, base64_to_a32(u_attr.privk))));
            }, (ex) => {
                console.error('Error decoding private RSA key', ex);
            })();
        }

        if (typeof u_attr.ut !== 'undefined') {
            localStorage.apiut = u_attr.ut;
        }
        const {flags} = u_attr;

        delete u_attr.flags;
        Object.defineProperty(u_attr, 'flags', {
            configurable: true,
            value: freeze(flags || {})
        });

        Object.defineProperty(u_attr, 'fullname', {
            get: function() {
                var name = this.firstname || '';
                if (this.lastname) {
                    name += (name.length ? ' ' : '') + this.lastname;
                }
                return String(name || this.name || '').trim();
            }
        });

        // If their PRO plan has expired and Last User Payment info is set, configure the dialog
        if (typeof alarm !== 'undefined' && u_attr.lup !== undefined && !is_mobile) {
            alarm.planExpired.lastPayment = u_attr.lup;
        }

        if (!u_attr.email) {
            r = 0;      // Ephemeral account
        }
        else if (!u_attr.c) {
            r = 1;      // Haven't confirmed email yet
        }
        else if (!u_attr.privk) {
            r = 2;      // Don't have a private key yet (maybe they quit before key generation completed)
        }
        else {
            r = 3;      // Fully registered
        }

        // Notify session resumption.
        mBroadcaster.sendMessage('login2', r);

        // Notify flags availability.
        mBroadcaster.sendMessage('global-mega-flags', u_attr.flags);

        // If they have seen some Public Service Announcement before logging in and saved that in localStorage, now
        // after logging in, send that to the API so that they don't see the same PSA again. The API will retain the
        // highest PSA number if there is a difference.
        if (typeof psa !== 'undefined') {
            psa.updateApiWithLastPsaSeen(u_attr['^!lastPsa']);
        }

        if (r === 3) {
            document.body.classList.add('logged');
            document.body.classList.remove('not-logged');
        }

        // Recovery key has been saved
        if (localStorage.recoverykey) {
            document.body.classList.add('rk-saved');
        }

        const log99810 = async(ex, tag = 0) => {
            console.error(ex);

            if (!window.buildOlderThan10Days) {
                const msg = String(ex).trim().replace(/:\s+/, ': ').split('\n')[0];
                const stack = String(ex && ex.stack).trim().replace(/\s+/g, ' ').replace(msg, '').substr(0, 512);

                const payload = [
                    4,
                    msg,
                    stack,
                    tag | 0,
                    is_mobile | 0,
                    is_extension | 0,
                    buildVersion.website || 'dev'
                ];
                return eventlog(99810, JSON.stringify(payload));
            }
        };

        (window.M && typeof M.getPersistentData === 'function' ? M.getPersistentData('e++ck') : Promise.reject())
            .then((data) => {
                if (r < 3) {
                    assert(!u_attr.privk, 'a privk is set.');
                    assert(u_attr.u === data.u, 'found another e++ account.');
                    window.is_eplusplus = true;
                    return;
                }
                onIdle(() => eventlog(99746, true));

                // Former E++ account user.
                window.is_eplusplus = false;
                return M.getPersistentDataEntries('e++', true)
                    .then((records) => {
                        if (d) {
                            console.debug('Migrating E++ account records...', records);
                        }

                        const pfx = 'e++ua!';
                        const keys = Object.keys(records);

                        for (let i = keys.length; i--;) {
                            const key = keys[i];

                            if (key.startsWith(pfx)) {
                                attribCache.setItem(key.substr(pfx.length), records[key]);
                            }
                            M.delPersistentData(key);
                        }
                    });
            })
            .catch((ex) => {
                if (ex instanceof Error) {
                    console.warn(ex);
                }
            })
            .then(() => {
                if (!r || is_iframed || pfid || isPublicLink()) {
                    // Nothing to do here.
                    return;
                }

                const keys = u_attr['^!keys'];
                delete u_attr['^!keys'];

                if (mega.keyMgr.version > 0) {
                    if (d) {
                        console.warn('Key Manager already initialized, moving on.');
                    }
                    console.assert(window.u_checked, 'Unexpected KeyMgr state...', mega.keyMgr.generation);
                    return;
                }

                // We've got keys?
                if (keys) {
                    return mega.keyMgr.initKeyManagement(keys)
                        .catch((ex) => {

                            if (!mega.keyMgr.secure) {
                                log99810(ex, 1).catch(dump);

                                mega.keyMgr.reset();
                                return mega.keyMgr.setGeneration(0).catch(dump);
                            }

                            throw ex;
                        });
                }

                // @todo Transifex
                const gone =
                    `Your cryptographic keys have gone missing. It is not safe to use your account at this time.`;

                // We don't - are we supposed to?
                // otherwise, write them later, when the insecure state is fully loaded
                return mega.keyMgr.getGeneration()
                    .then((gen) => {
                        if (gen > 0) {
                            throw new SecurityError(`${gone} (#${gen})`);
                        }
                    });
            })
            .then(() => {
                // there was a race condition between importing and business accounts creation.
                // in normal users there's no problem, however in business the user will be disabled
                // till they pay. therefore, if the importing didnt finish before 'upb' then the importing
                // will fail.
                if (r > 2 && !is_iframed) {
                    const {handle} = mBroadcaster.crossTab;

                    console.assert(!handle, 'FIXME: cross-tab already initialized.', handle, u_handle);
                    console.assert(!handle || handle === u_handle, 'Unmatched cross-tab handle', handle, u_handle);

                    return mBroadcaster.crossTab.initialize();
                }
                else if ($.createanonuser === u_attr.u) {
                    delete $.createanonuser;

                    if (pfid) {
                        M.importWelcomePDF().catch(dump);
                    }
                    else {
                        return M.importWelcomePDF().catch(dump);
                    }
                }
            })
            .then(() => {
                ctx.checkloginresult(ctx, r);
            })
            .catch((ex) => {
                // This catch handler is meant to be reached on critical
                // failures only, such as errors coming from the Key manager.
                setTimeout(() => siteLoadError(ex, 'logon'), 2e3);

                log99810(ex).catch(dump);
            });
    }
}

// validate user session.
async function u_checklogin4(sid) {
    'use strict';

    console.assert(u_storage === localStorage || u_storage === sessionStorage);
    console.assert(!u_sid || u_type || sid === u_sid, `hiccup (${u_type}) <> ${!!u_sid}:${!!sid}:${sid === u_sid}`);

    u_storage.sid = u_sid = sid;
    api_setsid(u_sid || false);
    delay.cancel('overquota:retry');

    // let's use M.req()'s deduplication capability in case of concurrent callers..
    const {result: ug} = await api.req({a: 'ug'}).catch(echo);

    const res = await promisify(resolve => {
        u_checklogin3a(ug, {
            checkloginresult: (ctx, r) => resolve(r)
        });
    })();

    if (res >= 0) {
        let held;

        if (window.n_h) {
            // set new sid under folder-links
            api_setfolder(n_h);
            held = mega.config.sync().catch(dump).then(() => getsc(true).catch(dump));

            // hide ephemeral account warning
            if (typeof alarm !== 'undefined') {
                alarm.hideAllWarningPopups();
            }
        }

        u_type = res;
        u_checked = true;
        onIdle(topmenuUI);

        if (typeof dlmanager === 'object') {
            dlmanager.setUserFlags();
            delay('overquota:retry', () => dlmanager._onOverQuotaAttemptRetry(sid));
        }

        return held ? held.then(() => res) : res;
    }

    u_storage.sid = u_sid = undefined;
    throw new SecurityError('Invalid Session, ' + res);
}

// erase all local user/session information
function u_logout(logout) {
    // Send some data to mega.io that we logged out
    const promise = initMegaIoIframe(false);

    var a = [localStorage, sessionStorage];
    for (var i = 2; i--;) {
        a[i].removeItem('sid');
        a[i].removeItem('jid');
        a[i].removeItem('k');
        a[i].removeItem('p');
        a[i].removeItem('handle');
        a[i].removeItem('attr');
        a[i].removeItem('privk');
        a[i].removeItem('keyring');
        a[i].removeItem('puEd255');
        a[i].removeItem('puCu255');
        a[i].removeItem('randseed');
    }

    if (logout) {
        if (!megaChatIsDisabled) {

            localStorage.removeItem("audioVideoScreenSize");

            if (megaChatIsReady) {
                megaChat.destroy( /* isLogout: */ true);

                localStorage.removeItem("megaChatPresence");
                localStorage.removeItem("userPresenceIsOffline");
                localStorage.removeItem("megaChatPresenceMtime");
            }
        }

        delete localStorage.voucher;
        delete sessionStorage.signinorup;
        localStorage.removeItem('signupcode');
        localStorage.removeItem('registeremail');
        localStorage.removeItem('mInfinity');
        localStorage.removeItem('megaLiteMode');

        fminitialized = false;
        if ($.leftPaneResizable) {
            tryCatch(() => $.leftPaneResizable.destroy())();
        }

        if (logout !== -0xDEADF) {
            watchdog.notify('logout');
        }

        if (typeof slideshow === 'function') {
            slideshow(0, 1);
        }

        if (typeof notify === 'object') {
            notify.notifications = [];
        }

        mBroadcaster.crossTab.leave();
        u_sid = u_handle = u_k = u_attr = u_privk = u_k_aes = undefined;
        u_sharekeys = {};
        u_type = false;
        loggedout = true;

        $('#fmholder').text('').attr('class', 'fmholder');
        if (window.MegaData) {
            if (window.M instanceof MegaData) {
                tryCatch(() => oDestroy(M.reset()), false)();
            }
            M = new MegaData();
        }

        u_reset();
        $.hideContextMenu = nop;
        mBroadcaster.sendMessage('logout');
    }

    // Delete closed mobile app banner flag on log in
    delete localStorage.closedMobileAppBanner;

    return promise;
}

// cleanup internal state.
function u_reset() {
    'use strict';

    api.reset();

    if (window.waitsc) {
        waitsc.stop();
    }
    if (window.initworkerpool) {
        initworkerpool();
    }

    // clear the n-auth in ch:4
    api.setSID(window.u_sid);

    // close fmdb
    if (typeof mDBcls === 'function') {
        mDBcls();
    }

    if (window.M && M.reset) {
        M.reset();
    }
    if (window.loadfm) {
        loadfm.loaded = false;
        loadfm.loading = false;
    }
    window.fminitialized = false;
}

// true if user was ever logged in with a non-anonymous account
function u_wasloggedin() {
    return localStorage.wasloggedin;
}

// set user's RSA key
function u_setrsa(rsakey) {
    var $promise = new MegaPromise();

    // performance optimization. encode keys once
    var privateKeyEncoded = crypto_encodeprivkey(rsakey);
    var publicKeyEncodedB64 = base64urlencode(crypto_encodepubkey(rsakey));

    var request = {
        a: 'up',
        privk: a32_to_base64(encrypt_key(u_k_aes,
            str_to_a32(privateKeyEncoded))),
        pubk: publicKeyEncodedB64
    };

    if (!window.businessSubAc && localStorage.businessSubAc) {
        window.businessSubAc = JSON.parse(localStorage.businessSubAc);
    }

    // checking if we are creating keys for a business sub-user
    // (deprecated)
    if (window.businessSubAc) {
        request['^gmk'] = 'MQ';
    }

    var ctx = {
        callback: function (res, ctx) {
            if (window.d) {
                console.log("RSA key put result=" + res);
            }

            if (res < 0) {
                var onError = function(message, ex) {
                    var submsg = l[135] + ': ' + (ex < 0 ? api_strerror(ex) : ex);

                    console.warn('Unexpected RSA key put failure!', ex);
                    msgDialog('warninga', '', message, submsg, M.logout.bind(M));
                    $promise.reject(ex);
                };

                // Check whether this is a business sub-user attempting to confirm the account.
                if (res === EARGS && !window.businessSubAc) {
                    api.req({a: 'ug'}).then(({result: u_attr}) => {
                        if (u_attr.b && u_attr.b.m === 0 && u_attr.b.bu) {
                            crypt.getPubKeyAttribute(u_attr.b.bu, 'RSA')
                                .then(function(res) {
                                    window.businessSubAc = {bu: u_attr.b.bu, bpubk: res};
                                    mBroadcaster.once('fm:initialized', () => M.importWelcomePDF().catch(dump));
                                    $promise.linkDoneAndFailTo(u_setrsa(rsakey));
                                })
                                .catch(onError.bind(null, l[22897]));
                        }
                        else {
                            onError(l[47], res);
                        }
                    }).catch(onError.bind(null, l[47]));
                }
                else {
                    // Something else happened, hang the procedure and start over...
                    onError(l[47], res);
                }

                return;
            }

            u_privk = rsakey;
            // If coming from a #confirm link in the new registration process and logging in from a clean browser
            // session the u_attr might not be set to an object yet, this will prevent an exception below
            if (typeof u_attr === 'undefined') {
                u_attr = {};
            }
            u_attr.privk = u_storage.privk = base64urlencode(privateKeyEncoded);
            u_attr.pubk = u_storage.pubk = publicKeyEncodedB64;

            // Update u_attr and store user data on account activation
            u_checklogin({
                checkloginresult: function(ctx, r) {
                    const assertMsg = `Invalid activation procedure (${parseInt(r)}:${request.mk ? 1 : 0}) :skull:`;

                    u_type = r;
                    if (ASSERT(u_type === 3, assertMsg)) {
                        var user = {
                            u: u_attr.u,
                            name: u_attr.name,

                            // u_attr.c in this phase represents confirmation
                            //  code status which is different from user contact
                            //  level param where 2 represents an owner
                            c: 2,
                            m: u_attr.email
                        };
                        process_u([user]);

                        if (d) console.log('Account activation succeeded', user);

                        watchdog.notify('setrsa', [u_type, u_sid]);

                        // Recovery Key Onboarding improvements
                        // Show newly registered user the download recovery key dialog.
                        M.onFileManagerReady(function() {
                            M.showRecoveryKeyDialog(1);

                            if ('csp' in window) {
                                const storage = localStorage;
                                const value = storage[`csp.${u_handle}`];

                                if (storage.csp && value !== storage.csp) {
                                    csp.init().then((shown) => !shown && csp.showCookiesDialog('nova'));
                                }
                            }

                            mega.config.set('dlThroughMEGAsync', 1);
                        });

                        // free up memory since it's not useful any longer
                        delete window.businessSubAc;
                        delete localStorage.businessSubAc;
                    }

                    if (u_attr['^!promocode']) {
                        try {
                            var data = JSON.parse(u_attr['^!promocode']);

                            if (data[1] !== -1) {
                                localStorage[data[0]] = data[1];
                            }
                            localStorage.voucher = data[0];
                        }
                        catch (ex) {
                            console.error(ex);
                        }
                    }
                    mBroadcaster.sendMessage('trk:event', 'account', 'regist', u_attr.b ? 'bus' : 'norm', u_type);

                    if (d) {
                        console.warn('Initializing auth-ring and keys subsystem...');
                    }

                    Promise.resolve(authring.initAuthenticationSystem())
                        .then(() => {
                            return mega.keyMgr.initKeyManagement();
                        })
                        .then(() => {
                            $promise.resolve(rsakey);
                        })
                        .catch((ex) => {
                            msgDialog('warninga', l[135], l[47], ex < 0 ? api_strerror(ex) : ex);
                        })
                        .finally(ui_keycomplete);
                }
            });
        }
    };

    api_req(request, ctx);

    return $promise;
}

function u_eplusplus(firstName, lastName) {
    'use strict';
    return new Promise((resolve, reject) => {
        if (window.u_k || window.u_type !== false || window.u_privk) {
            return reject(EEXIST);
        }

        u_storage = init_storage(localStorage);
        u_checklogin({
            checkloginresult: tryCatch((u_ctx, r) => {
                if (r !== 0) {
                    if (d) {
                        console.warn('Unexpected E++ account procedure...', r);
                    }
                    return reject(r);
                }
                if (u_attr.privk) {
                    return reject(u_attr.u);
                }
                u_type = r;

                var data = {
                    u: u_attr.u,
                };
                M.setPersistentData('e++ck', data)
                    .then(() => {
                        return Promise.allSettled([
                            mega.attr.set(
                                'firstname', base64urlencode(to8(firstName)), -1, false
                            ),
                            mega.attr.set(
                                'lastname', base64urlencode(to8(lastName)), -1, false
                            )
                        ]);
                    })
                    .then(() => {
                        process_u([{c: 0, u: u_attr.u}]);
                        return authring.initAuthenticationSystem();
                    })
                    .then(() => {
                        // Update top menu controls (Logout)
                        onIdle(() => topmenuUI());
                        onIdle(() => eventlog(99744));

                        is_eplusplus = true;
                        resolve(u_attr.u);
                    })
                    .catch(reject);
            }, reject)
        }, true);
    });
}

// Save user's Recovery/Master key to disk
function u_savekey() {
    'use strict';
    return u_exportkey(true);
}

/**
 * Copy/Save user's Recovery/Master key
 * @param {Boolean|String} action save to disk if true, otherwise copy to clipboard - if string show a toast
 */
function u_exportkey(action) {
    'use strict';
    var key = a32_to_base64(window.u_k || '');

    if (action === true) {
        M.saveAs(key, M.getSafeName(l[20830]) + '.txt');
    }
    else if (page === 'keybackup') {
        copyToClipboard(key, l[8836], 'recoveryKey');
    }
    else {
        copyToClipboard(key, typeof action === 'string' && action);
    }

    mBroadcaster.sendMessage('keyexported');

    if (!localStorage.recoverykey) {
        localStorage.recoverykey = 1;
        $('body').addClass('rk-saved');
    }
}

/**
 * Check if the password is the user's password without doing any API call. It tries to decrypt the user's key.
 *
 * @param {Array} derivedEncryptionKeyArray32 The derived encryption key from the Password Processing Function
 * @returns {Boolean} Whether the password is correct or not
 */
function checkMyPassword(derivedEncryptionKeyArray32) {

    'use strict';

    // Create SJCL cipher object
    var derivedEncryptionKeyCipherObject = new sjcl.cipher.aes(derivedEncryptionKeyArray32);

    // Decrypt the Master Key using the Derived Encryption Key
    var encryptedMasterKeyArray32 = base64_to_a32(u_attr.k);
    var decryptedMasterKeyArray32 = decrypt_key(derivedEncryptionKeyCipherObject, encryptedMasterKeyArray32);
    var decryptedMasterKeyString = decryptedMasterKeyArray32.join(',');

    // Convert the in memory copy of the unencrypted Master Key to string for comparison
    var masterKeyStringToCompare = u_k.join(',');

    // Compare the decrypted Master Key to the stored unencrypted Master Key
    return decryptedMasterKeyString === masterKeyStringToCompare;
}


/**
 * Generates meta data required for rendering avatars
 *
 * @param user_hash
 * @returns {*|jQuery|HTMLElement}
 */
function generateAvatarMeta(user_hash) {
    'use strict';
    const meta = {
        fullName: M.getNameByHandle(user_hash)
    };

    var ua_meta = useravatar.generateContactAvatarMeta(user_hash);
    meta.color = ua_meta.avatar.colorIndex;
    meta.shortName = ua_meta.avatar.letters;

    if (ua_meta.type === 'image') {
        meta.avatarUrl = ua_meta.avatar;
    }
    return meta;
}

function isNonActivatedAccount() {
    'use strict';
    return !window.u_privk && window.u_attr && (u_attr.p >= 1 || u_attr.p <= 4);
}

function isEphemeral() {
    return !is_eplusplus && u_type !== false && u_type < 3;
}

/**
 * Check if the current user doens't have a session, if they don't have
 * a session we show the login dialog, and when they have a session
 * we redirect back to the intended page.
 *
 * @return {Boolean} True if the login dialog is shown
 */
function checkUserLogin() {
    if (!u_type) {
        login_next = getSitePath();
        loadSubPage('login');
        return true;
    }

    return false;
}


/**
 * A reusable function that is used for processing locally/3rd party email change
 * action packets.
 *
 * @param ap {Object} the actual 'se' action packet
 */
function processEmailChangeActionPacket(ap) {
    // set email
    var emailChangeAccepted = (ap.s === 3 && typeof ap.e === 'string' && ap.e.indexOf('@') !== -1);

    if (emailChangeAccepted) {
        var user = M.getUserByHandle(ap.u);

        if (user) {
            user.m = ap.e;
            process_u([user]);

            if (ap.u === u_handle) {
                u_attr.email = user.m;

                if (M.currentdirid === 'account/profile') {
                    $('.nw-fm-left-icon.account').trigger('click');
                }
            }
        }
        // update the underlying fmdb cache
        M.addUser(user);

        // in case of business master
        // first, am i a master?
        if (u_attr && u_attr.b && u_attr.b.m) {
            // then, do i have this user as sub-user?
            if (M.suba && M.suba[ap.u]) {
                M.require('businessAcc_js', 'businessAccUI_js').done(
                    function () {
                        var business = new BusinessAccount();
                        var sub = M.suba[ap.u];
                        sub.e = ap.e;
                        if (sub.pe) {
                            delete sub.pe;
                        }
                        business.parseSUBA(sub, false, true);
                    }
                );
            }
        }
    }
    else {
        // if the is business master we might accept other cases
        if (u_attr && u_attr.b && u_attr.b.m) {
            // then, do i have this user as sub-user?
            if (M.suba && M.suba[ap.u]) {
                var stillOkEmail = (ap.s === 2 && typeof ap.e === 'string' && ap.e.indexOf('@') !== -1);
                if (stillOkEmail) {
                    M.require('businessAcc_js', 'businessAccUI_js').done(
                        function () {
                            var business = new BusinessAccount();
                            var sub = M.suba[ap.u];
                            sub.pe = { e: ap.e, ts: ap.ts };
                            business.parseSUBA(sub, false, true);
                        }
                    );
                }
            }
        }
    }
}

/**
 * Contains a list of permitted landing pages.
 * @var {array} allowedLandingPages
 */
var allowedLandingPages = ['fm', 'recents', 'chat'];

/**
 * Fetch the landing page.
 * @return {string|int} The user selected landing page.
 */
function getLandingPage() {
    'use strict';
    return pfid ? false : allowedLandingPages[mega.config.get('uhp')] || 'fm';
}

/**
 * Set the landing page.
 * @param {string} page The user selected landing page from the `allowedLandingPages` array.
 * @return {void}
 */
function setLandingPage(page) {
    'use strict';
    var index = allowedLandingPages.indexOf(page);
    mega.config.set('uhp', index < 0 ? 0 : index);
}

/**
 * Inform the mega.io static server of first name, avatar, login status in/out
 * @param {Boolean} loginStatus This is true if they just logged in, false if they logged out
 * @param {Number|undefined} planNum Optional Pro plan number if recently purchased (otherwise u_attr.p is used)
 * @returns {undefined}
 */
function initMegaIoIframe(loginStatus, planNum) {

    'use strict';

    // Set constants for URLs (easier to change for local testing)
    const megapagesUrl = 'https://mega.io';
    const parentUrl = 'https://127.0.0.1';

    const megapagesPromise = mega.promise;

    tryCatch(() => {
        const megaIoIframe = document.getElementById('i-ping');

        // Check iframe is available
        if (!megaIoIframe) {
            console.error('[webclient->megapages] The iframe is not available. Cannot send user details.');
            megapagesPromise.resolve();
            return;
        }

        // We only want to inform the mega.io site if on live domain
        if (is_iframed || is_extension || location.origin !== parentUrl) {
            console.warn(`[webclient->megapages] The iframe was not initialised.
                Is iframed: ${is_iframed}. Is extension: ${is_extension}.
                Origin unexpected: ${location.origin !== parentUrl} (was ${location.origin}, expecting ${parentUrl}).`);
            megapagesPromise.resolve();
            return;
        }

        // Give mega.io five seconds to provide receipt before allowing other processes to continue
        const timeout = setTimeout(() => {
            megapagesPromise.resolve();
        }, 5000);

        const sendMessage = (messageData) => {
            // Send the data
            megaIoIframe.contentWindow.postMessage(messageData, megapagesUrl);

            // Wait for receipt
            window.addEventListener('message', (e) => {
                if (e.source === megaIoIframe.contentWindow && e.origin === megapagesUrl) {
                    console.info('[megapages] megapages hook receipt received. Success:', e.data);
                    megapagesPromise.resolve();
                    clearTimeout(timeout);
                }
            });
        };

        // Once the mega.io iframe has loaded
        megaIoIframe.onload = () => {
            console.info('[webclient->megapages] iframe loaded. Preparing message...');

            let postMessageData = { };

            // If logging in, assign the first name and set the plan num if available (NB: Free is undefined)
            if (loginStatus) {
                postMessageData = {
                    firstName: u_attr.firstname,
                    planNum: planNum || u_attr.p || undefined
                };

                const avatarMeta = generateAvatarMeta(u_handle);
                if (avatarMeta && avatarMeta.color) {
                    postMessageData.avatarColourKey = avatarMeta.color;
                }

                // Get the custom avatar
                mega.attr.get(u_handle, 'a', true, false)
                    .done((res) => {

                        // If the avatar (in Base64) exists, add to the data
                        if (typeof res !== 'number' && res.length > 5) {
                            postMessageData.avatar = res;
                        }
                    })
                    .always(() => {
                        console.info('[webclient->megapages] Sending loggedin message to iframe.', postMessageData);
                        sendMessage(postMessageData);
                    });
            }
            else {
                console.info('[webclient->megapages] Sending loggedout message to iframe.', postMessageData);
                sendMessage(postMessageData);
            }
        };

        // If they logged out, inform the logged out mega.io URL
        if (!loginStatus) {
            console.info('[webclient->megapages] Setting iframe source to loggedout endpoint.');

            megaIoIframe.src = `${megapagesUrl}/webclient/loggedout.html`;
        }
        else {
            console.info('[webclient->megapages] Setting iframe source to loggedin endpoint');

            // Set the source to the logged in mega.io URL
            megaIoIframe.src = `${megapagesUrl}/webclient/loggedin.html`;
        }
    })();

    return megapagesPromise;
}

(function(exportScope) {
    "use strict";
    var _lastUserInteractionCache = {};
    var _lastUserInteractionCacheInFlight = {};
    var _lastUserInteractionPromiseCache = {};

    /**
     * Compare and return `true` if:
     * - `a` is > `b`
     *
     * @param a
     * @param b
     * @private
     */
    var _compareLastInteractionStamp = function(a, b) {
        var timestampA = parseInt(a.split(":")[1], 10);
        var timestampB = parseInt(b.split(":")[1], 10);

        return timestampA > timestampB;
    };

    const setLastInteractionQueue = [];
    const SET_LAST_INTERACTION_TIMER = 60; // seconds

    /**
     * Returns a promise which will be resolved with a string, formatted like this "$typeOfInteraction:$timestamp"
     * Where $typeOfInteraction can be:
     *  - 0 - cloud drive/sharing
     *  - 1 - chat
     *
     * @param u_h {String}
     * @param triggeredBySet {boolean}
     * @returns {MegaPromise}
     */
    var getLastInteractionWith = function (u_h, triggeredBySet, noRender) {
        console.assert(u_handle, "missing u_handle, can't proceed");
        console.assert(u_h, "missing argument u_h, can't proceed");

        if (!u_handle || !u_h) {
            return MegaPromise.reject(EARGS);
        }

        var _renderLastInteractionDone = noRender ? nop : function (r) {
            r = r.split(":");

            var ts = parseInt(r[1], 10);

            if (M.u[u_h]) {
                M.u[u_h].ts = ts;
            }

            if (triggeredBySet) {
                return;
            }

            var $elem = $('.li_' + u_h);

            $elem
                .removeClass('never')
                .removeClass('cloud-drive')
                .removeClass('conversations')
                .removeClass('unread-conversations');


            if (r[0] === "0") {
                $elem.addClass('cloud-drive');
            }
            else if (r[0] === "1" && megaChatIsReady) {
                var room = megaChat.getPrivateRoom(u_h);
                if (room && megaChat.plugins && megaChat.plugins.chatNotifications) {
                    if (megaChat.plugins.chatNotifications.notifications.getCounterGroup(room.roomId) > 0) {
                        $elem.addClass('unread-conversations');
                    }
                    else {
                        $elem.addClass('conversations');
                    }
                }
                else {
                    $elem.addClass('conversations');
                }
            }
            else {
                $elem.addClass('never');
            }

            $elem.text(time2last(ts) || l[1051]);
        };

        var _renderLastInteractionFail = noRender ? nop : function (r) {
            var $elem = $('.li_' + u_h);

            $elem
                .removeClass('never')
                .removeClass('cloud-drive')
                .removeClass('conversations')
                .removeClass('unread-conversations');


            $elem.addClass('never');
            $elem.text(l[1051]);
        };

        var $promise = new MegaPromise();

        $promise
            .done(_renderLastInteractionDone)
            .fail(_renderLastInteractionFail);

        if (_lastUserInteractionCacheInFlight[u_h] && _lastUserInteractionCacheInFlight[u_h] !== -1) {
            $promise.resolve(_lastUserInteractionCacheInFlight[u_h]);
        }
        else if (
            _lastUserInteractionPromiseCache[u_h] &&
            _lastUserInteractionPromiseCache[u_h].state() === 'pending'
        ) {
            return _lastUserInteractionPromiseCache[u_h];
        }
        else if (_lastUserInteractionCache[u_h] && _lastUserInteractionCacheInFlight[u_h] !== -1) {
            $promise.resolve(_lastUserInteractionCache[u_h]);
        }
        else if (
            (!_lastUserInteractionCache[u_h] || _lastUserInteractionCacheInFlight[u_h] === -1) &&
            (
                !_lastUserInteractionPromiseCache[u_h] ||
                _lastUserInteractionPromiseCache[u_h].state() !== 'pending'
            )
        ) {
            if (_lastUserInteractionCacheInFlight[u_h] === -1) {
                delete _lastUserInteractionCacheInFlight[u_h];
            }
            _lastUserInteractionPromiseCache[u_h] = mega.attr.getArrayAttribute(
                u_handle,
                'lstint',
                u_h,
                false,
                true
                )
                .always(function() {
                    _lastUserInteractionPromiseCache[u_h] = false;
                })
                .done(function (res) {
                    if (typeof res !== 'number') {
                        if (typeof res === 'undefined') {
                            // detected legacy value which was not unserialised properly....should re-initialise as
                            // empty value, e.g. no last interaction with that user (would be rebuilt by chat messages
                            // and stuff)
                            $promise.reject(false);
                        }
                        else {
                            if (!triggeredBySet) {
                                _lastUserInteractionCache[u_h] = res;
                            }
                            $promise.resolve(res);
                        }
                    }
                    else {
                        $promise.reject(false);
                        console.error("Failed to retrieve last interaction cache from attrib, response: ", res);
                    }
                })
                .fail(function(res) {
                    $promise.reject(res);
                });
        }
        else {
            throw new Error("This should not happen.");
        }

        return $promise;
    };

    /**
     * Set the last interaction for a contact (throttled internally)
     *
     * @param u_h {String} user handle
     * @param v {String} "$typeOfInteraction:$unixTimestamp" (see getLastInteractionWith for the types of int...)
     * @returns {Deferred}
     */
    var _realSetLastInteractionWith = function (u_h, v) {

        console.assert(u_handle, "missing u_handle, can't proceed");
        console.assert(u_h, "missing argument u_h, can't proceed");

        if (!u_handle || !u_h) {
            return MegaPromise.reject(EARGS);
        }

        var isDone = false;
        var $promise = createTimeoutPromise(
            () => {
                return isDone === true;
            },
            500,
            10000,
            false,
            `SetLastInteraction(${u_h})`
        );

        $promise.always(function () {
            isDone = true;
        });


        getLastInteractionWith(u_h, true)
            .done(function (timestamp) {
                if (_compareLastInteractionStamp(v, timestamp) === false) {
                    // older timestamp found in `v`, resolve the promise with the latest timestamp
                    $promise.resolve(v);
                    $promise.verify();
                }
                else {
                    _lastUserInteractionCache[u_h] = v;

                    $promise.resolve(_lastUserInteractionCache[u_h]);

                    // TODO: check why `M.u[u_h]` might not be set...
                    Object(M.u[u_h]).ts = parseInt(v.split(":")[1], 10);

                    $promise.verify();

                    mega.attr.setArrayAttribute(
                        'lstint',
                        u_h,
                        _lastUserInteractionCache[u_h],
                        false,
                        true
                    );
                }
            })
            .fail(function (res) {
                if (res === false || res === -9) {
                    if (res === -9 && _lastUserInteractionCache === false) {
                        _lastUserInteractionCache = {};
                    }
                    _lastUserInteractionCache[u_h] = v;
                    $promise.resolve(_lastUserInteractionCache[u_h]);

                    Object(M.u[u_h]).ts = parseInt(v.split(":")[1], 10);

                    mega.attr.setArrayAttribute(
                        'lstint',
                        u_h,
                        _lastUserInteractionCache[u_h],
                        false,
                        true
                    );

                    $promise.verify();
                }
                else {
                    $promise.reject(res);
                    console.error("setLastInteraction failed, err: ", res);
                    $promise.verify();
                }
            });

        return $promise;

    };

    /**
     * Internal method that flushes all queued setLastInteraction operations in one go.
     * Usually triggered by `setLastInteractionWith`
     *
     * @private
     */
    var _flushSetLastInteractionWith = function() {

        for (let i = setLastInteractionQueue.length; i--;) {
            const [user, value, promise] = setLastInteractionQueue[i];

            _lastUserInteractionCacheInFlight[user] = -1;
            promise.linkDoneAndFailTo(_realSetLastInteractionWith(user, value));
        }
        setLastInteractionQueue.length = 0;
    };


    /**
     * Set the last interaction for a contact (throttled internally)
     *
     * @param u_h {String} user handle
     * @param v {String} "$typeOfInteraction:$unixTimestamp" (see getLastInteractionWith for the types of int...)
     * @returns {Deferred|MegaPromise}
     */
    exportScope.setLastInteractionWith = function(u_h, v) {
        var promise = new MegaPromise();

        if (d && u_h === 'test-me') {
            const user = M.u[M.u.keys()[0]] || !1;

            onIdle(_flushSetLastInteractionWith);
            console.debug(`Triggering last-interaction (upv->ua combo) for "${user.name}" (${user.u}, ${user.m})`);

            u_h = user.u;
            v = `0:${unixtime()}`;
        }

        // set on client side, to simulate a real commit
        const user = u_h in M.u && M.u[u_h] || false;
        const newTs = parseInt(String(v).split(":")[1], 10);

        if (user && user.ts < newTs) {
            user.ts = newTs;
            _lastUserInteractionCacheInFlight[u_h] = v;
        }
        tSleep.schedule(SET_LAST_INTERACTION_TIMER, _flushSetLastInteractionWith);

        for (var i = 0; i < setLastInteractionQueue.length; i++) {
            var entry = setLastInteractionQueue[i];
            var u_h2 = entry[0];
            var ts2 = parseInt(entry[1].split(":")[1], 10);

            if (u_h2 === u_h) {
                if (newTs < ts2) {
                    return MegaPromise.resolve(entry[1]);
                }
                else {
                    entry[1] = v;
                    return entry[2];
                }

            }
        }
        setLastInteractionQueue.push([u_h, v, promise]);

        return promise;
    };
    exportScope.getLastInteractionWith = getLastInteractionWith;
})(window);

/**
 * General common functionality for the new secure Registration and Login process including an
 * improved Password Processing Function (PPF) now with PBKDF2-HMAC-SHA512, a per user salt and 100,000 iterations.
 */
var security = {

    /** Minimum password length across the app for registration and password changes */
    minPasswordLength: 8,

    /**
     * Minimum password score across the app for registration and password changes. The score is calculated
     * using the score from the ZXCVBN library and the range is from 0 - 4 (very weak, weak, medium, good, strong)
     */
    minPasswordScore: 1,

    /** The number of iterations for the PPF (1-2 secs computation time) */
    numOfIterations: 100000,

    /** The length of the salt in bits */
    saltLengthInBits: 128,          // 16 Bytes

    /** The desired length of the derived key from the PPF in bits */
    derivedKeyLengthInBits: 256,    // 32 Bytes

    /**
     * Checks if the password is valid and meets minimum strength requirements
     * @param {String} password The user's password
     * @param {String} confirmPassword The second password the user typed again as a confirmation to avoid typos
     * @returns {true|String} Returns true if the password is valid, or the error message if not valid
     */
    isValidPassword: function(password, confirmPassword) {

        'use strict';
        // Check for a password
        if (!password) {
            return l.err_no_pass;   // Enter a password
        }
        // Check if the passwords are not the same
        if (password !== confirmPassword) {
            return l[9066];         // Passwords don't match. Check and try again.
        }

        // Check if there is whitespace at the start or end of the password
        if (password !== password.trim()) {
            return l[19855];        // Whitespace at the start or end of the password is not permitted.
        }

        // Check for minimum password length
        if (password.length < security.minPasswordLength) {
            return l[18701];        // Your password needs to be at least x characters long.
        }

        // Check that the estimator library is initialised
        if (typeof zxcvbn === 'undefined') {
            return l[1115] + ' ' + l[1116];     // The password strength verifier is still initializing.
        }                                       // Please try again in a few seconds.

        // Check for minimum password strength score from ZXCVBN library
        if ((zxcvbn(password).score < security.minPasswordScore)) {
            // Your password needs to be stronger.
            // Make it longer, add special characters or use uppercase and lowercase letters.
            return l[1104];
        }

        return true;
    },

    /**
     * Converts a UTF-8 string to a byte array
     * @param {String} string A string of any character including UTF-8 chars e.g. password123
     * @returns {Uint8Array} Returns a byte array
     */
    stringToByteArray: function(string) {

        'use strict';

        return new TextEncoder('utf-8').encode(string);
    },

    /**
     * A wrapper function to create the Client Random Value, Encrypted Master Key and Hashed Authentication Key.
     * These values are needed for when registering, changing the user's password, recovering with Master Key and
     * for parking the user's account.
     * @param {String} password The password from the user
     * @param {Array} masterKeyArray32 The unencrypted Master Key
     * @returns {Promise<Object>} will pass
     *                                    the clientRandomValueBytes, encryptedMasterKeyArray32,
     *                                    hashedAuthenticationKeyBytes
     *                                    and derivedAuthenticationKeyBytes as the parameters
     */
    deriveKeysFromPassword: async function(password, masterKeyArray32) {
        'use strict';

        // Create the 128 bit (16 byte) Client Random Value and Salt
        var saltLengthInBytes = security.saltLengthInBits / 8;
        var clientRandomValueBytes = crypto.getRandomValues(new Uint8Array(saltLengthInBytes));
        var saltBytes = security.createSalt(clientRandomValueBytes);

        // Trim the password and convert it from ASCII/UTF-8 to a byte array
        var passwordTrimmed = $.trim(password);
        var passwordBytes = security.stringToByteArray(passwordTrimmed);

        // The number of iterations for the PPF and desired length in bits of the derived key
        var iterations = security.numOfIterations;
        var derivedKeyLength = security.derivedKeyLengthInBits;

        // Run the PPF
        const derivedKeyBytes = await security.deriveKey(saltBytes, passwordBytes, iterations, derivedKeyLength);

        // Get the first 16 bytes as the Encryption Key and the next 16 bytes as the Authentication Key
        const derivedEncryptionKeyBytes = derivedKeyBytes.subarray(0, 16);
        const derivedAuthenticationKeyBytes = derivedKeyBytes.subarray(16, 32);

        // Get a hash of the Authentication Key which the API will use for authentication at login time
        let hashedAuthenticationKeyBytes = asmCrypto.SHA256.bytes(derivedAuthenticationKeyBytes);

        // Keep only the first 128 bits (16 bytes) of the Hashed Authentication Key
        hashedAuthenticationKeyBytes = hashedAuthenticationKeyBytes.subarray(0, 16);

        // Convert the Derived Encryption Key to a big endian array of 32 bytes, then encrypt the Master Key
        const derivedEncryptionKeyArray32 = base64_to_a32(ab_to_base64(derivedEncryptionKeyBytes));
        const cipherObject = new sjcl.cipher.aes(derivedEncryptionKeyArray32);
        const encryptedMasterKeyArray32 = encrypt_key(cipherObject, masterKeyArray32);

        // Pass the Client Random Value, Encrypted Master Key and Hashed Authentication Key to the calling function
        return {
            clientRandomValueBytes,
            encryptedMasterKeyArray32,
            hashedAuthenticationKeyBytes,
            derivedAuthenticationKeyBytes
        };
    },

    /**
     * Creates a 128 bit Client Random Value and then derives the Salt from that.
     * The salt is created from SHA-256('mega.nz' || 'Padding' || Client Random Value)
     * @param {Uint8Array} clientRandomValueBytes The Client Random Value from which the salt will be constructed
     * @returns {Uint8Array} Returns the 256 bit (32 bytes) salt as a byte array
     */
    createSalt: function(clientRandomValueBytes) {

        'use strict';

        var saltString = 'mega.nz';
        var saltStringMaxLength = 200;  // 200 chars for 'mega.nz' + padding
        var saltHashInputLength = saltStringMaxLength + clientRandomValueBytes.length;  // 216 bytes

        // Pad the salt string to 200 chars with the letter P
        for (var i = saltString.length; i < saltStringMaxLength; i++) {
            saltString += 'P';
        }

        // Cronvert the salt to a byte array
        var saltStringBytes = security.stringToByteArray(saltString);

        // Concatenate the Client Random Value bytes to the end of the salt string bytes
        var saltInputBytesConcatenated = new Uint8Array(saltHashInputLength);
        saltInputBytesConcatenated.set(saltStringBytes);
        saltInputBytesConcatenated.set(clientRandomValueBytes, saltStringMaxLength);

        // Hash the bytes to create the salt
        var saltBytes = asmCrypto.SHA256.bytes(saltInputBytesConcatenated);

        // Return the salt which is needed for the PPF
        return saltBytes;
    },

    /**
     * Fetch the user's salt from the API
     * @param {String} email The user's email address
     */
    fetchAccountVersionAndSalt: async function(email) {
        'use strict';
        const {result: {s, v}} = await api.req({a: 'us0', user: email});

        return {version: v, salt: v > 1 ? s : null};
    },

    /**
     * A wrapper function used for deriving a key from a password
     * @param {Uint8Array} saltBytes The salt as a byte array
     * @param {Uint8Array} passwordBytes The password as a byte array
     * @param {Number} iterations The cost factor / number of iterations of the PPF to perform
     * @param {Number} derivedKeyLength The length of the derived key to create
     */
    deriveKey: async function(saltBytes, passwordBytes, iterations, derivedKeyLength) {
        'use strict';

        // If Web Crypto method supported, use that as it's nearly as fast as native
        if (window.crypto && window.crypto.subtle && !is_microsoft) {
            return security.deriveKeyWithWebCrypto(saltBytes, passwordBytes, iterations, derivedKeyLength);
        }

        // Otherwise, use asmCrypto which is the next fastest
        return security.deriveKeyWithAsmCrypto(saltBytes, passwordBytes, iterations, derivedKeyLength);
    },

    /**
     * Derive the key using the Web Crypto API
     * @param {Uint8Array} saltBytes The salt as a byte array
     * @param {Uint8Array} passwordBytes The password as a byte array
     * @param {Number} iterations The cost factor / number of iterations of the PPF to perform
     * @param {Number} derivedKeyLength The length of the derived key to create
     */
    deriveKeyWithWebCrypto: async function(saltBytes, passwordBytes, iterations, derivedKeyLength) {
        'use strict';

        // Import the password as the key
        return crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveBits'])
            .then((key) => {

                // Required PBKDF2 parameters
                var params = {
                    name: 'PBKDF2',
                    hash: 'SHA-512',
                    salt: saltBytes,
                    iterations: iterations
                };

                // Derive bits using the algorithm
                return crypto.subtle.deriveBits(params, key, derivedKeyLength);
            })
            .then((derivedKeyArrayBuffer) => {

                // Convert to a byte array
                // Pass the derived key to the callback
                return new Uint8Array(derivedKeyArrayBuffer);
            });
    },

    /**
     * Derive the key using asmCrypto
     * @param {Uint8Array} saltBytes The salt as a byte array
     * @param {Uint8Array} passwordBytes The password as a byte array
     * @param {Number} iterations The cost factor / number of iterations of the PPF to perform
     * @param {Number} derivedKeyLength The length of the derived key to create
     */
    deriveKeyWithAsmCrypto: async function(saltBytes, passwordBytes, iterations, derivedKeyLength) {
        'use strict';

        // Convert the desired derived key length to bytes and derive the key
        var keyLengthBytes = derivedKeyLength / 8;

        // Pass the derived key to the callback
        return asmCrypto.PBKDF2_HMAC_SHA512.bytes(passwordBytes, saltBytes, iterations, keyLengthBytes);
    },

    /**
     * A helper function for the check password feature (used when changing email or checking if they can remember).
     * This function will only pass the Derived Encryption Key to the completion callback.
     * @param {String} password The password from the user
     * @param {String} [saltBase64] Account Authentication Salt, if applicable
     * @returns {Promise} derivedEncryptionKeyArray32
     */
    getDerivedEncryptionKey: async function(password, saltBase64) {
        'use strict';

        saltBase64 = saltBase64 === undefined ? u_attr && u_attr.aas || '' : saltBase64;
        if (!saltBase64) {
            return prepare_key_pw(password);
        }

        // Convert the salt and password to byte arrays
        var saltArrayBuffer = base64_to_ab(saltBase64);
        var saltBytes = new Uint8Array(saltArrayBuffer);
        var passwordBytes = security.stringToByteArray(password);

        // The number of iterations for the PPF and desired length in bits of the derived key
        var iterations = security.numOfIterations;
        var derivedKeyLength = security.derivedKeyLengthInBits;

        // Run the PPF
        const derivedKeyBytes = await security.deriveKey(saltBytes, passwordBytes, iterations, derivedKeyLength);

        // Get the first 16 bytes as the Encryption Key
        const derivedEncryptionKeyBytes = derivedKeyBytes.subarray(0, 16);

        // Convert the Derived Encryption Key to a big endian array of 32 bit values for decrypting the Master Key
        // Pass only the Derived Encryption Key back to the callback
        return base64_to_a32(ab_to_base64(derivedEncryptionKeyBytes));
    },

    /**
     * Complete the Park Account process
     * @param {String} recoveryCode The recovery code from the email
     * @param {String} recoveryEmail The email address that is being recovered
     * @param {String} newPassword The new password for the account
     * @param {Function} completeCallback The function to run when the callback completes
     */
    resetUser: function(recoveryCode, recoveryEmail, newPassword, completeCallback) {

        'use strict';

        // Fetch the user's account version
        security.fetchAccountVersionAndSalt(recoveryEmail).then(({version}) => {

            // If using the new registration method (v2)
            if (version === 2) {

                // Create fresh Master Key
                api_create_u_k();

                // Derive keys from the new password
                security.deriveKeysFromPassword(newPassword, u_k)
                    .then(({clientRandomValueBytes, encryptedMasterKeyArray32, hashedAuthenticationKeyBytes}) => {

                        // Convert Master Key, Hashed Authentication Key and Client Random Value to Base64
                        var encryptedMasterKeyBase64 = a32_to_base64(encryptedMasterKeyArray32);
                        var hashedAuthenticationKeyBase64 = ab_to_base64(hashedAuthenticationKeyBytes);
                        var clientRandomValueBase64 = ab_to_base64(clientRandomValueBytes);

                        // Create some random bytes to send to the API. This is not actually needed for the new v2 Park
                        // Account process. It was only used for old style registrations at confirmation time, which
                        // checked the password was correct locally by decrypting a known value and checking that
                        // value. ToDo: API team to remove need for the 'z' property in the 'erx' API request.
                        var ssc = Array(8);
                        for (var i = 8; i--;) {
                            ssc[i] = rand(0x100000000);
                        }
                        var sscString = a32_to_str(ssc);
                        var base64data = base64urlencode(sscString);

                        // Run API request to park the account and start a new one under the same email
                        api_req({
                            a: 'erx',
                            c: recoveryCode,
                            x: encryptedMasterKeyBase64,
                            y: {
                                crv: clientRandomValueBase64,
                                hak: hashedAuthenticationKeyBase64
                            },
                            z: base64data
                        },
                        { callback: completeCallback });
                    }
                );
            }
            else {
                // Otherwise use the old reset/park method
                api_resetuser({ callback: completeCallback }, recoveryCode, recoveryEmail, newPassword);
            }
        });
    },

    /**
     * Perform the Master Key re-encryption with a new password. If the password is passed to the function as null,
     * then the function will just check the validity of the recovery code. The next step in the flow is for the user
     * to change their password which will then call this function again with all the parameters.
     *
     * @param {String} recoveryCode The recovery code from the email
     * @param {Array} masterKeyArray32 The Master/Recovery Key entered by the user
     * @param {String} recoveryEmail The email address that is being recovered
     * @param {String} [newPassword] The new password for the account (optional)
     */
    async resetKey(recoveryCode, masterKeyArray32, recoveryEmail, newPassword) {
        'use strict';
        const messages = freeze({
            [EKEY]: l[1978],
            [ENOENT]: l[1967],
            [EBLOCKED]: l[1980],
            [EEXPIRED]: l[1967],
        });

        loadingDialog.show();

        // Complete the reset of the user's password using the Master Key provided
        return this.performKeyReset(recoveryCode, masterKeyArray32, recoveryEmail, newPassword)
            .then((res) => {
                assert(res === 0);
                return res;
            })
            .catch((ex) => {
                console.warn(ex);
                if (String(ex).includes('invalid aes key size')) {
                    ex = EKEY;
                }
                const msg = String(messages[ex] || (ex < 0 ? api_strerror(ex) : ex));

                if (newPassword && msg.includes(l[1978])) {
                    $('.recover-block.error').removeClass('hidden');
                }

                throw msg;
            })
            .finally(() => {
                loadingDialog.hide();
            });
    },

    /**
     * Complete the reset of the user's password using the Master Key provided by the user
     * @param {String} recoveryCode The recovery code from the email
     * @param {Array} masterKeyArray32 The Master/Recovery Key entered by the user
     * @param {String} recoveryEmail The email address that is being recovered
     * @param {String} [newPassword] The new password for the account (optional)
     */
    async performKeyReset(recoveryCode, masterKeyArray32, recoveryEmail, newPassword) {
        'use strict';

        // Fetch the user's account version
        const [result, {version}] = await Promise.all([
            api.send({a: 'erx', r: 'gk', c: recoveryCode}),
            security.fetchAccountVersionAndSalt(recoveryEmail)
        ]);

        // If the private RSA key was returned
        assert(typeof result === 'string' && version > 0);

        // Decrypt the private RSA key.
        const privateRsaKeyArray32 = base64_to_a32(result);
        const cipher = new sjcl.cipher.aes(masterKeyArray32);

        let privateRsaKeyStr = a32_to_str(decrypt_key(cipher, privateRsaKeyArray32));
        let i = 0;

        // Verify the integrity of the decrypted private key
        while (i++ < 4) {
            const l = (privateRsaKeyStr.charCodeAt(0) * 256 + privateRsaKeyStr.charCodeAt(1) + 7 >> 3) + 2;

            if (privateRsaKeyStr.substr(0, l).length < 2) {
                break;
            }
            privateRsaKeyStr = privateRsaKeyStr.substr(l);
        }

        // If invalid, EKEY error.
        assert(i === 5 && privateRsaKeyStr.length < 16, l[1978]);

        if (newPassword) {
            const payload = {a: 'erx', r: 'sk', c: recoveryCode};

            if (version > 1) {
                // Derive keys from the new password
                const {
                    clientRandomValueBytes,
                    encryptedMasterKeyArray32,
                    hashedAuthenticationKeyBytes
                } = await security.deriveKeysFromPassword(newPassword, masterKeyArray32);

                // Convert Master Key, Hashed Authentication Key and Client Random Value to Base64
                const clientRandomValueBase64 = ab_to_base64(clientRandomValueBytes);
                const encryptedMasterKeyBase64 = a32_to_base64(encryptedMasterKeyArray32);
                const hashedAuthenticationKeyBase64 = ab_to_base64(hashedAuthenticationKeyBytes);

                payload.x = encryptedMasterKeyBase64;
                payload.y = {
                    crv: clientRandomValueBase64,
                    hak: hashedAuthenticationKeyBase64
                };
            }
            else {
                const aes = new sjcl.cipher.aes(prepare_key_pw(newPassword));

                payload.y = stringhash(recoveryEmail.toLowerCase(), aes);
                payload.x = a32_to_base64(encrypt_key(aes, masterKeyArray32));
            }

            // Run API request to park the account and start a new one under the same email
            return api.send(payload);
        }

        return 0;
    },

    /**
     * Verify if a given password is the user's password.
     * e.g., If everything is correct, we attempt to verify the email.
     * @param {String} pwd user-entered password
     * @returns {Promise<Boolean>}
     */
    async verifyUserPassword(pwd) {
        'use strict';
        const {u = false} = await M.getAccountDetails();

        assert(u.length === 11 && window.u_attr && u_attr.u === u, l[19]);

        return security.getDerivedEncryptionKey(pwd);
    },

    /**
     * Check whether the provided password is valid to decrypt a key.
     * @param {String|*} aPassword The password to test against.
     * @param {String|*} aMasterKey The encrypted master key.
     * @param {String|*} aPrivateKey The encrypted private key.
     * @param {String|*} [aSalt] Account authentication salt, if applicable.
     * @returns {Boolean|*} whether it succeed.
     */
    verifyPassword: promisify(function(resolve, reject, aPassword, aMasterKey, aPrivateKey, aSalt) {
        'use strict';

        if (typeof aPrivateKey === 'string') {
            aPrivateKey = base64_to_a32(aPrivateKey);
        }

        if (typeof aMasterKey === 'string') {
            aMasterKey = [[aMasterKey, aSalt]];
        }
        var keys = aMasterKey.concat();

        (function _next() {
            var pair = keys.pop();
            if (!pair) {
                return reject(ENOENT);
            }

            var mk = pair[0];
            var salt = pair[1];

            security.getDerivedEncryptionKey(aPassword, salt || false)
                .then(function(derivedKey) {
                    if (typeof mk === 'string') {
                        mk = base64_to_a32(mk);
                    }

                    var decryptedMasterKey = decrypt_key(new sjcl.cipher.aes(derivedKey), mk);
                    var decryptedPrivateKey = decrypt_key(new sjcl.cipher.aes(decryptedMasterKey), aPrivateKey);

                    if (crypto_decodeprivkey(a32_to_str(decryptedPrivateKey))) {
                        return resolve({k: decryptedMasterKey, s: salt});
                    }

                    onIdle(_next);
                })
                .catch(function(ex) {
                    console.warn(mk, salt, ex);
                    onIdle(_next);
                });
        })();
    }),

    /**
     * Complete the email verification process
     * @param {String} pwd The new password for the account.
     * @param {String} code The code from the email notification.
     * @returns {Promise}
     */
    completeVerifyEmail: promisify(function(resolve, reject, pwd, code) {
        'use strict';

        var req = {a: 'erx', c: code, r: 'v1'};
        var xhr = function(key, uh) {
            req.y = uh;
            req.x = a32_to_base64(key);
            api.req(req).then(resolve).catch(reject);
        };

        // If using the new registration method (v2)
        if (u_attr.aav > 1) {
            req.r = 'v2';

            security.deriveKeysFromPassword(pwd, u_k)
                .then(({clientRandomValueBytes, encryptedMasterKeyArray32, hashedAuthenticationKeyBytes}) => {
                    req.z = ab_to_base64(clientRandomValueBytes);
                    xhr(encryptedMasterKeyArray32, ab_to_base64(hashedAuthenticationKeyBytes));
                })
                .catch(reject);
        }
        else {
            var aes = new sjcl.cipher.aes(prepare_key_pw(pwd));
            xhr(encrypt_key(aes, u_k), stringhash(u_attr.email.toLowerCase(), aes));
        }
    }),

    /**
     * Ask the user for email verification on account suspension.
     * @param {String} [aStep] What step of the email verification should be triggered.
     * @returns {undefined}
     */
    showVerifyEmailDialog: function(aStep) {
        'use strict';
        var name = 'verify-email' + (aStep ? '-' + aStep : '');

        if ($.hideTopMenu) {
            $.hideTopMenu();
        }

        // abort any ongoing dialog operation that may would get stuck by receiving an whyamiblocked=700
        M.safeShowDialog.abort();

        M.safeShowDialog(name, function() {
            parsepage(pages.placeholder);
            watchdog.registerOverrider('logout');

            var $dialog = $('.mega-dialog.' + name);
            if (!$dialog.length) {
                $('#loading').addClass('hidden');
                parsepage(pages['dialogs-common']);
                $dialog = $('.mega-dialog.' + name);
            }
            var showLoading = function() {
                loadingDialog.show();
                $('.mega-dialog-container.common-container').addClass('arrange-to-back');
            };
            var hideLoading = function() {
                loadingDialog.hide();
                if (!$.msgDialog) {
                    $('.mega-dialog-container.common-container').removeClass('arrange-to-back');
                }
            };
            var reset = function(step) {
                hideLoading();
                closeDialog();

                if (step === true) {
                    loadSubPage('login');
                }
                else {
                    security.showVerifyEmailDialog(step && step.to);
                }
            };

            hideLoading();
            $('.mega-dialog:visible').addClass('hidden');

            if (aStep === 'login-to-account') {
                var code = String(page).substr(11);

                showLoading();
                console.assert(String(page).startsWith('emailverify'));

                api.req({a: 'erv', v: 2, c: code})
                    .then(({result: res}) => {
                        hideLoading();
                        console.debug('erv', [res]);

                        if (!Array.isArray(res) || !res[6]) {
                            return msgDialog('warninga', l[135], l[47], res < 0 ? api_strerror(res) : l[253], reset);
                        }

                        u_logout(true);

                        u_handle = res[4];
                        u_attr = {u: u_handle, email: res[1], privk: res[6].privk, evc: code, evk: res[6].k};

                        if (is_mobile) {
                            $('button.js-close', $dialog).addClass('hidden');
                            $('.cancel-email-verify', $dialog).removeClass('hidden').rebind('click.cancel', function() {
                                loadSubPage("start");
                            });
                        }
                        else {
                            $('button.js-close', $dialog).removeClass('hidden').rebind('click.cancel', function() {
                                loadSubPage("start");
                            });
                            $('.cancel-email-verify', $dialog).addClass('hidden');
                        }

                        $('.mail', $dialog).val(u_attr.email);
                        $('button.next', $dialog).rebind('click.ve', function() {
                            var $input = $('.pass', $dialog);
                            var pwd = $input.val();

                            if (!window.u_attr || !u_attr.evk) {
                                return tell(ESID);
                            }

                            showLoading();
                            security.verifyPassword(pwd, u_attr.evk, u_attr.privk)
                                .then(function(res) {
                                    u_k = res.k;
                                    u_attr.aav = 1 + !!res.s;
                                    reset({to: 'set-new-pass'});
                                })
                                .catch(function(ex) {
                                    hideLoading();
                                    console.debug(ex);
                                    $input.megaInputsShowError(l[1102]).val('').focus();
                                });

                            return false;
                        });
                    })
                    .catch((ex) => {
                        if (ex === EEXPIRED || ex === ENOENT) {
                            return msgDialog('warninga', l[135], ex === EEXPIRED ? l[7719] : l[22128], false, reset);
                        }
                        tell(ex);
                    })
                    .finally(() => loadingDialog.hide());
            }
            else if (aStep === 'set-new-pass') {
                console.assert(u_attr && u_attr.evc, 'Invalid procedure...');

                $('button.finish', $dialog).rebind('click.ve', function() {
                    var pw1 = $('input.pw1', $dialog).val();
                    var pw2 = $('input.pw2', $dialog).val();

                    var error = function(msg) {
                        hideLoading();
                        $('input', $dialog)
                            .val('').trigger('blur')
                            .first().trigger('input').megaInputsShowError(msg).trigger('focus');
                        return false;
                    };

                    var pwres = security.isValidPassword(pw1, pw2);
                    if (pwres !== true) {
                        return error(pwres);
                    }

                    showLoading();
                    security.verifyPassword(pw1, u_attr.evk, u_attr.privk)
                        .then(function() {
                            // Do not allow to use a old known password
                            error(l[22675]);
                        })
                        .catch(function(ex) {
                            if (ex !== ENOENT) {
                                console.error(ex);
                                return error(l[8982]);
                            }

                            security.completeVerifyEmail(pw1, u_attr.evc)
                                .then(function() {
                                    login_email = u_attr.email;
                                    watchdog.unregisterOverrider('logout');

                                    u_logout(true);
                                    eventlog(99728);
                                    loadSubPage('login');
                                })
                                .catch(function(ex) {
                                    hideLoading();
                                    msgDialog('warninga',
                                              l[135],
                                              l[47],
                                              ex < 0 ? api_strerror(ex) : ex,
                                              reset.bind(null, false));
                                });
                        });

                    return false;
                });
            }
            else {
                $('.send-email', $dialog).rebind('click.ve', function() {
                    api.req({a: 'era'}).then(({result}) => {
                        assert(result === 0);
                        showToast('info', l[16827]);
                    }).catch((ex) => {
                        if (ex === ETEMPUNAVAIL) {
                            msgDialog('warningb', l[135], l.resend_email_error, l.resend_email_ten_min_error_info);
                        }
                        else {
                            msgDialog('warningb', l[135], l[47], api_strerror(ex));
                        }
                    });
                    return false;
                });
            }

            var $inputs = $('input', $dialog);
            $inputs.rebind('keypress.ve', function(ev) {
                var key = ev.code || ev.key;

                if (key === 'Enter') {
                    if ($inputs.get(0) === this) {
                        $inputs.trigger('blur');
                        $($inputs.get(1)).trigger('focus');
                    }
                    else {
                        $('button.next, button.finish, button.send-email', $dialog).trigger('click');
                    }
                }
            });

            mega.ui.MegaInputs($inputs);
            return $dialog;
        });
    },

    /**
     * Persist account session data into WebStorage.
     * @param {Array} masterKeyArray32 The unencrypted Master Key
     * @param {String} decryptedSessionIdBase64 The decrypted Session ID as a Base64 string
     * @param {Array} [decodedPrivateRsaKey] The decoded RSA Private Key as an array of parts
     * @returns {undefined}
     */
    persistAccountSession(masterKeyArray32, decryptedSessionIdBase64, decodedPrivateRsaKey) {
        'use strict';
        const temp = security.login.rememberMe === false && !localStorage.sid;
        assert(Array.isArray(masterKeyArray32) && masterKeyArray32.length === 4);

        // tell whether this computer was ever logged
        localStorage.wasloggedin = true;

        // Before key is stored on storage and can be accessible by the other tabs, notify it.
        watchdog.notify('beforelogin');

        // Use localStorage if the user checked the Remember Me checkbox, otherwise use temporary sessionStorage
        u_storage = init_storage(temp ? sessionStorage : localStorage);

        // Set global values which are used everywhere
        u_k = masterKeyArray32;
        u_sid = decryptedSessionIdBase64;
        u_k_aes = new sjcl.cipher.aes(masterKeyArray32);

        // Store the Master Key and Session ID
        u_storage.k = JSON.stringify(masterKeyArray32);
        u_storage.sid = decryptedSessionIdBase64;

        // Store the RSA private key
        if (decodedPrivateRsaKey) {
            u_storage.privk = base64urlencode(crypto_encodeprivkey(decodedPrivateRsaKey));
        }

        // Notify other tabs
        watchdog.notify('login', [temp && masterKeyArray32, decryptedSessionIdBase64, temp && u_storage.privk]);

        // Set the Session ID for future API requests
        api.setSID(u_sid);
    }
};


/**
 * Registration specific functionality for the new secure Registration process
 */
security.register = {

    /** Backup of the details to re-send the email if requested  */
    sendEmailRequestParams: false,

    /**
     * Create new account registration
     * @param {String} firstName The user's first name
     * @param {String} lastName The user's last name
     * @param {String} email The user's email address
     * @param {String} password The user's password
     * @param {Boolean} fromProPage Whether the registration started on the Pro page or not
     * @param {Function} completeCallback A function to run when the registration is complete
     */
    startRegistration: function(firstName, lastName, email, password, fromProPage, completeCallback) {
        'use strict';

        if (this.sendEmailRequestParams) {
            console.error('startRegistration blocked, ongoing.');
            return;
        }
        this.sendEmailRequestParams = true;

        // Show loading dialog
        loadingDialog.show();

        // First create an ephemeral account and the Master Key (to be removed at a later date)
        security.register.createEphemeralAccount(function() {

            // Derive the Client Random Value, Encrypted Master Key and Hashed Authentication Key
            security.deriveKeysFromPassword(password, u_k)
                .then(({clientRandomValueBytes, encryptedMasterKeyArray32, hashedAuthenticationKeyBytes}) => {

                    // Encode parameters to Base64 before sending to the API
                    const req = {
                        a: 'uc2',
                        n: base64urlencode(to8(firstName + ' ' + lastName)),         // Name (used just for the email)
                        m: base64urlencode(email),                                   // Email
                        crv: ab_to_base64(clientRandomValueBytes),                   // Client Random Value
                        k: a32_to_base64(encryptedMasterKeyArray32),                 // Encrypted Master Key
                        hak: ab_to_base64(hashedAuthenticationKeyBytes),             // Hashed Authentication Key
                        v: 2                                                         // Version of this protocol
                    };

                    // If this was a registration from the Pro page
                    if (fromProPage === true) {
                        req.p = 1;
                    }

                    // Send signup link email
                    security.register.sendSignupLink(req, firstName, lastName, email, completeCallback);
                });
        });
    },

    /**
     * Create an ephemeral account
     * @param {Function} callbackFunction The callback function to run once the ephemeral account is created
     */
    createEphemeralAccount: function(callbackFunction) {

        'use strict';

        // Set a flag to check at the end of the registration process
        if (is_mobile) {
            localStorage.signUpStartedInMobileWeb = '1';
        }

        // If there is no ephemeral account already
        if (u_type === false) {

            // Initialise local storage
            u_storage = init_storage(localStorage);

            // Create anonymous ephemeral account
            u_checklogin({
                checkloginresult: tryCatch((context, userType) => {
                    const {u_k_aes} = window;

                    // Set the user type
                    u_type = userType;

                    // Ensure all went ok..
                    assert(u_type !== false && u_k_aes, `Invalid state (${u_type}:${!!u_k_aes})`);

                    // Continue registering the account
                    callbackFunction();
                }, (ex) => {
                    window.onerror = null;
                    msgDialog('warninga', l[135], `${l[47]} ${l.edit_card_error_des}`, String(ex));
                })
            }, true);
        }

        // If they already have an ephemeral account
        else if (u_type === 0) {

            // Continue registering the account
            callbackFunction();
        }
    },

    /**
     * Start the registration process and send a signup link to the user
     * @param {Object} sendEmailRequestParams An object containing the data to send to the API.
     * @param {String} firstName The user's first name
     * @param {String} lastName The user's last name
     * @param {String} email The user's email
     * @param {Function} completeCallback A function to run when the registration is complete
     */
    sendSignupLink: function(sendEmailRequestParams, firstName, lastName, email, completeCallback) {

        'use strict';

        // Save the input variables so they can be re-used to resend the details with a different email
        security.register.sendEmailRequestParams = {
            firstName: firstName,
            lastName: lastName
        };

        // Run the API request
        api_req(sendEmailRequestParams, {
            callback: function(result) {

                // Hide the loading spinner
                loadingDialog.hide();

                // If successful result, send additional information to the API for the name
                if (result === 0) {
                    security.register.sendAdditionalInformation(firstName, lastName);
                }
                security.register.sendEmailRequestParams = false;

                // Run the callback requested by the calling function to show a check email dialog or show error
                completeCallback(result, firstName, lastName, email);
            }
        });
    },

    /**
     * Cache registration data like name, email etc in case they refresh the page and need to resend the email
     * @param {Object} registerData An object containing keys 'first', 'last', 'name', 'email' and optional 'password'
     *                              for old style registrations.
     */
    cacheRegistrationData: function(registerData) {

        'use strict';

        // Remove password from the object so it doesn't get saved to
        // localStorage for the resend process.

        delete registerData.password;

        localStorage.awaitingConfirmationAccount = JSON.stringify(registerData);

        if (localStorage.voucher) {
            const data = [localStorage.voucher, localStorage[localStorage.voucher] || -1];
            mega.attr.set('promocode', JSON.stringify(data), -2, true).dump();
        }
    },

    /**
     * Repeat the registration process and send a signup link to the user via the new email address they entered
     * @param {String} firstName The user's first name
     * @param {String} lastName The user's last name
     * @param {String} newEmail The user's corrected email
     * @param {Function} completeCallback A function to run when the registration is complete
     */
    repeatSendSignupLink: function(firstName, lastName, newEmail, completeCallback) {

        'use strict';

        // Re-encode the parameters to Base64 before sending to the API
        var sendEmailRequestParams = {
            a: 'uc2',
            n: base64urlencode(to8(firstName + ' ' + lastName)),  // Name (used just for the email)
            m: base64urlencode(newEmail)                          // Email
        };

        // Run the API request
        api_req(sendEmailRequestParams, {
            callback: function(result) {

                // Hide the loading spinner
                loadingDialog.hide();

                // If successful result, show a dialog success
                if (is_mobile && result === 0) {
                    mobile.messageOverlay.show(l[16351]);    // The email was sent successfully.
                }

                // Run the callback requested by the calling function to show a check email dialog or whatever
                completeCallback(result, firstName, lastName, newEmail);
            }
        });
    },

    /**
     * Sends additional information e.g. first name and last name to the API
     * @param {String} firstName The user's first name
     * @param {String} lastName The user's last name
     */
    sendAdditionalInformation: function(firstName, lastName) {

        'use strict';

        // Set API request options
        var options = {
            a: 'up',
            terms: 'Mq',
            firstname: base64urlencode(to8(firstName)),
            lastname: base64urlencode(to8(lastName)),
            name2: base64urlencode(to8(firstName + ' ' + lastName))
        };

        if (mega.affid) {
            options.aff = mega.affid;
        }

        // Send API request
        api_req(options);
    },

    /**
     * Verifies the email confirmation code after registering
     * @param {String} confirmCode The confirm code from the registration email
     * @return {Promise<void>} {email, result}
     */
    async verifyEmailConfirmCode(confirmCode) {
        'use strict';

        const cc = String(typeof confirmCode === 'string' && base64urldecode(confirmCode));

        // Check if they registered using the new registration process (version 2)
        assert(cc.startsWith('ConfirmCodeV2'), l[703]);

        // Ask them to log out and click on the confirmation link again
        if (u_type === 3) {

            msgDialog('warningb', l[2480], l[12440], false, () => loadSubPage('fm'));
            throw EROLLEDBACK;
        }

        // Send the confirmation code back to the API
        return api.req({a: 'ud2', c: confirmCode})
            .then(({result}) => {
                const [email, name, uh] = result[1];

                if (window.u_handle && u_handle === uh) {
                    // same account still in active session, let's end.
                    if ('csp' in window) {
                        const storage = localStorage;
                        const value = storage[`csp.${u_handle}`];

                        if (value) {
                            storage.csp = value;
                        }
                    }
                    u_logout(1);
                }

                return {
                    name: base64urldecode(name),
                    email: base64urldecode(email),
                    result
                };
            });
    }
};


/**
 * Login specific functionality for the new secure Login process
 */
security.login = {

    /** Cache of the login email in case we need to resend after they have entered their two factor code */
    email: null,

    /** Cache of the login password in case we need to resend after they have entered their two factor code */
    password: null,

    /** Cache of the flag to remember that the user wants to remain logged in after they close the browser */
    rememberMe: false,

    /** Callback to run after login is complete */
    loginCompleteCallback: null,


    /**
     * Check which login method the user is using (either the old process or the new process)
     * ToDo: Add check to the email field on the login page if it is prefilled or they finish typing to fetch the salt
     * @param {String} email The user's email addresss
     * @param {String} password The user's password as entered
     * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if not applicable
     * @param {Boolean} rememberMe A boolean for if they checked the Remember Me checkbox on the login screen
     * @param {Function} oldStartCallback A callback for starting the old login process
     * @param {Function} newStartCallback A callback for starting the new login process
     */
    checkLoginMethod: function(email, password, pinCode, rememberMe, oldStartCallback, newStartCallback) {
        'use strict';

        console.assert(!!password, 'checkLoginMethod: blocked, pwd missing.');
        console.assert(pinCode || !security.login.email, 'checkLoginMethod: blocked, ongoing.');
        if ((!pinCode && security.login.email) || !password) {
            return;
        }

        // Temporarily cache the email, password and remember me checkbox status
        // in case we need to resend after they have entered their two factor code
        security.login.email = email;
        security.login.password = password;
        security.login.rememberMe = rememberMe;

        // Fetch the user's salt from the API
        security.fetchAccountVersionAndSalt(email).then(({version, salt}) => {

            // If using the new method pass through the salt as well
            if (version === 2) {
                newStartCallback(email, password, pinCode, rememberMe, salt);
            }

            // Otherwise using the old method
            else if (version === 1) {
                oldStartCallback(email, password, pinCode, rememberMe);
            }
        }).catch(tell);
    },

    /**
     * Start the login using the new process
     * @param {String} email The user's email addresss
     * @param {String} password The user's password as entered
     * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if not applicable
     * @param {Boolean} rememberMe A boolean for if they checked the Remember Me checkbox on the login screen
     * @param {String} salt The user's salt as a Base64 URL encoded string
     * @param {Function} loginCompleteCallback The final callback once the login is complete
     */
    startLogin: function(email, password, pinCode, rememberMe, salt, loginCompleteCallback) {

        'use strict';

        // Convert the salt and password to byte arrays
        var saltArrayBuffer = base64_to_ab(salt);
        var saltBytes = new Uint8Array(saltArrayBuffer);
        var passwordBytes = security.stringToByteArray(password);

        // The number of iterations for the PPF and desired length in bits of the derived key
        var iterations = security.numOfIterations;
        var derivedKeyLength = security.derivedKeyLengthInBits;

        // Set the callback to run after login is complete
        security.login.loginCompleteCallback = loginCompleteCallback;

        // Run the PPF
        security.deriveKey(saltBytes, passwordBytes, iterations, derivedKeyLength).then((derivedKeyBytes) => {

            // Get the first 16 bytes as the Encryption Key and the next 16 bytes as the Authentication Key
            var derivedEncryptionKeyBytes = derivedKeyBytes.subarray(0, 16);
            var derivedAuthenticationKeyBytes = derivedKeyBytes.subarray(16, 32);
            var authenticationKeyBase64 = ab_to_base64(derivedAuthenticationKeyBytes);

            // Convert the Derived Encryption Key to a big endian array of 32 bit values for decrypting the Master Key
            var derivedEncryptionKeyArray32 = base64_to_a32(ab_to_base64(derivedEncryptionKeyBytes));

            // Authenticate with the API
            security.login.sendAuthenticationKey(email, pinCode, authenticationKeyBase64, derivedEncryptionKeyArray32);
        });
    },

    /**
     * Authenticate with the API by sending the Authentication Key
     * @param {String} email The user's email address
     * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if not applicable
     * @param {String} authenticationKeyBase64 The 128 bit Authentication Key encdoded as URL encoded Base64
     * @param {Array} derivedEncryptionKeyArray32 A 128 bit key encoded as a big endian array of 32 bit values which
     *                                            was used to encrypt the Master Key
     */
    sendAuthenticationKey: function(email, pinCode, authenticationKeyBase64, derivedEncryptionKeyArray32) {

        'use strict';

        // Check for too many login attempts
        if (api_getsid.etoomany + 3600000 > Date.now() || location.host === 'webcache.googleusercontent.com') {
            security.login.loginCompleteCallback(ETOOMANY);
            return false;
        }

        // Setup the login request
        var requestVars = { a: 'us', user: email, uh: authenticationKeyBase64 };

        // If the two-factor authentication code was entered by the user, add it to the request as well
        if (pinCode !== null) {
            requestVars.mfa = pinCode;
        }

        // Send the Email and Authentication Key to the API
        api_req(requestVars, {
            callback: function(result) {

                // If successful
                if (typeof result === 'object') {

                    // Get values from Object
                    var temporarySessionIdBase64 = result.tsid;
                    var encryptedSessionIdBase64 = result.csid;
                    var encryptedMasterKeyBase64 = result.k;
                    var encryptedPrivateRsaKey = result.privk;
                    var userHandle = result.u;

                    // Decrypt the Master Key
                    var encryptedMasterKeyArray32 = base64_to_a32(encryptedMasterKeyBase64);
                    var cipherObject = new sjcl.cipher.aes(derivedEncryptionKeyArray32);
                    var decryptedMasterKeyArray32 = decrypt_key(cipherObject, encryptedMasterKeyArray32);

                    // If the temporary session ID is set then we need to generate RSA keys
                    if (typeof temporarySessionIdBase64 !== 'undefined') {
                        security.login.skipToGenerateRsaKeys(decryptedMasterKeyArray32, temporarySessionIdBase64);
                    }
                    else {
                        // Otherwise continue a regular login
                        security.login.decryptRsaKeyAndSessionId(decryptedMasterKeyArray32, encryptedSessionIdBase64,
                                                                 encryptedPrivateRsaKey, userHandle);
                    }
                }
                else {
                    // Return failure
                    security.login.loginCompleteCallback(result);
                }
            }
        });
    },

    /**
     * Sets some session variables and skips to the RSA Key Generation page and process
     * @param {Array} masterKeyArray32 The unencrypted Master Key
     * @param {String} temporarySessionIdBase64 The temporary session ID send from the API
     */
    skipToGenerateRsaKeys: function(masterKeyArray32, temporarySessionIdBase64) {
        'use strict';

        security.persistAccountSession(masterKeyArray32, temporarySessionIdBase64);

        // Redirect to key generation page
        loadSubPage('key');
    },

    /**
     * Decrypts the RSA private key and the RSA encrypted session ID
     * @param {Array} masterKeyArray32 The unencrypted Master Key
     * @param {String} encryptedSessionIdBase64 The encrypted session ID as a Base64 string
     * @param {String} encryptedPrivateRsaKeyBase64 The private RSA key as a Base64 string
     * @param {String} userHandle The encrypted user handle from the 'us' response
     */
    decryptRsaKeyAndSessionId: function(masterKeyArray32, encryptedSessionIdBase64,
                                        encryptedPrivateRsaKeyBase64, userHandle) {

        'use strict';

        const errobj = {};
        var keyAndSessionData = false;

        try {

            if (typeof userHandle !== 'string' || userHandle.length !== 11) {
                eventlog(99752, JSON.stringify([1, 11, userHandle]));

                console.error("Incorrect user handle in the 'us' response", userHandle);

                Soon(() => {
                    msgDialog('warninga', l[135], l[8853], userHandle);
                });

                return false;
            }

            // Decrypt and decode the RSA Private Key
            var cipherObject = new sjcl.cipher.aes(masterKeyArray32);
            var encryptedPrivateRsaKeyArray32 = base64_to_a32(encryptedPrivateRsaKeyBase64);
            var decryptedPrivateRsaKey = decrypt_key(cipherObject, encryptedPrivateRsaKeyArray32);
            var decryptedPrivateRsaKeyBigEndianString = a32_to_str(decryptedPrivateRsaKey);

            const decodedPrivateRsaKey = crypto_decodeprivkey(decryptedPrivateRsaKeyBigEndianString, errobj);
            if (!decodedPrivateRsaKey) {
                console.error('RSA key decoding failed (%o)..', errobj);

                eventlog(99752, JSON.stringify([1, 10, errobj]));

                Soon(() => {
                    msgDialog('warninga', l[135], l[8853], JSON.stringify(errobj));
                });

                return false;
            }

            // Decrypt the Session ID using the RSA Private Key
            var encryptedSessionIdBytes = base64urldecode(encryptedSessionIdBase64);
            var decryptedSessionId = crypto_rsadecrypt(encryptedSessionIdBytes, decodedPrivateRsaKey);
            var decryptedSessionIdSubstring = decryptedSessionId.substr(0, 43);
            var decryptedSessionIdBase64 = base64urlencode(decryptedSessionIdSubstring);

            // Get the user handle from the decrypted Session ID (11 bytes starting at offset 16 bytes)
            const sessionIdUserHandle = decryptedSessionId.substring(16, 27);

            // Add a check that the decrypted sid and res.u aren't shorter than usual before making the comparison.
            // Otherwise, we could construct an oracle based on shortened csids with single-byte user handles.
            if (decryptedSessionId.length !== 255) {
                eventlog(99752, JSON.stringify([1, 13, userHandle, decryptedSessionId.length]));

                throw new Error(`Incorrect length of Session ID ${decryptedSessionId.length}`);
            }

            // Check that the user handle included in the Session ID matches the one sent in the 'us' response
            if (sessionIdUserHandle !== userHandle) {
                eventlog(99752, JSON.stringify([1, 14, userHandle]));

                throw new Error(`User handle mismatch! us-req:"${userHandle}" != session:"${sessionIdUserHandle}"`);
            }

            // Set the data
            keyAndSessionData = [masterKeyArray32, decryptedSessionIdBase64, decodedPrivateRsaKey];
        }
        catch (ex) {
            if (!eventlog.sent['99752']) {
                eventlog(99752, JSON.stringify([1, 12, userHandle, errobj, String(ex).split('\n')[0]]));
            }

            console.error('Error decrypting or decoding the private RSA key or Session ID!', ex);

            // Show an error dialog
            Soon(() => {
                msgDialog('warninga', l[135], l[8853], `${ex}`);
            });

            return false;
        }

        // Continue with the flow
        security.login.setSessionVariables(keyAndSessionData);
    },

    /**
     * Set the session variables and complete the login
     * @param {Array} keyAndSessionData A basic array consisting of:
     *     [
     *        {Array} The unencrypted Master Key,
     *        {String} The decrypted Session ID as a Base64 string,
     *        {Array} The decoded RSA Private Key as an array of parts
     *     ]
     */
    setSessionVariables: function(keyAndSessionData) {
        'use strict';

        // Check if the Private Key and Session ID were decrypted successfully
        if (keyAndSessionData === false) {
            security.login.loginCompleteCallback(false);
            return false;
        }

        // Remove all previous login data
        u_logout();

        // Set variables
        security.persistAccountSession(...keyAndSessionData);

        // Cleanup temporary login variables
        security.login.email = null;
        security.login.password = null;
        security.login.rememberMe = false;

        // Continue to perform 'ug' request and afterwards run the loginComplete callback
        u_checklogin4(u_storage.sid)
            .then((res) => {
                security.login.loginCompleteCallback(res);

                // Logging to see how many people are signing in
                eventlog(is_mobile ? 99629 : 99630);

                // Broadcast login event
                mBroadcaster.sendMessage('login', keyAndSessionData);

                return res;
            })
            .dump('sec.login');
    },

    /**
     * Handles common errors like Two-Factor PIN issues, suspended accounts,
     * too many login attempts and incomplete registration
     * @param {Number} result A negative number if there was an error, or positive if login was successful
     * @param {type} oldStartLoginCallback
     * @param {type} newStartLoginCallback
     * @returns {Boolean} Returns true if the error was handled by this function, otherwise false and it will continue
     */
    checkForCommonErrors: function(result, oldStartLoginCallback, newStartLoginCallback) {
        'use strict';

        loadingDialog.hide();

        // If the Two-Factor Auth PIN is required
        if (result === EMFAREQUIRED) {

            // Request the 2FA PIN by showing the dialog, then after that it will re-run this function
            twofactor.loginDialog.init(oldStartLoginCallback, newStartLoginCallback);
            return true;
        }

        // If there was a 2FA error, show a message that the PIN code was incorrect and clear the text field
        else if (result === EFAILED) {
            twofactor.loginDialog.showVerificationError();
            return true;
        }

        // Cleanup temporary login variables
        security.login.email = null;
        security.login.password = null;
        security.login.rememberMe = false;

        // close two-factor dialog if it was opened
        twofactor.loginDialog.closeDialog();

        // Check for suspended account
        if (result === EBLOCKED) {
            msgDialog('warninga', l[6789], l[730]);
            return true;
        }

        // Check for too many login attempts
        else if (result === ETOOMANY) {
            api_getsid.etoomany = Date.now();
            api_getsid.warning();
            return true;
        }

        // Check for incomplete registration
        else if (result === EINCOMPLETE) {
            msgDialog('warningb', l[882], l[9082]); // This account has not completed the registration

            return true;
        }

        // Not applicable to this function
        return false;
    },

    /**
     * Silently upgrades a user's account from version 1 to the improved version 2 format (which has a per user salt)
     * and using the user's existing password. This is a general security improvement to upgrade all legacy users to
     * the latest account format when they log in.
     * @param {Number} loginResult The result from the v1 postLogin function which returns from u_checklogin3a
     * @param {Array} masterKey The unencrypted Master Key as an array of Int32 values
     * @param {String} password The current password from the user entered at login
     * @returns {Promise<*>} avu result
     */
    async checkToUpgradeAccountVersion(loginResult, masterKey, password) {
        'use strict';

        // Double check that: 1) not currently in registration signup, 2) account version is v1 and 3) login succeeded
        if (!confirmok && typeof u_attr === 'object' && u_attr.aav === 1 && loginResult !== false && loginResult >= 0) {

            // Show a console message in case it will take a while
            if (d) {
                console.info('Attempting to perform account version upgrade to v2...');
            }

            // Create the Client Random Value, re-encrypt the Master Key and create the Hashed Authentication Key
            const {
                clientRandomValueBytes,
                encryptedMasterKeyArray32,
                hashedAuthenticationKeyBytes
            } = await security.deriveKeysFromPassword(password, masterKey);

            // Convert to Base64
            const encryptedMasterKeyBase64 = a32_to_base64(encryptedMasterKeyArray32);
            const hashedAuthenticationKeyBase64 = ab_to_base64(hashedAuthenticationKeyBytes);
            const clientRandomValueBase64 = ab_to_base64(clientRandomValueBytes);
            const saltBase64 = ab_to_base64(security.createSalt(clientRandomValueBytes));

            // Prepare the Account Version Upgrade (avu) request
            const requestParams = {
                a: 'avu',
                emk: encryptedMasterKeyBase64,
                hak: hashedAuthenticationKeyBase64,
                crv: clientRandomValueBase64
            };

            // Send API request to change password
            const {result} = await api.req(requestParams).catch(dump);

            // If successful
            if (result === 0) {

                // Update global user attributes (key, salt and version) because the
                // 'ug' request is not re-done, nor are action packets sent for this
                u_attr.k = encryptedMasterKeyBase64;
                u_attr.aas = saltBase64;
                u_attr.aav = 2;

                // Log to console
                if (d) {
                    console.info('Account version upgrade to v2 successful.');
                }

                // Log to Stats (to know how many are successfully upgraded)
                eventlog(99770, true);
            }
            else {
                // Log failures as well (to alert us of bugs)
                eventlog(99771, true);
            }

            // If not successful, it will attempt again on next login, continue to update UI
            return result;
        }
    }
};


/**
 * Common functionality for desktop/mobile webclient for changing the password using the old and new processes
 */
security.changePassword = {

    /**
     * Change the user's password using the old method
     * @param {String} newPassword The new password
     * @param {String|null} twoFactorPin The 2FA PIN code or null if not applicable
     */
    async oldMethod(newPassword, twoFactorPin) {

        'use strict';

        // Otherwise change the password using the old method
        const newPasswordTrimmed = $.trim(newPassword);
        const pw_aes = new sjcl.cipher.aes(prepare_key_pw(newPasswordTrimmed));
        const encryptedMasterKeyBase64 = a32_to_base64(encrypt_key(pw_aes, u_k));
        const userHash = stringhash(u_attr.email.toLowerCase(), pw_aes);

        // Prepare the request
        var requestParams = {
            a: 'up',
            k: encryptedMasterKeyBase64,
            uh: userHash
        };

        // If the 2FA PIN was entered, send it with the request
        if (twoFactorPin !== null) {
            requestParams.mfa = twoFactorPin;
        }

        // Make API request to change the password
        return api.screq(requestParams)
            .then(({result}) => {

                // If successful, update user attribute key property with the Encrypted Master Key
                if (result) {
                    u_attr.k = encryptedMasterKeyBase64;
                }

                return result;
            });
    },

    /**
     * Change the user's password using the new method
     * @param {String} newPassword The new password
     * @param {String|null} twoFactorPin The 2FA PIN code or null if not applicable
     */
    async newMethod(newPassword, twoFactorPin) {

        'use strict';

        // Create the Client Random Value, Encrypted Master Key and Hashed Authentication Key
        return security.deriveKeysFromPassword(newPassword, u_k)
            .then(({clientRandomValueBytes, encryptedMasterKeyArray32, hashedAuthenticationKeyBytes}) => {

                // Convert to Base64
                var encryptedMasterKeyBase64 = a32_to_base64(encryptedMasterKeyArray32);
                var hashedAuthenticationKeyBase64 = ab_to_base64(hashedAuthenticationKeyBytes);
                var clientRandomValueBase64 = ab_to_base64(clientRandomValueBytes);
                var saltBase64 = ab_to_base64(security.createSalt(clientRandomValueBytes));

                // Prepare the request
                var requestParams = {
                    a: 'up',
                    k: encryptedMasterKeyBase64,
                    uh: hashedAuthenticationKeyBase64,
                    crv: clientRandomValueBase64
                };

                // If the 2FA PIN was entered, send it with the request
                if (twoFactorPin !== null) {
                    requestParams.mfa = twoFactorPin;
                }

                // Send API request to change password
                return api.screq(requestParams).then(({result}) => {

                    // If successful, update global user attributes key and salt as the 'ug' request is not re-done
                    if (result) {
                        u_attr.k = encryptedMasterKeyBase64;
                        u_attr.aas = saltBase64;
                    }

                    // Update UI
                    return result;
                });
            });
    },

    /**
     * Checks for the user's current Account Authentication Version (e.g. v1 or v2)
     * @returns {Promise<Number>} Account version.
     */
    async checkAccountVersion() {
        'use strict';

        // If the Account Authentication Version is already v2 we don't need to check the version again via the API
        if (u_attr && u_attr.aav === 2) {
            return u_attr.aav;
        }

        // If we are currently a v1 account, we must check here for the current account version (in case it changed
        // recently in another app/browser) because we don't want the other app/browser to have logged in and
        // updated to v2 and then the current account which is still logged in here as v1 to overwrite that with
        // the old format data when they change password. If that happened the user would not be able to log into
        // their account anymore.
        return (await M.getAccountDetails()).aav;
    },

    async isPasswordTheSame(newPassword, method) {
        "use strict";
        let encryptedMasterKeyBase64;
        assert(window.u_attr && u_attr.k && window.u_k, l[23324]);

        // registration v2
        if (method === 2) {
            assert(typeof u_attr.aas !== "undefined", l[23324]);

            const saltBytes = base64_to_ab(u_attr.aas);
            const passwordBytes = security.stringToByteArray($.trim(newPassword));

            const {numOfIterations: iter, derivedKeyLengthInBits: len} = security;
            const derivedKeyBytes = await security.deriveKey(saltBytes, passwordBytes, iter, len);

            const derivedEncryptionKeyBytes = derivedKeyBytes.subarray(0, 16);
            const derivedEncryptionKeyArray32 = base64_to_a32(ab_to_base64(derivedEncryptionKeyBytes));
            const cipherObject = new sjcl.cipher.aes(derivedEncryptionKeyArray32);
            const encryptedMasterKeyArray32 = encrypt_key(cipherObject, u_k);

            encryptedMasterKeyBase64 = a32_to_base64(encryptedMasterKeyArray32);
        }
        else {
            // registration v1
            const pw_aes = new sjcl.cipher.aes(prepare_key_pw(newPassword));

            encryptedMasterKeyBase64 = a32_to_base64(encrypt_key(pw_aes, u_k));
        }

        return u_attr.k === encryptedMasterKeyBase64;
    }
};

/**
 * Two-Factor Authentication logic for logging in with 2FA, setting up 2FA, disabling etc.
 */

/**
 * Generic functions for the desktop code
 */
var twofactor = {

    /**
     * Checks if Two-Factor Authentication functionality is enabled for all users
     * i.e. the user is allowed to see the 2FA section and enable/disable 2FA.
     * @returns {Boolean} Returns true if enabled, false if not.
     */
    isEnabledGlobally: function() {

        'use strict';

        // If the localStorage override is set, use that on/off value for testing
        if (localStorage.getItem('twoFactorAuthEnabled') !== null) {
            return (localStorage.getItem('twoFactorAuthEnabled') === '1') ? true : false;
        }

        return mega.flags.mfae;
    },

    /**
     * Checks if 2FA is enabled on the user's account
     * @param {Function} callbackFunction The function to call when the results are returned,
     * @returns {Promise<Boolean>} true for enabled and false for disabled
     */
    isEnabledForAccount: async function() {
        'use strict';

        // Make Multi-Factor Auth Get request
        return (await api.req({a: 'mfag', e: u_attr.email})).result === 1;
    }
};

/**
 * Logic for the dialog where they enter a code for logging in
 */
twofactor.loginDialog = {

    /**
     * Intialise the dialog
     * @param {Function} oldStartLoginCallback The old registration method start login callback to run after 2FA verify
     * @param {Function} newStartLoginCallback The new registration method start login callback to run after 2FA verify
     */
    init: function(oldStartLoginCallback, newStartLoginCallback) {

        'use strict';

        // Reset the 2FA dialog back to default UI
        this.resetState();

        // Show the dialog
        var $dialog = $('.mega-dialog.verify-two-factor-login');

        // Show the modal dialog
        $dialog.removeClass('hidden');
        fm_showoverlay();

        // Initialise functionality
        this.initKeyupFunctionality();
        this.initSubmitButton(oldStartLoginCallback, newStartLoginCallback);
        this.initLostAuthenticatorDeviceButton();
        this.initCloseButton();
    },

    /**
     * Initialises keyup/blur functionality on the input field to check the PIN as it's being entered
     */
    initKeyupFunctionality: function() {

        'use strict';

        // Cache selectors
        var $dialog = $('.mega-dialog.verify-two-factor-login');
        var $pinCodeInput = $dialog.find('.pin-input');
        var $submitButton = $dialog.find('.submit-button');
        var $warningText = $('.warning-text-field.failed', $dialog);
        var $warningText2 = $('.warning-text-field.empty', $dialog);

        // On keyup or clicking out of the text field
        $pinCodeInput.off('keyup blur').on('keyup blur', function(event) {

            // If Enter key is pressed, submit the login code
            if (event.keyCode === 13) {
                $submitButton.trigger('click');
            }

            // Hide previous warnings for incorrect PIN codes
            $warningText.addClass('v-hidden');
            $warningText2.addClass('hidden');

            // Trim whitespace from the ends of the PIN entered
            var pinCode = $pinCodeInput.val();
            var trimmedPinCode = $.trim(pinCode);

            // If empty, grey out the button so it appears unclickable
            if (trimmedPinCode === '' || trimmedPinCode.length !== 6 || Number.isInteger(trimmedPinCode)) {
                $submitButton.removeClass('active');
            }
            else {
                // Otherwise how the button as red/clickable
                $submitButton.addClass('active');
            }
        });

        // Put the focus in the PIN input field
        $pinCodeInput.trigger('focus');
    },

    /**
     * Initialise the Submit button
     * @param {Function} oldStartLoginCallback The old registration method start login callback
     * @param {Function} newStartLoginCallback The new registration method start login callback
     */
    initSubmitButton: function(oldStartLoginCallback, newStartLoginCallback) {

        'use strict';

        // Cache selectors
        var $dialog = $('.mega-dialog.verify-two-factor-login');
        var $pinCodeInput = $dialog.find('.pin-input');
        var $submitButton = $dialog.find('.submit-button');
        var $warningText = $('.warning-text-field.empty', $dialog);

        // On Submit button click
        $submitButton.rebind('click', () => {

            // Get the Google Authenticator PIN code from the user
            var pinCode = $.trim($pinCodeInput.val());
            if ($submitButton.hasClass('loading')) {
                return;
            }

            this.resetState();

            // Submit empty string
            if (!pinCode) {
                $warningText.removeClass('hidden');
                $pinCodeInput.trigger('focus');
                return;
            }

            // Get cached data from the login form
            const {email, password, rememberMe} = security.login;

            // Show loading spinner on the buttons
            $submitButton.addClass('loading');

            // Check if using old/new login method and log them in
            security.login.checkLoginMethod(email, password, pinCode, rememberMe,
                                            oldStartLoginCallback,
                                            newStartLoginCallback);
        });
    },

    /**
     * Initialise the Lost Authenticator Device button
     */
    initLostAuthenticatorDeviceButton: function() {

        'use strict';

        // Cache selectors
        var $dialog = $('.mega-dialog.verify-two-factor-login');
        var $lostDeviceButton = $dialog.find('.lost-authenticator-button');

        // On button click
        $lostDeviceButton.rebind('click', function() {

            // Cleanup temporary login variables
            security.login.email = null;
            security.login.password = null;
            security.login.rememberMe = false;

            // Load the Recovery page where they can recover using their Recovery Key
            loadSubPage('recovery');
        });
    },

    /**
     * Initialise the Close button to close the overlay
     */
    initCloseButton: function() {

        'use strict';

        // Show the dialog
        var $dialog = $('.mega-dialog.verify-two-factor-login');
        var $closeButton = $('button.js-close', $dialog);

        // On click of the close and back buttons
        $closeButton.rebind('click', function() {

            // Cleanup temporary login variables
            security.login.email = null;
            security.login.password = null;
            security.login.rememberMe = false;

            // Close the modal dialog
            twofactor.loginDialog.closeDialog();
        });
    },

    /**
     * Shows a verification error on the 2FA dialog when there was an incorrect PIN
     */
    showVerificationError: function() {

        'use strict';

        var $dialog = $('.mega-dialog.verify-two-factor-login');
        var $warningText = $('.warning-text-field.failed', $dialog);
        var $pinCodeInput = $dialog.find('.pin-input');
        var $submitButton = $dialog.find('.submit-button');

        // Reset the 2FA dialog back to default UI
        this.resetState();

        // Re-show the background overlay which is removed from loading dialog being hidden,
        // then show a message that the PIN code was incorrect and clear the text field
        fm_showoverlay();
        $submitButton.removeClass('loading');
        $warningText.removeClass('v-hidden');
        $pinCodeInput.val('');

        // Put the focus back in the PIN input field
        $pinCodeInput.trigger('focus');
    },

    /**
     * Reset the two-factor login dialog's user interface back to its default.
     * Useful if there was an error during the login/verification process.
     */
    resetState: function() {

        'use strict';

        var $dialog = $('.mega-dialog.verify-two-factor-login');
        var $warningText = $('.warning-text-field.failed', $dialog);
        var $warningText2 = $('.warning-text-field.empty', $dialog);
        var $pinCodeInput = $dialog.find('.pin-input');
        var $submitButton = $dialog.find('.submit-button');

        // Hide loading spinner, warning text and clear the text input
        $submitButton.removeClass('loading');
        $warningText.addClass('v-hidden');
        $warningText2.addClass('hidden');
        $pinCodeInput.val('');
    },

    /**
     * Close the dialog
     */
    closeDialog: function() {

        'use strict';

        var $dialog = $('.mega-dialog.verify-two-factor-login');

        // Close the modal dialog
        $dialog.addClass('hidden');
        if (!($.dialog && $.dialog === 'pro-login-dialog')) {
            fm_hideoverlay();
        }
    }
};


/**
 * Functions for enabling and displaying 2FA in the My Account section, Security tab
 */
twofactor.account = {

    /**
     * Initialise the 2FA section on the page
     */
    init: function() {

        'use strict';

        // Check if disabled/enabled
        this.fetchAndDisplayTwoFactorAuthStatus();
    },

    /**
     * Displays the current Two-Factor Authentication status (enabled/disabled)
     */
    fetchAndDisplayTwoFactorAuthStatus: function() {

        'use strict';

        var $twoFactorSection = $('.account.two-factor-authentication');
        var $button = $twoFactorSection.find('.enable-disable-2fa-button');

        // Check if 2FA is actually enabled on the API for everyone
        if (twofactor.isEnabledGlobally()) {

            // Show the 2FA section
            $twoFactorSection.removeClass('hidden');

            // Check if 2FA is enabled on their account
            twofactor.isEnabledForAccount().then((result) => {
                // If enabled, show red button, disable PIN entry text box and Deactivate text
                if (result) {
                    $button.addClass('toggle-on enabled').trigger('update.accessibility');
                }
                else {
                    // Otherwise show green button and Enable text
                    $button.removeClass('toggle-on enabled').trigger('update.accessibility');
                }

                // Init the click handler now for the button now that the enabled/disabled status has been retrieved
                twofactor.account.initEnableDeactivateButton();
            }).catch(tell);
        }
    },

    /**
     * Initialises the enable/deactivate 2FA button
     */
    initEnableDeactivateButton: function() {

        'use strict';

        var $accountPageTwoFactorSection = $('.account.two-factor-authentication');
        var $button = $accountPageTwoFactorSection.find('.enable-disable-2fa-button');

        // On button click
        $button.rebind('click', function() {

            // If 2FA is enabled
            if ($button.hasClass('enabled')) {
                // Show the verify 2FA dialog to collect the user's PIN
                twofactor.verifyActionDialog.init()
                    .then((twoFactorPin) => {
                        // Disable 2FA
                        loadingDialog.show();

                        // Run Multi-Factor Auth Disable (mfad) request
                        return api.send({a: 'mfad', mfa: twoFactorPin});
                    })
                    .then(() => {
                        // Refresh the account 2FA status to show it's deactivated
                        return twofactor.account.init();
                    })
                    .catch((ex) => {
                        if (ex === EBLOCKED) {
                            // dialog closed.
                            return;
                        }

                        // The Two-Factor has already been disabled
                        if (ex === ENOENT) {
                            msgDialog('warninga', '', l.two_fa_already_off_title, l.two_fa_already_off_text, () => {
                                // Refresh the account 2FA status
                                twofactor.account.init();
                            });
                        }
                        else if (ex < 0) {

                            // If there was an error, show a message that the code was incorrect
                            msgDialog('warninga', '', l.two_fa_cannot_disable_title, l.two_fa_cannot_disable_text);
                        }
                        else {
                            tell(ex);
                        }
                    })
                    .finally(() => loadingDialog.hide());
            }
            else {
                // Setup 2FA
                twofactor.setupDialog.init();
            }
        });
    },

    /**
     * Disable the Two Factor Authentication
     */
    disableTwoFactorAuthentication: function(twoFactorPin) {

        'use strict';

        loadingDialog.show();

        // Run Multi-Factor Auth Disable (mfad) request
        api_req({ a: 'mfad', mfa: twoFactorPin }, {
            callback: function(response) {

                loadingDialog.hide();

                // The Two-Factor has already been disabled
                if (response === ENOENT) {
                    msgDialog('warninga', '', l.two_fa_already_off_title, l.two_fa_already_off_text, () => {
                        // Refresh the account 2FA status
                        twofactor.account.init();
                    });
                }
                else if (response < 0) {

                    // If there was an error, show a message that the code was incorrect
                    msgDialog('warninga', '', l.two_fa_cannot_disable_title, l.two_fa_cannot_disable_text);
                }
                else {
                    // Refresh the account 2FA status to show it's deactivated
                    twofactor.account.init();
                }
            }
        });
    }
};


/**
 * The dialog to start the 2FA activation process
 */
twofactor.setupDialog = {

    /** jQuery selector for this dialog */
    $dialog: null,

    /**
     * Intialise the dialog
     */
    init: function() {

        'use strict';

        // Cache selector
        this.$dialog = $('.two-factor-dialog.setup-two-factor');

        // Setup functionality
        this.getSharedSecret();
        this.initNextButton();
        this.initCloseButton();
        this.initNoAuthenticatorAppButton();

        // Show the dialog
        this.$dialog.removeClass('hidden');
        fm_showoverlay();
    },

    /**
     * Setup the Two-Factor Authentication by getting a shared secret from the API
     */
    getSharedSecret: function() {

        'use strict';

        // Cache selectors
        var $seedInput = this.$dialog.find('.two-factor-qr-seed');
        var $qrCode = this.$dialog.find('.two-factor-qr-code');

        // Run Multi-Factor Auth Setup (mfas) request
        api.send('mfas')
            .then((res) => {
                assert(res && typeof res === 'string');

                // Set Base32 seed into text box
                $seedInput.val(res);

                // Configure the QR code rendering library
                // Appears as: MEGA (name@email.com) in authenticator app
                var options = {
                    width: 224,
                    height: 224,
                    correctLevel: QRErrorCorrectLevel.H,    // High
                    background: '#f2f2f2',
                    foreground: '#151412',
                    text: `otpauth://totp/MEGA:${u_attr.email}?secret=${res}&issuer=MEGA`
                };

                // Render the QR code
                $qrCode.text('').qrcode(options);

            })
            .catch((ex) => {
                twofactor.setupDialog.closeDialog();

                // If the Two-Factor has already been setup, show a warning dialog
                if (ex === EEXIST) {

                    msgDialog('warninga', l[19219], l['2fa_already_enabled']);
                }
                else {
                    tell(ex);
                }
            });
    },

    /**
     * Initialise the Next button to go to the Verify Setup dialog
     */
    initNextButton: function() {

        'use strict';

        // On button click
        this.$dialog.find('.two-factor-next-btn').rebind('click', function() {

            // Close the current dialog and open the verify dialog
            twofactor.setupDialog.closeDialog();
            twofactor.verifySetupDialog.init();
        });
    },

    /**
     * Initialise the close icon in the header to close the dialog
     */
    initCloseButton: function() {

        'use strict';

        // On button click, close the dialog
        this.$dialog.find('button.js-close').rebind('click', function() {

            twofactor.setupDialog.closeDialog();
        });
    },

    /**
     * Closes the dialog
     */
    closeDialog: function() {

        'use strict';

        // Hide the dialog and background
        this.$dialog.addClass('hidden');
        fm_hideoverlay();
    },

    /**
     * Initialise the Don't have an authenticator app? button to open the Select Authenticator App tooltip
     */
    initNoAuthenticatorAppButton: function() {

        'use strict';

        var $noAuthAppButton = this.$dialog.find('.no-auth-app-button');
        var $authAppSelectDialog = $('.auth-app-select-tooltip');

        // On button click
        $noAuthAppButton.rebind('click', function() {

            // Get the absolute position of the button, the width of the button and dialog
            var buttonOffset = $noAuthAppButton.offset();
            var buttonWidth = $noAuthAppButton.width();
            var dialogWidth = $authAppSelectDialog.outerWidth();

            // Put the dialog in the middle of the button horizontally
            var offsetMiddleOfButton = buttonOffset.left + (buttonWidth / 2);
            var leftOffset = offsetMiddleOfButton - (dialogWidth / 2);

            // Move the dialog down below the button text (14px text height + 10px top margin)
            var topOffset = buttonOffset.top + 14 + 10;

            // Show the tooltip above the Select Authenticator app dialog and below the button
            $authAppSelectDialog.css({ top: topOffset, left: leftOffset }).removeClass('hidden');

            // Initialise the handler to close the tooltip
            twofactor.setupDialog.initTooltipClose();

            // Prevent click closing the tooltip straight away
            return false;
        });
    },

    /**
     * Initialise the click handler to close the tooltip if they click anywhere in or out of the tooltip or press the
     * Esc key. The authenticator app buttons/hyperlinks should still open the link in a new tab/window regardless.
     */
    initTooltipClose: function() {

        'use strict';

        // If there is a click anywhere on the page
        $(document).rebind('click.closeauthapptooltip', function() {

            // Close the tooltip
            $('.auth-app-select-tooltip').addClass('hidden');

            // Remove the click handler
            $(document).off('click.closeauthapptooltip');
        });

        // If there is a keypress
        $(document).rebind('keyup.closeauthapptooltip', function(event) {

            // If the Esc key was pressed
            if (event.keyCode === 27) {

                // Close the tooltip
                $('.auth-app-select-tooltip').addClass('hidden');

                // Remove the keyup handler
                $(document).off('keyup.closeauthapptooltip');
            }
        });
    }
};


/**
 * The dialog to verify the 2FA activation process was set up correctly
 */
twofactor.verifySetupDialog = {

    /** jQuery selector for this dialog */
    $dialog: null,

    /**
     * Intialise the dialog
     */
    init: function() {

        'use strict';

        // Cache selector
        this.$dialog = $('.two-factor-dialog.setup-two-factor-verify');

        // Setup functionality
        this.resetToDefault();
        this.initCloseButton();
        this.initKeyupFunctionality();
        this.initBackButton();
        this.initNextButton();

        // Show the dialog
        this.$dialog.removeClass('hidden');
        fm_showoverlay();

        // Put the focus in the PIN input field after its visible
        this.$dialog.find('.pin-input').trigger('focus');
    },

    /**
     * Reset the dialog to default state if it is re-opened
     */
    resetToDefault: function() {

        'use strict';

        var $pinCode = this.$dialog.find('.pin-input');
        var $warningText = this.$dialog.find('.information-highlight.failed');
        var $warningText2 = this.$dialog.find('.information-highlight.empty');
        var $successText = this.$dialog.find('.information-highlight.success');
        var $closeButton = this.$dialog.find('button.js-close');

        // Clear the text input, remove the warning/success boxes, unhide the close button
        $pinCode.val('');
        $warningText.addClass('hidden');
        $warningText2.addClass('hidden');
        $successText.addClass('hidden');
        $closeButton.removeClass('hidden');
    },

    /**
     * Initialise the close icon in the header to close the dialog
     */
    initCloseButton: function() {

        'use strict';

        // On button click, close the dialog
        this.$dialog.find('button.js-close').rebind('click', function() {

            twofactor.verifySetupDialog.closeDialog();
        });
    },

    /**
     * Closes the dialog
     */
    closeDialog: function() {

        'use strict';

        // Hide the dialog and background
        this.$dialog.addClass('hidden');
        fm_hideoverlay();
    },

    /**
     * Initialises keyup/blur functionality on the input field to check the PIN as it's being entered
     */
    initKeyupFunctionality: function() {

        'use strict';

        // Cache selectors
        var $pinCodeInput = this.$dialog.find('.pin-input');
        var $warningText = this.$dialog.find('.information-highlight.failed');
        var $warningText2 = this.$dialog.find('.information-highlight.empty');
        var $verifyButton = this.$dialog.find('.next-button');

        // On keyup or clicking out of the text field
        $pinCodeInput.rebind('keyup blur', function(event) {

            // Hide previous warnings for incorrect PIN codes
            $warningText.addClass('hidden');
            $warningText2.addClass('hidden');

            // If Enter key is pressed, verify the code
            if (event.keyCode === 13) {
                $verifyButton.trigger('click');
            }
        });
    },

    /**
     * Initalises the back button to go back to the QR code/seed dialog
     */
    initBackButton: function() {

        'use strict';

        var $backButton = this.$dialog.find('.back-button');

        // On button click
        $backButton.removeClass('disabled').rebind('click', function() {

            // Don't let them go back if they already activated 2FA, they need to go forward
            if ($(this).hasClass('disabled')) {
                return false;
            }

            twofactor.verifySetupDialog.closeDialog();
            twofactor.setupDialog.init();
        });
    },

    /**
     * Initialise the Next button to verify the code
     */
    initNextButton: function() {

        'use strict';

        // Cache selectors
        var $pinCodeInput = this.$dialog.find('.pin-input');
        var $backButton = this.$dialog.find('.back-button');
        var $closeButton = this.$dialog.find('button.js-close');
        var $verifyButton = this.$dialog.find('.next-button');
        var $warningText = this.$dialog.find('.information-highlight.failed');
        var $successText = this.$dialog.find('.information-highlight.success');
        var $warningText2 = this.$dialog.find('.information-highlight.empty');

        // On button click
        $verifyButton.rebind('click', function() {

            if ($verifyButton.hasClass('disabled')) {
                return false;
            }
            $verifyButton.addClass('disabled');

            // Hide old warning
            $warningText.addClass('hidden');
            $warningText2.addClass('hidden');

            // If the operation hasn't succeeded yet
            if ($successText.hasClass('hidden')) {

                // Get the Google Authenticator PIN code from the user
                var pinCode = $.trim($pinCodeInput.val());

                if (pinCode === '' || pinCode.length !== 6 || Number.isInteger(pinCode)) {
                    $warningText2.removeClass('hidden');
                    $verifyButton.removeClass('disabled');
                    return;
                }

                // Run Multi-Factor Auth Setup (mfas) request
                api.req({a: 'mfas', mfa: pinCode})
                    .then((res) => {
                        console.info(res);

                        // Disable the back button and hide the close button to force them to go to the next step
                        // to backup their Recovery Key. Also now that 2FA is activated, show the success message
                        $backButton.addClass('disabled');
                        $closeButton.addClass('hidden');
                        $successText.removeClass('hidden');

                    })
                    .catch((ex) => {

                        // If the Two-Factor has already been setup, show a warning dialog
                        if (ex === EEXIST) {
                            msgDialog('warninga', l[19219], l['2fa_already_enabled'], null, () => {
                                // Close the dialog on click of OK button
                                twofactor.verifySetupDialog.closeDialog();
                            });
                        }
                        else {
                            console.error(ex);

                            // If there was an error, show message that the code was incorrect and clear the text field
                            $warningText.removeClass('hidden');
                            $pinCodeInput.val('');

                            // Put the focus back in the PIN input field
                            $pinCodeInput.trigger('focus');
                        }
                    })
                    .finally(() => {
                        $verifyButton.removeClass('disabled');
                    });
            }
            else {
                // If the operation to activate succeeded, load next dialog to backup the recovery key
                twofactor.verifySetupDialog.closeDialog();
                twofactor.backupKeyDialog.init();
            }
        });
    }
};


/**
 * The dialog to verify the 2FA activation process was set up correctly
 */
twofactor.backupKeyDialog = {

    /** jQuery selector for this dialog */
    $dialog: null,

    /**
     * Intialise the dialog
     */
    init: function() {

        'use strict';

        // Cache selectors
        this.$dialog = $('.two-factor-dialog.setup-two-factor-backup-key');

        // Setup functionality
        this.initCloseButton();
        this.initSaveRecoveryKeyButton();

        // Show the dialog
        this.$dialog.removeClass('hidden');
        fm_showoverlay();
    },

    /**
     * Initialise the button to save the Recovery Key to a file
     */
    initSaveRecoveryKeyButton: function() {
        'use strict';
        this.$dialog.find('.recovery-key-button').rebind('click', u_savekey);
    },

    /**
     * Initialise the close and finish buttons to close the dialog
     */
    initCloseButton: function() {

        'use strict';

        // On button click, close the dialog
        this.$dialog.find('button.js-close').rebind('click', function() {

            // Close the dialog and refresh the status of 2FA in the background
            twofactor.backupKeyDialog.closeDialog();
            twofactor.account.init();
        });
    },

    /**
     * Closes the dialog
     */
    closeDialog: function() {

        'use strict';

        // Hide the dialog and background
        this.$dialog.addClass('hidden');
        fm_hideoverlay();
    }
};


/**
 * Logic for the dialog where they need to perform some action e.g. change email or change
 * password but they need to enter their Two Factor Authentication PIN in order to proceed
 */
twofactor.verifyActionDialog = {

    /** jQuery selector for this dialog */
    $dialog: null,

    /**
     * Intialise the dialog
     * @returns {Promise<String>} 2-fa pin code.
     */
    init: function() {
        'use strict';
        return new Promise((resolve, reject) => {

            // Cache selectors
            this.$dialog = $('.mega-dialog.two-factor-verify-action');
            this.reject = reject;

            // Initialise functionality
            this.resetState();
            this.initKeyupFunctionality();
            this.initSubmitButton(resolve);
            this.initLostAuthenticatorDeviceButton();
            this.initCloseButton();

            // Show the modal dialog
            this.$dialog.removeClass('hidden');
            fm_showoverlay();

            // Put the focus in the PIN input field after its visible
            this.$dialog.find('.pin-input').trigger('focus');
        });
    },

    /**
     * Initialises keyup/blur functionality on the input field to check the PIN as it's being entered
     */
    initKeyupFunctionality: function() {

        'use strict';

        // Cache selectors
        var $pinCodeInput = this.$dialog.find('.pin-input');
        var $submitButton = this.$dialog.find('.submit-button');
        var $warningText = this.$dialog.find('.information-highlight.warning');

        // On keyup or clicking out of the text field
        $pinCodeInput.off('keyup blur').on('keyup blur', function(event) {

            $warningText.addClass('hidden');

            // If Enter key is pressed, submit the login code
            if (event.keyCode === 13) {
                $submitButton.trigger('click');
            }

            // Trim whitespace from the ends of the PIN entered
            var pinCode = $pinCodeInput.val();
            var trimmedPinCode = $.trim(pinCode);

            // If empty, grey out the button so it appears unclickable
            if (trimmedPinCode === '' || trimmedPinCode.length !== 6 || Number.isInteger(trimmedPinCode)) {
                $submitButton.removeClass('active');
            }
            else {
                // Otherwise how the button as red/clickable
                $submitButton.addClass('active');
            }
        });
    },

    /**
     * Initialise the Submit button
     * @param {Function} completeCallback The callback to run after 2FA verify
     */
    initSubmitButton: function(completeCallback) {

        'use strict';

        // Cache selectors
        var $pinCodeInput = this.$dialog.find('.pin-input');
        var $submitButton = this.$dialog.find('.submit-button');
        var $warningText = this.$dialog.find('.information-highlight.warning');

        // On Submit button click/tap
        $submitButton.rebind('click', function() {

            // Get the Google Authenticator PIN code from the user
            var pinCode = $.trim($pinCodeInput.val());

            if (pinCode === '' || pinCode.length !== 6 || Number.isInteger(pinCode)) {
                $warningText.removeClass('hidden');
                $pinCodeInput.trigger('focus');
            }
            else {
                // Close the modal dialog
                twofactor.verifyActionDialog.closeDialog();

                // Send the PIN code to the callback
                completeCallback(pinCode);
            }
        });
    },

    /**
     * Initialise the Lost Authenticator Device button
     */
    initLostAuthenticatorDeviceButton: function() {

        'use strict';

        // Cache selectors
        var $lostDeviceButton = this.$dialog.find('.lost-authenticator-button');

        // On button click
        $lostDeviceButton.rebind('click', function() {
            twofactor.verifyActionDialog.closeDialog();
            M.showRecoveryKeyDialog();
        });
    },

    /**
     * Initialise the Close buttons to close the overlay
     */
    initCloseButton: function() {

        'use strict';

        var $closeButton = this.$dialog.find('button.js-close');

        // On click of the close and back buttons
        $closeButton.rebind('click', function() {

            // Close the modal dialog
            twofactor.verifyActionDialog.closeDialog();
        });
    },

    /**
     * Closes the dialog
     */
    closeDialog: function() {
        'use strict';
        const {reject} = this;

        if (reject) {
            onIdle(() => reject(EBLOCKED));
            delete this.reject;
        }

        // Hide the dialog and background
        this.$dialog.addClass('hidden');
        fm_hideoverlay();
    },

    /**
     * Reset the two-factor login dialog's user interface back to its default.
     * Useful if there was an error during the verification process.
     */
    resetState: function() {

        'use strict';

        var $pinCodeInput = this.$dialog.find('.pin-input');
        var $submitButton = this.$dialog.find('.submit-button');
        var $warningText = this.$dialog.find('.information-highlight.warning');

        // Hide loading spinner and clear the text input
        $submitButton.removeClass('active');
        $pinCodeInput.val('');
        $warningText.addClass('hidden');
    }
};
