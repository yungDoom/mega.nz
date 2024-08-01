// Release version information is replaced by the build scripts
var buildVersion = {"website":"5.27.1","chrome":"5.27.1","chromeSize":8175507,"firefox":"4.24.0","firefoxSize":8599527,"commit":"aada4a2ff3245c2b04c792e831b53e3f0212c30e","timestamp":1721880800,"dateTime":"Thu, 25 Jul 2024 16:13:20 +1200"};

var browserUpdate = 0;
var pageLoadTime;
var silent_loading = false;
var cookiesDisabled = false;
var storageQuotaError = false;
var lastactive = new Date().getTime();
var seqno = Math.ceil(Math.random()*1000000000);
var staticpath = null;
var defaultStaticPath = 'https://eu.static.mega.co.nz/4/';
var ua = window.navigator.userAgent.toLowerCase();
var uv = window.navigator.appVersion.toLowerCase();
var storage_version = '1'; // clear localStorage when version doesn't match
var contenterror = 0;
var nocontentcheck = false;
var l, d = false;
var loginresponse, voucher, dl_res, gmf_res;
var tmp, page, apipath, hashLogic, u_storage, u_sid;

// Cache location.search parameters early as the URL may get rewritten later
var locationSearchParams = location.search;

var is_electron = false;
var is_eplusplus = false;
if (typeof process !== 'undefined') {
    var mll = process.moduleLoadList || [];

    if (mll.indexOf('NativeModule ELECTRON_ASAR') !== -1) {
        is_electron = module;
        module = undefined; // prevent factory loaders from using the module

        // localStorage.jj = 1;
    }
}

var is_mobile = (function isMobile() {
    'use strict';
    var mobileStrings = [
        'iphone', 'ipad', 'android', 'blackberry', 'nokia', 'opera mini', 'ucbrowser',
        'windows mobile', 'windows phone', 'iemobile', 'mobile safari', 'bb10; touch'
    ];
    for (var i = mobileStrings.length; i--;) {
        if (ua.indexOf(mobileStrings[i]) > 0) {
            return true;
        }
    }
})();

var is_android = is_mobile && ua.indexOf('android') > 0;
var is_uc_browser = is_mobile && ua.indexOf('ucbrowser') > 0;
var is_ios = is_mobile && (ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1 || ua.indexOf('ipod') > -1);
var is_old_windows_phone = is_mobile && /windows phone 8|iemobile\/9|iemobile\/10|iemobile\/11/i.test(ua);
var is_windowsphone = is_old_windows_phone || is_mobile && ua.indexOf('windows phone') > 0;
var is_huawei = is_mobile && (ua.indexOf('huawei') > 0 || ua.indexOf('hmscore') > 0);

if (is_android && !is_huawei) {
    // detect huawei devices by model
    tmp = [
        'ana-al00', 'ana-nx9', 'ang-an00', 'art-l28', 'brq-an00', 'cdy-nx9b', 'dra-lx9', 'els-n39', 'els-nx9',
        'jef-nx9', 'jny-lx2', 'lio-an00m', 'lio-l29', 'lio-n29', 'med-lx9', 'noh-an00', 'noh-lg', 'noh-nx9',
        'nop-an00', 'oce-an10', 'oce-an50', 'tas-l29', 'tet-an00'
    ];
    for (var m = tmp.length; m--;) {
        if (ua.indexOf(tmp[m]) > 0) {
            is_huawei = tmp[m];
            break;
        }
    }
}

var staticServerLoading = {
    loadFailuresOriginal: 0,        // Count of failures on the original static server (from any thread)
    loadFailuresDefault: {},        // Count of failures on the EU static server per file
    maxRetryAttemptsOriginal: 2,    // Max retry attempts on the original static server before switching to the default
    maxRetryAttemptsDefault: 3,     // Max retry attempts on the default static server per file before it shows dialog
    failureLoggedOriginal: false,   // Flag to indicate failure of original static server was logged to the API
    failureLoggedDefault: false,    // Flag to indicate failure of the default static server was logged to the API
    failureLoggedCorrupt: false,    // Flag to indicate that file corruption (hash mismatch) was logged to the API
    flippedToDefault: false         // Flag to indicate if the static server was flipped
};
var load_error_types = {
    /** The file is corrupt i.e. mismatch on SHA-2 hash check */
    file_corrupt: 1,
    /** A file loading issue, network issue or the static server is down */
    file_load_error: 2
};

Object.defineProperties(self, {
    'freeze': {
        value: function freeze(obj) {
            Object.setPrototypeOf(obj, null);
            return Object.freeze(obj);
        }
    },

    'gClearTimeout': {
        value: self.clearTimeout
    },

    'gSetTimeout': {
        value: self.setTimeout
    },

    'lazy': {
        value: function lazy(target, property, stub) {
            return Object.defineProperty(target, property, {
                get: function() {
                    Object.defineProperty(this, property, {
                        value: stub.call(this),
                        enumerable: property[0] !== '_'
                    });
                    return this[property];
                },
                configurable: true
            });
        }
    },

    'megaChatIsDisabled': ((function() {
        var status = tryCatch(function() {
            return localStorage.testChatDisabled;
        }, false)();
        return {
            set: function(val) {
                status = val;
                if (status) {
                    $(document.body).addClass("megaChatDisabled");
                }
                else {
                    $(document.body).removeClass("megaChatDisabled");
                }
            },
            get: function() {
                return status || window.mega.flags.mcs === 0;
            }
        };
    })()),

    'megaChatIsReady': {
        get: function() {
            return !self.megaChatIsDisabled && typeof megaChat !== 'undefined' && megaChat.is_initialized;
        }
    }
});

/**
 * Check whether the provided `page` points to a public link
 * @param {String} [page] optional page to check.
 * @returns {String|Array|Boolean} page for v1, [public-handle, key] for v2+, or false
 */
function isPublicLink(page) {
    'use strict';
    var ptr = (page = getCleanSitePath(page)).split(/[^\w-]/).filter(String);

    if (page[0] === '!') {

        ptr.unshift('file');
    }
    else if (isPublicLink.upd[ptr[0]]) {

        ptr[0] = isPublicLink.upd[ptr[0]];
    }
    else if (isPublicLink.v1[page.slice(0, 2)]) {

        return page;
    }

    if (ptr.length > 1 && page.length > isPublicLink.v2[ptr[0]]) {

        return Object.defineProperties(ptr.slice(1), {
            dl: {
                value: ptr[0] === 'file' || ptr[0] === 'embed'
            },
            pf: {
                value: ptr[0] === 'folder' || ptr[0] === 'collection'
            },
            link: {
                value: ptr[0] + '/' + ptr[1] + '#' + ptr[2] + (ptr.length > 3 ? '/' + ptr.slice(3).join('/') : '')
            }
        });
    }

    return false;
}

Object.defineProperties(isPublicLink, {
    v1: {
        value: {'F!': 1, 'P!': 1, 'E!': 1, 'D!': 1}
    },
    v2: {
        value: {file: 6, folder: 8, embed: 7, chat: 6, collection: 12}
    },
    upd: {
        value: {F: 'folder', E: 'embed', D: 'filerequest'}
    }
});

try {
// auto-shield
    freeze(freeze);
    freeze(lazy);

    freeze(isPublicLink.v1);
    freeze(isPublicLink.v2);
    freeze(isPublicLink.upd);
    freeze(isPublicLink);

    delete String.prototype.big;
    delete String.prototype.sup;
    delete String.prototype.sub;
    delete String.prototype.bold;
    delete String.prototype.link;
    delete String.prototype.blink;
    delete String.prototype.small;
    delete String.prototype.fixed;
    delete String.prototype.anchor;
    delete String.prototype.strike;
    delete String.prototype.italics;
    delete String.prototype.fontsize;
    delete String.prototype.fontcolor;
}
catch (ex) {
    console.warn('unsecure browser environment...', ex);
}

tmp = document.location.href.substr(0, 16);
var is_chrome_web_ext = tmp === 'chrome-extension' || tmp === 'ms-browser-exten';
var is_firefox_web_ext = tmp === 'moz-extension://';
var is_extension = hashLogic = is_electron || is_chrome_web_ext || is_firefox_web_ext;

tmp = getCleanSitePath();
var is_embed = tmp.substr(0, 6) === 'embed/' || tmp.substr(0, 2) === 'E!';
var is_drop = tmp.substr(0, 12) === 'filerequest#' || tmp.substr(0, 4) === 'drop' || tmp.substr(0, 2) === 'D!';
var is_megadrop = (tmp.substr(0, 9) === 'megadrop/' || tmp.substr(0, 12) === 'filerequest/') && tmp.split('/')[1];
var is_chatlink = tmp.substr(0, 5) === 'chat/' && tmp.replace(/[#?].*$/, '').split('/')[1];
var is_iframed = is_embed || is_drop || is_megadrop;
var is_karma = !is_iframed && /^localhost:987[6-9]/.test(window.top.location.host);

var is_microsoft = /msie|edge|trident/i.test(ua);
var is_bot = !is_extension && /bot|crawl/i.test(ua);
var is_webcache = location.host === 'webcache.googleusercontent.com';
var is_livesite = location.host === 'mega.nz' || location.host === 'mega.io'
    || location.host === 'smoketest.mega.nz' || is_extension;

function getMobileStoreLink() {
    'use strict';

    if (is_ios) {
        return 'https://itunes.apple.com/app/mega/id706857885';
    }
    if (is_windowsphone) {
        return 'zune://navigate/?phoneappID=1b70a4ef-8b9c-4058-adca-3b9ac8cc194a';
    }
    if (is_huawei) {
        return 'https://appgallery.huawei.com/#/app/C102009895';
    }
    return 'https://play.google.com/store/apps/details?id=mega.privacy.android.app&referrer=meganzindexandroid';
}

function goToMobileApp(aBaseLink) {
    'use strict';
    var testbed = tryCatch(function() {
        return localStorage.testOpenInApp;
    }, false)();

    if (is_ios || testbed === 'ios') {
        openExternalLink('mega://' + aBaseLink);
    }
    else if (is_windowsphone || testbed === 'winphone') {
        top.location = 'mega://' + aBaseLink;
    }
    else if (is_android || testbed === 'android') {
        var tmp = 'intent://' + aBaseLink + '/#Intent;scheme=mega;package=mega.privacy.android.app;end';
        tmp = tmp.replace('id.app', 'id.app;S.browser_fallback_url=' + encodeURIComponent(getMobileStoreLink()));
        if (is_huawei) {
            tmp = tmp.replace('.app;', '.app.huawei;');
        }
        top.location = tmp;
    }
    else {
        // eslint-disable-next-line no-alert
        alert('This device is unsupported.');
    }
    return false;
}

function openExternalLink(aExternalLink) {
    'use strict';

    // Clear page events
    var clearEvents = function() {
        document.removeEventListener('visibilitychange', clearEvents);
        clearTimeout(window.appLnkInt);
        window.appLnkInt = undefined;
        return 0xDEAD;
    };
    mBroadcaster.addListener('beforepagechange', clearEvents);

    // Clear events when changing the tab visibility
    clearEvents();
    document.addEventListener('visibilitychange', clearEvents);

    // Open App link
    tryCatch(function() {
        top.location = aExternalLink;
    })();

    // Try to open Store link If application link is not opened
    window.appLnkInt = setTimeout(function() {

        if (!document.hidden) {
            top.location = getMobileStoreLink();
        }
        clearEvents();
    }, 3e3);
}

function getSitePath() {
    'use strict';

    if (is_webcache) {
        var m = String(location.href).match(/mega\.nz\/([\w-]+)/);
        if (m) {
            return '/' + m[1];
        }
    }

    return self.hashLogic ? '/' + location.hash.replace('#', '') : location.pathname + location.hash;
}

// remove dangling characters from the pathname/hash
function getCleanSitePath(path) {
    'use strict';

    if (path === undefined) {
        path = getSitePath();

        if (location.search && path.indexOf('#') < 0) {
            location.search.replace(/\w+=[^&]+/g, function(m) {
                path += '/' + m;
            });
        }
    }

    if (path.indexOf('lang_') > -1) {
        path = path.replace('lang_', 'lang=');
    }

    // cleanup and handle affiliate tags.
    path = mURIDecode(path).replace(/^[#/]+|\/+$/g, '').split(/(\/\w+=)/);

    if (/^\w+=/.test(path[0])) {
        path = [''].concat(path[0].split('=')).concat(path.slice(1));
    }

    // Allow search the folder with '=' symbol
    if (path[0] === 'fm/search' && path.length > 1) {
        path = [path.join('')];
    }

    if (path.length > 1) {
        for (var s = 1; s < path.length; s += 2) {
            var v = mURIDecode(path[s + 1]);
            var k = String(path[s]).replace(/\W/g, '');

            path[k] = v;

            v = k.substr(0, 3);
            if (v === 'utm' || v === 'mtm') {
                /** @property window.uTagUTM */
                /** @property window.uTagMTM */
                v = 'uTag' + v.toUpperCase();
                window[v] = window[v] || {};
                window[v][k] = path[k];
            }
        }

        if (path.uao) {
            var target = window.mega || window;
            target.uaoref = path.uao;
        }
        if (path.aff) {
            tryCatch(function() {
                if (!path.aff_time) {
                    sessionStorage.affid = path.aff;
                    sessionStorage.affts = Date.now();
                    sessionStorage.afftype = 1;
                }
                else if (!(sessionStorage.affts > (path.aff_time *= 1000))) {
                    sessionStorage.affid = path.aff;
                    sessionStorage.affts = path.aff_time;

                    // Future proof, currently only public link affiliate data is coming from other agent.
                    // Later, url from other agents will contains type for it to support other type.
                    sessionStorage.afftype = path.aff_type || 2;
                }
            }, false)();
        }

        tryCatch(function() {
            if (path.csp) {
                localStorage.csp = path.csp >>> 0 & 0xff;
            }
            if (path.sra) {
                localStorage.utm = b64decode(path.sra);
            }
            if (path.lang && path.lang.length < 6) {
                localStorage.lang = path.lang;
            }
            if (path.cjevent) {
                sessionStorage.cjevent = path.cjevent;
            }
            if (path[0] === 'pro' && path.tab) {
                window.mProTab = path.tab;
            }
        }, false)();

        if (path.mt) {
            window.uTagMT = path.mt;
        }
        if (path.mct) {
            window.uTagMCT = path.mct;
        }

        if (path.next) {
            window.nextPage = b64decode(path.next);
            if (path.plan) {
                window.pickedPlan = path.plan;
            }
            else if (path.articleUrl) {
                window.helpOrigin = b64decode(path.articleUrl);
            }
        }
    }

    return path[0];
}

// Safer wrapper around decodeURIComponent
function mURIDecode(path) {
    path = String(path);

    if (path.indexOf('%25') >= 0) {
        do {
            path = path.replace(/%25/g, '%');
        } while (path.indexOf('%25') >= 0);
    }
    if (path.indexOf('%21') >= 0) {
        path = path.replace(/%21/g, '!');
    }
    try {
        path = decodeURIComponent(path);
    }
    catch (e) {}

    return path;
}

/**
 * Based on the user's geographic location, set the closest static path.
 * This is detected by the mega.nz server and set as a cookie e.g. "geoip=SG".
 * @returns {String} Returns the nearest static server to be used or the EU one as default
 */
// eslint-disable-next-line complexity
function geoStaticPath(cms) {

    'use strict';

    var finalPath = cms ? 'cms/' : '4/';
    try {
        // If flag is not set to force the default EU static server
        if (!sessionStorage.skipGeoStaticPath) {

            // Set which countries will use which static server
            var northAmericaStaticCountries = 'AG AI AR BB BL BO BR BS BZ CA CL CO CO CR CU DO EC FK GD GF GL GT GY HN HT IS JM KN LC MX NI PA PE PR PY SR SR TT US UY VC VE VE VG VI';
            var newZealandStaticCountries = 'AU FJ NC NZ';
            var japanStaticCountries = 'JP TW PH HK MO KR SG KP BN BT MM MY TH VN';

            // Match on cookie e.g. "geoip=SG" returns array ['geoip=SG', 'SG']
            var cookieMatch = String(document.cookie).match(/geoip\s*\=\s*([A-Z]{2})/);

            // Check the country code to return a closer static server
            if (cookieMatch && cookieMatch[1] && japanStaticCountries.indexOf(cookieMatch[1]) > -1) {
                return 'https://jp.static.mega.co.nz/' + finalPath;
            }
            else if (cookieMatch && cookieMatch[1] && northAmericaStaticCountries.indexOf(cookieMatch[1]) > -1) {
                return 'https://na.static.mega.co.nz/' + finalPath;
            }
            else if (cookieMatch && cookieMatch[1] && newZealandStaticCountries.indexOf(cookieMatch[1]) > -1) {
                return 'https://nz.static.mega.co.nz/' + finalPath;
            }
        }
    }
    catch (ex) {}

    return defaultStaticPath;
}

var myURL = window.URL;

// Check whether we should redirect the user to the browser update.html page (triggered for Edge 18 and worse browsers)
browserUpdate = browserUpdate ||
    (is_embed
            ? (typeof ReadableStream === 'undefined' || typeof IntersectionObserver === 'undefined')
            : typeof BigInt === 'undefined'
    );
// ReadableStream: C43 E14 F65 O30 S10.1
// IntersectionObserver: C51 E15 F55 O38 S12.1

if (!String.prototype.trim) {
    String.prototype.trim = function() {
        return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    };
}
if (!String.trim) {
    String.trim = function(s) {
        return String(s).trim();
    };
}

if (!browserUpdate) try
{
    try {
        if (typeof localStorage === 'undefined' || localStorage === null) {
            throw new Error('SecurityError: DOM Exception 18');
        }

        d = localStorage.d | 0;
        jj = localStorage.jj;
        dd = localStorage.dd;

        // Write test
        localStorage['$!--foo'] = Array(100).join(",");
        delete localStorage['$!--foo'];
    }
    catch (ex) {

        storageQuotaError = (ex.code === 22);
        cookiesDisabled = ex.code && ex.code === DOMException.SECURITY_ERR
            || ex.message === 'SecurityError: DOM Exception 18'
            || storageQuotaError;

        if (!cookiesDisabled) {
            throw ex;
        }

        // Cookies are disabled, therefore we can't use localStorage.
        // We could either show the user a message about the issue and let him
        // enable cookies, or rather setup a tiny polyfill so that they can use
        // the site even in such case, even though this solution has side effects.
        tmp = Object.create({}, {
                length:     { get: function() { return Object.keys(this).length; }},
                key:        { value: function(pos) { return Object.keys(this)[pos]; }},
                removeItem: { value: function(key) { delete this[key]; }},
                setItem:    { value: function(key, value) { this[key] = String(value); }},
                getItem:    { value: function(key) {
                    if (this.hasOwnProperty(key)) {
                        return this[key];
                    }
                    return null;
                }},
                clear: {
                    value: function() {
                        var obj = this;
                        Object.keys(obj).forEach(function(memb) {
                            if (obj.hasOwnProperty(memb)) {
                                delete obj[memb];
                            }
                        });
                    }
                }
            });

        try {
            delete window.localStorage;
            Object.defineProperty(window, 'localStorage', { value: tmp });
            Object.defineProperty(window, 'sessionStorage', { value: tmp });
        }
        catch (e) {
            if (!is_mobile) {
                throw ex;
            }
        }
        tmp = undefined;

        setTimeout(function() {
            console.warn('Apparently you have Cookies disabled, ' +
                'please note this session is temporal, ' +
                'it will die once you close/reload the browser/tab.');
        }, 4000);
    }

    if (!is_livesite && !is_karma && !is_webcache) {
        d = d > 0 ? d : !localStorage.nfd;
        jj = d > 0 && !sessionStorage.dbgContentCheck;
        dd = 1;
    }

    if (!is_livesite && window.dd) {
        nocontentcheck = sessionStorage.dbgContentCheck ? 0 : true;

        staticpath = location.origin + '/';
        defaultStaticPath = staticpath;

        if (window.d) {
            console.debug('StaticPath set to "' + staticpath + '"');
        }
    }

    if (location.host === 'smoketest.mega.nz') {
        staticpath = 'https://smoketest.static.mega.nz/4/';
        defaultStaticPath = staticpath;
        d = 1;
        sessionStorage.rad = 1;
    }

    if (d > 0) {
        localStorage.minLogLevel |= 0;
    }

    // Override the default static path to test recovery after standard static server failure
    if (localStorage.getItem('defaultstaticpath') !== null) {
        defaultStaticPath = localStorage.defaultstaticpath;
    }

    staticpath = localStorage.staticpath || staticpath || geoStaticPath(false);
    apipath = localStorage.apipath || 'https://g.api.mega.co.nz/';

    // If dark mode flag is enabled, change styling
    if (localStorage.getItem('darkMode') === '1') {
        document.documentElement.classList.add('dark-mode');
    }
}
catch(e) {
    if (!is_mobile || !cookiesDisabled) {
        var extraInfo = '';
        if (storageQuotaError) {
            extraInfo = "\n\nTip: We've detected this issue is likely caused by " +
                "browsing in private mode, please try turning it off.";
        }
        else if (cookiesDisabled) {
            extraInfo = "\n\nTip: We've detected this issue is likely related to " +
                "having Cookies disabled, please check your browser settings.";
        }
        alert(
            "Sorry, we were unable to initialize the browser's local storage, " +
            "either you're using an outdated/misconfigured browser or " +
            "it's something from our side.\n" +
            "\n"+
            "If you think it's our fault, please report the issue back to us.\n" +
            "\n" +
            "Reason: " + (e.message || e) +
            "\nBrowser: " + (typeof mozBrowserID !== 'undefined' ? mozBrowserID : ua)
            + extraInfo
        );
        browserUpdate = 1;
    }
}

if (location.host === 'mega.io') {
    tmp = document.head.querySelector('meta[property="og:url"]');
    if (tmp) {
        tmp.content = 'https://mega.io/';
    }
    tmp = document.head.querySelector('meta[property="twitter:url"]');
    if (tmp) {
        tmp.content = 'https://mega.io/';
    }
    tmp = document.head.querySelector('link[rel="icon"]');
    if (tmp) {
        tmp.href = 'https://mega.io/favicon.ico?v=3';
    }
    tmp = undefined;
}

tmp = is_mobile && Object(window.clientInformation).vendor === 'Google Inc.';

var mega = {
    ui: {},
    state: 0,
    utils: {},
    slideshow: {settings: {}},
    uaoref: window.uaoref,
    updateURL: defaultStaticPath + 'current_ver.txt',
    chrome: (
        typeof window.chrome === 'object'
        && (window.chrome.runtime !== undefined || tmp)
        && String(window.webkitRTCPeerConnection).indexOf('native') > 0
    ),
    browserBrand: [
        0, 'Torch', 'Epic', 'Edgium'
    ],
    whoami: 'We make secure cloud storage simple. Create an account and get up to 50 GB ' +
            'free on MEGA\'s end-to-end encrypted cloud collaboration platform today!',

    maxWorkers: Math.min(navigator.hardwareConcurrency || 4, 16),

    /** An object with flags detailing which features are enabled on the API
     *  XXX: This is now meant to be a legacy private property, use `mega.flags` instead.
     */
    apiMiscFlags: null,

    /** Get browser brand internal ID */
    getBrowserBrandID: function() {
        if (Object(window.chrome).torch) {
            return 1;
        }
        else {
            var plugins = Object(navigator.plugins);
            var len = plugins.length | 0;

            while (len--) {
                var plugin = Object(plugins[len]);

                // XXX: This plugin might be shown in other browsers than Epic,
                //      hence we check for chrome.webstore since it won't appear
                //      in Google Chrome, although it might does in other forks?
                if (plugin.name === 'Epic Privacy Browser Installer') {
                    return Object(window.chrome).webstore ? 2 : 0;
                }
            }

            if (this.chrome && !String(this.userAgentBrands).indexOf('MicrosoftEdge:')) {
                return 3;
            }
        }

        return 0;
    },

    /** get cryptographically strong random values. */
    getRandomValues: function(len) {
        'use strict';
        var seed = new Uint8Array(len || 128);
        return asmCrypto.getRandomValues(seed);
    },

    /** Load performance report */
    initLoadReport: function() {
        var r = {startTime: Date.now(), stepTimeStamp: Date.now(), EAGAINs: 0, e500s: 0, errs: 0, mode: 1};

        r.aliveTimer = setInterval(function() {
            var now = Date.now();
            if ((now - r.aliveTimeStamp) > 20000) {
                // Either the browser froze for too long or the computer
                // was resumed from sleep/hibernation... let's hope it's
                // the later and do not send this report.
                r.sent = true;
                clearInterval(r.aliveTimer);
            }
            else if (r.scSent && now - r.scSent > 6e4 && (scqhead > scqtail * 2)) {

                // Do not tell API to rebuild the treecache if we were loading from indexedDB
                if (r.mode === 1 && !sessionStorage.lightTreeReload) {
                    sessionStorage.lightTreeReload = true;
                    fm_fullreload(true);
                }
                else {
                    onIdle(function() {
                        eventlog(99679, true); // sc processing took too long
                    });

                    $.closeMsgDialog = 1;
                    msgDialog('warninga:!^' + l[17704] + '!' + l[17705], l[882], l[17706], 0, function(yes) {
                        if (yes) {
                            fm_fullreload();
                        }
                        $.closeMsgDialog = 0;
                    });

                    r.scSent = now;
                    delete sessionStorage.lightTreeReload;
                }
            }
            r.aliveTimeStamp = now;
        }, 2000);

        this.loadReport = r;
        this.state |= window.MEGAFLAG_LOADINGCLOUD;
    },

    redirect: function(to, page, kv, urlQs, st) {
        'use strict';
        var storage = localStorage;
        var toMegaIo = to === 'mega.io';
        var getCount = 0;
        st = typeof st === 'undefined' || st;

        to = (String(to).indexOf('//') < 0 ? 'https://' : '') + to;

        var uLang = sessionStorage.lang || storage.lang;
        if (uLang) {
            // Map webclient language codes to those that are supported on mega.io
            to += '/' + mega.getMegaIoMappedLang(uLang);
        }

        if (page) {
            to += '/' + page;
        }

        var affid = sessionStorage.affid || storage.affid;
        var affts = sessionStorage.affts || storage.affts;
        if (affid && affts && !(Date.now() - affts > 864e5)) {
            to += '?aff=' + affid;
            getCount++;
        }

        var _getSeperator = function() {
            if (toMegaIo) {
                return getCount++ ? '&' : '?';
            }
            else {
                return '/';
            }
        }

        if (!toMegaIo && storage.csp) {
            to += _getSeperator() + 'csp=' + storage.csp;
        }

        if (!toMegaIo && storage.utm) {
            to += _getSeperator() + 'sra=' + b64encode(storage.utm);
        }

        if (Array.isArray(kv)) {
            for (var i = kv.length; i--;) {
                var k = kv[i][0];
                var v = kv[i][1];
                v = !kv[i][2] && typeof v === 'string' ? b64encode(v) : v;
                if (v || v === 0) {
                    to += '/' + k + '=' + v;
                }
            }
        }
        if (st) {
            window.onload = window.onerror = null;
            return location.replace(to + (urlQs || ''));
        }
        window.open(to + (urlQs || ''), '_blank', toMegaIo ? 'noopener' : 'noopener,noreferrer');
    },

    /**
     * Map webclient language codes to those that are supported on mega.io
     * @param {String} userLang The current webclient user language code e.g. EN, NL etc
     * @returns {String} Returns the mapped language for mega.io (could be empty string for English or not supported)
     */
    getMegaIoMappedLang: function(userLang) {
        'use strict';

        // Webclient (mega.nz) to mega.io mappings
        var mappings = {
            'en': '',
            'ar': 'ar',
            'br': 'pt-br',
            'cn': 'zh-hans',
            'ct': 'zh-hant',
            'de': 'de',
            'es': 'es',
            'fr': 'fr',
            'he': '',   // Hebrew not supported
            'hu': '',   // Hungarian not supported
            'id': 'id',
            'it': 'it',
            'jp': 'ja',
            'ka': '',   // Georgian not supported
            'kr': 'ko',
            'nl': 'nl',
            'pl': 'pl',
            'pt': 'pt',
            'ro': 'ro',
            'ru': 'ru',
            'th': 'th',
            'tl': '',   // Filipino not supported
            'tr': '',   // Turkish not supported
            'uk': '',   // Ukrainian not supported
            'vi': 'vi'
        };

        var mappedLang = mappings[userLang];

        return typeof mappedLang === 'undefined' ? '' : mappedLang;
    }
};

Object.defineProperty(mega, 'flags', {
    get: function() {
        'use strict';
        return typeof u_attr === 'object' && u_attr.flags || this.apiMiscFlags || false;
    }
});

Object.defineProperty(mega, 'user', {
    get: function() {
        'use strict';
        return typeof u_attr === 'object' && u_attr.u === window.u_handle && u_attr.u || false;
    }
});

Object.defineProperty(mega, 'ipcc', {
    get: function() {
        'use strict';
        return typeof u_attr === 'object' && u_attr.ipcc || window.ipcc || false;
    }
});

Object.defineProperty(mega, 'BID', {
    get: function() {
        'use strict';
        if (!mega.flags.bid) {
            return 'gTxFhlOd_LQ';
        }
        else if (mega.flags.bid === 3) {
            return '-aw4PbDRAKo';
        }

        console.error("Invalid/unknown bid.");
        return 'gTxFhlOd_LQ';
    }
});

Object.defineProperty(mega, 'paywall', {
    get: function() {
        'use strict';
        return typeof u_attr === 'object' &&
            (u_attr.uspw || u_attr.b && u_attr.b.s === -1 || u_attr.pf && u_attr.pf.s === -1) || false;
    }
});

Object.defineProperty(mega, 'active', {
    get: (function() {
        'use strict';
        // Number of milliseconds past the user will be considered inactive.
        var THRESHOLD = 3e4;
        return function() {
            return Date.now() - lastactive < THRESHOLD;
        };
    })()
});

/** @property mega.infinity */
lazy(mega, 'infinity', function() {
    return mega.flags.inf > 0 || !!localStorage.mInfinity || !!localStorage.megaLiteMode;
});

/** @property mega.rewindEnabled */
lazy(mega, 'rewindEnabled', function() {
    'use strict';
    return (mega.flags.rw || localStorage.rewindEnable) && !is_mobile;
});

/** @property mega.viewID */
lazy(mega, 'viewID', function() {
    'use strict';
    return (Date.now() / 1e3 >>> 0).toString(16).slice(-8) + makeUUID().slice(-8);
});

(function(chrome) {
    'use strict';
    delete mega.chrome;

    /** @property mega.chrome */
    lazy(mega, 'chrome', function() {
        return chrome || String(this.userAgentBrands).split(':').includes('Chromium');
    });
})(mega.chrome);

/** @property mega.userAgentBrands */
lazy(mega, 'userAgentBrands', function() {
    'use strict';
    var res = [];
    var userAgentData = (window.navigator || !1).userAgentData;

    if (userAgentData) {
        var brands = userAgentData.brands;

        if (Array.isArray(brands)) {

            for (var i = brands.length; i--;) {
                var brand = (brands[i] || !1).brand;

                res.push(String(brand).replace(/[\s:]/g, ''));
            }
        }
    }

    return res.join(':');
});

if (window.crypto && typeof crypto.getRandomValues === 'function') {
    (function(crypto, rand) {
        'use strict';
        mega.getRandomValues = function(len) {
            var seed = new Uint8Array(len || 128);
            return rand.call(crypto, seed);
        };
        mega.getRandomValues.strong = true;

        if (window.isSecureContext && typeof crypto.randomUUID === 'function') {
            Object.defineProperty(window, 'makeUUID', {
                value: function() {
                    return crypto.randomUUID();
                }
            });
        }
    })(crypto, crypto.getRandomValues);
}

if (!window.AudioContext && window.webkitAudioContext) {
    window.AudioContext = window.webkitAudioContext;
}

// nb: can overflow..
Object.defineProperty(window, 'mIncID', {value: 0, writable: true});

var bootstaticpath = staticpath;
var urlrootfile = '';

// Disable hash checking for search engines to speed the site load up
if (is_bot) {
    nocontentcheck = true;
}
else if (is_karma) {
    nocontentcheck = true;
    bootstaticpath = 'base/';
}
// Disable hash checking if requested for development
/*
else if (localStorage.disablecontentcheck) {
    nocontentcheck = true;
}
//*/

is_mobile = is_mobile || localStorage.testMobileSite;
hashLogic = hashLogic || localStorage.hashLogic || typeof history == 'undefined';

tmp = getCleanSitePath(location.hash || undefined);
if (tmp.substr(0, 12) === 'sitetransfer') {
    try {
        sessionStorage.sitet = tmp;
        location.hash = 'hashtransfer';
    }
    catch (ex) {
        console.warn(ex);
    }
    hashLogic = true; // temporarily prevent the history.* calls in case they are reached...
}
else if (tmp.substr(0, 4) === 'test') {
    hashLogic = true;
    tmp = -0x8feed;
}

Object.defineProperty(self, 'mShowAds', {
    value: (is_livesite || localStorage.gads) && !is_extension && !(localStorage.sid || sessionStorage.sid)
});

// eslint-disable-next-line es/no-object-fromentries
if (Object.fromEntries && !self.mShowAds) {
    if (is_karma || tmp === -0x8feed) {
        Object.freeze = echo;
    }
    Object.freeze(Object);
}

if (!browserUpdate && is_extension)
{
    hashLogic = true;
    nocontentcheck=true;

    if (is_electron) {
        urlrootfile = 'index.html';
        bootstaticpath = location.href.replace(urlrootfile, '');
    }
    else {
        // WebExtensions
        urlrootfile = 'mega/secure.html';

        tmp = 'extStageReload' + (is_iframed | 0) + (is_embed | 0) + (is_drop | 0);

        if (typeof chrome !== 'object' || typeof chrome.runtime !== 'object') {
            var stage = sessionStorage[tmp] | 0;
            if (stage < 4) {
                sessionStorage[tmp] = ++stage;
                location.reload(true);
            }

            console.error('Something went wrong...', window.chrome, window.chrome && chrome.runtime);
        }
        else {
            delete sessionStorage[tmp];
            tmp = typeof chrome.runtime.getManifest === 'function' && chrome.runtime.getManifest() || false;

            if (tmp.version === '109101.103.97') {
                d = d > 0 ? d : 1;
                urlrootfile = 'webclient/secure.html';

                if (typeof chrome.runtime.getPackageDirectoryEntry === 'function') {
                    chrome.runtime.getPackageDirectoryEntry(function(root) {
                        'use strict';
                        root.getDirectory('webclient', {create: false}, function(dir) {
                            dir.getDirectory('images', {create: false}, function(dir) {
                                if (dir && dir.isDirectory && dir.name === 'images') {
                                    staticpath = bootstaticpath;
                                }
                            });
                        });
                    });
                }
            }
        }

        Object.defineProperty(self, 'jj', {value: -1});
        bootstaticpath = chrome.runtime.getURL(urlrootfile.split('/')[0] + '/');
    }

    if (localStorage.useBootStaticPath) {
        staticpath = bootstaticpath;
    }

    Object.defineProperty(window, 'eval', {
        value : function evil(code) {
            'use strict';
            throw new Error('Unsafe eval is not allowed, code: ' + String(code).replace(/\s+/g,' ').substr(0,60) + '...');
        }
    });
}

window.redirect = ['about', 'achievements', 'android', 'bird', 'business', 'chrome', 'cmd', 'collaboration',
                   'contact', 'cookie', 'copyright', 'corporate', 'credits', 'desktop', 'dev',
                   'developers', 'dispute', 'doc', 'edge', 'extensions', 'firefox', 'gdpr', 'help', 'ios',
                   'megabackup', 'mobile', 'nas', 'objectstorage',
                   'plugin', 'privacy', 'refer', 'resellers', 'sdk', 'securechat',
                   'security', 'sourcecode', 'start', 'storage', 'sync', 'takedown', 'terms', 'uwp', 'wp'];
var isStaticPage = function(page) {
    'use strict';
    if (page) {
        var excludedPages = {copyrightnotice: 1, disputenotice: 1, businesssignup: 1, businessinvite: 1};
        if (excludedPages[page] || page.indexOf('businesssignup') > -1 || page.indexOf('businessinvite') > -1 || page.indexOf('about/jobs') > -1) {
            return false;
        }
        for (var k = redirect.length; k--;) {
            if (page.substr(0, redirect[k].length) === redirect[k]) {
                return true;
            }
        }
    }
    else {
        return true;
    }
    return false;
};

if (hashLogic) {
    // legacy support:
    page = getCleanSitePath(document.location.hash);
}
else if ((page = isPublicLink())) {
    // folder or file link: always keep the hash URL to ensure that keys remain client side
    // history.replaceState so that back button works in new URL paradigm
    dl_res = !!page.dl;
    page = page.link || page;
    pushHistoryState(true, page);
}
else {
    if (document.location.hash.length > 0) {
        // history.replaceState for legacy hash requests to new URL paradigm
        page = document.location.hash;
    }
    else {
        // new URL paradigm, look for desired page in the location.pathname:
        page = document.location.pathname;
    }

    page = getCleanSitePath(page);

	// put try block around it to allow the page to be rendered in Google cache
	try
	{
		history.replaceState({subpage: page}, "", '/' + page);
	}
	catch(e)
	{
		console.log('Probably Google Cache?');
	}
}

// If they need to update their browser, store the current page before going to the update page
if (browserUpdate) {
    localStorage.prevPage = page;
    window.location = (is_extension ? '' : '/') + 'update.html';
}

// Mapping of user's browser language preference to language codes and native/english names
var languages = {
    'ar': [['ar', 'ar-'], 'Arabic', 'العربية'],
    'br': [['pt-br', 'pt'], 'Portuguese', 'Português'],
    'cn': [['zh', 'zh-cn'], 'Chinese', '简体中文'],
    'ct': [['zh-hk', 'zh-sg', 'zh-tw'], 'Traditional Chinese', '中文繁體'],
    'de': [['de', 'de-'], 'German', 'Deutsch'],
    'en': [['en', 'en-'], 'English', 'English'],
    'es': [['es', 'es-'], 'Spanish', 'Español'],
    'fr': [['fr', 'fr-'], 'French', 'Français'],
    'id': [['id'], 'Indonesian', 'Bahasa Indonesia'],
    'it': [['it', 'it-'], 'Italian', 'Italiano'],
    'jp': [['ja'], 'Japanese', '日本語'],
    'kr': [['ko'], 'Korean', '한국어'],
    'nl': [['nl', 'nl-'], 'Dutch', 'Nederlands'],
    'pl': [['pl'], 'Polish', 'Polski'],
    'ro': [['ro', 'ro-'], 'Romanian', 'Română'],
    'ru': [['ru', 'ru-mo'], 'Russian', 'Pусский'],
    'th': [['||', 'th'], 'Thai', 'ไทย'],
    'vi': [['vn', 'vi'], 'Vietnamese', 'Tiếng Việt']
};

/**
 * Below is the asmCrypto SHA-256 library which was converted to a string so it can be run by the web worker which
 * hashes the files. This was created by:
 * 1) Running 'git clone https://github.com/vibornoff/asmcrypto.js.git'
 * 2) Running 'npm install' to install Grunt and other dependencies
 * 3) Running 'git checkout v0.0.9' to switch to the v0.0.9 stable release version
 * 4) Running 'grunt --with="sha256" devel' to build the library with just SHA-256
 * 5) Changing namespace to asmCryptoSha256 so it does not interfere with the main asmCrypto library that is loaded later
 * 5) Replacing single quotes with double quotes, removing comments and whitespace (variable and function names remain unobfuscated)
 */
var asmCryptoSha256Js = '!function(exports,global){function IllegalStateError(){var err=Error.apply(this,arguments);this.message=err.message,this.stack=err.stack}IllegalStateError.prototype=Object.create(Error.prototype,{name:{value:"IllegalStateError"}});function IllegalArgumentError(){var err=Error.apply(this,arguments);this.message=err.message,this.stack=err.stack}IllegalArgumentError.prototype=Object.create(Error.prototype,{name:{value:"IllegalArgumentError"}});function SecurityError(){var err=Error.apply(this,arguments);this.message=err.message,this.stack=err.stack}SecurityError.prototype=Object.create(Error.prototype,{name:{value:"SecurityError"}});var FloatArray=global.Float64Array||global.Float32Array;function string_to_bytes(str,utf8){utf8=!!utf8;var len=str.length,bytes=new Uint8Array(utf8?4*len:len);for(var i=0,j=0;i<len;i++){var c=str.charCodeAt(i);if(utf8&&0xd800<=c&&c<=0xdbff){if(++i>=len)throw new Error("Malformed string, low surrogate expected at position "+i);c=((c^0xd800)<<10)|0x10000|(str.charCodeAt(i)^0xdc00)}else if(!utf8&&c>>>8){throw new Error("Wide characters are not allowed.");}if(!utf8||c<=0x7f){bytes[j++]=c}else if(c<=0x7ff){bytes[j++]=0xc0|(c>>6);bytes[j++]=0x80|(c&0x3f)}else if(c<=0xffff){bytes[j++]=0xe0|(c>>12);bytes[j++]=0x80|(c>>6&0x3f);bytes[j++]=0x80|(c&0x3f)}else{bytes[j++]=0xf0|(c>>18);bytes[j++]=0x80|(c>>12&0x3f);bytes[j++]=0x80|(c>>6&0x3f);bytes[j++]=0x80|(c&0x3f)}}return bytes.subarray(0,j)}function hex_to_bytes(str){var len=str.length;if(len&1){str="0"+str;len++}var bytes=new Uint8Array(len>>1);for(var i=0;i<len;i+=2){bytes[i>>1]=parseInt(str.substr(i,2),16)}return bytes}function base64_to_bytes(str){return string_to_bytes(atob(str))}function bytes_to_string(bytes,utf8){utf8=!!utf8;var len=bytes.length,chars=new Array(len);for(var i=0,j=0;i<len;i++){var b=bytes[i];if(!utf8||b<128){chars[j++]=b}else if(b>=192&&b<224&&i+1<len){chars[j++]=((b&0x1f)<<6)|(bytes[++i]&0x3f)}else if(b>=224&&b<240&&i+2<len){chars[j++]=((b&0xf)<<12)|((bytes[++i]&0x3f)<<6)|(bytes[++i]&0x3f)}else if(b>=240&&b<248&&i+3<len){var c=((b&7)<<18)|((bytes[++i]&0x3f)<<12)|((bytes[++i]&0x3f)<<6)|(bytes[++i]&0x3f);if(c<=0xffff){chars[j++]=c}else{c^=0x10000;chars[j++]=0xd800|(c>>10);chars[j++]=0xdc00|(c&0x3ff)}}else{throw new Error("Malformed UTF8 character at byte offset "+i);}}var str="",bs=16384;for(var i=0;i<j;i+=bs){str+=String.fromCharCode.apply(String,chars.slice(i,i+bs<=j?i+bs:j))}return str}function bytes_to_hex(arr){var str="";for(var i=0;i<arr.length;i++){var h=(arr[i]&0xff).toString(16);if(h.length<2)str+="0";str+=h}return str}function bytes_to_base64(arr){return btoa(bytes_to_string(arr))}function pow2_ceil(a){a-=1;a|=a>>>1;a|=a>>>2;a|=a>>>4;a|=a>>>8;a|=a>>>16;a+=1;return a}function is_number(a){return(typeof a==="number")}function is_string(a){return(typeof a==="string")}function is_buffer(a){return(a instanceof ArrayBuffer)}function is_bytes(a){return(a instanceof Uint8Array)}function is_typed_array(a){return(a instanceof Int8Array)||(a instanceof Uint8Array)||(a instanceof Int16Array)||(a instanceof Uint16Array)||(a instanceof Int32Array)||(a instanceof Uint32Array)||(a instanceof Float32Array)||(a instanceof Float64Array)}function _heap_init(constructor,options){var heap=options.heap,size=heap?heap.byteLength:options.heapSize||65536;if(size&0xfff||size<=0)throw new Error("heap size must be a positive integer and a multiple of 4096");heap=heap||new constructor(new ArrayBuffer(size));return heap}function _heap_write(heap,hpos,data,dpos,dlen){var hlen=heap.length-hpos,wlen=(hlen<dlen)?hlen:dlen;heap.set(data.subarray(dpos,dpos+wlen),hpos);return wlen}function hash_reset(){this.result=null;this.pos=0;this.len=0;this.asm.reset();return this}function hash_process(data){if(this.result!==null)throw new IllegalStateError("state must be reset before processing new data");if(is_string(data))data=string_to_bytes(data);if(is_buffer(data))data=new Uint8Array(data);if(!is_bytes(data))throw new TypeError("data isnt of expected type");var asm=this.asm,heap=this.heap,hpos=this.pos,hlen=this.len,dpos=0,dlen=data.length,wlen=0;while(dlen>0){wlen=_heap_write(heap,hpos+hlen,data,dpos,dlen);hlen+=wlen;dpos+=wlen;dlen-=wlen;wlen=asm.process(hpos,hlen);hpos+=wlen;hlen-=wlen;if(!hlen)hpos=0}this.pos=hpos;this.len=hlen;return this}function hash_finish(){if(this.result!==null)throw new IllegalStateError("state must be reset before processing new data");this.asm.finish(this.pos,this.len,0);this.result=new Uint8Array(this.HASH_SIZE);this.result.set(this.heap.subarray(0,this.HASH_SIZE));this.pos=0;this.len=0;return this}function sha256_asm(stdlib,foreign,buffer){"use asm";var H0=0,H1=0,H2=0,H3=0,H4=0,H5=0,H6=0,H7=0,TOTAL0=0,TOTAL1=0;var I0=0,I1=0,I2=0,I3=0,I4=0,I5=0,I6=0,I7=0,O0=0,O1=0,O2=0,O3=0,O4=0,O5=0,O6=0,O7=0;var HEAP=new stdlib.Uint8Array(buffer);function _core(w0,w1,w2,w3,w4,w5,w6,w7,w8,w9,w10,w11,w12,w13,w14,w15){w0=w0|0;w1=w1|0;w2=w2|0;w3=w3|0;w4=w4|0;w5=w5|0;w6=w6|0;w7=w7|0;w8=w8|0;w9=w9|0;w10=w10|0;w11=w11|0;w12=w12|0;w13=w13|0;w14=w14|0;w15=w15|0;var a=0,b=0,c=0,d=0,e=0,f=0,g=0,h=0,t=0;a=H0;b=H1;c=H2;d=H3;e=H4;f=H5;g=H6;h=H7;t=(w0+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x428a2f98)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w1+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x71374491)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w2+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xb5c0fbcf)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w3+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xe9b5dba5)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w4+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x3956c25b)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w5+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x59f111f1)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w6+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x923f82a4)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w7+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xab1c5ed5)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w8+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xd807aa98)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w9+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x12835b01)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w10+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x243185be)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w11+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x550c7dc3)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w12+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x72be5d74)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w13+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x80deb1fe)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w14+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x9bdc06a7)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;t=(w15+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xc19bf174)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w0=t=((w1>>>7^w1>>>18^w1>>>3^w1<<25^w1<<14)+(w14>>>17^w14>>>19^w14>>>10^w14<<15^w14<<13)+w0+w9)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xe49b69c1)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w1=t=((w2>>>7^w2>>>18^w2>>>3^w2<<25^w2<<14)+(w15>>>17^w15>>>19^w15>>>10^w15<<15^w15<<13)+w1+w10)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xefbe4786)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w2=t=((w3>>>7^w3>>>18^w3>>>3^w3<<25^w3<<14)+(w0>>>17^w0>>>19^w0>>>10^w0<<15^w0<<13)+w2+w11)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x0fc19dc6)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w3=t=((w4>>>7^w4>>>18^w4>>>3^w4<<25^w4<<14)+(w1>>>17^w1>>>19^w1>>>10^w1<<15^w1<<13)+w3+w12)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x240ca1cc)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w4=t=((w5>>>7^w5>>>18^w5>>>3^w5<<25^w5<<14)+(w2>>>17^w2>>>19^w2>>>10^w2<<15^w2<<13)+w4+w13)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x2de92c6f)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w5=t=((w6>>>7^w6>>>18^w6>>>3^w6<<25^w6<<14)+(w3>>>17^w3>>>19^w3>>>10^w3<<15^w3<<13)+w5+w14)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x4a7484aa)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w6=t=((w7>>>7^w7>>>18^w7>>>3^w7<<25^w7<<14)+(w4>>>17^w4>>>19^w4>>>10^w4<<15^w4<<13)+w6+w15)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x5cb0a9dc)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w7=t=((w8>>>7^w8>>>18^w8>>>3^w8<<25^w8<<14)+(w5>>>17^w5>>>19^w5>>>10^w5<<15^w5<<13)+w7+w0)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x76f988da)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w8=t=((w9>>>7^w9>>>18^w9>>>3^w9<<25^w9<<14)+(w6>>>17^w6>>>19^w6>>>10^w6<<15^w6<<13)+w8+w1)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x983e5152)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w9=t=((w10>>>7^w10>>>18^w10>>>3^w10<<25^w10<<14)+(w7>>>17^w7>>>19^w7>>>10^w7<<15^w7<<13)+w9+w2)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xa831c66d)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w10=t=((w11>>>7^w11>>>18^w11>>>3^w11<<25^w11<<14)+(w8>>>17^w8>>>19^w8>>>10^w8<<15^w8<<13)+w10+w3)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xb00327c8)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w11=t=((w12>>>7^w12>>>18^w12>>>3^w12<<25^w12<<14)+(w9>>>17^w9>>>19^w9>>>10^w9<<15^w9<<13)+w11+w4)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xbf597fc7)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w12=t=((w13>>>7^w13>>>18^w13>>>3^w13<<25^w13<<14)+(w10>>>17^w10>>>19^w10>>>10^w10<<15^w10<<13)+w12+w5)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xc6e00bf3)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w13=t=((w14>>>7^w14>>>18^w14>>>3^w14<<25^w14<<14)+(w11>>>17^w11>>>19^w11>>>10^w11<<15^w11<<13)+w13+w6)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xd5a79147)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w14=t=((w15>>>7^w15>>>18^w15>>>3^w15<<25^w15<<14)+(w12>>>17^w12>>>19^w12>>>10^w12<<15^w12<<13)+w14+w7)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x06ca6351)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w15=t=((w0>>>7^w0>>>18^w0>>>3^w0<<25^w0<<14)+(w13>>>17^w13>>>19^w13>>>10^w13<<15^w13<<13)+w15+w8)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x14292967)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w0=t=((w1>>>7^w1>>>18^w1>>>3^w1<<25^w1<<14)+(w14>>>17^w14>>>19^w14>>>10^w14<<15^w14<<13)+w0+w9)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x27b70a85)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w1=t=((w2>>>7^w2>>>18^w2>>>3^w2<<25^w2<<14)+(w15>>>17^w15>>>19^w15>>>10^w15<<15^w15<<13)+w1+w10)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x2e1b2138)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w2=t=((w3>>>7^w3>>>18^w3>>>3^w3<<25^w3<<14)+(w0>>>17^w0>>>19^w0>>>10^w0<<15^w0<<13)+w2+w11)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x4d2c6dfc)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w3=t=((w4>>>7^w4>>>18^w4>>>3^w4<<25^w4<<14)+(w1>>>17^w1>>>19^w1>>>10^w1<<15^w1<<13)+w3+w12)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x53380d13)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w4=t=((w5>>>7^w5>>>18^w5>>>3^w5<<25^w5<<14)+(w2>>>17^w2>>>19^w2>>>10^w2<<15^w2<<13)+w4+w13)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x650a7354)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w5=t=((w6>>>7^w6>>>18^w6>>>3^w6<<25^w6<<14)+(w3>>>17^w3>>>19^w3>>>10^w3<<15^w3<<13)+w5+w14)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x766a0abb)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w6=t=((w7>>>7^w7>>>18^w7>>>3^w7<<25^w7<<14)+(w4>>>17^w4>>>19^w4>>>10^w4<<15^w4<<13)+w6+w15)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x81c2c92e)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w7=t=((w8>>>7^w8>>>18^w8>>>3^w8<<25^w8<<14)+(w5>>>17^w5>>>19^w5>>>10^w5<<15^w5<<13)+w7+w0)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x92722c85)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w8=t=((w9>>>7^w9>>>18^w9>>>3^w9<<25^w9<<14)+(w6>>>17^w6>>>19^w6>>>10^w6<<15^w6<<13)+w8+w1)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xa2bfe8a1)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w9=t=((w10>>>7^w10>>>18^w10>>>3^w10<<25^w10<<14)+(w7>>>17^w7>>>19^w7>>>10^w7<<15^w7<<13)+w9+w2)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xa81a664b)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w10=t=((w11>>>7^w11>>>18^w11>>>3^w11<<25^w11<<14)+(w8>>>17^w8>>>19^w8>>>10^w8<<15^w8<<13)+w10+w3)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xc24b8b70)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w11=t=((w12>>>7^w12>>>18^w12>>>3^w12<<25^w12<<14)+(w9>>>17^w9>>>19^w9>>>10^w9<<15^w9<<13)+w11+w4)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xc76c51a3)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w12=t=((w13>>>7^w13>>>18^w13>>>3^w13<<25^w13<<14)+(w10>>>17^w10>>>19^w10>>>10^w10<<15^w10<<13)+w12+w5)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xd192e819)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w13=t=((w14>>>7^w14>>>18^w14>>>3^w14<<25^w14<<14)+(w11>>>17^w11>>>19^w11>>>10^w11<<15^w11<<13)+w13+w6)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xd6990624)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w14=t=((w15>>>7^w15>>>18^w15>>>3^w15<<25^w15<<14)+(w12>>>17^w12>>>19^w12>>>10^w12<<15^w12<<13)+w14+w7)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xf40e3585)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w15=t=((w0>>>7^w0>>>18^w0>>>3^w0<<25^w0<<14)+(w13>>>17^w13>>>19^w13>>>10^w13<<15^w13<<13)+w15+w8)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x106aa070)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w0=t=((w1>>>7^w1>>>18^w1>>>3^w1<<25^w1<<14)+(w14>>>17^w14>>>19^w14>>>10^w14<<15^w14<<13)+w0+w9)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x19a4c116)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w1=t=((w2>>>7^w2>>>18^w2>>>3^w2<<25^w2<<14)+(w15>>>17^w15>>>19^w15>>>10^w15<<15^w15<<13)+w1+w10)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x1e376c08)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w2=t=((w3>>>7^w3>>>18^w3>>>3^w3<<25^w3<<14)+(w0>>>17^w0>>>19^w0>>>10^w0<<15^w0<<13)+w2+w11)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x2748774c)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w3=t=((w4>>>7^w4>>>18^w4>>>3^w4<<25^w4<<14)+(w1>>>17^w1>>>19^w1>>>10^w1<<15^w1<<13)+w3+w12)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x34b0bcb5)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w4=t=((w5>>>7^w5>>>18^w5>>>3^w5<<25^w5<<14)+(w2>>>17^w2>>>19^w2>>>10^w2<<15^w2<<13)+w4+w13)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x391c0cb3)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w5=t=((w6>>>7^w6>>>18^w6>>>3^w6<<25^w6<<14)+(w3>>>17^w3>>>19^w3>>>10^w3<<15^w3<<13)+w5+w14)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x4ed8aa4a)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w6=t=((w7>>>7^w7>>>18^w7>>>3^w7<<25^w7<<14)+(w4>>>17^w4>>>19^w4>>>10^w4<<15^w4<<13)+w6+w15)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x5b9cca4f)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w7=t=((w8>>>7^w8>>>18^w8>>>3^w8<<25^w8<<14)+(w5>>>17^w5>>>19^w5>>>10^w5<<15^w5<<13)+w7+w0)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x682e6ff3)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w8=t=((w9>>>7^w9>>>18^w9>>>3^w9<<25^w9<<14)+(w6>>>17^w6>>>19^w6>>>10^w6<<15^w6<<13)+w8+w1)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x748f82ee)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w9=t=((w10>>>7^w10>>>18^w10>>>3^w10<<25^w10<<14)+(w7>>>17^w7>>>19^w7>>>10^w7<<15^w7<<13)+w9+w2)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x78a5636f)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w10=t=((w11>>>7^w11>>>18^w11>>>3^w11<<25^w11<<14)+(w8>>>17^w8>>>19^w8>>>10^w8<<15^w8<<13)+w10+w3)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x84c87814)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w11=t=((w12>>>7^w12>>>18^w12>>>3^w12<<25^w12<<14)+(w9>>>17^w9>>>19^w9>>>10^w9<<15^w9<<13)+w11+w4)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x8cc70208)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w12=t=((w13>>>7^w13>>>18^w13>>>3^w13<<25^w13<<14)+(w10>>>17^w10>>>19^w10>>>10^w10<<15^w10<<13)+w12+w5)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0x90befffa)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w13=t=((w14>>>7^w14>>>18^w14>>>3^w14<<25^w14<<14)+(w11>>>17^w11>>>19^w11>>>10^w11<<15^w11<<13)+w13+w6)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xa4506ceb)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w14=t=((w15>>>7^w15>>>18^w15>>>3^w15<<25^w15<<14)+(w12>>>17^w12>>>19^w12>>>10^w12<<15^w12<<13)+w14+w7)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xbef9a3f7)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;w15=t=((w0>>>7^w0>>>18^w0>>>3^w0<<25^w0<<14)+(w13>>>17^w13>>>19^w13>>>10^w13<<15^w13<<13)+w15+w8)|0;t=(t+h+(e>>>6^e>>>11^e>>>25^e<<26^e<<21^e<<7)+(g^e&(f^g))+0xc67178f2)|0;h=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+((b&c)^(d&(b^c)))+(b>>>2^b>>>13^b>>>22^b<<30^b<<19^b<<10))|0;H0=(H0+a)|0;H1=(H1+b)|0;H2=(H2+c)|0;H3=(H3+d)|0;H4=(H4+e)|0;H5=(H5+f)|0;H6=(H6+g)|0;H7=(H7+h)|0}function _core_heap(offset){offset=offset|0;_core(HEAP[offset|0]<<24|HEAP[offset|1]<<16|HEAP[offset|2]<<8|HEAP[offset|3],HEAP[offset|4]<<24|HEAP[offset|5]<<16|HEAP[offset|6]<<8|HEAP[offset|7],HEAP[offset|8]<<24|HEAP[offset|9]<<16|HEAP[offset|10]<<8|HEAP[offset|11],HEAP[offset|12]<<24|HEAP[offset|13]<<16|HEAP[offset|14]<<8|HEAP[offset|15],HEAP[offset|16]<<24|HEAP[offset|17]<<16|HEAP[offset|18]<<8|HEAP[offset|19],HEAP[offset|20]<<24|HEAP[offset|21]<<16|HEAP[offset|22]<<8|HEAP[offset|23],HEAP[offset|24]<<24|HEAP[offset|25]<<16|HEAP[offset|26]<<8|HEAP[offset|27],HEAP[offset|28]<<24|HEAP[offset|29]<<16|HEAP[offset|30]<<8|HEAP[offset|31],HEAP[offset|32]<<24|HEAP[offset|33]<<16|HEAP[offset|34]<<8|HEAP[offset|35],HEAP[offset|36]<<24|HEAP[offset|37]<<16|HEAP[offset|38]<<8|HEAP[offset|39],HEAP[offset|40]<<24|HEAP[offset|41]<<16|HEAP[offset|42]<<8|HEAP[offset|43],HEAP[offset|44]<<24|HEAP[offset|45]<<16|HEAP[offset|46]<<8|HEAP[offset|47],HEAP[offset|48]<<24|HEAP[offset|49]<<16|HEAP[offset|50]<<8|HEAP[offset|51],HEAP[offset|52]<<24|HEAP[offset|53]<<16|HEAP[offset|54]<<8|HEAP[offset|55],HEAP[offset|56]<<24|HEAP[offset|57]<<16|HEAP[offset|58]<<8|HEAP[offset|59],HEAP[offset|60]<<24|HEAP[offset|61]<<16|HEAP[offset|62]<<8|HEAP[offset|63])}function _state_to_heap(output){output=output|0;HEAP[output|0]=H0>>>24;HEAP[output|1]=H0>>>16&255;HEAP[output|2]=H0>>>8&255;HEAP[output|3]=H0&255;HEAP[output|4]=H1>>>24;HEAP[output|5]=H1>>>16&255;HEAP[output|6]=H1>>>8&255;HEAP[output|7]=H1&255;HEAP[output|8]=H2>>>24;HEAP[output|9]=H2>>>16&255;HEAP[output|10]=H2>>>8&255;HEAP[output|11]=H2&255;HEAP[output|12]=H3>>>24;HEAP[output|13]=H3>>>16&255;HEAP[output|14]=H3>>>8&255;HEAP[output|15]=H3&255;HEAP[output|16]=H4>>>24;HEAP[output|17]=H4>>>16&255;HEAP[output|18]=H4>>>8&255;HEAP[output|19]=H4&255;HEAP[output|20]=H5>>>24;HEAP[output|21]=H5>>>16&255;HEAP[output|22]=H5>>>8&255;HEAP[output|23]=H5&255;HEAP[output|24]=H6>>>24;HEAP[output|25]=H6>>>16&255;HEAP[output|26]=H6>>>8&255;HEAP[output|27]=H6&255;HEAP[output|28]=H7>>>24;HEAP[output|29]=H7>>>16&255;HEAP[output|30]=H7>>>8&255;HEAP[output|31]=H7&255}function reset(){H0=0x6a09e667;H1=0xbb67ae85;H2=0x3c6ef372;H3=0xa54ff53a;H4=0x510e527f;H5=0x9b05688c;H6=0x1f83d9ab;H7=0x5be0cd19;TOTAL0=TOTAL1=0}function init(h0,h1,h2,h3,h4,h5,h6,h7,total0,total1){h0=h0|0;h1=h1|0;h2=h2|0;h3=h3|0;h4=h4|0;h5=h5|0;h6=h6|0;h7=h7|0;total0=total0|0;total1=total1|0;H0=h0;H1=h1;H2=h2;H3=h3;H4=h4;H5=h5;H6=h6;H7=h7;TOTAL0=total0;TOTAL1=total1}function process(offset,length){offset=offset|0;length=length|0;var hashed=0;if(offset&63)return-1;while((length|0)>=64){_core_heap(offset);offset=(offset+64)|0;length=(length-64)|0;hashed=(hashed+64)|0}TOTAL0=(TOTAL0+hashed)|0;if(TOTAL0>>>0<hashed>>>0)TOTAL1=(TOTAL1+1)|0;return hashed|0}function finish(offset,length,output){offset=offset|0;length=length|0;output=output|0;var hashed=0,i=0;if(offset&63)return-1;if(~output)if(output&31)return-1;if((length|0)>=64){hashed=process(offset,length)|0;if((hashed|0)==-1)return-1;offset=(offset+hashed)|0;length=(length-hashed)|0}hashed=(hashed+length)|0;TOTAL0=(TOTAL0+length)|0;if(TOTAL0>>>0<length>>>0)TOTAL1=(TOTAL1+1)|0;HEAP[offset|length]=0x80;if((length|0)>=56){for(i=(length+1)|0;(i|0)<64;i=(i+1)|0)HEAP[offset|i]=0x00;_core_heap(offset);length=0;HEAP[offset|0]=0}for(i=(length+1)|0;(i|0)<59;i=(i+1)|0)HEAP[offset|i]=0;HEAP[offset|56]=TOTAL1>>>21&255;HEAP[offset|57]=TOTAL1>>>13&255;HEAP[offset|58]=TOTAL1>>>5&255;HEAP[offset|59]=TOTAL1<<3&255|TOTAL0>>>29;HEAP[offset|60]=TOTAL0>>>21&255;HEAP[offset|61]=TOTAL0>>>13&255;HEAP[offset|62]=TOTAL0>>>5&255;HEAP[offset|63]=TOTAL0<<3&255;_core_heap(offset);if(~output)_state_to_heap(output);return hashed|0}function hmac_reset(){H0=I0;H1=I1;H2=I2;H3=I3;H4=I4;H5=I5;H6=I6;H7=I7;TOTAL0=64;TOTAL1=0}function _hmac_opad(){H0=O0;H1=O1;H2=O2;H3=O3;H4=O4;H5=O5;H6=O6;H7=O7;TOTAL0=64;TOTAL1=0}function hmac_init(p0,p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,p11,p12,p13,p14,p15){p0=p0|0;p1=p1|0;p2=p2|0;p3=p3|0;p4=p4|0;p5=p5|0;p6=p6|0;p7=p7|0;p8=p8|0;p9=p9|0;p10=p10|0;p11=p11|0;p12=p12|0;p13=p13|0;p14=p14|0;p15=p15|0;reset();_core(p0^0x5c5c5c5c,p1^0x5c5c5c5c,p2^0x5c5c5c5c,p3^0x5c5c5c5c,p4^0x5c5c5c5c,p5^0x5c5c5c5c,p6^0x5c5c5c5c,p7^0x5c5c5c5c,p8^0x5c5c5c5c,p9^0x5c5c5c5c,p10^0x5c5c5c5c,p11^0x5c5c5c5c,p12^0x5c5c5c5c,p13^0x5c5c5c5c,p14^0x5c5c5c5c,p15^0x5c5c5c5c);O0=H0;O1=H1;O2=H2;O3=H3;O4=H4;O5=H5;O6=H6;O7=H7;reset();_core(p0^0x36363636,p1^0x36363636,p2^0x36363636,p3^0x36363636,p4^0x36363636,p5^0x36363636,p6^0x36363636,p7^0x36363636,p8^0x36363636,p9^0x36363636,p10^0x36363636,p11^0x36363636,p12^0x36363636,p13^0x36363636,p14^0x36363636,p15^0x36363636);I0=H0;I1=H1;I2=H2;I3=H3;I4=H4;I5=H5;I6=H6;I7=H7;TOTAL0=64;TOTAL1=0}function hmac_finish(offset,length,output){offset=offset|0;length=length|0;output=output|0;var t0=0,t1=0,t2=0,t3=0,t4=0,t5=0,t6=0,t7=0,hashed=0;if(offset&63)return-1;if(~output)if(output&31)return-1;hashed=finish(offset,length,-1)|0;t0=H0,t1=H1,t2=H2,t3=H3,t4=H4,t5=H5,t6=H6,t7=H7;_hmac_opad();_core(t0,t1,t2,t3,t4,t5,t6,t7,0x80000000,0,0,0,0,0,0,768);if(~output)_state_to_heap(output);return hashed|0}function pbkdf2_generate_block(offset,length,block,count,output){offset=offset|0;length=length|0;block=block|0;count=count|0;output=output|0;var h0=0,h1=0,h2=0,h3=0,h4=0,h5=0,h6=0,h7=0,t0=0,t1=0,t2=0,t3=0,t4=0,t5=0,t6=0,t7=0;if(offset&63)return-1;if(~output)if(output&31)return-1;HEAP[(offset+length)|0]=block>>>24;HEAP[(offset+length+1)|0]=block>>>16&255;HEAP[(offset+length+2)|0]=block>>>8&255;HEAP[(offset+length+3)|0]=block&255;hmac_finish(offset,(length+4)|0,-1)|0;h0=t0=H0,h1=t1=H1,h2=t2=H2,h3=t3=H3,h4=t4=H4,h5=t5=H5,h6=t6=H6,h7=t7=H7;count=(count-1)|0;while((count|0)>0){hmac_reset();_core(t0,t1,t2,t3,t4,t5,t6,t7,0x80000000,0,0,0,0,0,0,768);t0=H0,t1=H1,t2=H2,t3=H3,t4=H4,t5=H5,t6=H6,t7=H7;_hmac_opad();_core(t0,t1,t2,t3,t4,t5,t6,t7,0x80000000,0,0,0,0,0,0,768);t0=H0,t1=H1,t2=H2,t3=H3,t4=H4,t5=H5,t6=H6,t7=H7;h0=h0^H0;h1=h1^H1;h2=h2^H2;h3=h3^H3;h4=h4^H4;h5=h5^H5;h6=h6^H6;h7=h7^H7;count=(count-1)|0}H0=h0;H1=h1;H2=h2;H3=h3;H4=h4;H5=h5;H6=h6;H7=h7;if(~output)_state_to_heap(output);return 0}return{reset:reset,init:init,process:process,finish:finish,hmac_reset:hmac_reset,hmac_init:hmac_init,hmac_finish:hmac_finish,pbkdf2_generate_block:pbkdf2_generate_block}}var _sha256_block_size=64,_sha256_hash_size=32;function sha256_constructor(options){options=options||{};this.heap=_heap_init(Uint8Array,options);this.asm=options.asm||sha256_asm(global,null,this.heap.buffer);this.BLOCK_SIZE=_sha256_block_size;this.HASH_SIZE=_sha256_hash_size;this.reset()}sha256_constructor.BLOCK_SIZE=_sha256_block_size;sha256_constructor.HASH_SIZE=_sha256_hash_size;var sha256_prototype=sha256_constructor.prototype;sha256_prototype.reset=hash_reset;sha256_prototype.process=hash_process;sha256_prototype.finish=hash_finish;var sha256_instance=null;function get_sha256_instance(){if(sha256_instance===null)sha256_instance=new sha256_constructor({heapSize:0x100000});return sha256_instance}function sha256_bytes(data){if(data===undefined)throw new SyntaxError("data required");return get_sha256_instance().reset().process(data).finish().result}function sha256_hex(data){var result=sha256_bytes(data);return bytes_to_hex(result)}function sha256_base64(data){var result=sha256_bytes(data);return bytes_to_base64(result)}sha256_constructor.bytes=sha256_bytes;sha256_constructor.hex=sha256_hex;sha256_constructor.base64=sha256_base64;exports.SHA256=sha256_constructor;global.asmCryptoSha256=exports}({},function(){return this}());';

function addScript(data) {
    "use strict";
    return mCreateElement('script', {type: 'text/javascript'}, 'head', data);
}

function scriptTest(data, callback) {
    'use strict';
    var feat = addScript([data]);
    var load = feat.onload;
    feat.onload = function() {
        if (load) {
            setTimeout(load);
        }
        callback(false);
        this.onload = this.onerror = null;
        this.parentNode.removeChild(this);
        URL.revokeObjectURL(this.src);
    };
    feat.onerror = callback;
}

function mCreateElement(aNode, aAttrs, aChildNodes, aTarget, aData) {
    "use strict";

    aNode = document.createElement(aNode);
    if (!aNode) {
        return null;
    }

    if (aAttrs) {
        for (var attr in aAttrs) {
            aNode.setAttribute( attr, '' + aAttrs[attr]);
        }
    }

    if (!Array.isArray(aChildNodes)) {
        aData = aTarget;
        aTarget = aChildNodes;
        aChildNodes = null;
    }

    if (aChildNodes) {
        for (var cn in aChildNodes) {
            if (aChildNodes[cn]) {
                aNode.appendChild(aChildNodes[cn]);
            }
        }
    }

    if (aTarget) {
        if (typeof aTarget === 'string') {
            aTarget = document[aTarget] || document.getElementsByTagName(aTarget)[0];
        }
        if (aTarget) {
            aTarget.appendChild(aNode);
        }
        else if (d) {
            console.error('Invalid target', aNode, aAttrs, aTarget);
        }
    }

    if (aData) {
        aData = mObjectURL(aData, aAttrs && aAttrs.type || 'text/plain');

        if (!d) {
            aNode.onload = function() {
                setTimeout(function() {
                    URL.revokeObjectURL(aData);
                }, 2600);

                aNode.onload = null;
            };
        }

        if (aNode.nodeName === 'SCRIPT') {
            console.assert(self.is_extension === false, 'We cannot use blob-URIs under the browser extension.');
            aNode.src = aData;
        }
        else {
            aNode.href = aData;
        }
    }

    return aNode;
}

function mObjectURL(data, type) {
    'use strict';
    return URL.createObjectURL(new Blob(data, {type: type}));
}

/**
 * Events broadcaster
 * @name mBroadcaster
 * @private
 */
tmp = [];
self.mBroadcaster = {
    mbl: tmp,
    once: Array.prototype.push.bind(tmp, true),
    addListener: Array.prototype.push.bind(tmp, false)
};
tmp = 0;

var sh = [];
var sh1 = [
'lang/fr_685cb34cbc35b290a9c79514fd69c6bec6fbc4dc4b788980574717afad7b67d7.json',
'lang/es_57edbbeb7a2fc442a4c566d4586e05076a75e8b944b2e937cb3f3dbfb64142cd.json',
'lang/tr_ae7326c0dbfa17d2f27bdb5c3e78340f8aae8c2e2d9a0b8573cbfcbf92d782dd.json',
'lang/pt_e4edf4a0921c0725af548a6496612fb16393e7b9f0a19713dc9c32a880b57b8b.json',
'lang/br_b4d8e4117101dba3e889edd085ae91e16ead7762c4ce85ac24cf9d42b7c27a0e.json',
'lang/uk_f9c280618988dc92c189a26ce325dfc1bd4d12ec5f1a6f8a5753ecfe0e90999c.json',
'lang/ro_66c5d9162d404c010b4b6cd04a375d8330f92b351c85debe7b069b0db5d88d7a.json',
'lang/nl_4d31ec8822ae642c7204f67e667405825262ccd08b7930b94f1dffcb19d8a946.json',
'lang/hu_8d7bc626c888769c12d20514cc9c81550fbe40ce06a0cb2699bab5a39e24ed6b.json',
'lang/he_693e4cf2e33c5cb711431d7a98e05bcf854f45001876477f8177783f14b0e786.json',
'lang/en_3734b2cfee66071dc75d51428993984692bd11f63e80946eae6a043abf2a745c.json',
'lang/ru_22b379b7d16272e9354c5e6a6b7334ab653fae8588acb44bdd9ee7572c457795.json',
'lang/th_e28891b105a19f0fae83c3111d3ac492b17e140d454076ffceaea71129127955.json',
'lang/cn_c85f2f7288601bf398aac6701ee1fda2ca9a9c77d47dbd00bd74985025425bc8.json',
'lang/de_9409b99aacab0dbd43d0e03a816855f7dadcc31afc6ff6ee997086e3b6d4c27a.json',
'lang/kr_17de214aa207983804d3ed5a403e8ab940197941b98d166280358629ed6029bb.json',
'lang/vi_685b93ede6f61e12784c194b5a2e0f980fbdc966deaaf254f432fd2e4bf02fbd.json',
'lang/pl_4d2f55de414151e64f3992428685f7e930cf473beec64087dc850dfdbd0722a8.json',
'lang/ar_b4778f444c9667ddeb6e0b9aa3aa2b9ccc756f750ef707426d399a229548ca87.json',
'lang/tl_611646ca0ab0d654bbdc3887a6e1a03d96f6096b4f035666555f58a8efea2da5.json',
'lang/ct_4eb0fa052beb33347d9abbc9208bac6504efe3bd7784a655250b7d0e2d5587c5.json',
'lang/id_998a7bb80939dfec15064baa653113067fd7b9b8a420bae52baf01834fa24f5e.json',
'lang/it_296b605ab8d7481ff5666cf66f4bba91db2e764b5fd85af0f4788b0d2bb6ef5a.json',
'lang/jp_6d48bd1efe14291087750e253a0f6eb0f7b1256f73033d4315e063c2faac064a.json',
'lang/ka_6e1d58551a63be00bb67a2a03609aa262b4d7682737fd719bd8c3bfe92e00145.json',
'js/mega-1_3a42998e6f7318edd6f6ea0568cc7824c9273044f89e2c38ae326fc554ad5a84.js',
'js/mega-2_1f80ff7ea7cc787dbed8963b01c4f709df888754e80f262d2e109e5a088a8f04.js',
'js/mega-3_8ede336a5dc1f58a4293364a48fd6a9497808a0617ff6b142208d3964cf3d33d.js',
'js/mega-4_4fd1c8f7e2f02fb9a57dcf5667dd968ed828ff048ce607fd73cbd530cf8a9db2.js',
'js/mega-5_7c64dbc499f22b65ddec712d468a4e0b6d9cecf056028c77e5965d2b1e9b844d.js',
'js/mega-6_74aa5152cf89642adaada88e241f6b57ddcbfdf8da1629b24324ee45a77e6454.js',
'js/mega-7_ab5f68f7bde1e63461bc0cb52c3617dce7b559ccb32bbafa257c19dcfafcb4b8.js',
'css/mega-1_73f0048e4f39d5ec99a6cd1b8e309b77eaccdbe1eaaf31c05e2b8e660919fdd0.css',
'html/templates_a88b02dea5df987ad87e1658dda19e833dc66e58f608f12e253e73c0e45fa879.json',
'js/mega-8_58e0fd578e8929b93e419e9251bff39acbb84a5be5b9a0534be81693b4ab523c.js',
'js/ui/commercials_b1fe90e17ec5fffec713b83f73c733bd8006181f8fc886586f410b2a5c83ba3a.js',
'js/mega-9_bc91f313152b74408e3715be06f8b45c9450f6f4814a11e5a2ab431e886fee21.js',
'css/bottom-pages-animations.css-postbuild_077437ba5398f2997efea39e55f89eadd473667177aba0b14a48c8b57c60af43.css',
'js/mega-10_1bc8293db76a9695d8282796443344f97d236d2dd41ddaa4ea8db0d6ceebe2db.js',
'css/mega-2_ae346453e03589830cf0be8e0db45e0372f2b24b62f99e784e4ed72c1995f658.css',
'js/transfers/meths/mediasource_0b532510cdd027680f2ef433ae462aa55cfbb369b1214bcbbe3ed58d040d037b.js',
'js/mega-11_187f230e32b9f5a8b7ccaebdc95e13d34abefa2862e925b8a8bb1355aab74bf0.js',
'js/mega-12_548777c3ca463d5feccdfb4875fb248535b4ebe92e2ad0e25d2794fe40f5e9db.js',
'css/mega-3_17f5c0552e3c0e7a17e9e0e9b691e6d7723994d1d3f2ee4d974816368378e708.css',
'js/mega-13_2224f998d49563d64c2bff9d6ec651139a08316aeec950bbc16aa5296d020889.js',
'js/mega-14_c75f6c1eac11e2289cde512a7028d10972757e97228d1d23a6925d86629affba.js',
'js/mega-15_207a3670d97405b3e1c86b2db89c2c13872f6c08f9e09862405ce5b193060d77.js',
'css/mega-4_c2d0cba8bf9abe2a393754504ea5204b1ba57e3ae067c9dd5d8b0cf07cb133ab.css',
'js/mega-16_4741185115a21fee4b066e7885cef9f5c5ac3b200c0644c2adba8ab045b56cba.js',
'js/mega-17_869a0acef669d9ad1a5cb4ccddbc6b23faf9f229dc5964a2ba3451e25dc081a4.js',
'makecache_dbb6cba999ac51c3b8057f1fe0ad23fdc5efaa16aa6e41b240125859adb71dda.js',
'css/lang_ar.css-postbuild_4748218104d66ed9d81f39fc14c9364141a16cd877da0ab83d13e48e09e136dc.css',
'css/lang_th.css-postbuild_0da390fa93a38fa492523d7d9d73d4795937b637ec97a214d6126c26e2b3ef90.css',
'css/lang_vi.css-postbuild_60872e6770c4e3f61366d7461bae23c03c54a34a0d1f04e7dcaf0286e1c00ee8.css',
'css/mega-5_3625af6046023ee3e5364183eea6306d496bd67948d6dc4f678dfb74cd5798ad.css',
'css/mega-6_c2284a11a631f967ec34a7f1daa60b0db1d35443f470d73f536eadb344cbfd7f.css',
'js/mega-18_b023090157c514c32fc2a95fa3ce51d45f20e84a47e11e82e2347aea5b615951.js',
'css/mega-7_58c04ac027b15931acfb17be4a134e35c8bdd3b99109e617895713a42f32d84a.css',
'js/filerequest_upload_c6463ef6f72d81db82c2474994c51646134c9061be09991d9cb102475607b79c.js',
'css/filerequest.css-postbuild_db0abcad5b7660623302d64990b0332ae7fce58a37e7ca14c978461af1c155eb.css',
'css/filerequest-mobile.css-postbuild_a432988d07bf0f07fb01c4f35ffdd3aa88d9f3634a3a9c9006a9028575ee727c.css',
'js/mega-19_d9200127196d85ebe56563dff32818ecf26a0126b962c2367eb490f7eea97814.js',
'js/mega-20_521db560a17408280fcf0df7d16dfd5cd315687bfed0028fb471b0b39f310d3f.js',
'js/mega-21_464e5d2050c7a5622f4dfe5ce0cb5684109cbb7425bbe39ef5fa43b88c8ed637.js',
'html/embedplayer.html-postbuild_deebb3580293439a42d161fd5b6b1b2b682b121a6f82c260f8fb91d3afa54d23.html',
'css/mega-8_3aaaf438d5d25481c2ac8819cad1ccef09aa6a0196d8b74ca67a305b2e105989.css',
'html/js/embeddrop_f68ce47691dab6bce72dd13004ee9bcfcfba323113085c6dfe301a15b925061d.js',
'css/embeddrop.css-postbuild_9b8e62cc33357eb6511049ac8605123d7e620bb6c940e9a2c48897b5b0a2f5ad.css',
'js/vendor/asmcrypto_9c90f27443fbdb85519985333a8b00c3cff0e10a2753955f41890342d64362f7.js',
'js/vendor/web-streams-polyfill_4456707bb534dcea561d444476628a671857bc2e1809e0bde32cc5849acf393c.js',
'js/vendor/dcraw_ecd21f93deed73abf3d11422681d642227729cbe25eff1f5a9cc49c1320e37f4.js',
'js/vendor/datepicker_a10572b8b4af667841980a214a8b4303e0a2423fa443f44727aa4537380220a2.js',
'html/sourcecode_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.html',
'html/register.html-postbuild_222bbe842f3eb8a809d003df3f8ab74af9b9350d625fe52866aa55ded3699132.html',
'html/js/register_5c0861ab96e3aabe40e6533c74def0529df445f4f0828bc2bfd85c1b52741c31.js',
'html/download.html-postbuild_2749a59feff4141009bb961edd622162e7589b7f6c446e9be297528f0cdff89d.html',
'html/js/download_7066fb3a9439ac4b7ab62485a20eef0196e9d0ec2a4038302f3eeda11453f2c5.js',
'html/disputenotice.html-postbuild_f3478166c1b0e7f22131d16b792ddb8a08eb79a5bb737e29a14f349fdcde9fdf.html',
'html/js/copyright_1704a4bf7c9fff04becec73989988917d3d57cdff6d95b7de05ca695c764f81f.js',
'html/backup.html-postbuild_aa0baaaf6854fceaf43f0a7914e3b3542e17b704dbac843e34c2ba348be497b6.html',
'html/js/backup_1919e59702db20666414b33a6d8f4485bba459a5a8eafa8863ba65b8fe98d5fe.js',
'html/cancel.html-postbuild_1f44d30619a06de19432dc4f83e21766b92477f79165c88bdb9197936bfb6470.html',
'html/js/cancel_adf07d26257d4392bed08f887dc5740f77d36de4348e169e44820118c4d657e3.js',
'html/reset.html-postbuild_563596ca65e3eb463f1b206bad981a1bf2a84aabda5e27935e724f1d68cb1d2c.html',
'html/js/reset_76f8eaa8d92b6b587759d405cf7017f92f3df34f229272e394919d0e6e7d971e.js',
'html/js/emailchange_b02546a945c072ccbeea37a6f6b00b604ac8d10d984f5a8f467fc2288ad6395d.js',
'html/emailchange.html-postbuild_6f9dc16f3da157b8ddd80c240ad94c18a22570dbcad65bcdbc01ff09cff418da.html',
'html/recovery.html-postbuild_2ae02a9bd0a2422b05ae5e826eb86ab06d1a5b0f40615c76aa8d2ba138bc8b56.html',
'html/js/recovery_6b34d40009a3b97de01a8e608bec817b1d2842da73eaab5f6517d98d20cb7a2d.js',
'html/sdkterms_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.html',
'html/js/support_ccabba6a6e6c03fdd02627360a97f3e57d114534b59d1991e89a11159c7fc2ad.js',
'html/support.html-postbuild_fb9e2c022ea8640598d4e409535f7727a5c9e1f0a0b39ada5b2de8c8dc61de96.html',
'js/vendor/pdf_72a249d2fcd1bf4a68fd69dbb3684a2351571415f098bdea16361a90be853607.js',
'js/vendor/tiff_f010f8f9b4a7aa6d3af1873ead6483eebf7cc274c0a27734bac1a3d0070f4719.js',
'js/vendor/webp_29dee7af39441287b9ead094d3870b341c5aa137ee3650a3e7a920f9cd5b3cb1.js',
'js/vendor/videostream_913e5fc788783a0a1e6be4f461629bf9b6daace4b047840d8d9f06b1f06ec686.js',
'js/vendor/mediainfo_570d1b1d444c3dfad15de11befbb9dc2bfcff7413b352d44a3f30ca0a1672a60.js',
'js/vendor/zxcvbn_d73bf00b6455547cd51ec70ece7fe4f2e4f8aa4dbcb17be6e87b691ead9d8b67.js',
'html/redeem.html-postbuild_7bdf70146cf11393103e19abd20c68498e80b92bee7566659d1ce2be952c8c46.html',
'html/js/discountpromo_c885bf35b6c421abf5308b4f37f3cfaf4febd63adc0d3e0cb81ced5b71333517.js',
'html/unsub.html-postbuild_ade0f16ff461dc0750929f3c4614fdd4e71529ec0800520e0b193b2e2bf80a71.html',
'html/js/unsub_76c75101f8f8f3abc3de4e556e38aecab4866466b0cfb0968dfaebb363292ad1.js',
'html/js/redeem_011173bf2348eb282ca8fc43a5f0e91e60467523f821c9d5b7bc5ab17ef31d58.js',
'js/vendor/pdf_72a249d2fcd1bf4a68fd69dbb3684a2351571415f098bdea16361a90be853607.js',
'html/pdf.viewer.html-postbuild_f493c9fc142c08291d7f524c49a772bf2b71821d7b68d2353d301e5a61e017a8.html',
'css/pdf.viewer.css-postbuild_387f0e5cd7ffb8ce49de084017783bf69cbcc34dbe4fcc8811f71bac48e4638a.css',
'js/vendor/pdf.viewer_f768f3f930a8e2ffd009185aa80f5685e858c394ea0f5fa3cb6f6d0059ee544e.js',
'html/filerequest.html-postbuild_05ca7f96ee21c9bd0402f751df09569dbb29159cb4424ca062bedff40da290e1.html',
'js/fm/megadata/businessaccount_89b0a498ca5b19fdef538497e3cd10aa4cb21395e636853e193603e29396de14.js',
'js/fm/businessAccountUI_3dfb174520d341dc59a59b73c967520fc53fd7cdfd57080201a3824e60472d90.js',
'js/vendor/Chart_65785cbac065c034683427886733eb2c928641b454b30d5e16e18487d204f2f3.js',
'js/ui/chart.helper_521157fe800d3591d76c16b7bb01bac1226c2e38f6d64f5f986aef7d578a210c.js',
'html/invoicePDF.html-postbuild_790768a920c86b577d38985602b86bcc7c19501691bf910030c6adb215041cb5.html',
'js/vendor/codemirror_10efe839da820fceb0cba5fe3653c69848bfe1f3f4a8b3090e397a2f793abd4a.js',
'js/vendor/simplescrollbars_ffba38fcd4f8eaf98ad01abcab41f02f353ca4ec41931eddbfacb9352b456672.js',
'html/troy-hunt.html-postbuild_a18c7952cbb8afac2c77b8ac8901a0d3ea923b784ff814dd3fe109d3c2733443.html',
'html/js/troy-hunt_19d96f28a57ce22a049da0a94261b7190aa1410ff1c0403f5b0ac8260ed39301.js',
'css/troy-hunt.css-postbuild_9f4df50ac218daf3b5dc0a709bc166077c092539038eb067699ae0dd3a1b0e6b.css',
'js/ui/reportAbuse_f8d99c6be6361fcc455bfd58637b0007f122bd1eae0f2dd0e299fd7cd9379742.js',
'css/folder-link.css-postbuild_1d21b6fd6f92e09c0c138dd448a4aa0fccac3c7061221470dc87f31b03e3fbb9.css',
'js/time_checker_39c5b115b88f9e0d63371d028e11082a7113eb35abc17c9a7b00a00fd96b8aa9.js',
'js/filerequest_3b70e8389ed8246991c7e415ce558d1846f715ab33d2fb576e9278fd849b1153.js',
'js/filerequest_upload_c6463ef6f72d81db82c2474994c51646134c9061be09991d9cb102475607b79c.js',
'js/vendor/docx-preview_68717acbd58970a0bdb7a2e816e02c45e7530437ed8c6ff809bce1d459cb463a.js',
'js/ui/docx.viewer_0eb995f8824472fbe26311d3da485b7782c0b89011d094c28633b471f90151c5.js',
'html/docx.viewer.html-postbuild_ec2eff36cf9a4d84a9cfd896c7c1ae630530a7f1405ec525ce002301c72e5a1c.html',
'css/docx.viewer.css-postbuild_7c0032f4d46e2861ba927f753e515c157eba17b025d63b69e20da06f188f9b0a.css',
'js/vendor/client-zip_f531ca16ab41b4ce8661d240c4252ebfbb296a3f7a2e14fa7339e6551b517fa9.js',
'js/webgl-group1_6d20c444c8e9c3827b2fd5dd9a59c99c08dbad53925f5d2a46174bbc61f548e3.js',
'js/s4-group1_502fc06087d4aacf74f29801257a9fa79a9516a031df94f39fabaa75e80e907c.js',
'css/s4-group1_9c1a3f9ea80bc2dae58d5a94c1ca90fa85dafdfb5499b25cff3e4733c783cea3.css',
'js/rewind-group1_fabe16f45eca677d36cb9552d148dc8194b4f0c258e4377de8b4c3635ae91122.js',
'css/rewind-group1_46d769ed07d095a352b91847293df4ddde1eb2930f7233e964c387b9f8af6ca9.css',
'js/chat-group1_4acf3d0ef771df133f063c5c9a2e4391798c74ee32fb4a26f9360aaba836f1f6.js',
'js/chat-group2_dfe2c8e97238260a42551d3e1023befd4317f8ced700b5104771dfd5a3ecaf87.js',
'js/chat-group3_dbd2318aad40d8c9375948dc2f7a8e1852fd625577c65e4f69713631930e935e.js',
'js/chat-group4_1fad9375dc432eb94ef020d70db2c88ecc42754dc219d3ec1a1f292adaed3e74.js',
'js/chat-group5_a35a1c37edeb8164700af2b9fce0e12da208a4cd860e606a846328e55cd50030.js',
'js/chat-group6_04708706dc6dfa3faafd693a3d9fe2a7080f4a502e7fcd417fc6d58bec4faf52.js',
'css/chat-group1_dc85fb3f0ef1594fc486de8b2866d5eb5625a59d9596c95d40646cb244a126f1.css'
];


/**
 * Check that the hexadecimal hash of the file from the worker thread matches the correct one created at deployment time
 * @param {String} hashFromWorker A hexadecimal string
 * @param {String} fileName The file name with the SHA-256 hash appended at the end
 * @returns {Boolean}
 */
function compareHashes(hashFromWorker, fileName) {

    // Retrieve the SHA-256 hash that was appended to the file name
    var startOfHash = fileName.lastIndexOf('_') + 1;
    var endOfHash = fileName.lastIndexOf('.');
    var hashFromDeployment = fileName.substring(startOfHash, endOfHash);

    if (hashFromWorker === hashFromDeployment) {
        return true;
    }
    else {
        console.error('Hash mismatch on file: ' + fileName + '. Hash from worker thread: ' + hashFromWorker + ' Hash from deployment script: ' + hashFromDeployment);
        return false;
    }
}

function init_storage ( storage ) {
    var v = storage.v || 0,
        d = storage.d,
        dd = storage.dd,
        sp = storage.staticpath;

    // Graceful storage version upgrade
    if ( v == 0 ) {
        // array of limbs -> mpi-encoded number
        function b2mpi (b) {
            var bs = 28, bm = (1 << bs) - 1, bn = 1, bc = 0, r = [0], rb = 1, rn = 0;
            var bits = b.length * bs;
            var n, rr='';

            for ( n = 0; n < bits; n++ ) {
                if ( b[bc] & bn ) r[rn] |= rb;
                if ( (rb <<= 1) > 255 ) rb = 1, r[++rn] = 0;
                if ( (bn <<= 1) > bm ) bn = 1, bc++;
            }

            while ( rn && r[rn] == 0 ) rn--;

            bn = 256;
            for ( bits = 8; bits > 0; bits-- ) if ( r[rn] & (bn >>= 1) ) break;
            bits += rn * 8;

            rr += String.fromCharCode(bits/256)+String.fromCharCode(bits%256);
            if ( bits ) for ( n = rn; n >= 0; n-- ) rr += String.fromCharCode(r[n]);
            return rr;
        }

        if ( storage.privk && storage.privk.substr(0, 1) == "[") { /* is json serialized array which need to be migrated */
            // Upgrade key format
            try {
                var privk = JSON.parse(storage.privk), str = '';
                for ( var i = 0; i < privk.length; i++ ) str += b2mpi( privk[i] );
                storage.privk = btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
                v++;
            }
            catch ( e ) {
                console.error("Could not migrate storage - priv key could not be converted to the new format: ", e);
            }
        }
        else {
            v++;
        }

        storage.v = v;
    }
    // if ( v == 1 ) { ... }
    // if ( v == 2 ) { ... }
    // ... and so on

    // Or upgrade hard when graceful method isn't provided
    if ( v != storage_version ) {
        storage.clear();
        storage.v = storage_version;
        if ( d ) storage.d = d;
        if ( dd ) storage.dd = dd;
        if ( sp ) storage.staticpath = sp;
    }

    return storage;
}

/**
 * Logs errors when loading/verifying files. This will log once for a file load error on the regular static server
 * (after x retries of any file), log once for any error on the default static server (after x retries per file) and
 * log once for any file corruption errors.
 * @param {Number} errorType The error code (see load_error_types object)
 * @param {String} filename The file that failed to load
 * @param {String} staticPathToLog The static path to be logged
 */
function logStaticServerFailure(errorType, filename, staticPathToLog) {

    'use strict';

    // Don't log if the build is older than 10 days
    if (window.buildOlderThan10Days) {
        return false;
    }

    // If file loading error
    if (errorType === load_error_types.file_load_error) {

        // If using the default static path
        if (staticpath === defaultStaticPath) {

            // If already logged that the default static server failed, exit
            if (staticServerLoading.failureLoggedDefault) {
                return false;
            }

            // Otherwise set flag to not log it again
            staticServerLoading.failureLoggedDefault = true;
        }
        else {
            // If already logged that the regular static server failed, exit
            if (staticServerLoading.failureLoggedOriginal) {
                return false;
            }

            staticServerLoading.failureLoggedOriginal = true;
        }
    }

    // If file corruption (hash mismatch) error
    else if (errorType === load_error_types.file_corrupt) {

        // If already logged that there was a corrupt file error, exit
        if (staticServerLoading.failureLoggedCorrupt) {
            return false;
        }

        staticServerLoading.failureLoggedCorrupt = true;
    }
    else {
        // Otherwise if already logged some other error, exit
        if (window.log99723) {
            return false;
        }

        if (typeof errorType !== 'number') {
            errorType = String(errorType).split('\n').slice(0, 3).join(' ').substr(0, 96);
        }
        window.log99723 = true;
    }

    // Send log. NB: Not using staticpath global here, in case it changed in the main thread
    // and due to the onIdle timeout below it hasn't actually sent the log yet
    setTimeout(function() {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', apipath + 'cs?id=0', true);
        xhr.send(
            JSON.stringify(
                [{a: 'log', e: 99723, m: JSON.stringify([1, errorType, filename, staticPathToLog])}]
            )
        );
    });
}

/**
 * Show a site load error alert with OK and Cancel buttons
 * @param {Number|Error|String} error The type of error e.g. loadErrorType.file_corrupt/file_load_error, or an
 *                                    Error/exception, or an error message to be displayed.
 * @param {String} filename The file that failed to load
 */
function siteLoadError(error, filename) {
    'use strict';

    if (filename !== 'mainlayout') {

        logStaticServerFailure(error, filename, staticpath);
    }

    var message = ['MEGA failed to load because '];
    if (location.host !== 'mega.nz') {
        message[0] += '..';
    }

    if (error === load_error_types.file_corrupt) {
        message.push('The file "' + filename + '" is corrupt.');
    }
    else if (error === load_error_types.file_load_error) {
        message.push('The file "' + filename + '" could not be loaded.');
    }
    else {
        message.push('Filename: ' + filename + "\nException: " + error);

        var stack = String(error.stack).split('\n').splice(1, 4).join('\n');
        if (stack) {
            message.push('Stack trace: ' + stack);
        }
    }

    message.push('Please click OK to refresh and try again.');
    message.push("If the problem persists, please try disabling all third-party browser extensions, " +
                 "update your browser and MEGA browser extension to the latest version. " +
                 "If that does not help, contact support@mega.nz");

    message.push('BrowserID: ' + (typeof mozBrowserID !== 'undefined' ? mozBrowserID : ua) + '\n' +
                 'Static server: ' + staticpath + '\n' +
                 'Flipped to default static: ' + (staticServerLoading.flippedToDefault ? 'yes' : 'no') + '\n' +
                 'Date/time: ' + new Date().toISOString());

    message = message.join("\n\n");
    console.error(message);
    contenterror = 1;

    if (window.sleTick || window.top !== window) {
        return;
    }

    // Give time for window.onerror to fire 'cd2' before showing the blocking confirm-dialog
    window.sleTick = setTimeout(function() {

        // Show confirm dialog, if 'OK' is pressed it will reload
        if (confirm(message) === true) {

            // Force EU static on page reload
            sessionStorage.skipGeoStaticPath = '1';
            location.reload(true);
        }

        window.sleTick = null;

    }, 2e3);
}

if (is_mobile) {
    mCreateElement('meta', {
        sizes: "72x72",
        name: "apple-touch-icon-precomposed",
        href: staticpath + "images/favicons/apple-touch-icon-72x72.png"
    }, 'head');
    mCreateElement('meta', {
        sizes: "144x114",
        name: "apple-touch-icon-precomposed",
        href: staticpath + "images/favicons/apple-touch-icon-144x114.png"
    }, 'head');
    mCreateElement('meta', {
        sizes: "144x144",
        name: "apple-touch-icon-precomposed",
        href: staticpath + "images/favicons/apple-touch-icon-144x144.png"
    }, 'head');

    mCreateElement('meta', {name: "apple-mobile-web-app-capable", content: "yes"}, 'head');
    mCreateElement('meta', {name: "apple-mobile-web-app-status-bar-style", content: "black"}, 'head');
}

if (is_livesite && !is_extension) {
    mCreateElement('link', {rel: "manifest", href: "/manifest.json"}, 'head');
}

if (is_ios) {
    // http://whatsmyuseragent.com/Devices/iPhone-User-Agent-Strings
    // http://www.enterpriseios.com/wiki/Complete_List_of_iOS_User_Agent_Strings
    tmp = ua.match(/(?:iphone|cpu) os (\d+)[\._](\d+)/);
    if (tmp) {
        var rev = tmp.pop();
        tmp = tmp.pop();

        console.log('Found iOS ' + tmp + '.' + rev);

        is_ios = parseInt(tmp);
        if (!is_ios) {
            // Huh?
            is_ios = true;
        }
    }
    tmp = undefined;

    if (is_mobile) {
        // Prevent Safari's copy&paste bug..
        window.onhashchange = function() {
            location.reload();
        };
    }
}

// Viewport meta.
// Disable user-scalable to avoid auto-zoom on iOS and firefox browsers (?)
// These browsers already support zoom
mCreateElement('meta', {
    name: 'viewport',
    content: 'width=device-width, initial-scale=1, maximum-scale=1, ' +
        (!is_mobile || is_ios || ua.indexOf('firefox') > 0 ? 'user-scalable=0, ' : '') +
        'interactive-widget=resizes-content'
}, 'head');

// Determine whether to show the legacy mobile page for these links so that they redirect back to the app
tmp = is_mobile && (
    page.substr(0, 9) === 'newsignup'
    || page.substr(0, 7) === 'account'
    || is_old_windows_phone && page.substr(0, 7) === 'confirm'
);

/**
 * Some legacy secureboot mobile code that has been refactored to keep just the blog working and also redirect to the
 * app if any cancel, verify, fm/ipc, newsignup, recover or account links are clicked in the app
 * because the new mobile site is not designed for those yet.
 */
if (tmp) {

    var app;
    var android;
    var intent;
    var link = document.createElement('link');

    link.setAttribute('rel', 'stylesheet');
    link.type = 'text/css';
    link.href = staticpath + 'css/mobile-app-old.css';
    document.head.appendChild(link);

    // AMO: Markup should not be passed to `innerHTML` dynamically. -- This isnt reached for the extension, anyway
    // jscs:disable
    // eslint-disable-next-line no-unsanitized/property, no-restricted-properties
    document.body.innerHTML = '<div class="bottom-page scroll-block selectable-txt"><div class="main-content-block">'
                            + '<div class="main-centered-bl">'
                            + '<div class="main-logo"></div><div class="main-head-txt" id="m_title"></div>'
                            + '<div class="main-head-txt" id="m_desc"></div><br /><br />'
                            + '<a href="" class="main-button" id="m_appbtn"></a><div class="main-social hidden">'
                            + '<a href="https://www.facebook.com/MEGAprivacy" class="main-social-icon facebook"></a>'
                            + '<a href="https://www.twitter.com/MEGAprivacy" class="main-social-icon twitter"></a>'
                            + '<div class="clear"></div></div></div> </div><div class="scrolling-content">'
                            + '<div class="mid-logo"></div><div class="mid-gray-block">MEGA provides free cloud '
                            + 'storage with convenient and powerful always-on privacy</div>'
                            + '<div class="scrolling-block-icon encription"></div><div class="scrolling-block-header">'
                            + 'End-to-end encryption</div><div class="scrolling-block-txt">Unlike other cloud storage '
                            + 'providers, your data is encrypted & decrypted during transfer by your client devices '
                            + 'only and never by us.</div><div class="scrolling-block-icon access"></div>'
                            + '<div class="scrolling-block-header">Secure Global Access</div>'
                            + '<div class="scrolling-block-txt">Your data is accessible any time, from any device, '
                            + 'anywhere. Only you control the keys to your files.</div>'
                            + '<div class="scrolling-block-icon colaboration"></div>'
                            + '<div class="scrolling-block-header">Secure Collaboration</div>'
                            + '<div class="scrolling-block-txt">Share folders with your contacts and see their '
                            + 'updates in real time. Online collaboration has never been more private and secure.'
                            + '</div><div class="bottom-menu full-version"><div class="copyright-txt">Mega Limited '
                            + new Date().getFullYear() + '</div><div class="language-block"></div><div class="clear">'
                            + '</div><iframe src="" width="1" height="1" frameborder="0" style="width:1px; '
                            + 'height:1px; border:none;" id="m_iframe"></iframe></div></div></div>';

    if (is_windowsphone) {
        app = 'zune://navigate/?phoneappID=1b70a4ef-8b9c-4058-adca-3b9ac8cc194a';
        document.body.className = 'wp full-mode supported';
    }
    else if (is_android) {
        app = 'https://play.google.com/store/apps/details?id=mega.privacy.android.app&referrer=meganzsb';
        if (is_huawei) {
            app = 'https://appgallery.huawei.com/#/app/C102009895';
        }
        document.body.className = 'android full-mode supported';
        android = 1;
        var ver = ua.match(/android (\d+)\.(\d+)/);
        if (ver) {
            var rev = ver.pop();
            ver = ver.pop();
            // Check for Android 2.3+
            if (ver > 2 || (ver === 2 && rev > 3)) {
                intent = 'intent://#' + page + '/#Intent;scheme=mega;package=mega.privacy.android.app;end';
            }
        }
        if (intent) {
            if (is_huawei) {
                intent = intent.replace('.app;', '.app.huawei;');
            }
            document.location = intent;
        }
    }
    else if (ua.indexOf('bb10') > -1) {
        app = 'http://appworld.blackberry.com/webstore/content/46810890/';
        document.body.className = 'blackberry full-mode supported';
    }
    else if (is_ios) {
        app = 'https://itunes.apple.com/app/mega/id706857885';
        document.body.className = 'ios full-mode supported';
    }
    else {
        document.body.className = 'another-os full-mode unsupported';
    }
    document.getElementById('m_title').innerHTML = 'This link should be opened in the MEGA app.';

    if (app) {
        document.getElementById('m_appbtn').href = app;
        document.getElementById('m_desc').innerHTML = 'Otherwise, you can also open the link on a '
                                                    + 'desktop/laptop browser, or download the MEGA app.';
    }
    else {
        document.getElementById('m_desc').innerHTML = 'Otherwise you can also open the link on a '
                                                    + 'desktop/laptop browser.';
    }

    var prechar = '#';
    if (ua.indexOf('windows phone') > -1) {
        prechar = '';
    }
    if (ua.indexOf('chrome') > -1) {
        window.location = 'mega://' + prechar + page;
    }
    else if (is_ios > 8) {
        setTimeout(function() {
            var text = 'This link should be opened in the MEGA app. '
                + 'Click OK if you already have the MEGA app installed';
            if (confirm(text)) {
                document.location = 'mega://#' + page;
            }
        }, 1500);
    }
    else {
        document.getElementById('m_iframe').src = 'mega://' + prechar + page;
    }
    if (intent) {
        document.getElementById('m_title').innerHTML
            += '<br/><em>If you already have the app installed, <a href="' + intent + '">click here!</a></em>';
    }
}
else if (!browserUpdate) {
    d = window.d || 0;
    jj = window.jj || 0;

    // Do not report exceptions if this build is older than 10 days
    var exTimeLeft = (is_extension || !nocontentcheck) && (buildVersion.timestamp + 10 * 86400) * 1000 > Date.now();
    window.buildOlderThan10Days = !exTimeLeft;

    // Override to see logs being sent
    if (localStorage.getItem('sendStaticFailureLogs') !== null) {
        window.buildOlderThan10Days = false;
    }

    if (!d && exTimeLeft && is_livesite)
    {
        var __cdumps = [], __cd_t;
        window.onerror = function __MEGAExceptionHandler(msg, url, ln, cn, errobj)
        {
            function mTrim(s)
            {
                return String(s)
                    .replace('-extension://', '~')
                    .replace(/blob:[^:\s]+/, '..')
                    .replace(/([^'])\w+:\/\/[^\s:]+/, '$1..')
                    .replace(/\.\.:\/\/[^:\s]+/, '..')
                    .replace(/(?: line \d+ > eval)+/g,' >.eval')
                    .trim();
            }
            if (__cdumps.length > 3) return false;

            if (url && ln < 2) {
                console.debug([errobj || msg]);
                return;
            }

            var expectedSourceOrigin = url || ln > 999;
            var dump = {
                l: ln,
                f: mTrim(url),
                m: mTrim(msg)
                    .replace(/'[a-z]+:\/+[^']+(?:'|$)/gi, function(url) {
                        url = url.substr(1);
                        if (url[url.length - 1] === "'") {
                            url = url.substr(0, url.length - 1);
                        }
                        var a = document.createElement('a');
                        a.href = url;
                        return "'" + (a.origin !== 'null' && a.origin
                            || (a.protocol + '//' + a.hostname)) + "...'";
                    })
                    .replace(/(Cannot read propert[\w\s]+)\(?([\w\s]*'[\w-]{8}')/, "$1'<h>?'")
                    .replace(/(Access to '\.\.).*(' from script denied)/, '$1$2')
                    .replace(/gfs\w+\.userstorage/, 'gfs...userstorage')
                    .replace(/^Uncaught\W*(?:exception\W*)?/i, ''),
            }, cc;
            var sbid = +(''+(document.querySelector('script[src*="secureboot"]')||{}).src).split('=').pop()|0;

            if (~dump.m.indexOf('[[:i]]')) {
                return false;
            }

            if (dump.m.indexOf("Failed to construct 'Worker'") !== -1) {
                errobj = {};
                dump.l = ln = 1; // enforce deduplication..
            }

            if (~dump.m.indexOf("\n")) {
                var lns = dump.m.split(/\r?\n/).map(String.trim).filter(String);

                if (lns.length > 6) {
                    dump.m = [].concat(lns.slice(0,2), "[..!]", lns.slice(-2)).join(" ");
                }
            }
            dump.m = (
                is_mobile ? '[mobile] ' :
                    is_embed ? '[embed] ' :
                        window.pfid ? '[FL] ' :
                            mega.infinity ? '[INF] ' :
                        is_drop ? '[drop] ' : ''
            ) + dump.m.replace(/\s+/g, ' ');

            var injectedScript =
                /userscript|user\.js|EvalError/.test(dump.m + url + (errobj && errobj.stack))
                || dump.m.indexOf('Permission denied to access property') !== -1
                || dump.m.indexOf('Cannot redefine property') !== -1
                || dump.m.indexOf("evaluating 'ze(e,t)'") !== -1
                || dump.m.indexOf("evaluating 'r(a,c)'") !== -1
                || dump.m.indexOf("evaluating 'a.L") !== -1
                || dump.m.indexOf('Error: hookFull') !== -1;

            if (injectedScript) {
                window.onerror = null;
                window.log99723 = true;
                expectedSourceOrigin = false;
            }

            if (expectedSourceOrigin && !window.u_checked) {
                // Alert the user if there was an uncaught exception while
                // loading the site, this should only happen on some fancy
                // browsers other than what we use during development, and
                // hopefully they'll report it back to us for troubleshoot
                return siteLoadError(dump.m, url + '^~' + ln);
            }

            if (injectedScript) {
                // Some third party extension is injecting bogus script(s)...
                console.warn('Your account is only as secure as your computer...');
                console.warn('Check your installed extensions for the one injecting bogus scripts on this page...');
                console.error(dump.m, dump, errobj);
                return false;
            }

            if (/NS_ERR|out[\s_]+of[\s_]+mem|dead\s+object|allocation\s+failed/i.test(dump.m)
                && (!window.ua || !ua.details || !ua.details.blink)) {

                window.onerror = null;
                console.error(dump.m, dump, errobj);
                return false;
            }

            if (!expectedSourceOrigin) {
                window.onerror = null;
                console.error(dump.m, dump, errobj);

                if (!/SyntaxError|Script\serror/.test(dump.m)) {
                    onIdle(function() {
                        var xhr = new XMLHttpRequest();
                        xhr.open('POST', apipath + 'cs?id=0', true);
                        xhr.send(
                            JSON.stringify(
                                [{a: 'log', e: 99806, m: JSON.stringify([1, dump.m, url + ':' + ln])}]
                            )
                        );
                    });
                }
                return;
            }

            var version = buildVersion.website;

            if (is_extension) {
                if (is_firefox_web_ext) {
                    version = buildVersion.firefox;
                }
                else if (mega.chrome) {
                    version = buildVersion.chrome;
                }
            }

            if (errobj)
            {
                if (errobj.stack)
                {
                    var maxStackLines = 15;
                    var omsg = String(msg).trim();
                    var re = RegExp(
                        omsg.substr(0, 70)
                        .replace(/^\w+:\s/, '')
                        .replace(/([^\w])/g, '\\$1')
                        + '[^\r\n]+'
                    );

                    dump.s = String(errobj.stack)
                        .replace(omsg, '').replace(re, '')
                        .split("\n").map(mTrim)
                        .filter(function(s, idx, a) {
                            return s.length && a[idx - 1] !== s;
                        });

                    for (var idx = 1; idx < dump.s.length; idx++) {
                        var s = dump.s[idx];

                        if (s.indexOf('@resource:') > 0 || s.indexOf('@jar:') > 0) {
                            maxStackLines = idx;
                            break;
                        }
                    }

                    if (dump.m.indexOf(':skull:') > 0) {
                        maxStackLines = 50;
                    }

                    dump.s = dump.s.splice(0, maxStackLines).join("\n");

                    if (dump.s.indexOf('Unknown script code:') !== -1
                        || dump.s.indexOf('Function code:') !== -1
                        || dump.s.indexOf('(eval code:') !== -1
                        || dump.s.indexOf('(unknown source)') !== -1
                        || /<anonymous>:\d+:/.test(dump.s)) {

                        console.warn('Got uncaught exception from unknown resource,'
                            + ' your MEGA account might be compromised.');
                        console.error(msg, errobj, errobj && errobj.stack, url, ln);
                        return false;
                    }
                }

                if (typeof eventlog === 'function' && !errobj.udata && /\w/.test(msg || '')) {
                    eventlog(99702, JSON.stringify([version, ln, msg]), true);
                }
            }
            if (cn) dump.c = cn;

            if (/Access to (?:the script at )?'.*(?:' from script|'?is) denied|origin 'null'/.test(dump.m)) {
                console.error(dump.m, dump);
                return false;
            }

            if (ln == 0 && !dump.s)
            {
                if (dump.m.toLowerCase().indexOf('out of memory') != -1) dump.m = '!Fatal! Out Of Memory.';
                else dump.m = dump.m.replace(/[^\s\w]/gi,'') || ('[!] ' + msg);
            }

            try
            {
                var crashes = JSON.parse(localStorage.crashes || '{}');
                var checksum = wchecksum(JSON.stringify(dump), 0x4ef5391a);

                if (crashes.v != sbid) crashes = { v : sbid };

                if (crashes[checksum])
                {
                    // Reported less than 10 days ago?
                    if (Date.now() - crashes[checksum] < 864000000) return false;
                }
                dump.x = checksum;
                crashes[checksum] = Date.now();
                localStorage.crashes = JSON.stringify(crashes);
                cc = Object.keys(crashes).length;
            }
            catch(e) {
                delete localStorage.crashes;
            }

            __cdumps.push(dump);
            if (__cd_t) clearTimeout(__cd_t);
            var report = tryCatch(function()
            {
                function ctx(id)
                {
                    return {
                        callback : function(res)
                        {
                            if (res === EOVERQUOTA)
                            {
                                __cdumps = new Array(4);
                                if (__cd_t) clearTimeout(__cd_t);

                                if (id)
                                {
                                    var crashes = JSON.parse(localStorage.crashes || '{}');
                                    delete crashes[id];
                                    localStorage.crashes = JSON.stringify(crashes);
                                }
                            }
                        }
                    };
                }
                var ids = [], uds = [], r = 1;
                for (var i in __cdumps)
                {
                    var dump = __cdumps[i];

                    if (dump.x) { ids.push(dump.x); delete dump.x; }
                    if (dump.d) { uds.push(dump.d); delete dump.d; }
                    if (dump.l < 0) r = 0;
                }

                var report = {};
                report.ua = navigator.userAgent;
                report.io = window.dlMethod && dlMethod.name;
                report.sb = sbid;
                report.tp = typeof $ !== 'undefined' && $.transferprogress;
                report.id = ids.join(",");
                report.ud = uds;
                report.cc = cc;

                report = JSON.stringify(r? report:{});

                for (var i = __cdumps.length; i--;)
                {
                    if (!/\w/.test(__cdumps[i].m || '')) continue;

                    api_req({
                        a: 'cd2',
                        c: JSON.stringify(__cdumps[i]),
                        // v: report,
                        // s: window.location.host,
                        t: version
                    }, ctx(ids[i]));
                }
                __cd_t = 0;
                __cdumps = [];
            });
            __cd_t = setTimeout(function() {
                report();
            }, 3000);

            return false;
        };
    }

    /**
     * Detects which language the user currently has set in their browser
     * @returns {String} Returns the two letter language code e.g. 'en', 'es' etc
     */
    var detectLang = function() {
        'use strict';

        // Get the preferred language in their browser
        var userLangs, userLang, ourLangs, k, v, j, i, u;

        // Check if a language override exists on the URL where applicable.
        if (is_drop) {
            tmp = page.split('!').pop();

            if (languages[tmp]) {
                return tmp;
            }
        }

        // Otherwise get the user's preferred language in their browser settings
        userLangs = navigator.languages || navigator.language || navigator.userLanguage;

        // If a language can't be detected, default to English
        if (!userLangs) {
            return 'en';
        }

        if (!Array.isArray(userLangs)) {
            userLangs = [userLangs];
        }

        for (u = 0; u < userLangs.length; u++) {

            // Lowercase it
            userLang = String(userLangs[u]).toLowerCase();

            // Language mapping handling.
            ourLangs = Object.keys(languages);

            // Match on language code variants e.g. 'pt-br' returns 'br'
            for (i = ourLangs.length; i--;) {
                k = ourLangs[i];
                v = languages[k][0];

                for (j = v.length; j--;) {
                    if (v[j] === userLang || v[j] === userLang.substr(0, 3)) {
                        return k;
                    }
                }
            }

            // If no exact match supported, normalise to base language code e.g. en-gb, en-us, en-ca returns 'en'
            for (i = ourLangs.length; i--;) {
                k = ourLangs[i];
                v = languages[k][0];

                for (j = v.length; j--;) {
                    if (v[j].substr(0, 3) === userLang.substr(0, 3)) {
                        return k;
                    }
                }
            }
        }

        // Default to English
        return 'en';
    };

    /**
     * Gets the file path for a language file
     * @param {String} language
     * @returns {String}
     */
    var getLanguageFilePath = function(language) {
        'use strict';

        // If the sh1 (filename with hashes) array has been created from deploy script
        if (typeof sh1 === 'undefined') {
            // Otherwise return the filename.json when in Development
            return 'lang/' + language + '.json';
        }

        var enLang;
        for (var i = 0, length = sh1.length; i < length; i++) {
            var filePath = sh1[i];

            // If the language e.g. 'en' matches part of the filename from the deploy script e.g.
            // 'lang/en_0a8e1591149050ef1884b0c4abfbbeb759bbe9eaf062fa54e5b856fdb78e1eb3.json'
            if (filePath.indexOf('lang/' + language) > -1) {
                return filePath;
            }

            // Catch the English language file.
            if (filePath.indexOf('lang/en_') > -1) {
                enLang = filePath;
            }
        }

        console.warn('Failed to find language file for %s...', language);
        return enLang;
    };

    tryCatch(function() {
        if (!is_mobile && !is_iframed && 'serviceWorker' in navigator) {
            // The service worker isn't listened to until much later so just queue any messages for now.
            var handler = function(ev) {
                mega.pendingServiceWorkerMsgs.push({data: ev.data});
            };
            navigator.serviceWorker.addEventListener('message', handler);

            mega.pendingServiceWorkerMsgs = [];
            mega.pendingServiceWorkerHandler = handler;
        }
    })();


    var lang = sessionStorage.lang || localStorage.lang;
    var jsl = [];

    // If they've already selected a language, use that
    if (lang && !languages[lang]) {
        console.warn('Language "%s" is no longer available...', lang);
        delete localStorage.lang;
        delete sessionStorage.lang;
        lang = 0;
    }
    lang = lang || detectLang();

    // Get the language file path e.g. lang/en.json or 'lang/en_7a8e15911490...f1878e1eb3.json'
    var langFilepath = getLanguageFilePath(lang);
    jsl.push({f:langFilepath, n: 'lang', j:3});
    /* Bundle Includes:
     *   sjcl.js
     *   nodedec.js
     *   js/vendor/jquery.js
     *   js/jquery.protect.js
     */
    jsl.push({f:'js/mega-1_3a42998e6f7318edd6f6ea0568cc7824c9273044f89e2c38ae326fc554ad5a84.js', n: 'js-mega-1-js', j: 1, w: 23});
    /* Bundle Includes:
     *   js/vendor/jquery-ui.js
     *   js/vendor/jquery-ui-touch.js
     *   js/vendor/jquery.mousewheel.js
     *   js/scrolling.utils.js
     *   js/jquery.misc.js
     *   js/vendor/megaLogger.js
     *   js/vendor/jquery.fullscreen.js
     *   js/jquery-ui.extra.js
     *   js/utils/broadcast.js
     *   js/utils/polyfills.js
     */
    jsl.push({f:'js/mega-2_1f80ff7ea7cc787dbed8963b01c4f709df888754e80f262d2e109e5a088a8f04.js', n: 'js-mega-2-js', j: 1, w: 27});

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
    jsl.push({f:'js/mega-3_8ede336a5dc1f58a4293364a48fd6a9497808a0617ff6b142208d3964cf3d33d.js', n: 'js-mega-3-js', j: 1, w: 22});
    /* Bundle Includes:
     *   js/utils/media.js
     *   js/utils/megalite.js
     *   js/utils/network.js
     *   js/utils/splitter.js
     *   js/utils/test.js
     *   js/utils/timers.js
     *   js/utils/watchdog.js
     *   js/utils/workers.js
     *   js/utils/trans.js
     *   js/utils/webgl.js
     *   js/utils/subtitles.js
     *   js/utils/sets.js
     */
    jsl.push({f:'js/mega-4_4fd1c8f7e2f02fb9a57dcf5667dd968ed828ff048ce607fd73cbd530cf8a9db2.js', n: 'js-mega-4-js', j: 1, w: 21});

    // Sets and elements

    /* Bundle Includes:
     *   js/vendor/dexie.js
     *   js/functions.js
     *   js/config.js
     *   js/crypto.js
     *   js/account.js
     *   js/security.js
     *   js/two-factor-auth.js
     */
    jsl.push({f:'js/mega-5_7c64dbc499f22b65ddec712d468a4e0b6d9cecf056028c77e5965d2b1e9b844d.js', n: 'js-mega-5-js', j: 1, w: 29});
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
    jsl.push({f:'js/mega-6_74aa5152cf89642adaada88e241f6b57ddcbfdf8da1629b24324ee45a77e6454.js', n: 'js-mega-6-js', j: 1, w: 30});



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
    jsl.push({f:'js/mega-7_ab5f68f7bde1e63461bc0cb52c3617dce7b559ccb32bbafa257c19dcfafcb4b8.js', n: 'js-mega-7-js', j: 1, w: 29});

    /* Bundle Includes:
     *   css/avatars.css
     *   css/fonts.css
     *   css/bottom-pages.css
     *   css/bottom-menu.css
     *   css/business.css
     *   css/pro.css
     *   css/planpricing.css
     *   css/startpage.css
     *   css/icons.css
     *   css/spinners.css
     *   css/business-register.css
     *   css/psa.css
     *   css/features.css
     *   css/dialogs-common.css
     *   css/dialogs/cookie-dialog.css
     *   css/jquery-ui.extra.css
     *   css/cookiepolicy.css
     */
    jsl.push({f:'css/mega-1_73f0048e4f39d5ec99a6cd1b8e309b77eaccdbe1eaaf31c05e2b8e660919fdd0.css', n: 'css-mega-1-css', j: 2, w: 27});

    // Common desktop and mobile, bottom pages
    jsl.push({f:'html/templates_a88b02dea5df987ad87e1658dda19e833dc66e58f608f12e253e73c0e45fa879.json', n: 'templates', j: 0, w: 43});
    /* Bundle Includes:
     *   js/vendor/perfect-scrollbar.js
     *   js/ui/languageDialog.js
     */
    jsl.push({f:'js/mega-8_58e0fd578e8929b93e419e9251bff39acbb84a5be5b9a0534be81693b4ab523c.js', n: 'js-mega-8-js', j: 1, w: 3});
    // jsl.push({f:'js/ui/commercials_b1fe90e17ec5fffec713b83f73c733bd8006181f8fc886586f410b2a5c83ba3a.js', n: 'commercials', j:1,w:1});

    if (!is_mobile) {
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
    jsl.push({f:'js/mega-9_bc91f313152b74408e3715be06f8b45c9450f6f4814a11e5a2ab431e886fee21.js', n: 'js-mega-9-js', j: 1, w: 26});

        // UI Elements

        // Bottom pages for desktop
        jsl.push({f:'css/bottom-pages-animations.css-postbuild_077437ba5398f2997efea39e55f89eadd473667177aba0b14a48c8b57c60af43.css', n: 'bottom-pages-animations_css', j:2,w:5,c:1,d:1,cache:1});
    } // !is_mobile

    // TextEditor
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
    jsl.push({f:'js/mega-10_1bc8293db76a9695d8282796443344f97d236d2dd41ddaa4ea8db0d6ceebe2db.js', n: 'js-mega-10-js', j: 1, w: 29});
    /* Bundle Includes:
     *   css/codemirror.css
     *   css/txteditor.css
     *   css/vars/theme.css
     *   css/switches.css
     *   css/sprites/fm-uni@uni.css
     *   css/sprites/fm-mime@uni.css
     *   css/sprites/fm-mime-90@uni.css
     *   css/sprites/fm-mono@mono.css
     *   css/sprites/fm-theme@dark.css
     *   css/sprites/fm-theme@light.css
     *   css/sprites/fm-illustrations.css
     *   css/mega-dialog.css
     *   css/vars/dialog.css
     *   css/vars/button.css
     *   css/radios.css
     *   css/mega-button.css
     *   css/checkboxes.css
     *   css/media-viewer.css
     *   css/video-player.css
     *   css/perfect-scrollbar.css
     *   css/animations.css
     */
    jsl.push({f:'css/mega-2_ae346453e03589830cf0be8e0db45e0372f2b24b62f99e784e4ed72c1995f658.css', n: 'css-mega-2-css', j: 2, w: 14});

    // Transfers
    // jsl.push({f:'js/transfers/meths/mediasource_0b532510cdd027680f2ef433ae462aa55cfbb369b1214bcbbe3ed58d040d037b.js', n: 'dl_mediasource', j:1,w:3});

    // Everything else...

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
    jsl.push({f:'js/mega-11_187f230e32b9f5a8b7ccaebdc95e13d34abefa2862e925b8a8bb1355aab74bf0.js', n: 'js-mega-11-js', j: 1, w: 29});

    // Pro pages Step 1 (Pro plan) and Step 2 (Pro payment)

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
    jsl.push({f:'js/mega-12_548777c3ca463d5feccdfb4875fb248535b4ebe92e2ad0e25d2794fe40f5e9db.js', n: 'js-mega-12-js', j: 1, w: 24});

    // Variables which can be used across all stylesheets

    // Sprites

    // Dialog templates

    // Inputs


    // Megalist

    // Search

    if (!is_mobile) {

    /* Bundle Includes:
     *   css/buttons.css
     *   css/components.css
     *   css/ui/mcomponents.css
     *   css/style.css
     *   css/fm-header.css
     *   css/fm-breadcrumb.css
     *   css/fm-lists.css
     *   css/grid-table.css
     *   css/tabs.css
     *   css/empty-pages.css
     *   css/node-filter.css
     *   css/gallery.css
     *   css/onboarding.css
     *   css/download.css
     *   css/user-card.css
     *   css/account.css
     *   css/banners.css
     *   css/dropdowns.css
     *   css/jq-ui-custom.css
     *   css/labels-and-filters.css
     *   css/dialogs.css
     */
    jsl.push({f:'css/mega-3_17f5c0552e3c0e7a17e9e0e9b691e6d7723994d1d3f2ee4d974816368378e708.css', n: 'css-mega-3-css', j: 2, w: 42});

        // MComponents
    /* Bundle Includes:
     *   js/ui/mcomponents/classes/MComponent.js
     *   js/ui/mcomponents/classes/MButton.js
     *   js/ui/mcomponents/classes/MCheckbox.js
     *   js/ui/mcomponents/classes/MContextMenu.js
     *   js/ui/mcomponents/classes/MDialog.js
     *   js/ui/mcomponents/classes/MEmptyPad.js
     *   js/ui/mcomponents/classes/MHint.js
     *   js/ui/mcomponents/classes/MMenuSelect.js
     *   js/ui/mcomponents/classes/MMenuSelectItem.js
     *   js/ui/mcomponents/classes/MSidebarButton.js
     *   js/ui/mcomponents/classes/MTab.js
     *   js/ui/mcomponents/classes/MTabs.js
     *   js/vendor/megaDynamicList.js
     *   js/fm/quickfinder.js
     *   js/fm/selectionManager2.js
     *   js/fm.js
     *   js/fm/backupsUI.js
     *   js/fm/dashboard.js
     *   js/fm/recents.js
     *   js/time_checker.js
     *   js/ui/contextMenu.js
     *   js/ui/dragselect.js
     *   js/ui/onboarding.js
     *   js/ui/sms.js
     */
    jsl.push({f:'js/mega-13_2224f998d49563d64c2bff9d6ec651139a08316aeec950bbc16aa5296d020889.js', n: 'js-mega-13-js', j: 1, w: 29});

    /* Bundle Includes:
     *   js/fm/account.js
     *   js/fm/account-change-password.js
     *   js/fm/account-change-email.js
     *   js/fm/dialogs.js
     *   js/ui/dropdowns.js
     *   js/ui/node-filter.js
     *   js/ui/info-panel.js
     *   js/notify.js
     *   js/vendor/avatar.js
     */
    jsl.push({f:'js/mega-14_c75f6c1eac11e2289cde512a7028d10972757e97228d1d23a6925d86629affba.js', n: 'js-mega-14-js', j: 1, w: 27});
    /* Bundle Includes:
     *   js/fm/affiliate.js
     *   js/fm/vpn.js
     *   js/fm/gallery/helpers/GalleryTitleControl.js
     *   js/fm/gallery/helpers/GalleryEmptyBlock.js
     *   js/fm/gallery/helpers/GalleryEmptyPhotos.js
     *   js/fm/gallery/helpers/GalleryEmptyImages.js
     *   js/fm/gallery/helpers/GalleryEmptyVideos.js
     *   js/fm/gallery/helpers/GalleryEmptyFavourites.js
     *   js/fm/gallery/helpers/GalleryEmptyDiscovery.js
     *   js/fm/gallery/gallery.js
     *   js/fm/albums/Albums.js
     *   js/fm/albums/AlbumTimeline.js
     *   js/ui/notificationBanner.js
     */
    jsl.push({f:'js/mega-15_207a3670d97405b3e1c86b2db89c2c13872f6c08f9e09862405ce5b193060d77.js', n: 'js-mega-15-js', j: 1, w: 27});

        // Gallery helpers






    /* Bundle Includes:
     *   css/share-dialog.css
     *   css/popups.css
     *   css/data-blocks-view.css
     *   css/recovery.css
     *   css/settings.css
     *   css/media-print.css
     *   css/affiliate-program.css
     *   css/backup-center.css
     *   css/top-menu.css
     *   css/context-menu.css
     *   css/tables.css
     *   css/recents.css
     *   css/transfer-widget.css
     *   css/components/fm-left-pane.css
     *   css/components/info-panel.css
     *   css/chat-bundle.css
     *   css/topbar.css
     *   css/notification-banner.css
     */
    jsl.push({f:'css/mega-4_c2d0cba8bf9abe2a393754504ea5204b1ba57e3ae067c9dd5d8b0cf07cb133ab.css', n: 'css-mega-4-css', j: 2, w: 17});


        // CSS Revamp changes

        // `Meetings` UI styles


        // Notification banner
    } // !is_mobile

    // do not change the order...
    /* Bundle Includes:
     *   js/fm/filemanager.js
     *   js/fm/utils.js
     *   js/fm/megadata.js
     *   js/fm/megadata/account.js
     *   js/fm/megadata/contacts.js
     *   js/fm/megadata/filters.js
     *   js/fm/megadata/menus.js
     */
    jsl.push({f:'js/mega-16_4741185115a21fee4b066e7885cef9f5c5ac3b200c0644c2adba8ab045b56cba.js', n: 'js-mega-16-js', j: 1, w: 23});
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
    jsl.push({f:'js/mega-17_869a0acef669d9ad1a5cb4ccddbc6b23faf9f229dc5964a2ba3451e25dc081a4.js', n: 'js-mega-17-js', j: 1, w: 26});

    if (localStorage.makeCache) {
        jsl.push({f:'makecache_dbb6cba999ac51c3b8057f1fe0ad23fdc5efaa16aa6e41b240125859adb71dda.js', n: 'makecache', j:1});
    }

    if (lang === 'ar' || lang === 'fa') {
        jsl.push({f:'css/lang_ar.css-postbuild_4748218104d66ed9d81f39fc14c9364141a16cd877da0ab83d13e48e09e136dc.css', n: 'lang_arabic_css', j: 2, w: 30, c: 1, d: 1, m: 1});
    }
    else if (lang === 'th') {
        jsl.push({f:'css/lang_th.css-postbuild_0da390fa93a38fa492523d7d9d73d4795937b637ec97a214d6126c26e2b3ef90.css', n: 'lang_thai_css', j: 2, w: 30, c: 1, d: 1, m: 1});
    }
    else if (lang === 'vi') {
        jsl.push({f:'css/lang_vi.css-postbuild_60872e6770c4e3f61366d7461bae23c03c54a34a0d1f04e7dcaf0286e1c00ee8.css', n: 'lang_viet_css', j: 2, w: 30, c: 1, d: 1, m: 1});
    }

    // Load files common to all mobile pages
    if (is_mobile) {

        // Variables which can be used across all mobile stylesheets
    /* Bundle Includes:
     *   css/vars/mobile-theme.css
     *   css/vars/mobile-theme-auto.css
     *   css/mobile/mobile.dropdown.css
     *   css/mobile/mobile.overlay.css
     *   css/mobile/mobile.sheet.css
     *   css/mobile/mobile.context.menu.css
     *   css/mobile/mobile.checkbox.css
     *   css/mobile/mobile.radio.button.css
     *   css/mobile/mobile.toggle.button.css
     *   css/mobile/mobile.footer.css
     *   css/mobile/mobile.header.css
     *   css/mobile/mobile.top.menu.css
     *   css/mobile/mobile.msgdialog.css
     *   css/mobile/mobile.rack.css
     *   css/mobile/mobile.toast.css
     *   css/mobile/mobile.rubbish-bin.css
     *   css/mobile/mobile.banner.css
     *   css/mobile/mobile.node-selector.css
     *   css/mobile/mobile.empty.state.css
     *   css/mobile/mobile.transfer.block.css
     *   css/mobile/mobile.bottom.bar.css
     *   css/mobile/mobile.account.css
     *   css/mobile/mobile.download.css
     *   css/mobile/mobile.promo.banner.css
     *   css/sprites/mobile-fm-uni@uni.css
     *   css/sprites/mobile-fm-mono@mono.css
     *   css/sprites/mobile-fm-theme@dark.css
     *   css/sprites/mobile-fm-theme@light.css
     *   css/mobile.css
     *   css/mobile/mobile.tappable.css
     *   css/mobile/mobile.settings.css
     *   css/mobile/mobile.settings.history.css
     *   css/mobile/mobile.link-management.css
     *   css/mobile/mobile.referral.css
     *   css/mobile-help.css
     */
    jsl.push({f:'css/mega-5_3625af6046023ee3e5364183eea6306d496bd67948d6dc4f678dfb74cd5798ad.css', n: 'css-mega-5-css', j: 2, w: 31});

        // Sprites

    /* Bundle Includes:
     *   css/mobile-top-menu.css
     *   css/mobile-media-viewer.css
     *   css/mobile/mobile.node.css
     *   css/mobile/mobile.sharednode.css
     *   css/mobile/mobile.tab.css
     *   css/mobile/mobile.public.link.css
     *   css/mobile/mobile.datepicker.css
     *   css/mobile/mobile.account.cancel-subscription.css
     *   css/mobile/mobile.backup.recovery.css
     *   css/mobile/mobile.achieve.css
     *   css/mobile/mobile.achieve.invites.css
     *   css/mobile/mobile.achievements-block.css
     *   css/mobile/mobile.achieve.invite-bonuses.css
     *   css/mobile/mobile.file-request-management.css
     *   css/mobile/mobile.conflict-resolution.css
     *   css/mobile/mobile.recovery.logout.css
     */
    jsl.push({f:'css/mega-6_c2284a11a631f967ec34a7f1daa60b0db1d35443f470d73f536eadb344cbfd7f.css', n: 'css-mega-6-css', j: 2, w: 2});

    /* Bundle Includes:
     *   js/vendor/jquery.mobile.js
     *   js/mobile/mobile.js
     *   js/mobile/mobile.megaRender.js
     *   js/mobile/mobile.affiliate.js
     *   js/mobile/mobile.cloud.js
     *   js/mobile/mobile.cloud.action-bar.js
     *   js/mobile/mobile.node-name-control.js
     *   js/mobile/mobile.key.decryption.js
     *   js/mobile/mobile.password.decryption.js
     *   js/mobile/mobile.download.overlay.js
     *   js/mobile/mobile.chatlink.js
     *   js/mobile/mobile.language-menu.js
     *   js/mobile/mobile.link-management.js
     *   js/mobile/mobile.file-request-management.js
     *   js/mobile/mobile.message-overlay.js
     *   js/mobile/mobile.not-found.js
     *   js/mobile/mobile.pro-signup-prompt.js
     *   js/mobile/mobile.propay.js
     *   js/mobile/mobile.recovery.js
     *   js/mobile/mobile.recovery.send-email.js
     *   js/mobile/mobile.recovery.from-email-link.js
     *   js/mobile/mobile.recovery.enter-key.js
     *   js/mobile/mobile.recovery.change-password.js
     *   js/mobile/mobile.register.js
     *   js/mobile/mobile.signin.js
     *   js/mobile/mobile.support.js
     *   js/mobile/mobile.upload-overlay.js
     *   js/mobile/mobile.contact-link.js
     *   js/mobile/mobile.twofactor.js
     *   js/mobile/mobile.sms.phone-input.js
     *   js/mobile/mobile.sms.verify-code.js
     *   js/mobile/mobile.sms.verify-success.js
     *   js/mobile/mobile.sms.achievement.js
     *   js/mobile/mobile.rubbishbin.js
     *   js/mobile/mobile.conflict-resolution.js
     *   js/mobile/mobile.recovery-logout.js
     *   js/mobile/mobile.over-bandwidth-quota.js
     *   js/mobile/mobile.over-storage-quota.js
     *   js/mobile/mobile.component.js
     *   js/mobile/mobile.group.js
     *   js/mobile/mobile.dropdown.js
     *   js/mobile/mobile.dropdown-items.js
     *   js/mobile/mobile.context.menu.js
     *   js/mobile/mobile.tappable.js
     *   js/mobile/mobile.info-menu-item.js
     *   js/mobile/mobile.link.js
     *   js/mobile/mobile.button.js
     *   js/mobile/mobile.checkbox.js
     *   js/mobile/mobile.node.js
     *   js/mobile/mobile.sharednode.js
     *   js/mobile/mobile.radio.button.js
     *   js/mobile/mobile.radio.group.js
     *   js/mobile/mobile.toggle.button.js
     *   js/mobile/mobile.footer.js
     *   js/mobile/mobile.header.js
     *   js/mobile/mobile.top.menu.js
     *   js/mobile/settings/appearance.js
     *   js/mobile/settings/settingsHelper.js
     *   js/mobile/settings/settings.js
     *   js/mobile/settings/account.js
     *   js/mobile/mobile.account.paymentcard.js
     *   js/mobile/mobile.account.cancel-subscription.js
     *   js/mobile/mobile.achieve.js
     *   js/mobile/mobile.achievements-block.js
     *   js/mobile/mobile.achieve.invites.js
     *   js/mobile/mobile.achieve.referrals.js
     *   js/mobile/mobile.achieve.invite-bonuses.js
     *   js/mobile/settings/support.js
     *   js/mobile/settings/about.js
     *   js/mobile/settings/changePassword.js
     *   js/mobile/settings/changeEmail.js
     *   js/mobile/settings/lostAuthDevice.js
     *   js/mobile/settings/verifyEmail.js
     *   js/mobile/settings/twofactorVerifyAction.js
     *   js/mobile/settings/deleteAccount.js
     *   js/mobile/settings/verifyDelete.js
     *   js/mobile/settings/privacyAndSecurity.js
     *   js/mobile/settings/history.js
     *   js/mobile/settings/backupRecovery.js
     *   js/mobile/settings/fileManagement.js
     *   js/mobile/settings/notifications.js
     *   js/mobile/settings/referral.js
     *   js/mobile/settings/referralDistribution.js
     *   js/mobile/settings/termsPolicies.js
     *   js/mobile/settings/twofactorSettings.js
     *   js/mobile/mobile.msgdialog.js
     *   js/mobile/mobile.rack.slot.js
     *   js/mobile/mobile.rack.js
     *   js/mobile/mobile.toast.js
     *   js/mobile/mobile.banner.js
     *   js/mobile/mobile.datepicker.js
     *   js/mobile/mobile.tab.js
     *   js/mobile/mobile.overlay.js
     *   js/mobile/mobile.sheet.js
     *   js/mobile/mobile.node-selector.js
     *   js/mobile/mobile.empty.state.js
     *   js/mobile/mobile.transfer.block.js
     *   js/mobile/mobile.bottom.bar.js
     *   js/mobile/mobile.view.overlay.js
     *   js/mobile/mobile.appbanner.js
     *   js/chat/strongvelope.js
     *   js/mobile/mobile.promo.banner.js
     */
    jsl.push({f:'js/mega-18_b023090157c514c32fc2a95fa3ce51d45f20e84a47e11e82e2347aea5b615951.js', n: 'js-mega-18-js', j: 1, w: 52});
    }

    /* Bundle Includes:
     *   css/toast.css
     *   css/general.css
     *   css/megainput.css
     *   css/vars/text-input.css
     *   css/retina-images.css
     */
    jsl.push({f:'css/mega-7_58c04ac027b15931acfb17be4a134e35c8bdd3b99109e617895713a42f32d84a.css', n: 'css-mega-7-css', j: 2, w: 2});

    if (is_megadrop) {
        // @todo FIXME: we *should* load required resources only!

        jsl.push({f:'js/filerequest_upload_c6463ef6f72d81db82c2474994c51646134c9061be09991d9cb102475607b79c.js', n: 'filerequest_upload_js', j:1 });

        jsl.push({f:'css/filerequest.css-postbuild_db0abcad5b7660623302d64990b0332ae7fce58a37e7ca14c978461af1c155eb.css', n: 'filerequest_css', j:2,w:5});

        if (is_mobile) {
            jsl.push({f:'css/filerequest-mobile.css-postbuild_a432988d07bf0f07fb01c4f35ffdd3aa88d9f3634a3a9c9006a9028575ee727c.css', n: 'filerequest_mobile_css', j:2, w:5});
        }
    }

    // We need to keep a consistent order in loaded resources, so that if users
    // send us logs we won't get different line numbers on stack-traces from
    // different browsers. Hence, do NOT add more jsl entries after this block,
    // unless they're optional (such as polyfills) or third-party resources.

    if (is_embed) {
        jsl = [{f: langFilepath, n: 'lang', j: 3}];
    /* Bundle Includes:
     *   sjcl.js
     *   nodedec.js
     *   js/vendor/jquery.js
     *   js/jquery.protect.js
     *   js/vendor/jquery.fullscreen.js
     *   js/vendor/jquery.mousewheel.js
     *   js/jquery.misc.js
     *   html/js/embedplayer.js
     *   js/transfers/cloudraid.js
     *   js/utils/broadcast.js
     *   js/utils/polyfills.js
     */
    jsl.push({f:'js/mega-19_d9200127196d85ebe56563dff32818ecf26a0126b962c2367eb490f7eea97814.js', n: 'js-mega-19-js', j: 1, w: 30});

    /* Bundle Includes:
     *   js/utils/api.js
     *   js/utils/browser.js
     *   js/utils/clipboard.js
     *   js/utils/conv.js
     *   js/utils/dom.js
     *   js/utils/events.js
     *   js/utils/locale.js
     *   js/utils/media.js
     *   js/utils/network.js
     *   js/utils/timers.js
     *   js/utils/watchdog.js
     *   js/utils/workers.js
     *   js/crypto.js
     */
    jsl.push({f:'js/mega-20_521db560a17408280fcf0df7d16dfd5cd315687bfed0028fb471b0b39f310d3f.js', n: 'js-mega-20-js', j: 1, w: 29});

    /* Bundle Includes:
     *   js/account.js
     *   js/ui/contextMenu.js
     *   js/transfers/queue.js
     *   js/transfers/decrypter.js
     *   js/vendor/videostream.js
     */
    jsl.push({f:'js/mega-21_464e5d2050c7a5622f4dfe5ce0cb5684109cbb7425bbe39ef5fa43b88c8ed637.js', n: 'js-mega-21-js', j: 1, w: 21});


        jsl.push({f:'html/embedplayer.html-postbuild_deebb3580293439a42d161fd5b6b1b2b682b121a6f82c260f8fb91d3afa54d23.html', n: 'index', j: 0});
    /* Bundle Includes:
     *   css/embedplayer.css
     *   css/video-player.css
     *   css/sprites/embed-mono@mono.css
     */
    jsl.push({f:'css/mega-8_3aaaf438d5d25481c2ac8819cad1ccef09aa6a0196d8b74ca67a305b2e105989.css', n: 'css-mega-8-css', j: 2, w: 3});
    }

    if (is_drop) {
        u_checked = true;
        jsl = [{f: langFilepath, n: 'lang', j: 3}];
        jsl.push({f:'html/js/embeddrop_f68ce47691dab6bce72dd13004ee9bcfcfba323113085c6dfe301a15b925061d.js', n: 'embeddrop_js', j: 1, w: 4});
        jsl.push({f:'css/embeddrop.css-postbuild_9b8e62cc33357eb6511049ac8605123d7e620bb6c940e9a2c48897b5b0a2f5ad.css', n: 'embeddrop_css', j: 2, w: 5});
    }
    else {
        jsl.push({f:'js/vendor/asmcrypto_9c90f27443fbdb85519985333a8b00c3cff0e10a2753955f41890342d64362f7.js', n: 'asmcrypto_js', j: 1, w: 5});

        if (typeof ReadableStreamDefaultController === 'undefined'
            || !Object.hasOwnProperty.call(ReadableStreamDefaultController.prototype || {}, 'enqueue')) {

            jsl.push({f:'js/vendor/web-streams-polyfill_4456707bb534dcea561d444476628a671857bc2e1809e0bde32cc5849acf393c.js', n: 'web_streams_polyfill_js', j: 1});
        }
    }

    if (page.substr(0, 5) === 'chat/') {
    }

    var jsl2 =
    {
        'dcrawjs': {f:'js/vendor/dcraw_ecd21f93deed73abf3d11422681d642227729cbe25eff1f5a9cc49c1320e37f4.js', n: 'dcraw_js', j: 1},
        'datepicker_js': {f:'js/vendor/datepicker_a10572b8b4af667841980a214a8b4303e0a2423fa443f44727aa4537380220a2.js', n: 'datepicker_js', j:1},
        'sourcecode': {f:'html/sourcecode_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.html', n: 'sourcecode', j:0},
        'register': {f:'html/register.html-postbuild_222bbe842f3eb8a809d003df3f8ab74af9b9350d625fe52866aa55ded3699132.html', n: 'register', j:0},
        'register_js': {f:'html/js/register_5c0861ab96e3aabe40e6533c74def0529df445f4f0828bc2bfd85c1b52741c31.js', n: 'register_js', j:1},
        'download': {f:'html/download.html-postbuild_2749a59feff4141009bb961edd622162e7589b7f6c446e9be297528f0cdff89d.html', n: 'download', j:0},
        'download_js': {f:'html/js/download_7066fb3a9439ac4b7ab62485a20eef0196e9d0ec2a4038302f3eeda11453f2c5.js', n: 'download_js', j:1},
        'disputenotice': {f:'html/disputenotice.html-postbuild_f3478166c1b0e7f22131d16b792ddb8a08eb79a5bb737e29a14f349fdcde9fdf.html', n: 'disputenotice', j:0},
        'copyright_js': {f:'html/js/copyright_1704a4bf7c9fff04becec73989988917d3d57cdff6d95b7de05ca695c764f81f.js', n: 'copyright_js', j:1},
        'keybackup': {f:'html/backup.html-postbuild_aa0baaaf6854fceaf43f0a7914e3b3542e17b704dbac843e34c2ba348be497b6.html', n: 'keybackup', j:0},
        'keybackup_js': {f:'html/js/backup_1919e59702db20666414b33a6d8f4485bba459a5a8eafa8863ba65b8fe98d5fe.js', n: 'keybackup_js', j:1},
        'cancel': {f:'html/cancel.html-postbuild_1f44d30619a06de19432dc4f83e21766b92477f79165c88bdb9197936bfb6470.html', n: 'cancel', j:0},
        'cancel_js': {f:'html/js/cancel_adf07d26257d4392bed08f887dc5740f77d36de4348e169e44820118c4d657e3.js', n: 'cancel_js', j:1},
        'reset': {f:'html/reset.html-postbuild_563596ca65e3eb463f1b206bad981a1bf2a84aabda5e27935e724f1d68cb1d2c.html', n: 'reset', j:0},
        'reset_js': {f:'html/js/reset_76f8eaa8d92b6b587759d405cf7017f92f3df34f229272e394919d0e6e7d971e.js', n: 'reset_js', j:1},
        'change_email_js': {f:'html/js/emailchange_b02546a945c072ccbeea37a6f6b00b604ac8d10d984f5a8f467fc2288ad6395d.js', n: 'change_email_js', j:1},
        'change_email': {f:'html/emailchange.html-postbuild_6f9dc16f3da157b8ddd80c240ad94c18a22570dbcad65bcdbc01ff09cff418da.html', n: 'change_email', j:0},
        'recovery': {f:'html/recovery.html-postbuild_2ae02a9bd0a2422b05ae5e826eb86ab06d1a5b0f40615c76aa8d2ba138bc8b56.html', n: 'recovery', j:0},
        'recovery_js': {f:'html/js/recovery_6b34d40009a3b97de01a8e608bec817b1d2842da73eaab5f6517d98d20cb7a2d.js', n: 'recovery_js', j:1},
        'sdkterms': {f:'html/sdkterms_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.html', n: 'sdkterms', j:0},
        'support_js': {f:'html/js/support_ccabba6a6e6c03fdd02627360a97f3e57d114534b59d1991e89a11159c7fc2ad.js', n: 'support_js', j:1},
        'support': {f:'html/support.html-postbuild_fb9e2c022ea8640598d4e409535f7727a5c9e1f0a0b39ada5b2de8c8dc61de96.html', n: 'support', j:0},
        'pdfjs': {f:'js/vendor/pdf_72a249d2fcd1bf4a68fd69dbb3684a2351571415f098bdea16361a90be853607.js', n: 'pdfjs', j:1},
        'tiffjs': {f:'js/vendor/tiff_f010f8f9b4a7aa6d3af1873ead6483eebf7cc274c0a27734bac1a3d0070f4719.js', n: 'tiffjs', j:1},
        'webpjs': {f:'js/vendor/webp_29dee7af39441287b9ead094d3870b341c5aa137ee3650a3e7a920f9cd5b3cb1.js', n: 'webpjs', j:1},
        'videostream': {f:'js/vendor/videostream_913e5fc788783a0a1e6be4f461629bf9b6daace4b047840d8d9f06b1f06ec686.js', n: 'videostream', j:1},
        'mediainfo': {f:'js/vendor/mediainfo_570d1b1d444c3dfad15de11befbb9dc2bfcff7413b352d44a3f30ca0a1672a60.js', n: 'mediainfo', j:1},
        'zxcvbn_js': {f:'js/vendor/zxcvbn_d73bf00b6455547cd51ec70ece7fe4f2e4f8aa4dbcb17be6e87b691ead9d8b67.js', n: 'zxcvbn_js', j:1},
        'redeem': {f:'html/redeem.html-postbuild_7bdf70146cf11393103e19abd20c68498e80b92bee7566659d1ce2be952c8c46.html', n: 'redeem', j:0},
        'discountpromo_js': {f:'html/js/discountpromo_c885bf35b6c421abf5308b4f37f3cfaf4febd63adc0d3e0cb81ced5b71333517.js', n: 'discountpromo_js', j:1},
        'unsub': {f:'html/unsub.html-postbuild_ade0f16ff461dc0750929f3c4614fdd4e71529ec0800520e0b193b2e2bf80a71.html', n: 'unsub', j:0},
        'unsub_js': {f:'html/js/unsub_76c75101f8f8f3abc3de4e556e38aecab4866466b0cfb0968dfaebb363292ad1.js', n: 'unsub_js', j:1},
        'redeem_js': {f:'html/js/redeem_011173bf2348eb282ca8fc43a5f0e91e60467523f821c9d5b7bc5ab17ef31d58.js', n: 'redeem_js', j:1},
        'pdfjs2': {f:'js/vendor/pdf_72a249d2fcd1bf4a68fd69dbb3684a2351571415f098bdea16361a90be853607.js', n: 'pdfjs2', j:4 },
        'pdfviewer': {f:'html/pdf.viewer.html-postbuild_f493c9fc142c08291d7f524c49a772bf2b71821d7b68d2353d301e5a61e017a8.html', n: 'pdfviewer', j:0 },
        'pdfviewercss': {f:'css/pdf.viewer.css-postbuild_387f0e5cd7ffb8ce49de084017783bf69cbcc34dbe4fcc8811f71bac48e4638a.css', n: 'pdfviewercss', j:4 },
        'pdfviewerjs': {f:'js/vendor/pdf.viewer_f768f3f930a8e2ffd009185aa80f5685e858c394ea0f5fa3cb6f6d0059ee544e.js', n: 'pdfviewerjs', j:4 },
        'filerequest': {f:'html/filerequest.html-postbuild_05ca7f96ee21c9bd0402f751df09569dbb29159cb4424ca062bedff40da290e1.html', n: 'filerequest', j:0 },
        'businessAcc_js': {f:'js/fm/megadata/businessaccount_89b0a498ca5b19fdef538497e3cd10aa4cb21395e636853e193603e29396de14.js', n: 'businessAcc_js', j:1 },
        'businessAccUI_js': {f:'js/fm/businessAccountUI_3dfb174520d341dc59a59b73c967520fc53fd7cdfd57080201a3824e60472d90.js', n: 'businessAccUI_js', j:1 },
        'charts_js': {f:'js/vendor/Chart_65785cbac065c034683427886733eb2c928641b454b30d5e16e18487d204f2f3.js', n: 'charts_js', j:1},
        'charthelper_js': {f:'js/ui/chart.helper_521157fe800d3591d76c16b7bb01bac1226c2e38f6d64f5f986aef7d578a210c.js', n: 'charthelper_js', j:1},
        'business_invoice': {f:'html/invoicePDF.html-postbuild_790768a920c86b577d38985602b86bcc7c19501691bf910030c6adb215041cb5.html', n: 'business_invoice', j:0},
        'codemirror_js': {f:'js/vendor/codemirror_10efe839da820fceb0cba5fe3653c69848bfe1f3f4a8b3090e397a2f793abd4a.js', n: 'codemirror_js', j:1},
        'codemirrorscroll_js': {f:'js/vendor/simplescrollbars_ffba38fcd4f8eaf98ad01abcab41f02f353ca4ec41931eddbfacb9352b456672.js', n: 'codemirrorscroll_js', j:1},
        'special': {f:'html/troy-hunt.html-postbuild_a18c7952cbb8afac2c77b8ac8901a0d3ea923b784ff814dd3fe109d3c2733443.html', n:'special', j:0},
        'special_js': {f:'html/js/troy-hunt_19d96f28a57ce22a049da0a94261b7190aa1410ff1c0403f5b0ac8260ed39301.js', n:'special_js', j:1},
        'special_css': {f:'css/troy-hunt.css-postbuild_9f4df50ac218daf3b5dc0a709bc166077c092539038eb067699ae0dd3a1b0e6b.css', n:'special_css', j:2},
        'reportabuse_js': {f:'js/ui/reportAbuse_f8d99c6be6361fcc455bfd58637b0007f122bd1eae0f2dd0e299fd7cd9379742.js', n:'reportabuse_js', j:1},
        'folderlink_css':{f:'css/folder-link.css-postbuild_1d21b6fd6f92e09c0c138dd448a4aa0fccac3c7061221470dc87f31b03e3fbb9.css', n: 'folderlink_css', j: 2, w: 5, c: 1, d: 1, cache: 1},
        'time_checker_js': {f:'js/time_checker_39c5b115b88f9e0d63371d028e11082a7113eb35abc17c9a7b00a00fd96b8aa9.js', n:'time_checker_js', j:1},
        'filerequest_js': {f:'js/filerequest_3b70e8389ed8246991c7e415ce558d1846f715ab33d2fb576e9278fd849b1153.js', n: 'filerequest_js', j:1 },
        'filerequest_upload_js': {f:'js/filerequest_upload_c6463ef6f72d81db82c2474994c51646134c9061be09991d9cb102475607b79c.js', n: 'filerequest_upload_js', j:1 },
        'docxpreview_js': {f:'js/vendor/docx-preview_68717acbd58970a0bdb7a2e816e02c45e7530437ed8c6ff809bce1d459cb463a.js', n: 'docxpreview_js', j:4},
        'docxviewer_js': {f:'js/ui/docx.viewer_0eb995f8824472fbe26311d3da485b7782c0b89011d094c28633b471f90151c5.js', n: 'docxviewer_js', j:4},
        'docxviewer': {f:'html/docx.viewer.html-postbuild_ec2eff36cf9a4d84a9cfd896c7c1ae630530a7f1405ec525ce002301c72e5a1c.html', n: 'docxviewer', j:0},
        'docxviewercss': {f:'css/docx.viewer.css-postbuild_7c0032f4d46e2861ba927f753e515c157eba17b025d63b69e20da06f188f9b0a.css', n: 'docxviewercss', j:4},
        'clientzip_js': {f:'js/vendor/client-zip_f531ca16ab41b4ce8661d240c4252ebfbb296a3f7a2e14fa7339e6551b517fa9.js', n: 'clientzip_js', j:1},
    };

    /* eslint-disable max-len */
    var jsl3 = {'webgl':{'webgl_group1_js':{f:'js/webgl-group1_6d20c444c8e9c3827b2fd5dd9a59c99c08dbad53925f5d2a46174bbc61f548e3.js',n:'webgl_group1_js',j:5,w:0}},'s4':{'s4_group1_js':{f:'js/s4-group1_502fc06087d4aacf74f29801257a9fa79a9516a031df94f39fabaa75e80e907c.js',n:'s4_group1_js',j:1,w:17},'s4_group1_css':{f:'css/s4-group1_9c1a3f9ea80bc2dae58d5a94c1ca90fa85dafdfb5499b25cff3e4733c783cea3.css',n:'s4_group1_css',j:2,w:1}},'rewind':{'rewind_group1_js':{f:'js/rewind-group1_fabe16f45eca677d36cb9552d148dc8194b4f0c258e4377de8b4c3635ae91122.js',n:'rewind_group1_js',j:1,w:12},'rewind_group1_css':{f:'css/rewind-group1_46d769ed07d095a352b91847293df4ddde1eb2930f7233e964c387b9f8af6ca9.css',n:'rewind_group1_css',j:2,w:1}},'chat':{'chat_group1_js':{f:'js/chat-group1_4acf3d0ef771df133f063c5c9a2e4391798c74ee32fb4a26f9360aaba836f1f6.js',n:'chat_group1_js',j:1,w:7},'chat_group2_js':{f:'js/chat-group2_dfe2c8e97238260a42551d3e1023befd4317f8ced700b5104771dfd5a3ecaf87.js',n:'chat_group2_js',j:1,w:45},'chat_group3_js':{f:'js/chat-group3_dbd2318aad40d8c9375948dc2f7a8e1852fd625577c65e4f69713631930e935e.js',n:'chat_group3_js',j:1,w:25},'chat_group4_js':{f:'js/chat-group4_1fad9375dc432eb94ef020d70db2c88ecc42754dc219d3ec1a1f292adaed3e74.js',n:'chat_group4_js',j:1,w:29},'chat_group5_js':{f:'js/chat-group5_a35a1c37edeb8164700af2b9fce0e12da208a4cd860e606a846328e55cd50030.js',n:'chat_group5_js',j:1,w:13},'chat_group6_js':{f:'js/chat-group6_04708706dc6dfa3faafd693a3d9fe2a7080f4a502e7fcd417fc6d58bec4faf52.js',n:'chat_group6_js',j:1,w:72},'chat_group1_css':{f:'css/chat-group1_dc85fb3f0ef1594fc486de8b2866d5eb5625a59d9596c95d40646cb244a126f1.css',n:'chat_group1_css',j:2,w:8}}}
    var subpages =
    {
        'keybackup': ['keybackup', 'keybackup_js'],
        'recovery': ['recovery', 'recovery_js'],
        'reset': ['reset', 'reset_js'],
        'verify': ['change_email', 'change_email_js'],
        'cancel': ['cancel', 'cancel_js'],
        'register': ['register', 'register_js', 'zxcvbn_js'],
        'newsignup': ['register', 'register_js', 'zxcvbn_js'],
        'emailverify': ['zxcvbn_js'],
        '!': ['download', 'download_js'],
        'file': ['download', 'download_js'],
        'F!': ['folderlink_css'],
        'folder': ['folderlink_css'],
        'collection': ['folderlink_css'],
        'discountpromo': ['discountpromo_js'],
        's': ['discountpromo_js'], // Short URL for 'sale' e.g. /s/blackfriday
        'disputenotice': ['disputenotice', 'copyright_js'],
        'support': ['support_js', 'support'],
        'recover': ['reset', 'reset_js'],
        'redeem': ['redeem', 'redeem_js'],
        'unsub': ['unsub', 'unsub_js'],
        'developersettings': ['developersettings', 'developersettings_js'],
        'filerequest': ['filerequest', 'filerequest_upload_js'],
        'special': ['special', 'special_js', 'special_css']
    };

    if (is_mobile) {
        // Page specific
        subpages['!'] = ['download_js'];
    }

    if (page.substr(0, 5) === 'chat/') {
        // jsl = [{f: langFilepath, n: 'lang', j: 3}];
        // ^ @todo: consider loading only needed files...

        tmp = Object.keys(jsl3.chat);
        for (var u = 0; u < tmp.length; ++u) {
            jsl.push(jsl3.chat[tmp[u]]);
        }
        tmp = 0;
    }

    page = ({
        'megacmd': 'cmd',
        'computerbild2019': 'redeem'
    })[page] || page;

    if (page && !is_iframed)
    {
        for (var p in subpages)
        {
            if (page.substr(0,p.length) == p)
            {
                for (var i in subpages[p]) jsl.push(jsl2[subpages[p][i]]);
            }
        }
    }
    var xhr_slots = d && jj ? 5 : localStorage.testSingleThreadLoad ? 1 : 2;
    var waitingToBeLoaded = 0,jsl_done,jj_done = !jj;
    if (!nocontentcheck) {
        addScript([asmCryptoSha256Js]);
    }
    if (typeof Worker !== 'undefined' && typeof window.URL !== 'undefined' && !nocontentcheck)
    {
        var hashdata = ['self.postMessage = self.webkitPostMessage || self.postMessage;', asmCryptoSha256Js, 'self.onmessage = function(e) { try { var hashHex = asmCryptoSha256.SHA256.hex(e.data.text); e.data.hash = hashHex; self.postMessage(e.data); } catch(err) { e.data.error = err.message; self.postMessage(e.data);  } };'];
        var hash_url = mObjectURL(hashdata, "text/javascript");
        var hash_workers = [];
        var i =0;
        // eslint-disable-next-line block-scoped-var
        while (i < xhr_slots)
        {
            try
            {
                hash_workers[i] = new Worker(hash_url);
                hash_workers[i].postMessage = hash_workers[i].webkitPostMessage || hash_workers[i].postMessage;
                hash_workers[i].onmessage = function(e)
                {
                    if (e.data.error)
                    {
                        console.log('error',e.data.error);
                        console.log(e.data.text);
                        alert('error');
                    }
                    var file = Object(jsl[e.data.jsi]).f || 'unknown.js';

                    if (nocontentcheck === false && !compareHashes(e.data.hash, file)) {
                        siteLoadError(load_error_types.file_corrupt, bootstaticpath + file);
                        contenterror = 1;
                    }
                    if (!contenterror)
                    {
                        jsl_current += jsl[e.data.jsi].w || 1;
                        jsl_progress();
                        if (++jslcomplete == jsl.length) initall();
                        else jsl_load(e.data.xhri);
                    }
                };
            }
            catch(e)
            {
                hash_workers = undefined;
                break;
            }
            i++;
        }
        hashdata = null;
    }
    asmCryptoSha256Js = null;

    if (jj)
    {
        var _queueWaitToBeLoaded = function(id, elem) {
            waitingToBeLoaded++;
            elem.onload = function() {
                // if (d) console.log('jj.progress...', waitingToBeLoaded);

                jsl_loaded[Object(jsl[id]).n] = 1;
                jsl_current += Object(jsl[id]).w || 1;
                jsl_progress();

                if (--waitingToBeLoaded == 0) {
                    jj_done = true;
                    boot_done();
                }
                elem.onload = null;
            };
        };

        var createScriptTag = function(id, src) {
            var elem = mCreateElement('script', {type: 'text/javascript'}, 'head');
            elem.async = false;
            _queueWaitToBeLoaded(id, elem);
            elem.src = src;
            return elem;
        };

        var createStyleTag = function(id, src) {
            var elem = mCreateElement('link', {type: 'text/css', rel: "stylesheet"}, 'head');
            _queueWaitToBeLoaded(id, elem);
            elem.href = src;
            return elem;
        };
    }

    var pages = [],xhr_progress,xhr_stack,jsl_fm_current,jsl_current,jsl_total,jsl_perc,jsli,jslcomplete;

    function jsl_start()
    {
        if (xhr_stack) {
            console.error('jsl_start: invalid procedure, pending requests are running...');
            return false;
        }
        jslcomplete = 0;
        xhr_progress = Array(xhr_slots);
        xhr_stack = Array(xhr_progress.length);
        jsl_fm_current = 0;
        jsl_current = 0;
        jsl_total = 0;
        jsl_perc = 0;
        jsli=0;
        var i;
        var jjNoCache = '';
        if (localStorage.jjnocache) {
            jjNoCache = '?r=' + (new Date().toISOString().replace(/[^\w]/g, ''));
        }
        for (i = 0; i < jsl.length; i++) {
            if (jsl[i] && !jsl[i].text) {
                jsl_total += jsl[i].w || 1;

                if (jj && (jj > 0 || jsl[i].j !== 2)) {

                    if (jsl[i].j === 1) {
                        jj_done = false;
                        jsl[i].text = '/**/';
                        createScriptTag(i, bootstaticpath + jsl[i].f + jjNoCache);
                    }
                    else if (jsl[i].j === 2) {

                        jj_done = false;
                        jsl[i].text = '/**/';
                        createStyleTag(i, bootstaticpath + jsl[i].f + jjNoCache);
                    }
                }

                if (!jj || !jsl[i].j || jsl[i].j > 1 + (jj > 0)) {
                    jsl_done = false;
                }
            }
        }
        if (d) {
            console.log('jj.total...', waitingToBeLoaded);
        }

        for (i = xhr_progress.length; i--;) {
            jsl_load(i);
        }
    }

    // Set a 15 second timeout for receiving an initial response from the normal static server. If the static server is
    // completely dead, the longest wait a user will have is 15 seconds before they are switched to the EU servers. If
    // the server is ok, but their connection is slow, then it's likely they will still receive an initial response
    // within 15 seconds. Once that first byte is received then the XHR onprogress handler will set the timeout to
    // unlimited (0 ms) and let the lower layers handle it (e.g. use the browser default timeout) which can let the
    // site load slowly over 5 minutes if they are on a really bad connection. For the EU static server (which we
    // assume never fails) we set the timeout to unlimited.
    var xhr_timeout = (staticpath === defaultStaticPath) ? 0 : 15000;

    /**
     * Handles the XHR loading error. It tries reloading the file multiple times and switches the static path to the
     * default static server if necessary. NB: there may be 2 or more concurrent XHR threads running which can arrive
     * into this function (order of arrival not guaranteed). Using a regular static server counts errors overall,
     * whereas using the default static counts errors per file.
     */
    var xhr_error = function() {

        'use strict';

        var url = this.url;
        var jsi = this.jsi;
        var xhri = this.xhri;

        // If on original staticpath (NA, SG, NZ)
        if (staticpath !== defaultStaticPath) {

            // Increment count
            staticServerLoading.loadFailuresOriginal++;

            // If the number of regular static load failures (any file from any thread) are less than the max allowed
            if (staticServerLoading.loadFailuresOriginal < staticServerLoading.maxRetryAttemptsOriginal) {

                // Set short timeout to go to new thread
                setTimeout(function() {

                    // Try loading the file again from the same static
                    xhr_progress[xhri] = 0;
                    xhr_load(url, jsi, xhri);

                }, 50);
            }
            else {
                // Log that the original static server failed
                logStaticServerFailure(load_error_types.file_load_error, url, staticpath);

                // If not using an extension, set the bootstaticpath to EU static
                // NB: extensions load JS, CSS and lang files locally, only fonts, images come from the statics
                if (!is_extension) {
                    bootstaticpath = defaultStaticPath;
                }

                // Set the static path to EU static, then continue to default static path handling below...
                staticpath = defaultStaticPath;

                // Set flag to show the static server was flipped to the default EU server
                staticServerLoading.flippedToDefault = true;

                // Set the timeout to unlimited now it's on EU static
                xhr_timeout = 0;

                // Log that the loading was flipped to load from the default static servers
                if (d) {
                    console.log('Flipped to failsafe static server path: ' + defaultStaticPath);
                }
            }
        }

        // If on default EU static server
        if (staticpath === defaultStaticPath) {

            // If the failure count for this file on the default static server is not initialised
            if (typeof staticServerLoading.loadFailuresDefault[url] === 'undefined') {

                // Initialise count to 1 if they were originally on EU static server as they have already had one error
                staticServerLoading.loadFailuresDefault[url] = (staticServerLoading.flippedToDefault) ? 0 : 1;
            }

            // If the failure count for this file on the default static server is less than the max allowed retries
            if (staticServerLoading.loadFailuresDefault[url] < staticServerLoading.maxRetryAttemptsDefault) {

                // Set to retry after 0~ ms, then 100ms, then 200ms
                setTimeout(function() {

                    // Try loading the file again from the default EU static
                    xhr_progress[xhri] = 0;
                    xhr_load(url, jsi, xhri);

                }, staticServerLoading.loadFailuresDefault[url] * 100);

                // Increment count of failures
                staticServerLoading.loadFailuresDefault[url]++;
            }
            else {
                // Show site load error and log that it failed
                console.error('gave up retrying for', url);
                siteLoadError(load_error_types.file_load_error, url);
            }
        }
    };

    function xhr_load(url,jsi,xhri)
    {
        xhr_stack[xhri] = new XMLHttpRequest();
        xhr_stack[xhri].onload = function()
        {
            try {
                jsl[this.jsi].text = this.response || this.responseText;
                if (!is_livesite) {
                    var entry = jsl[this.jsi];
                    if (entry && entry.j === 3 && entry.f.indexOf('_prod') === -1
                        && entry.text.indexOf('<!DOCTYPE html>') > -1) {
                        console.warn('Lang file ' +
                            entry.f + ' cannot be found. Switching to _prod lang file');
                        entry.f = entry.f.replace('.json', '_prod.json');
                        entry.text = null;
                        jsl[this.jsi] = entry;
                        return xhr_load(jsl[this.jsi].f, this.jsi, xhri);
                    }
                }

            }
            catch (ex) {
                return siteLoadError(ex, bootstaticpath + Object(jsl[this.jsi]).f);
            }

            if (typeof hash_workers !== 'undefined' && !nocontentcheck)
            {
                hash_workers[this.xhri].postMessage({'text':jsl[this.jsi].text,'xhr':'test','jsi':this.jsi,'xhri':this.xhri});
            }
            else
            {
                if (nocontentcheck === false) {

                    // Hash the file content and convert to hex
                    var hashHex = asmCryptoSha256.SHA256.hex(jsl[this.jsi].text);

                    // Compare the hash from the file and the correct hash determined at deployment time
                    if (!compareHashes(hashHex, jsl[this.jsi].f)) {
                        siteLoadError(load_error_types.file_corrupt, jsl[this.jsi].f);
                        contenterror = 1;
                    }
                }

                if (!contenterror)
                {
                    jsl_current += jsl[this.jsi].w || 1;
                    jsl_progress();
                    if (++jslcomplete == jsl.length) initall();
                    else jsl_load(this.xhri);
                }
            }
        };
        xhr_stack[xhri].onreadystatechange = tryCatch(function() {
            if (this.readyState === 2) {
                xhr_timeout = 0;
                this.timeout = 0;
            }
        }, false);
        xhr_stack[xhri].onerror = xhr_error;
        xhr_stack[xhri].ontimeout = xhr_error;
        if (jsl[jsi].text)
        {
            if (++jslcomplete == jsl.length) initall();
            else jsl_load(xhri);
        }
        else
        {
            xhr_stack[xhri].url = url;
            xhr_stack[xhri].jsi = jsi;
            xhr_stack[xhri].xhri = xhri;
            if (localStorage.dd) url += '?t=' + Date.now();
            xhr_stack[xhri].open("GET", bootstaticpath + url, true);

            if (xhr_timeout > 0) {
                xhr_stack[xhri].timeout = xhr_timeout;
            }

            if (is_firefox_web_ext) {
                xhr_stack[xhri].overrideMimeType('text/plain');
            }
            xhr_stack[xhri].send(null);
        }
    }

    window.onload = function() {
        'use strict';

        window.onload = null;
        if (is_karma) {
            window.jsl = [];
            return;
        }

        pageLoadTime = Date.now();
        mBroadcaster.once('startMega', function() {
            var now = Date.now();

            pageLoadTime = now - pageLoadTime;

            tryCatch(function() {
                /* @property window.ipcc */
                Object.defineProperty(window, 'ipcc', {
                    value: (String(document.cookie).match(/geoip\s*=\s*([A-Z]{2})/) || [])[1]
                });
            })();
        });

        if (is_extension) {
            return jsl_start();
        }

        scriptTest(
            'es6s =' +
            (is_embed || ' BigInt(Math.pow(2, 48)) << 16n === 18446744073709551616n') + // C67 E79 F68 O54 S14
            ' && (Array.prototype.values === Array.prototype[Symbol.iterator])' + // C66 E12 F60 O53 S9
            ' && (function *(a=1,){yield a})(2).next().value === 2', // C58 E14 F52 O45 S10
            function(error) {
                if (error || !window.es6s) {
                    document.location = (is_extension ? '' : '/') + 'update.html';
                    return;
                }
                jsl_start();
                delete window.es6s;
            });
    };
    function jsl_load(xhri)
    {
        if (jsl[jsli]) xhr_load(jsl[jsli].f, jsli++,xhri);
    }
    function jsl_progress()
    {
        // if (d) console.log('done',(jsl_current+jsl_fm_current));
        // if (d) console.log('total',jsl_total);
        var p = Math.floor((jsl_current+jsl_fm_current)/jsl_total*100);
        var deg = 0;
        var leftProgressBlock = document.getElementById('loadinganimleft');
        var rightProgressBlock = document.getElementById('loadinganimright');

        // Fix exception thrown when going from mobile web /login page to mobile web /register page
        if (!rightProgressBlock || !leftProgressBlock) {
            return false;
        }

        if ((p > jsl_perc) && (p <= 100))
        {
            jsl_perc = p;
            if (d) console.log('jsl.progress... ' + p + '%', (jsl_current+jsl_fm_current), jsl_total);
            if (is_extension) p=100;
            deg = 360 * p / 100;
            if (deg <= 180) {
                rightProgressBlock.style.webkitTransform = 'rotate(' + deg + 'deg)';
                rightProgressBlock.style.MozTransform = 'rotate(' + deg + 'deg)';
                rightProgressBlock.style.msTransform = 'rotate(' + deg + 'deg)';
                rightProgressBlock.style.OTransform = 'rotate(' + deg + 'deg)';
                rightProgressBlock.style.transform = 'rotate(' + deg + 'deg)';
            } else {
                rightProgressBlock.style.webkitTransform = 'rotate(180deg)';
                rightProgressBlock.style.MozTransform = 'rotate(180deg)';
                rightProgressBlock.style.msTransform = 'rotate(180deg)';
                rightProgressBlock.style.OTransform = 'rotate(180deg)';
                rightProgressBlock.style.transform = 'rotate(180deg)';
                leftProgressBlock.style.webkitTransform = 'rotate(' + (deg - 180) + 'deg)';
                leftProgressBlock.style.MozTransform = 'rotate(' + (deg - 180) + 'deg)';
                leftProgressBlock.style.msTransform = 'rotate(' + (deg - 180) + 'deg)';
                leftProgressBlock.style.OTransform = 'rotate(' + (deg - 180) + 'deg)';
                leftProgressBlock.style.transform = 'rotate(' + (deg - 180) + 'deg)';
            }
        }
    }
    var cssCache=false;
    var jsl_loaded={};
    function initall() {
        var temp;
        var jsar = [];
        var cssar = [];
        var j2re1 = /(?:\.\.\/)+/g;
        var j2re2 = /\/en\//g;
        var j2tr2 = '/' + lang + '/';
        var j4re = /url\(["'./]*(images\/[^"')]+)["']?\)/g;
        var j4tr = "url('" + staticpath + "$1')";

        if (lang === 'en') {
            j2tr2 = 0;
        }

        xhr_stack = false;
        for (var i = 0; i < jsl.length; ++i)
        {
            if ((jsl[i].j == 1) && (!jj))
            {
                jsar.push(jsl[i].text + '\n\n');
            }
            else if (jsl[i].j === 2 && (!jj || jj < 0))
            {
                if (tmp !== -23 && (tmp = document.getElementById('bootbottom'))) {
                    tmp.style.display = 'none';
                    tmp = -23;
                }

                var text = jsl[i].text.replace(j2re1, staticpath);
                if (j2tr2) {
                    text = text.replace(j2re2, j2tr2);
                }

                cssar.push(text);
            }
            else if (jsl[i].j == 3) {
                try {
                    l = !jj && l || JSON.parse(jsl[i].text);
                } catch(ex) {
                    console.error(ex);
                    if (lang !== 'en') {
                        localStorage.lang = 'en';
                        setTimeout(function() {
                            document.location.reload();
                        }, 300);
                    }
                    throw new Error('Error parsing language file '+lang+'.json');
                }
            }
            else if (jsl[i].j === 4) { // new type to distinguish files to be used on iframes
                if (!window[jsl[i].n]) {
                    var blobLink;
                    if ((jsl[i].n || '').indexOf('css') > -1) {
                        blobLink = mObjectURL([jsl[i].text.replace(j4re, j4tr)], 'text/css');
                    }
                    else {
                        if (self.is_extension) {
                            console.error("This won't work...", jsl[i].n);
                        }
                        blobLink = mObjectURL([jsl[i].text], 'text/javascript');
                    }
                    window[jsl[i].n] = blobLink;
                }
            }
            else if (jsl[i].j === 5) {
                /** @property window.sbj5rsc_webgl */
                temp = 'sbj5rsc_' + jsl[i].n.split(/[:_]/)[0];
                if (!window[temp]) {
                    window[temp] = '';
                }
                window[temp] += jsl[i].text;
                jsl[i].text = '/*j5*/';
            }
            else if (jsl[i].j === 0 && jsl[i].f.match(/\.json$/)) {
                try {
                    var templates = JSON.parse(jsl[i].text);
                    for (var e in templates) {
                        pages[e] = templates[e];
                        jsl_loaded[e] = 1;
                    }
                } catch (ex) {
                    console.error("Error parsing template", ex, jsl[i]);
                    throw new Error("Error parsing template, " + String(ex.message || ex).substr(0, 88));
                }
            }
            else if (jsl[i].j == 0) pages[jsl[i].n] = jsl[i].text;

            jsl[i].text = ' ';
        }

        if (cssar.length) {
            mCreateElement('link', {type: 'text/css', rel: 'stylesheet'}, 'head', cssar);
        }

        if (jj) {
            jsl_done = true;
            boot_done();
        }
        else {
            if (localStorage.makeCache && !cssCache) {
                cssCache = cssar;
            }
            if (!jsl_done || jsar.length) {
                jsar.push('jsl_done=true; boot_done();');
            }
            else {
                boot_done();
            }
            if (jsar.length) {
                addScript(jsar);
            }
            jsar = undefined;
            cssar = undefined;
        }
    }

    // For live we want the loading-sprite served from the root web servers so that if a static server is down we can
    // detect that quickly with our JS static loading logic. Otherwise, these images will block the loading before then
    var istaticpath = '/';

    // The loading-sprite images are embedded inside the extensions
    if (is_chrome_web_ext || is_firefox_web_ext) {
        istaticpath = '../images/mega/';
    }

    mCreateElement('style', {type: 'text/css'}, 'body').textContent = '.div, span, input {outline: none;}.hidden {display: none;}.clear {clear: both;margin: 0px;padding: 0px;display: block;}.loading-main-block {width: 100%;height: 100%;position: fixed;z-index: 10000;font-family:Arial, Helvetica, sans-serif;}.main-blur-block,.bottom-page.scroll-block{display:none}.loading-mid-white-block {height: 100%;width:100%;}.loading-cloud {width: 222px;position: fixed;height: 158px;background-image: url(' + istaticpath + 'loading-sprite_v4.png);background-repeat: no-repeat;background-position: 0 0;left:50%;top:50%;margin:-79px 0 0 -111px;}.loading-m-block{width:60px;height:60px;position:absolute; left:81px;top:65px;background-color:white;background-image: url(' + istaticpath + 'loading-sprite_v4.png);background-repeat: no-repeat;background-position: -81px -65px;border-radius: 100%;-webkit-border-radius: 100%;border-radius: 100%;z-index:10;}.loading-percentage { width: 80px;height: 80px; background-color: #e1e1e1;position: absolute;-moz-border-radius: 100%;-webkit-border-radius: 100%;border-radius: 100%;overflow: hidden;background-image: url(' + istaticpath + 'loading-sprite_v4.png);background-repeat: no-repeat;background-position: -70px -185px;left:71px;top:55px;}.loading-percentage ul {list-style-type: none;-moz-border-radius: 100%;-webkit-border-radius: 100%;border-radius: 100%;overflow: hidden;}.loading-percentage li {position: absolute;top: 0px;}.loading-percentage p, .loading-percentage li, .loading-percentage ul{width: 80px;height: 80px;padding: 0;margin: 0;}.loading-percentage span {display: block;width: 40px;height: 80px;}.loading-percentage ul :nth-child(odd) {clip: rect(0px, 80px, 80px, 40px);}.loading-percentage ul :nth-child(even) {clip: rect(0px, 40px, 80px, 0px);}.loading-percentage .right-c span {-moz-border-radius-topleft: 40px;-moz-border-radius-bottomleft: 40px;-webkit-border-top-left-radius: 40px;-webkit-border-bottom-left-radius: 40px;border-top-left-radius: 40px;border-bottom-left-radius: 40px;background-color:#dc0000;}.loading-percentage .left-c span {margin-left: 40px;-moz-border-radius-topright: 40px;-moz-border-radius-bottomright: 40px;-webkit-border-top-right-radius: 40px;-webkit-border-bottom-right-radius: 40px;border-top-right-radius: 40px;border-bottom-right-radius: 40px;background-color:#dc0000;}.loading-main-bottom {max-width: 940px;width: 100%;position: absolute;bottom: 20px;left: 50%;margin: 0 0 0 -470px;text-align: center;}.loading-bottom-button {height: 29px;width: 29px;float: left;background-image: url(' + istaticpath + 'loading-sprite_v4.png);background-repeat: no-repeat;cursor: pointer;}.st-social-block-load {position: fixed;bottom: 20px;left: 0;width: 100%;height: 43px;text-align: center;}.st-bottom-button {height: 24px;width: 24px;margin: 0 8px;display: inline-block;background-image: url(' + istaticpath + 'loading-sprite_v4.png);background-repeat: no-repeat;background-position:11px -405px;cursor: pointer;-moz-border-radius: 100%;-webkit-border-radius: 100%;border-radius: 100%;-webkit-transition: all 200ms ease-in-out;-moz-transition: background-color 200ms ease-in-out;-o-transition: background-color 200ms ease-in-out;-ms-transition: background-color 200ms ease-in-out;transition: background-color 200ms ease-in-out;background-color:#999999;}.st-bottom-button.st-google-button {background-position: 11px -405px;}.st-bottom-button.st-google-button {background-position: -69px -405px;}.st-bottom-button.st-twitter-button{background-position: -29px -405px;}.st-bottom-button:hover {background-color:#334f8d;}.st-bottom-button.st-twitter-button:hover {background-color:#1a96f0;}.st-bottom-button.st-google-button:hover {background-color:#d0402a;}@media only screen and (-webkit-min-device-pixel-ratio: 1.5), only screen and (-o-min-device-pixel-ratio: 3/2), only screen and (min--moz-device-pixel-ratio: 1.5), only screen and (min-device-pixel-ratio: 1.5) {.maintance-block, .loading-percentage, .loading-m-block, .loading-cloud, .loading-bottom-button,.st-bottom-button, .st-bottom-scroll-button {background-image: url(' + istaticpath + 'loading-sprite_v4@2x.png);    background-size: 222px auto;}}';

    mCreateElement('div', { "class": "loading-main-block", id: "loading"}, 'body')
        .innerHTML =
            '<div class="loading-mid-white-block">'+
            '    <div class="loading-cloud">'+
            '        <div class="loading-percentage">'+
            '            <ul>'+
            '                <li class="right-c"><p id="loadinganimright"><span></span></p></li>'+
            '                <li class="left-c"><p  id="loadinganimleft"><span></span></p></li>'+
            '            </ul>'+
            '        </div>'+
            '        <div class="loading-m-block"></div>'+
            '    </div>'+
            '    <div class="st-social-block-load" id="bootbottom">'+
            '        <a href="https://www.facebook.com/MEGAprivacy" target="_blank" rel="noopener noreferrer" class="st-bottom-button st-facebook-button"></a>'+
            '        <a href="https://www.twitter.com/MEGAprivacy" target="_blank" rel="noopener noreferrer" class="st-bottom-button st-twitter-button"></a>'+
            '    </div>'+
            '</div>';

    if (is_iframed || window.top !== window) {
        try {
            // if this does fail, we're under a mis-configured sandbox, and loading Worker()ers won't work.
            tmp = 1 + (document.cookie | 0);

            document.body.textContent = '';
            document.body.style.background = is_drop ? '#fff' : '#000';
            document.body.className = is_drop ? 'theme-light' : 'theme-dark-forced';
            jsl_progress = function() {};
        }
        catch (ex) {
            if (ex.code === 18 || ex.name === 'SecurityError') {
                window.onload = window.onerror = null;
                tmp = String(ex.message || ex.name || ex);
                document.body.textContent = tmp.substr(tmp.lastIndexOf(':') + 1);
                throw ex;
            }
        }
    }

    u_storage = init_storage(localStorage.sid ? localStorage : sessionStorage);

    (function _crossTabSession(u_storage) {
        'use strict';

        var xhr = function(params, data, callback) {
            var xhr = new XMLHttpRequest();
            xhr.onloadend = function() {
                var response = false;

                if (this.status === 200) {
                    try {
                        response = this.response || this.responseText || false;
                        if (response[0] === '[') {
                            response = JSON.parse(response);
                        }
                    }
                    catch (ex) {
                        console.warn(ex);
                        response = false;
                    }
                }

                if (!callback(response)) {
                    boot_done();
                }
            };

            xhr.open("POST", apipath + 'cs?id=0' + (params || ''), true);
            xhr.send(JSON.stringify([].concat(data)));
        };

        var gmf = function() {
            gmf_res = true;

            xhr(false, {a: 'gmf'}, function(result) {
                if (Array.isArray(result) && typeof result[0] === 'object') {
                    // Cache flags object
                    mega.apiMiscFlags = result[0];
                }
                else if (d) {
                    console.error('API request error, no flags given...', result);
                }
                gmf_res = false;
            });
        };

        var ack = function() {
            if (!(u_sid = u_storage.sid)) {
                loginresponse = false;
                gmf();
            }

            if (loginresponse) {
                xhr('&sid=' + u_storage.sid, {'a': 'ug'}, function(response) {
                    loginresponse = false;

                    if (parseInt(response) === -15 /* ESID */) {
                        loginresponse = -15;
                    }
                    else if (parseInt(response) === -16 /* EBLOCKED */) {
                        loginresponse = -16;
                    }
                    else if (typeof response[0] === 'object') {
                        loginresponse = response;
                    }

                    if (!Array.isArray(loginresponse)) {
                        // Invalid login session, retrieve raw API flags.
                        gmf();
                    }
                });
            }

            if (dl_res) {
                var g = {
                    a: 'g',
                    ad: 1,
                    p: page.split(/[!#/]/)[1]
                };

                xhr(u_sid ? '&v=2&sid=' + u_sid : '&v=2', g, function(response) {
                    dl_res = Array.isArray(response) && response[0];
                });
            }

            if (is_chatlink) {
                xhr(u_sid ? '&sid=' + u_sid : false, {a: "mcphurl", v: 1, ph: is_chatlink}, function(response) {
                    is_chatlink = Array.isArray(response) && response[0] || -1;
                });

                is_chatlink = true;
            }

            if (is_megadrop) {
                xhr(u_sid ? '&sid=' + u_sid : false, {a: "pg", p: is_megadrop.substr(0, 11)}, function(response) {
                    is_megadrop = Array.isArray(response) && response[0] || -1;
                });

                is_megadrop = true;
            }

            if (voucher) {
                var code = localStorage.voucher || page.substr(7);
                var request = [
                    {a: 'uavq', f: 1, v: code},
                    {a: 'uq', pro: 1, gc: 1},
                    {a: 'utqa', nf: 2, p: 1, r: 1}
                ];

                xhr(u_sid ? ('&sid=' + u_sid) : false, request, function(res) {
                    voucher = false;

                    if (Array.isArray(res) && typeof res[0] === 'object') {
                        var v = res[0];
                        v.balance = parseFloat((((res[1] || []).balance || [])[0] || [])[0]) || 0;
                        v.plans = Array.isArray(res[2]) && res[2].length && res[2];
                        v.value = parseFloat(v.value);
                        v.code = code;

                        if (v.plans && v.value) {
                            mega.voucher = v;
                        }
                    }
                });
            }

            boot_done();
            ack = undefined;
        };

        // No session handling needed for
        if (is_drop || is_karma) {
            return;
        }

        // Redirect static pages to mega.io if there isn't a stored session ID (regardless of its validity),
        // since without a session-id it's not possible to access any internal page.
        if (location.host === 'mega.nz' && !u_storage.sid && !is_iframed && isStaticPage(page) && !location.hash) {
            return mega.redirect('mega.io', page, false, locationSearchParams);
        }

        if (page[0] === 'F' && page[1] === '!' || page.substr(0, 7) === 'folder/') {
            var n = page.split(/\W+/);

            if (n && !n[2] && n[1] && n[1].length === 8) {
                xhr('&v=1&n=' + n[1], null, function(res) {
                    res |= 0;

                    if (res === -9 || res === -16) {
                        window['preflight-folder-link-error:' + n[1]] = res;
                    }
                    return -1;
                });
            }
        }

        if (!(parseInt(localStorage.voucherExpiry) > Date.now())) {
            delete localStorage.voucher;
        }

        loginresponse = true;
        voucher = localStorage.voucher !== undefined || page.substr(0, 7) === 'voucher';

        if (localStorage === u_storage || is_iframed) {
            ack();
        }
        else {
            var setLSItem = tryCatch(function(k, v) {
                localStorage.setItem(k, JSON.stringify(v));
            });
            window.addEventListener('storage', function(ev) {
                if (ev.key === 'sb!sid') {
                    var value = JSON.parse(ev.newValue || '""');

                    if (typeof value === 'number') {
                        // Requesting session storage

                        var data = {};

                        if (sessionStorage.sid) {
                            data.k = sessionStorage.k;
                            data.sid = sessionStorage.sid;
                        }

                        setTimeout(function() {
                            setLSItem('sb!sid', data);
                        });
                    }
                    else if (typeof value === 'object') {
                        // Received session storage

                        if (ack) {
                            if (value.sid) {
                                u_storage.k = value.k;
                                u_storage.sid = value.sid;
                            }
                            ack();
                        }
                    }

                    delete localStorage[ev.key];
                }
            });

            if (u_storage.sid) {
                ack();
            }
            else {
                setTimeout(function() {
                    if (ack) {
                        ack();
                    }
                    delete localStorage['sb!sid'];
                }, 800);
                setLSItem('sb!sid', Math.random());
            }
        }
    })(u_storage);

    function boot_auth(u_ctx,r)
    {
        u_type = r;
        u_checked=true;
        startMega();
    }

    var boot_done_makecache=false;

    function boot_done()
    {
        if (boot_done_makecache)
        {
            boot_done_makecache=false;
            makeCache();
            return false;
        }

        if (d) console.log('boot_done', loginresponse === true, dl_res === true, !jsl_done, !jj_done);

        if (!jsl_done
            || !jj_done
            || dl_res === true
            || gmf_res === true
            || voucher === true
            || is_chatlink === true
            || is_megadrop === true
            || loginresponse === true) {
            return;
        }

        // turn the `ua` (userAgent) string into an object which holds the browser details
        try {
            ua = Object(ua);
            ua.details = Object.create(browserdetails(ua));
        }
        catch (e) {}

        // announce the loading finish of relevant resources in jsl
        for (var i = 0; i < jsl.length; i++) {
            if (!jj || !jsl[i].j || jsl[i].j > 1 + (jj > 0)) {
                jsl_loaded[jsl[i].n] = 1;
            }
        }

        mBroadcaster.sendMessage('boot_done');

        if (u_checked) {
            startMega();
        }
        else if (loginresponse === -15) {
            u_logout(true);
            boot_auth(null, false);
        }
        else if (loginresponse === -16) {
            api_setsid(u_sid);
            boot_auth(null, false);
        }
        else if (loginresponse)
        {
            api_setsid(u_sid);
            u_checklogin3a(loginresponse[0],{checkloginresult:boot_auth});
            loginresponse = undefined;
        }
        else u_checklogin({checkloginresult:boot_auth},false);
    }
}

/**
 * History API's pushState helper that takes into account whether we're running through an extension or public-link
 * @param {Object|String} page The page to change to, or an history's state object
 * @param {Object} [state] An optional state object, if an String is provided for the 1st parameter.
 */
function pushHistoryState(page, state) {
    'use strict';

    try {
        var method = 'pushState';
        if (page === true) {
            method = 'replaceState';
            page = state;
            state = undefined;
        }

        if (typeof page !== 'object') {
            page = page ? {subpage: page} : history.state || {subpage: getCleanSitePath()};
        }
        state = Object.assign({}, page, state);
        page = state.subpage || state.fmpage || location.hash;

        if (page.substr(0, 9) === 'fm/search') {
            state.searchString = page.substr(9) || state.searchString;
            page = state.subpage = 'fm/search';
        }

        if (d > 1 && method === 'pushState' && JSON.stringify(history.state) === JSON.stringify(state)) {
            console.warn('duplicate push state attempt.');
        }

        history[method](state, '', (self.hashLogic || page[1] === '!' ? '#' : '/') + page);
    }
    catch (ex) {
        console.warn(ex);
    }
}

/**
 * Simple .toArray method to be used to convert `arguments` to a normal JavaScript Array
 *
 * Please note there is a huge performance degradation when using `arguments` outside their
 * owning function, to mitigate it use this function as follow: toArray.apply(null, arguments)
 *
 * @returns {Array}
 * @deprecated
 */
function toArray() {
    var len = arguments.length;
    var res = Array(len);
    while (len--) {
        res[len] = arguments[len];
    }
    return res;
}

function tryCatch(fn, onerror)
{
    fn.foo = function __tryCatchWrapper()
    {
        try {
            return fn.apply(this, arguments);
        } catch (e) {
            if (onerror !== false) {
                console.error(e);
            }

            if (typeof onerror === 'function') {
                setTimeout(onerror.bind(null, e));
            }
        }
    };
    fn.foo.bar = fn;
    return fn.foo;
}

/** fast weak checksum */
function wchecksum(data, seed) {
    'use strict';
    seed = seed || 0x9f00eb1f;

    var l = data.length;
    while (l--) {
        seed += data.charCodeAt(l) * l;
    }
    return seed >>> 0;
}

function onIdle(callback) {
    'use strict';
    return window.requestIdleCallback(callback, {timeout: 51});
}

function makeUUID(a) {
    'use strict';

    return a
        ? (a ^ Math.random() * 16 >> a / 4).toString(16)
        : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, makeUUID);
}

function inherits(target, source) {
    'use strict';

    target.prototype = Object.create(source && source.prototype || source);
    Object.defineProperty(target.prototype, 'constructor', {
        value: target,
        enumerable: false
    });

    Object.defineProperty(target.prototype, 'toString', {
        value: function() {
            return '[object ' + this.constructor.name + ']';
        },
        writable: true,
        configurable: true
    });

    if (!target.prototype.valueOf) {
        Object.defineProperty(target.prototype, 'valueOf', {
            value: function() {
                return this;
            },
            configurable: true
        });
    }

    if (source) {
        Object.setPrototypeOf(target, source);
    }
}

function b64encode(str) {
    'use strict';
    // eslint-disable-next-line local-rules/hints
    try {
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
    catch (ex) {}
}
function b64decode(str) {
    'use strict';
    // eslint-disable-next-line local-rules/hints
    try {
        return atob((str + '=='.substr(2 - str.length * 3 & 3)).replace(/-/g, '+').replace(/_/g, '/'));
    }
    catch (ex) {}
}

function clip(str) {
    'use strict';
    var elm = document.getElementById('chromeclipboard');
    if (elm) {
        elm.textContent = str;
        var res = tryCatch(function() {
            elm.focus();
            elm.setSelectionRange(0, str.length);
            return document.execCommand('copy');
        })();

        elm.textContent = '';
        return res;
    }
}

// Promise.catch helper
function nop() {
    'use strict';
}

// Promise.catch helper
function echo(a) {
    'use strict';
    return a;
}

// Promise.catch helper
function tell(ex) {
    'use strict';
    if (d) {
        console.error(ex);
    }
    msgDialog('warninga', l[135], l[47], ex < 0 ? api_strerror(ex) : ex);
}

tryCatch(function(x) {
    'use strict';
    var ael = x.addEventListener;
    var psy = tryCatch(function(f) {
        return String(f).indexOf('Synchronizetion') > 0;
    });
    x.addEventListener = function(t, f) {
        if (t === 'contextmenu' && psy(f)) {
            window.onerror = null;
            return;
        }
        return ael.apply(x, arguments);
    };
    mBroadcaster.once('startMega', tryCatch(function() {
        x.addEventListener = ael;
    }));
})(window);

var dump = nop;
mBroadcaster.once('startMega', function() {
    'use strict';

    var data = sessionStorage.sitet;

    if (data) {
        delete sessionStorage.sitet;
        onIdle(function() {
            M.transferFromMegaCoNz(data);
        });
    }

    if (window.uTagMT) {
        var mt = window.uTagMT;
        delete window.uTagMT;

        onIdle(function() {
            api.req({a: 'mrt', t: mt}).dump('uTagMT');
        });
    }

    if (window.uTagMCT) {
        onIdle(function() {
            eventlog(99988, window.uTagMCT);
            delete window.uTagMCT;
        });
    }

    if (sessionStorage.affid && 'csp' in window) {
        delay('aff:cspchk:movelocal', function() {
            if ('affiliate' in M) {
                M.affiliate.persist();
            }
        });
    }

    Object.defineProperty(window, 'dump', {value: console.warn.bind(console, '[dump]')});
});

Object.defineProperty(self, 's4', {value: Object.create(null)});
