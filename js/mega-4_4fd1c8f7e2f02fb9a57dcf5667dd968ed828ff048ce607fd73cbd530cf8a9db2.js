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

function isStreamingEnabled() {
    'use strict';
    // return !window.safari || d;
    return true;
}

function isMediaSourceSupported() {
    'use strict'; // https://caniuse.com/#feat=mediasource
    return window.MediaSource && typeof MediaSource.isTypeSupported === 'function' && isStreamingEnabled();
}

function is_video(n) {
    'use strict';

    if (String(n && n.fa).indexOf(':8*') > 0) {
        // check whether it's an *streamable* video
        return MediaAttribute.getMediaType(n);
    }

    var ext = fileext(n && n.name || n, true, true);

    return is_video.ext[ext];
}

is_video.ext = {
    'MP4': -1,
    'M4V': -1
};

if (!isMediaSourceSupported()) {
    window.is_video = function() {
        'use strict';
        return false;
    };
}

/**
 * Check whether a node is an streamable audio file.
 * @param {MegaNode} n The node.
 * @returns {Boolean} whether it is
 */
function is_audio(n) {
    'use strict';
    return is_video(n) === 2;
}

/**
 * Returns a truthy value whenever we can get a previewable image for a file/node.
 * @param {String|MegaNode|Object} n An ufs-node, or filename
 * @param {String} [ext] Optional filename extension
 * @returns {Number|String|Function}
 *      {Number}: Build-in support in browsers,
 *      {String}: RAW Image file type
 *      {Function}: Handler we can use to get a preview image out of the file/node data
 */
function is_image(n, ext) {
    'use strict';
    ext = ext || fileext(n && n.name || n, true, true);
    return is_image.def[ext] || is_rawimage(null, ext) || mThumbHandler.has(0, ext);
}

/**
 * Same as is_image(), additionally checking whether the node has an image file attribute we can preview
 * @param {String|MegaNode|Object} n An ufs-node, or filename
 * @param {String} [ext] Optional filename extension
 * @returns {Number|String|Function|Boolean}
 */
function is_image2(n, ext) {
    'use strict';
    ext = ext || fileext(n && n.name || n, true, true);
    return (is_image(n, ext) && (!mega.chrome || !n || n.s < 6e8))
        || (filemime(n).startsWith('image') && String(n.fa).indexOf(':1*') > 0);
}

/**
 * Same as is_image2(), additionally skipping non-image files regardless of file attributes or generation handlers
 * @param {String|MegaNode|Object} n An ufs-node, or filename
 * @param {String} [ext] Optional filename extension
 * @returns {Number|String|Function|Boolean}
 */
function is_image3(n, ext) {
    'use strict';
    ext = ext || fileext(n && n.name || n, true, true);
    return ext !== 'PDF' && ext !== 'DOCX' && is_image2(n, ext);
}

/**
 * Check whether a file/node is a RAW image.
 * @param {String|MegaNode|Object} name An ufs-node, or filename
 * @param {String} [ext] Optional filename extension
 * @returns {String}
 */
function is_rawimage(name, ext) {
    'use strict';

    ext = ext || fileext(name, true, true);

    return is_image.raw[ext] && ext;
}

is_image.def = {
    'JPG': 1,
    'JPEG': 1,
    'GIF': 1,
    'BMP': 1,
    'PNG': 1
};

is_image.raw = {
    // http://www.sno.phy.queensu.ca/~phil/exiftool/#supported
    // let raw = {}; for(let tr of document.querySelectorAll('.norm.tight.sm.bm tr'))
    //   if (tr.childNodes.length > 2 && ~tr.childNodes[2].textContent.indexOf('RAW'))
    //     raw[tr.childNodes[0].textContent] = tr.childNodes[2].textContent;
    "3FR": "Hasselblad RAW (TIFF-based)",
    "ARI": "Arri Alexa RAW Format",
    "ARQ": "Sony Alpha Pixel-Shift RAW (TIFF-based)",
    "ARW": "Sony Alpha RAW (TIFF-based)",
    "BAY": "Casio RAW Camera Image File Format",
    "BMQ": "NuCore Raw Image File",
    "CAP": "Phase One Digital Camera Raw Image",
    "CINE": "Phantom Software Raw Image File.",
    "CR2": "Canon RAW 2 (TIFF-based)",
    "CR3": "Canon RAW 3 (QuickTime-based)",
    "CRW": "Canon RAW Camera Image File Format (CRW spec.)",
    "CIFF": "Canon RAW Camera Image File Format (CRW spec.)",
    "CS1": "Sinar CaptureShop 1-shot RAW (PSD-based)",
    "DC2": "Kodak DC25 Digital Camera File",
    "DCR": "Kodak Digital Camera RAW (TIFF-based)",
    "DSC": "Kodak Digital Camera RAW Image (TIFF-based)",
    "DNG": "Digital Negative (TIFF-based)",
    "DRF": "Kodak Digital Camera RAW Image (TIFF-based)",
    "EIP": "Phase One Intelligent Image Quality RAW (TIFF-based)",
    "ERF": "Epson RAW Format (TIFF-based)",
    "FFF": "Hasselblad RAW (TIFF-based)",
    "IA": "Sinar Raw Image File",
    "IIQ": "Phase One Intelligent Image Quality RAW (TIFF-based)",
    "K25": "Kodak DC25 RAW (TIFF-based)",
    "KC2": "Kodak DCS200 Digital Camera Raw Image Format",
    "KDC": "Kodak Digital Camera RAW (TIFF-based)",
    "MDC": "Minolta RD175 Digital Camera Raw Image",
    "MEF": "Mamiya (RAW) Electronic Format (TIFF-based)",
    "MOS": "Leaf Camera RAW File",
    "MRW": "Minolta RAW",
    "NEF": "Nikon (RAW) Electronic Format (TIFF-based)",
    "NRW": "Nikon RAW (2) (TIFF-based)",
    "OBM": "Olympus RAW Format (TIFF-based)",
    "ORF": "Olympus RAW Format (TIFF-based)",
    "ORI": "Olympus RAW Format (TIFF-based?)",
    "PEF": "Pentax (RAW) Electronic Format (TIFF-based)",
    "PTX": "Pentax (RAW) Electronic Format (TIFF-based)",
    "PXN": "Logitech Digital Camera Raw Image Format",
    "QTK": "Apple Quicktake 100/150 Digital Camera Raw Image",
    "RAF": "FujiFilm RAW Format",
    "RAW": "Panasonic RAW (TIFF-based)",
    "RDC": "Digital Foto Maker Raw Image File",
    "RW2": "Panasonic RAW 2 (TIFF-based)",
    "RWL": "Leica RAW (TIFF-based)",
    "RWZ": "Rawzor Digital Camera Raw Image Format",
    "SR2": "Sony RAW 2 (TIFF-based)",
    "SRF": "Sony RAW Format (TIFF-based)",
    "SRW": "Samsung RAW format (TIFF-based)",
    "STI": "Sinar Capture Shop Raw Image File",
    "X3F": "Sigma/Foveon RAW"
};

/**
 * Global function to Check if the node is for a textual file
 * @param {MegaNode} node An ufs node.
 * @returns {Boolean} Whether it's a text/plain file
 */
function is_text(node) {
    'use strict';
    if (!node || node.fa || node.s === undefined || node.s > 2e7) {
        return false;
    }

    var fext = fileext(node.name);
    if (!fext) {
        return true;
    }

    var fType = filetype(node, true)[0];
    if (fType === 'text' || fType === 'web-data' || fType === 'web-lang' || fType === 'mega') {
        return true;
    }

    if (fmconfig.editorext && fmconfig.editorext.indexOf(fext.toLowerCase()) > -1) {
        return true;
    }

    return false;
}

var mThumbHandler = {
    sup: Object.create(null),

    add: function(exts, parser) {
        'use strict';
        parser = ((handler) => promisify((resolve, reject, data) => handler(data, resolve)))(parser);

        exts = String(exts).split(',');

        for (var i = exts.length; i--;) {
            this.sup[exts[i].toUpperCase()] = parser;
        }
    },

    has: function(name, ext) {
        'use strict';

        ext = ext || fileext(name, true, true);

        return this.sup[ext];
    }
};

mThumbHandler.add('DOCX', function DOCXThumbHandler(ab, cb) {
    'use strict';

    // @todo ..
    cb(null);
});

mThumbHandler.add('PSD', function PSDThumbHandler(ab, cb) {
    'use strict';

    // http://www.awaresystems.be/imaging/tiff/tifftags/docs/photoshopthumbnail.html
    var logger = MegaLogger.getLogger('crypt');
    var u8 = new Uint8Array(ab);
    var dv = new DataView(ab);
    var len = u8.byteLength;
    var i = 0;
    var result;
    if (d) {
        console.time('psd-proc');
    }

    while (len > i + 12) {
        if (u8[i] === 0x38 && u8[i + 1] === 0x42 && u8[i + 2] === 0x49 && u8[i + 3] === 0x4d) // 8BIM
        {
            var ir = dv.getUint16(i += 4);
            var ps = dv.getUint8(i += 2) + 1;

            if (ps % 2) {
                ++ps;
            }
            var rl = dv.getUint32(i += ps);

            i += 4;
            if (len < i + rl) {
                break;
            }

            if (ir === 1033 || ir === 1036) {
                logger.debug('Got thumbnail resource at offset %d with length %d', i, rl);

                i += 28;
                result = ab.slice(i, i + rl);
                break;
            }

            i += rl;
        }
        else {
            ++i;
        }
    }
    if (d) {
        console.timeEnd('psd-proc');
    }
    cb(result);
});

mThumbHandler.add('TIFF,TIF', function TIFThumbHandler(ab, cb) {
    'use strict';

    M.require('tiffjs').tryCatch(function makeTIF() {
        if (TIFThumbHandler.working) {
            if (d) {
                console.debug('Holding tiff thumb creation...', ab && ab.byteLength);
            }
            mBroadcaster.once('TIFThumbHandler.ready', makeTIF);
            return;
        }
        TIFThumbHandler.working = true;

        onIdle(function() {
            if (d) {
                console.debug('...unholding tiff thumb creation.', mBroadcaster.hasListener('TIFThumbHandler.ready'));
            }
            TIFThumbHandler.working = false;
            mBroadcaster.sendMessage('TIFThumbHandler.ready');
        });

        var timeTag = 'tiffjs.' + makeUUID();

        if (d) {
            console.debug('Creating TIFF thumbnail...', ab && ab.byteLength);
            console.time(timeTag);
        }

        var dv = new DataView(ab.buffer || ab);
        switch (dv.byteLength > 16 && dv.getUint16(0)) {
            case 0x4D4D: // TIFF, big-endian
            case 0x4949: // TIFF, little-endian
                // XXX: libtiff is unable to handle images with 32-bit samples.
                var tiff = false;

                try {
                    Tiff.initialize({TOTAL_MEMORY: 134217728});
                    tiff = new Tiff(new Uint8Array(ab));

                    ab = dataURLToAB(tiff.toDataURL());

                    if (d) {
                        console.log('tif2png %sx%s (%s bytes)', tiff.width(), tiff.height(), ab.byteLength);
                    }
                }
                catch (ex) {
                    if (d) {
                        console.warn('Caught tiff.js exception, aborting...', ex);
                    }
                    ab = false;

                    if (!tiff) {
                        break;
                    }
                }

                try {
                    tiff.close();
                    Tiff.Module.FS_unlink(tiff._filename);
                }
                catch (ex) {
                    if (d) {
                        console.debug(ex);
                    }
                }

                if (ab) {
                    eventlog(99692);
                }
                break;

            default:
                if (d) {
                    console.debug('This does not seems a TIFF...', [ab]);
                }
        }

        if (d) {
            console.timeEnd(timeTag);
        }

        cb(ab);
    });
});

mThumbHandler.add('WEBP', function WEBPThumbHandler(ab, cb) {
    'use strict';

    M.require('webpjs').tryCatch(function() {
        var timeTag = 'webpjs.' + makeUUID();

        if (d) {
            console.debug('Creating WEBP thumbnail...', ab && ab.byteLength);
            console.time(timeTag);
        }

        var canvas = webpToCanvas(new Uint8Array(ab), ab.byteLength);

        if (d) {
            console.timeEnd(timeTag);
        }

        if (canvas) {
            ab = dataURLToAB(canvas.toDataURL());

            if (d) {
                console.log('webp2png %sx%s (%s bytes)', canvas.width, canvas.height, ab.byteLength);
            }
        }
        else {
            if (d) {
                console.debug('WebP thumbnail creation failed.');
            }
            ab = null;
        }
        cb(ab);
    });
});

mThumbHandler.add('PDF', function PDFThumbHandler(ab, cb) {
    'use strict';

    M.require('pdfjs').then(function() {
        if (!PDFThumbHandler.q) {
            PDFThumbHandler.q = function PDFThumbQueueHandler(task, done) {
                var buffer = task[0];
                var callback = task[1];
                var tag = 'pdf-thumber.' + makeUUID();
                var logger = PDFThumbHandler.q.logger;
                var finish = function(buf) {
                    if (done) {
                        onIdle(done);
                        done = null;
                    }

                    if (d) {
                        console.timeEnd(tag);
                    }
                    callback(buf);
                };

                if (d) {
                    logger.info('[%s] Starting pdf thumbnail creation...', tag, buffer.byteLength);
                    console.time(tag);
                }

                if (!window.pdfjsLib || typeof pdfjsLib.getPreviewImage !== 'function') {
                    if (d) {
                        logger.warn('unexpected pdf.js instance/state...');
                    }
                    return finish();
                }

                pdfjsLib.getPreviewImage(buffer).then(function(buffer) {

                    if (d) {
                        logger.log('[%s] %sx%s (%s bytes)', tag, buffer.width, buffer.height, buffer.byteLength);
                    }

                    finish(buffer);
                    eventlog(99661);// Generated PDF thumbnail.
                }).catch(function(ex) {
                    if (d) {
                        logger.warn('[%s] Failed to create PDF thumbnail.', tag, ex);
                    }
                    finish();
                });
            };
            PDFThumbHandler.q = new MegaQueue(PDFThumbHandler.q, mega.maxWorkers, 'pdf-thumber');

            if (d) {
                console.info('Using pdf.js %s (%s)', pdfjsLib.version, pdfjsLib.build);
            }
        }
        var q = PDFThumbHandler.q;

        if (d) {
            var bytes = q._queue.reduce(function(r, v) {
                r += v[0][0].byteLength;
                return r;
            }, 0);
            q.logger.debug('Queueing pdf thumbnail creation (%s waiting, %s bytes)', q._queue.length, bytes);
        }
        q.push([ab, cb]);
        ab = cb = undefined;
    }).catch(function(ex) {
        if (d) {
            console.warn(ex);
        }
        cb(null);
    });
});

mThumbHandler.add('SVG', function SVGThumbHandler(ab, cb) {
    'use strict';

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var image = new Image();
    image.onload = function() {
        canvas.height = image.height;
        canvas.width = image.width;
        ctx.drawImage(image, 0, 0);
        cb(dataURLToAB(canvas.toDataURL('image/png')));
    };
    image.src = 'data:image/svg+xml;charset=utf-8,'
        + encodeURIComponent(ab_to_str(ab).replace(/foreignObject|script/g, 'desc'));
});

if (!mega.chrome || (parseInt(String(navigator.appVersion).split('Chrome/').pop()) | 0) < 56) {
    delete mThumbHandler.sup.SVG;
}

mBroadcaster.once('startMega', tryCatch(() => {
    'use strict';
    const images = [
        [
            'JXL',
            'image/jxl',
            '/woAkAEAEogCAMAAPeESAAAVKqOMG7yc6/nyQ4fFtI3rDG21bWEJY7O9MEhIOIONi4LdHIrhMyApVJIA'
        ],
        [
            'WEBP',
            'image/webp',
            'UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
        ],
        [
            'AVIF',
            'image/avif',
            `AAAAHGZ0eXBtaWYxAAAAAG1pZjFhdmlmbWlhZgAAAPJtZXRhAAAAAAAAACtoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAZ28tYXZp
            ZiB2MAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAARAAAEAAQAAAAABFgABAAAAGAAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAA
            GF2MDFJbWFnZQAAAABnaXBycAAAAEhpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGFzcAAAAAEAAAABAAAADGF2MUOBAAwAAAAAEH
            BpeGkAAAAAAwgICAAAABdpcG1hAAAAAAAAAAEAAQQBAoOEAAAAIG1kYXQSAAoFGAAOwCAyDR/wAABgBgAAAACsyvA=`
        ],
        [
            'HEIC',
            'image/heic',
            `AAAAGGZ0eXBoZWljAAAAAGhlaWNtaWYxAAABvm1ldGEAAAAAAAAAImhkbHIAAAAAAAAAAHBpY3QAAAAAAAAAAAAAAAAAAAAAACRkaW5m
            AAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAA5waXRtAAAAAAABAAAAOGlpbmYAAAAAAAIAAAAVaW5mZQIAAAAAAQAAaHZjMQAAA
            AAVaW5mZQIAAAEAAgAARXhpZgAAAAAaaXJlZgAAAAAAAAAOY2RzYwACAAEAAQAAAOBpcHJwAAAAwGlwY28AAAATY29scm5jbHgAAgACAA
            aAAAAAeGh2Y0MBAWAAAACwAAAAAAAe8AD8/fj4AAAPA6AAAQAXQAEMAf//AWAAAAMAsAAAAwAAAwAeLAmhAAEAIkIBAQFgAAADALAAAAM
            AAAMAHqEickmcuSRKSXE3AgIGpAKiAAEAEUQBwGDAkwE6RERJEkSRJEqQAAAAFGlzcGUAAAAAAAAAAgAAAAIAAAAJaXJvdAAAAAAQcGl4
            aQAAAAADCAgIAAAAGGlwbWEAAAAAAAAAAQABBYGCA4QFAAAALGlsb2MAAAAARAAAAgABAAAAAQAAAeYAAAASAAIAAAABAAAB5gAAAAAAA
            AABbWRhdAAAAAAAAAAiAAAADiYBrcDmF9NIDoIkoml4`
        ]
    ];
    const supported = [];
    let count = images.length;

    const test = (name, mime, data) => {
        const img = new Image();
        const done = () => {
            if (!--count && self.d) {
                console.info(`This browser does support decoding ${supported} images.`);
            }
            img.onload = img.onerror = undefined;
        };
        img.onload = function() {
            if (this.naturalWidth > 0) {
                is_image.def[name] = 1;
                delete mThumbHandler.sup[name];
                supported.push(name);
            }
            done();
        };
        img.onerror = done;
        img.src = `data:${mime};base64,${data.replace(/\s+/g, '')}`;
    };

    for (let i = images.length; i--;) {

        test(...images[i]);
    }
}));


// ---------------------------------------------------------------------------------------------------------------

/**
 * Retrieve file attribute image
 * @param {MegaNode} node The node to get associated image with
 * @param {Number} [type] Image type, 0: thumbnail, 1: preview
 * @param {Boolean} [raw] get back raw buffer, otherwise a blob: URI
 * @returns {Promise}
 */
function getImage(node, type, raw) {
    'use strict';
    const entry = `${Object(node).h}!${type |= 0}.${raw |= 0}`;

    if (!type && thumbnails.has(node.fa) && !raw) {
        return Promise.resolve(thumbnails.get(node.fa));
    }

    if (getImage.cache.has(entry)) {
        const value = getImage.cache.get(entry);
        return value instanceof Promise ? value : Promise.resolve(value);
    }

    const promise = new Promise((resolve, reject) => {
        const onload = (a, b, data) => {
            if (data === 0xDEAD) {
                getImage.cache.delete(entry);
                reject(node);
            }
            else {
                const value = raw ? data : mObjectURL([data.buffer || data], 'image/jpeg');

                getImage.cache.set(entry, value);
                resolve(value);
            }
        };

        api_getfileattr({[node.fa]: node}, type, onload, reject).catch(dump);
    });

    getImage.cache.set(entry, promise);
    return promise;
}

/** @property getImage.cache */
lazy(getImage, 'cache', () => {
    'use strict';
    return new LRUMap(23, (uri) => typeof uri === 'string' && URL.revokeObjectURL(uri));
});

/**
 * Store file attribute image
 * @param {MegaNode} n The node to set associated image
 * @param {ArrayBuffer} ab The binary data holding the image
 * @param {*} [options]
 */
function setImage(n, ab, options) {
    'use strict';
    var aes = new sjcl.cipher.aes([
        n.k[0] ^ n.k[4], n.k[1] ^ n.k[5], n.k[2] ^ n.k[6], n.k[3] ^ n.k[7]
    ]);
    var ph = !n.u || n.u !== u_handle ? n.ph : null;
    createnodethumbnail(n.h, aes, n.h, ab, options || false, ph);
}

/**
 * Just a quick&dirty function to retrieve an image embed through ID3v2.3 tags
 * @details Based on https://github.com/tmont/audio-metadata
 * @param {File|ArrayBuffer} entry
 */
function getID3CoverArt(entry) {
    'use strict';
    // jscs:disable disallowImplicitTypeConversion
    return new Promise(function(resolve, reject) {
        var parse = tryCatch(function(ab) {
            var result;
            var u8 = new Uint8Array(ab);
            var getLong = function(offset) {
                return (((((u8[offset] << 8) + u8[offset + 1]) << 8) + u8[offset + 2]) << 8) + u8[offset + 3];
            };
            var readFrame = function(offset) {
                var id = String.fromCharCode.apply(String, [
                    u8[offset], u8[offset + 1], u8[offset + 2], u8[offset + 3]
                ]);
                return {id: id, size: getLong(offset + 4) + 10};
            };
            if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33 && u8[3] === 3) {
                var offset = 10 + (u8[5] & 128 ? getLong(10) : 0);
                var size = offset + getLong(6);

                while (offset < size) {
                    var frame = readFrame(offset);
                    if (frame.id === 'APIC') {
                        offset += 11;
                        while (u8[offset++]) {}
                        ++offset;
                        if (u8[offset] === 0xFF && u8[offset + 1] === 0xFE
                            || u8[offset] === 0xFE && u8[offset + 1] === 0xFF) {

                            while (u8[offset]) {
                                offset += 2;
                            }
                            offset += 3;
                            frame.size += offset; // fixme..
                        }
                        else {
                            while (u8[offset++]) {}
                            ++offset;
                        }
                        result = u8.slice(--offset, frame.size);
                        break;
                    }
                    offset += frame.size;
                }
            }
            if (u8[0] === 0x66 && u8[1] === 0x4C && u8[2] === 0x61 && u8[3] === 0x43) {
                var pos = 4;
                var len = u8.byteLength;
                var type;

                while (len > pos) {
                    var hdr = getLong(pos);

                    if ((hdr >>> 24 & ~0x80) === 6) {
                        var index = getLong(pos + 8);
                        index += getLong(pos + index + 12) + 32 + pos;
                        type = getLong(pos + 4);

                        result = u8.slice(index + 4, getLong(index));
                    }

                    if (type === 3 || (hdr >>> 24 & 0x80)) {
                        break;
                    }
                    pos += 4 + (hdr & 0xffffff);
                }
            }
            if (result && result.byteLength) {
                if (d) {
                    console.debug('getID3CoverArt', [result]);
                }
                return resolve(result);
            }
            onIdle(function() {
                reject(Error('[getID3CoverArt] None found.'));
            });
        }, reject);

        if (entry instanceof Blob) {
            var reader = new FileReader();
            reader.onload = function(ev) {
                if (ev.target.error) {
                    return reject(ev.target.error);
                }
                parse(ev.target.result);
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(entry);
        }
        else {
            parse(entry);
        }
    });
}

// ---------------------------------------------------------------------------------------------------------------

/**
 * Fullscreen handling helper
 * @param {Object} $button The button to jump into fullscreen
 * @param {Object} $element The element that must go into fullscreen
 * @returns {FullScreenManager}
 * @requires jquery.fullscreen.js
 * @constructor
 */
function FullScreenManager($button, $element) {
    'use strict';

    if (!(this instanceof FullScreenManager)) {
        return new FullScreenManager($button, $element);
    }

    var listeners = [];
    var iid = makeUUID();
    var $document = $(document);
    var state = $document.fullScreen();
    var goFullScreen = function() {
        state = $document.fullScreen();

        if (state) {
            $document.fullScreen(false);
        }
        else {
            $element.fullScreen(true);
        }
        return false;
    };

    if (state === null) {
        // FullScreen is not supported
        $button.addClass('hidden');
    }
    else {
        $document.rebind('fullscreenchange.' + iid, function() {
            state = $document.fullScreen();

            for (var i = listeners.length; i--;) {
                listeners[i](state);
            }
        });
        this.enterFullscreen = function() {
            if (!state) {
                goFullScreen();
            }
        };
        $button.removeClass('hidden').rebind('click.' + iid, goFullScreen);
    }

    Object.defineProperty(this, 'state', {
        get: function() {
            return state;
        }
    });

    this.iid = iid;
    this.$button = $button;
    this.$document = $document;
    this.listeners = listeners;
    this.destroyed = false;
}

FullScreenManager.prototype = Object.create(null);

// destroy full screen manager instance
FullScreenManager.prototype.destroy = function(keep) {
    'use strict';

    if (!this.destroyed) {
        this.destroyed = true;
        this.$button.off('click.' + this.iid);
        this.$document.off('fullscreenchange.' + this.iid);

        if (!keep) {
            this.exitFullscreen();
        }
        this.$button = this.$document = this.listeners = null;
    }
};

// list for full screen changes
FullScreenManager.prototype.change = function(cb) {
    'use strict';
    this.listeners.push(tryCatch(cb.bind(this)));
    return this;
};

// switch full screen
FullScreenManager.prototype.switchFullscreen = function() {
    'use strict';

    if (this.state) {
        this.exitFullscreen();
    }
    else {
        this.enterFullscreen();
    }
};

// exit full screen
FullScreenManager.prototype.exitFullscreen = function() {
    'use strict';
    this.$document.fullScreen(false);
};

// enter full screen
FullScreenManager.prototype.enterFullscreen = function() {
    'use strict';
    /* noop */
};

// ---------------------------------------------------------------------------------------------------------------


(function _initVideoStream(global) {
    'use strict';

    // @private Make thumb/preview images if missing
    var _makethumb = function(n, stream) {
        if (String(n.fa).indexOf(':0*') < 0 || String(n.fa).indexOf(':1*') < 0) {
            var onVideoPlaying = function() {

                if (this.duration) {
                    const took = Math.round(2 * this.duration / 100);

                    if (d) {
                        console.debug('Video thumbnail missing, will take image at %s...', secondsToTime(took));
                    }

                    this.on('timeupdate', function() {
                        if (this.currentTime < took) {
                            return true;
                        }

                        this.getImage().then(setImage.bind(null, n)).catch(console.warn.bind(console));
                    });

                    return false;
                }

                return true;
            };

            if (is_audio(n)) {
                stream.on('audio-buffer', function(ev, buffer) {
                    getID3CoverArt(buffer).then(setImage.bind(null, n)).catch(console.debug.bind(console));
                });
            }
            else {
                stream.on('playing', onVideoPlaying);
            }
        }
    };

    /** Animation for hiding the mobile video controls*/
    var hideMobileVideoControls = null;

    /**
     * Init & reset hide the mobile video controls animation function
     * @param $wrapper
     * @private
     */
    var _initHideMobileVideoControls = function($wrapper) {
        clearTimeout(hideMobileVideoControls);
        hideMobileVideoControls = setTimeout(function() {
            $('.video-controls', $wrapper).addClass('invisible');
            $('.viewer-vad-control', $wrapper).addClass('bottom');
        }, 3000);
    };

    const _createSubtitlesManager = tryCatch((node, $wrapper, $video, $videoControls) => {
        let continuePlay, $subtitles;
        const video = $video.get(0);
        const $button = $('button.subtitles', $videoControls);
        const manager = mega.utils.subtitles.init();
        const menu = contextMenu.create({
            animationDuration: 150,
            boundingElement: $wrapper[0],
            sibling: $('.subtitles-wrapper .tooltip', $wrapper)[0],
            template: $('#media-viewer-subtitles-menu', $wrapper)[0]
        });
        const destroy = tryCatch(() => {
            if ($subtitles) {
                $subtitles.off();
            }
            if (menu) {
                contextMenu.close(menu);
            }
            $button.off().parent().addClass('hidden');
        });
        onIdle(() => manager.configure(node).catch(destroy));

        // Subtitles icon
        $button.rebind('click.media-viewer', tryCatch(() => {
            if ($button.hasClass('active')) {
                $button.removeClass('active deactivated');
                contextMenu.close(menu);
            }
            else if (video) {
                if (video.paused) {
                    continuePlay = false;
                }
                else {
                    continuePlay = true;
                    video.pause();
                    $wrapper.rebind('mouseup.close-subtitles-context-menu', () => {
                        if (video.paused) {
                            video.pause();
                        }
                        $wrapper.off('mouseup.close-subtitles-context-menu');
                    });
                }
                $button.addClass('active deactivated').trigger('simpletipClose');
                // eslint-disable-next-line local-rules/open -- not a window.open() call.
                contextMenu.open(menu);

                mBroadcaster.sendMessage('trk:event', 'media-journey', 'subtitles', 'open');
            }
            return false;
        }));

        // Bind Subtitles context menu
        $('.context-menu.subtitles', $wrapper).rebind('click.media-viewer', 'button', tryCatch((ev) => {
            const $this = $(ev.currentTarget);
            const name = $this[0].className;
            const index = name === 'add' ? -1 : $this.index();
            const {length} = $this.parent().children();

            if (index >= 0 && index < length) {
                const success = manager.select(index - 1);

                if (success || success === undefined) {
                    $('div.video-subtitles', $wrapper).remove();
                    $subtitles = null;

                    if (index > 0) {
                        const subtitlesElement = document.createElement('div');
                        subtitlesElement.setAttribute('class', 'video-subtitles');
                        video.after(subtitlesElement);

                        $subtitles = $('div.video-subtitles', $wrapper);
                        $subtitles.rebind('click.subtitles', () => {
                            $video.trigger('click');
                        });
                        $subtitles.rebind('dblclick.subtitles', () => {
                            $video.trigger('dblclick');
                        });
                        manager.displaySubtitles(video.streamer, $subtitles);
                        $button.addClass('mask-color-brand');
                        mBroadcaster.sendMessage('trk:event', 'media-journey', 'subtitles', 'select');
                    }
                    else {
                        mBroadcaster.sendMessage('trk:event', 'media-journey', 'subtitles', 'off');
                        $button.removeClass('mask-color-brand');
                    }
                    $('.context-menu.subtitles button i', $wrapper).addClass('hidden');
                    $(`.context-menu.subtitles button.${name} i`, $wrapper).removeClass('hidden');
                }
            }
            else if (index === -1) {
                if (!video.paused) {
                    continuePlay = true;
                    video.pause();
                }
                manager.addSubtitlesDialog(continuePlay);
            }
        }));
        $button.parent().removeClass('hidden');

        return freeze({
            destroy,
            fire(ev) {
                if (ev.type === 'mouseup') {
                    const $target = $(ev.target);
                    if (!$target.closest('button.subtitles').length
                        && $button.hasClass('active')) {

                        $button.trigger('click.media-viewer');
                    }
                }
                else {
                    return true;
                }
            },
            display(streamer) {
                if ($subtitles) {
                    manager.displaySubtitles(streamer, $subtitles);
                }
                video.streamer = streamer;
            },
        });
    });

    // @private Init custom video controls
    var _initVideoControls = function(wrapper, streamer, node, options) {
        var $wrapper = $(wrapper);
        var $video = $('video', $wrapper);
        var videoElement = $video.get(0);
        var $videoContainer = $video.parent();
        var $videoControls = $('.video-controls', $wrapper);
        var $playVideoButton = $('.play-video-button', $wrapper);
        var $document = $(document);
        var filters = Object.create(null);
        let duration, playevent;
        const MOUSE_IDLE_TID = 'auto-hide-media-controls';
        const SPRITE = is_embed ? 'sprite-embed-mono' : 'sprite-fm-mono';
        const $playPauseButton = $('.play-pause-video-button', $wrapper);
        const $watchAgainButton = $('.watch-again-button', $wrapper);

        const props = Object.defineProperties(Object.create(null), {
            duration: {
                get() {
                    return duration || streamer && streamer.duration;
                }
            }
        });
        let subtitlesManager, speedMenu, settingsMenu;

        /* Drag status */
        let timeDrag = false;

        // Set volume icon default state
        $('.vol-wrapper', $wrapper).removeClass('audio');

        // Obtain handles to buttons and other elements
        var $playpause = $('.playpause', $videoControls);
        var $mute = $('.mute', $videoControls);
        var $progress = $('.video-progress-bar', $videoControls);
        var $progressBar = $('.video-time-bar', $videoControls);
        var $fullscreen = $('.fs', $videoControls);
        var $volumeBar = $('.volume-bar', $videoControls);
        var $pendingBlock = $('.loader-grad', $wrapper);
        const $repeat = $('.repeat', $videoControls);
        const $speed = $('.speed', $videoControls);
        const $settings = $('button.settings', $videoControls);

        // time-update elements and helpers.
        var onTimeUpdate;
        var setTimeUpdate;
        var progressBarElementStyle = $progressBar.get(0).style;
        var videoTimingElement = $('.video-timing.current', $wrapper).get(0);

        const $expectTimeBar = $('.video-expected-time-bar', $videoControls);
        const $progressTimeBar = $('.video-progress-time', $videoControls);

        // set idle state, i.e. hide controls
        var setIdle = function(value) {
            if (setIdle.value !== value) {
                setIdle.value = value;
                onTimeUpdate.last = null;

                if (value) {
                    $wrapper.addClass('mouse-idle');
                }
                else {
                    setTimeUpdate();
                    $wrapper.removeClass('mouse-idle');
                }
            }
        };

        // As the video is playing, update the progress bar
        onTimeUpdate = function(offset, length) {
            offset = (offset > length ? length : offset) | 0;

            if (offset !== onTimeUpdate.last) {
                onTimeUpdate.last = offset;

                if (!setIdle.value) {
                    videoTimingElement.textContent = secondsToTimeShort(offset, 1);
                    progressBarElementStyle.setProperty('width', `${100 * offset / length}%`);
                }

                if (offset % 2) {
                    // Store the current time in session storage such that we can restore on reload.
                    sessionStorage.previewTime = offset;
                }

                if (subtitlesManager) {
                    subtitlesManager.display(streamer);
                }
            }
        };

        // programmatic timeupdate helper
        setTimeUpdate = function() {
            if (streamer) {
                onTimeUpdate(streamer.currentTime, props.duration);
            }
        };
        $video.rebind('timeupdate.xyz', setTimeUpdate);

        const volumeIcon = (volume) => {
            if (volume < 0.5) {
                return 'icon-volume-small-regular-outline';
            }

            if (volume >= 0.5 && volume < 0.75) {
                return 'icon-volume-min-small-regular-outline';
            }

            return 'icon-volume-max-small-regular-outline';
        };

        const getTimeOffset = (x) => {
            const maxduration = props.duration || 0;
            const position = x - $progress.offset().left; // Click pos
            const percentage = Math.max(0, Math.min(100, 100 * position / $progress.width()));
            const selectedTime = Math.round(maxduration * percentage / 100);
            return {time: selectedTime | 0, percent: percentage};
        };

        // Update Progress Bar control
        const updatebar = (x) => {
            if (streamer) {
                const o = getTimeOffset(x);
                const t = secondsToTimeShort(o.time, 1);

                // Update progress bar and video current time
                $progressTimeBar.text(t);
                videoTimingElement.textContent = t;
                progressBarElementStyle.setProperty('width', o.percent + '%');

                if (!timeDrag) {
                    streamer.currentTime = o.time;

                    // Also set startTime, needed by AudioStream.
                    options.startTime = o.time;
                }
            }
        };

        // Changes the button state of certain button's so the correct visuals can be displayed with CSS
        var changeButtonState = function(type) {

            // Play/Pause button
            if (type === 'playpause' && !timeDrag) {
                const {ended} = streamer || !1;

                if (ended && $watchAgainButton.hasClass('hidden')) {

                    if ($repeat.mnh === node.h) {

                        $playpause.trigger('click');
                        return;
                    }

                    $('i', $playpause).removeClass('icon-pause-small-regular-outline')
                        .addClass('icon-rotate-ccw-small-regular-outline');
                    $('.playpause-wrapper .tooltip', $wrapper).text(l.video_player_watch_again);
                    $watchAgainButton.removeClass('hidden');
                    videoElement.style.filter = `${videoElement.style.filter.replace('none', '')}blur(6px)`;
                    mBroadcaster.sendMessage('trk:event', 'media-journey', 'playback', 'ended');
                }
                else if (videoElement.paused) {
                    $('i', $playpause).removeClass('icon-pause-small-regular-outline')
                        .addClass('icon-play-small-regular-outline');
                    $('.playpause-wrapper .tooltip', $wrapper).text(l.video_player_play);
                    $pendingBlock.addClass('hidden');
                    $watchAgainButton.addClass('hidden');
                    $playPauseButton.removeClass('hidden');
                    videoElement.style.filter = videoElement.style.filter.replace('blur(6px)', '');
                    $('i', $playPauseButton).removeClass('icon-play-regular-solid')
                        .addClass('icon-pause-small-regular-solid');
                    tSleep(2.5).then(() => $playPauseButton.addClass('hidden'));

                    if (is_mobile && playevent) {
                        clearTimeout(hideMobileVideoControls);
                        $videoControls.removeClass('invisible');
                    }
                }
                else {
                    $('i', $playpause).removeClass().addClass(`${SPRITE} icon-pause-small-regular-outline`);
                    $('.playpause-wrapper .tooltip', $wrapper).text(l.video_player_pause);
                    $playVideoButton.addClass('hidden');
                    $watchAgainButton.addClass('hidden');
                    videoElement.style.filter = videoElement.style.filter.replace('blur(6px)', '');
                    if ($('i', $playPauseButton).hasClass('icon-pause-small-regular-solid')) {
                        $playPauseButton.removeClass('hidden');
                        $('i', $playPauseButton).addClass('icon-play-regular-solid')
                            .removeClass('icon-pause-small-regular-solid');
                        tSleep(2.5).then(() => $playPauseButton.addClass('hidden'));
                    }
                }
            }
            // Mute button
            else if (type === 'mute') {
                if (videoElement.muted) {
                    $('i', $mute).removeClass().addClass(`${SPRITE} icon-volume-x-small-regular-outline`);
                    $('.vol-wrapper .tooltip', $wrapper).text(l.video_player_unmute);
                }
                else {
                    $('i', $mute).removeClass().addClass(`${SPRITE} ${volumeIcon(streamer.volume)}`);
                    $('.vol-wrapper .tooltip', $wrapper).text(l.video_player_mute);
                }
            }
        };

        var hideControls = function() {
            setIdle(false);
            if (dlmanager.isStreaming) {
                delay(MOUSE_IDLE_TID, () => {
                    if (streamer && !streamer.interrupted) {
                        setIdle(true);
                    }
                }, 2600);
            }
        };

        // Set video duration in progress bar
        var setDuration = function(value) {
            duration = value;
            $wrapper.find('.video-timing.duration').text(secondsToTimeShort(value, 1));
        };

        // Increase/decrease video speed
        var setVideoSpeed = function(rate) {
            if (rate) {
                const r = streamer.playbackRate;
                streamer.playbackRate = Math.min(Math.max(r + rate, 0.25), 6);
            }
            else {
                streamer.playbackRate = 1.0;
            }
        };

        // Increase/decrease video volume.
        var setVideoVolume = function(v) {
            if (videoElement.muted) {
                videoElement.muted = false;
                changeButtonState('mute');
            }
            streamer.volume += v;
            $('span', $volumeBar).css('width', Math.round(streamer.volume * 100) + '%');
        };

        // Increase/decrease color filter
        var setVideoFilter = function(v) {
            var style = [];
            var op = v > 0 && v < 4 ? 2 : v > 3 && v < 7 ? 5 : 8;
            var filter = ({'2': 'saturate', '5': 'contrast', '8': 'brightness'})[op];

            if (!v) {
                filters = Object.create(null);
                $('.reset-all', $videoControls).trigger('click');
            }
            else if (v === op) {
                delete filters[filter];
            }
            else {
                v = '147'.indexOf(v) < 0 ? 0.1 : -0.1;
                filters[filter] = Number(Math.min(8.0, Math.max((filters[filter] || 1) + v, 0.1)).toFixed(2));
            }

            Object.keys(filters).forEach(function(k) {
                style.push(k + '(' + filters[k] + ')');
            });

            videoElement.style.filter = style.join(' ') || 'none';

            const $elm = $(`.${filter}-bar`, $videoControls);
            const pcn = Math.min(100, (filters[filter] || 1) * 50);
            $('span', $elm).css('width', `${pcn}%`);
            $elm.next().text(pcn);

            if (pcn !== 50) {
                $('.reset-all', $videoControls).removeClass('invisible');
            }
        };

        // Apply specific video filter
        var applyVideoFilter = function(s, c, b) {
            filters.saturate = s;
            filters.contrast = c;
            filters.brightness = b;
            videoElement.style.filter = 'saturate(' + s + ') contrast(' + c + ') brightness(' + b + ')';
        };

        // update Settings panel Bar control
        const setVideoFilterLevel = (pageX, $elm) => {
            let values = [...$('.settings-range .settings-bar span', $videoControls)];

            if ($elm) {
                const width = $elm.width();
                const position = width - (pageX - $elm.offset().left);
                const percent = Math.max(0, Math.min(100 - 100 * position / width | 0, 100));

                $elm.next().text(percent);
                $('span', $elm).css('width', `${percent}%`);
            }
            else {
                $('.settings-range .value', $videoControls).textContent = '50';
                $('.settings-range .settings-bar span', $videoControls).css('width', '50%');
            }
            values = values.map(({style: v}) => parseFloat(v.width || '50') / 50);

            applyVideoFilter.apply(this, values.reverse());

            if (values.filter(v => v !== 1).length) {
                $('.reset-all', $videoControls).removeClass('invisible');
            }
            else {
                $('.reset-all', $videoControls).addClass('invisible');
            }
        };

        // Seek by specified number of seconds.
        var seekBy = function(sec) {
            streamer.currentTime = Math.min(props.duration, Math.max(0, streamer.currentTime + sec));
        };

        // Playback Speed context menu
        if (!speedMenu) {
            speedMenu = contextMenu.create({
                template: $('#media-viewer-speed-menu', $wrapper)[0],
                sibling: $('.speed-wrapper .tooltip', $wrapper)[0],
                animationDuration: 150,
                boundingElement: $wrapper[0]
            });
        }

        // Settings context menu
        if (!settingsMenu) {
            settingsMenu = contextMenu.create({
                template: $('#media-viewer-video-settings-menu', $wrapper)[0],
                sibling: $('.settings-wrapper .tooltip', $wrapper)[0],
                animationDuration: 150,
                boundingElement: $wrapper[0]
            });
        }

        // Set Init Values
        changeButtonState('mute');
        $('.video-timing', $wrapper).text('00:00');
        $progressBar.removeAttr('style');
        $volumeBar.find('style').removeAttr('style');

        if ($('.loader-grad', $wrapper).hasClass('hidden')) {

            $playVideoButton.removeClass('hidden');
        }

        duration = options.playtime || MediaAttribute(node).data.playtime || 0;
        setDuration(duration);
        onTimeUpdate(0, 1);

        if (duration && options.startTime) {
            onTimeUpdate(options.startTime, duration);
        }
        setVideoFilterLevel();

        if (options.filter) {
            applyVideoFilter.apply(this, options.filter.map(v => v / 10));
        }

        // Subtitles manager
        if (self.fminitialized && !self.pfcol && !is_audio(node) && !is_mobile) {

            subtitlesManager = _createSubtitlesManager(node, $wrapper, $video, $videoControls);
        }
        if (!subtitlesManager) {
            if (page === 'download' || self.pfcol) {
                $('button.subtitles', $videoControls).attr('disabled', 'disabled').addClass('mask-color-grey-out');
            }
            else {
                $('button.subtitles', $videoControls).parent().addClass('hidden');
            }
        }

        // Add event listeners for video specific events
        $video.rebind('play pause', function() {
            if (!videoElement.paused &&
                ($.dialog === 'subtitles-dialog' ||
                $('.context-menu.subtitles', $wrapper).get(0) &&
                $('.context-menu.subtitles', $wrapper).get(0).classList.contains('visible'))) {
                videoElement.pause();
            }
            else {
                changeButtonState('playpause');
            }
        });

        $video.rebind('playing', function() {
            if (streamer.currentTime + 0.01) {
                $pendingBlock.addClass('hidden');

                if (!playevent) {
                    playevent = true;
                    if (streamer.duration > duration) {
                        setDuration(streamer.duration);
                    }

                    streamer.on('duration', (ev, value) => {
                        if (duration < value) {
                            setDuration(value);
                            return true;
                        }
                    });

                    // play/pause on click
                    $video.rebind('click', function() {
                        if (!is_mobile) {
                            $playpause.trigger('click');
                        }
                    });

                    // jump to full screen on double-click
                    $video.rebind('dblclick', function() {
                        $fullscreen.trigger('click');
                    });

                    $playVideoButton.rebind('click', function() {
                        $playpause.trigger('click');
                    });

                    $watchAgainButton.rebind('click', () => {
                        $playpause.trigger('click');
                    });

                    const $vc = $('.vol-wrapper', $wrapper);

                    if (streamer.hasAudio) {
                        $vc.addClass('audio').removeAttr('title');
                    }
                    else {
                        var title = l[19061];

                        if (streamer.hasUnsupportedAudio) {
                            eventlog(99693, streamer.hasUnsupportedAudio);
                            title = escapeHTML(l[19060]).replace('%1', streamer.hasUnsupportedAudio);
                        }
                        $('i', $vc).removeClass().addClass(`${SPRITE} icon-volume-x-small-regular-outline`);
                        $('.vol-wrapper .tooltip', $wrapper).text(title);
                    }

                    streamer._megaNode = node;
                    dlmanager.isStreaming = streamer;
                    pagemetadata();
                }

                hideControls();
                $document.rebind('mousemove.idle', hideControls);
            }
        });

        $videoControls.rebind('mousemove.idle', function() {
            onIdle(() => {
                delay.cancel(MOUSE_IDLE_TID);
            });
        });

        $video.rebind('ended.idle pause.idle', function() {
            setIdle(false);
            delay.cancel(MOUSE_IDLE_TID);
            $document.off('mousemove.idle');
            if (streamer.ended) {
                delete sessionStorage.previewTime;
                onIdle(() => progressBarElementStyle.setProperty('width', '100%'));
            }
            // playevent = false;
        });

        $video.rebind('contextmenu.mvs', function() {
            if (playevent) {
                $video.off('contextmenu.mvs');
            }
            else {
                return false;
            }
        });

        // Add events for all buttons
        $playpause.rebind('click', function() {
            if (streamer.interrupted) {
                if (dlmanager.isOverQuota) {
                    $wrapper.trigger('is-over-quota');
                    dlmanager.showOverQuotaDialog();
                }
                else {
                    later(hideControls);

                    if (streamer.ended) {
                        streamer.currentTime = 0;
                        mBroadcaster.sendMessage('trk:event', 'media-journey', 'playback', 'watch-again');
                    }
                    else {
                        streamer.play();
                    }
                }
            }
            else {
                videoElement.pause();
                mBroadcaster.sendMessage('trk:event', 'media-journey', 'playback', 'pause-click');
            }
            return false;
        });

        // update Volume Bar control
        var updateVolumeBar = function(x) {
            var $this = $($volumeBar);

            if (x) {
                var position = $this.width() - (x - $this.offset().left);
                var percentage = 100 - (100 * position / $this.width());

                // Check within range
                if (percentage > 100) {
                    percentage = 100;
                }
                else if (percentage > 0) {
                    videoElement.muted = false;
                }
                else {
                    percentage = 0;
                    videoElement.muted = true;
                }

                changeButtonState('mute');
                $('span', $this).css('width', percentage + '%');
                streamer.volume = percentage / 100;
            }
            else if (videoElement.muted) {
                $('span', $this).css('width', '0%');
            }
            else {
                var currentVolume = streamer.volume * 100;
                $('span', $this).css('width', currentVolume + '%');
            }
        };

        // Volume Bar control
        var volumeDrag = false;
        /* Drag status */
        $volumeBar.rebind('mousedown.volumecontrol', (e) => {
            volumeDrag = true;
            updateVolumeBar(e.pageX);
        });

        $('.vol-wrapper', $wrapper).rebind('mousewheel.volumecontrol', (e) => {
            const delta = Math.max(-1, Math.min(1, e.deltaY || -e.detail));

            setVideoVolume(0.1 * delta);
            return false;
        });

        updateVolumeBar();

        // Add the event listener of clicking mute/unmute buttons from the right click menu when play video/audio
        $video.rebind('volumechange', () => {
            changeButtonState('mute');
            updateVolumeBar();
        });

        // Bind Mute button
        $mute.rebind('click', function() {
            if ($(this).parent('.vol-wrapper').hasClass('audio')) {
                streamer.muted = -1; // swap state
                changeButtonState('mute');
                updateVolumeBar();
            }
            return false;
        });

        // Settings panel bar control
        let settingsPanelDrag = false;
        const $vcSResetAll = $('.reset-all', $videoControls);
        const $vcSettingsBar = $('.settings-bar', $videoControls);
        $vcSettingsBar.rebind('mousedown.settingspanelcontrol', function({pageX}) {
            const $this = $(this);
            settingsPanelDrag = $this;

            if (pageX > 0) {
                setVideoFilterLevel(pageX, $this);
            }
        });

        $vcSettingsBar.rebind('mousemove.settingspanelcontrol', function({pageX}) {
            if (pageX > 0) {
                const $this = $(this);
                const width = $this.width();
                const position = width - (pageX - $this.offset().left);
                const percentage = Math.max(0, Math.min(100 - 100 * position / width | 0, 100));

                $this.next().text(percentage).css('left', `${percentage / 100 * width - 4}px`);
            }
        });

        $vcSResetAll.rebind('click', () => setVideoFilterLevel());

        // Get page X based on event
        var getX = function(e) {
            if (e.type.includes("mouse")) {
                return e.pageX;
            }
            else if (e.type.includes("touch")) {
                return (e.changedTouches || e.touches)[0].pageX;
            }
        };

        $progress.rebind('mousedown.videoprogress touchstart.videoprogress', function(e) {
            timeDrag = true;

            if (streamer && streamer.currentTime) {
                videoElement.pause();
                onIdle(updatebar.bind(0, getX(e)));
            }

            if (is_mobile) {
                var $videoControl = $(this).parents('.video-controls');
                clearTimeout(hideMobileVideoControls);
                $videoControl.addClass('timeDrag');
            }
        });

        $document.rebind('mouseup.video-player touchend.videoprogress', function(e) {
            // video progress
            if (timeDrag) {
                timeDrag = false;

                if (streamer && streamer.currentTime) {
                    updatebar(getX(e));

                    if (!streamer.WILL_AUTOPLAY_ONSEEK) {
                        streamer.play();
                    }
                }
            }

            if (is_mobile) {
                var $videoControl = $(this).parents('.video-controls');
                $videoControl.removeClass('timeDrag');
                _initHideMobileVideoControls($wrapper);
            }

            $progressTimeBar.css('display', '');

            // volume control
            if (volumeDrag) {
                volumeDrag = false;
                updateVolumeBar(e.pageX);
            }

            // settings panel control
            if (settingsPanelDrag) {
                if (e.pageX > 0) {
                    setVideoFilterLevel(e.pageX, settingsPanelDrag);
                }
                settingsPanelDrag = false;
            }
        });

        $document.rebind('mousemove.video-player', (e) => {
            // video progress
            if (timeDrag && streamer && streamer.currentTime) {
                updatebar(getX(e));
            }

            // volume control
            if (volumeDrag) {
                updateVolumeBar(e.pageX);
            }

            // settings panel control
            if (settingsPanelDrag && e.pageX > 0) {
                setVideoFilterLevel(e.pageX, settingsPanelDrag);
            }
        });

        const _hoverAction = e => {

            const x = getX(e);

            $progressTimeBar.text(secondsToTimeShort(getTimeOffset(x).time, 1));
            $expectTimeBar.css('width', `${100 * (x - $progress.offset().left) / $progress.width()}%`);
        };

        $progress.rebind('mousemove.videoprogress',_hoverAction);
        $('.video-progress-block', $videoControls).rebind('mouseenter.videoprogress', _hoverAction);

        $progress.rebind('touchmove.videoprogress', function(e) {
            updatebar(getX(e));
            this.setAttribute('title', secondsToTimeShort(getTimeOffset(getX(e)).time, 1));
            return false;
        });

        // Set the video container's fullscreen state
        var setFullscreenData = function(state) {
            $videoContainer.attr('data-fullscreen', !!state);

            // Set the fullscreen button's 'data-state' which allows the correct button image to be set via CSS
            $fullscreen.attr('data-state', state ? 'cancel-fullscreen' : 'go-fullscreen');

            if (state) {
                $('i', $fullscreen).removeClass('icon-maximize-02-small-regular-outline')
                    .addClass('icon-minimize-02-small-regular-outline');
                $('.fs-wrapper .tooltip', $wrapper).text(l.video_player_exit_fullscreen);
            }
            else {
                $('i', $fullscreen).removeClass('icon-minimize-02-small-regular-outline')
                    .addClass('icon-maximize-02-small-regular-outline');
                $('.fs-wrapper .tooltip', $wrapper).text(l.video_player_fullscreen);
            }
        };

        var $element = page === 'download' ? $wrapper.find('.video-block') : $wrapper;
        var fullScreenManager = FullScreenManager($fullscreen, $element).change(setFullscreenData);

        // Bind Repeat button
        $repeat.rebind('click', () => {
            if ($repeat.mnh) {
                $repeat.mnh = null;
                $repeat.removeClass('mask-color-brand');
                $('.repeat-wrapper .tooltip', $wrapper).text(l.video_player_repeat);
            }
            else {
                $repeat.mnh = node.h;
                $repeat.addClass('mask-color-brand');
                $('.repeat-wrapper .tooltip', $wrapper).text(l.video_player_stop_repeat);
                eventlog(99940);
            }
        });

        // Speed icon
        $speed.rebind('click.media-viewer', function() {
            var $this = $(this);

            if ($this.hasClass('hidden')) {
                return false;
            }
            if ($this.hasClass('active')) {
                $this.removeClass('active deactivated');
                contextMenu.close(speedMenu);
            }
            else {
                $this.addClass('active deactivated').trigger('simpletipClose');
                // xxx: no, this is not a window.open() call..
                // eslint-disable-next-line local-rules/open
                contextMenu.open(speedMenu);
            }
            return false;
        });

        // Settings icon
        $settings.rebind('click.media-viewer', function() {
            var $this = $(this);

            if ($this.hasClass('hidden')) {
                return false;
            }
            if ($this.hasClass('active')) {
                $settings.removeClass('active deactivated mask-color-brand');
                $('i', $settings).removeClass('icon-settings-02-small-regular-solid')
                    .addClass('icon-settings-02-small-regular-outline');
                contextMenu.close(settingsMenu);
            }
            else {
                $settings.addClass('active deactivated mask-color-brand').trigger('simpletipClose');
                $('i', $settings).addClass('icon-settings-02-small-regular-solid')
                    .removeClass('icon-settings-02-small-regular-outline');
                // xxx: no, this is not a window.open() call..
                // eslint-disable-next-line local-rules/open
                contextMenu.open(settingsMenu);
            }
            return false;
        });

        // Close context menu
        $wrapper.rebind('mouseup.video-player', (ev) => {
            const $target = $(ev.target);

            if (!$target.closest('button.speed').length && $speed.hasClass('active')) {
                $speed.trigger('click.media-viewer');
            }

            if (subtitlesManager) {
                subtitlesManager.fire(ev);
            }
        });

        $wrapper.rebind('mousedown.video-player', (e) => {
            const $target = $(e.target);

            if (!$target.closest('button.settings').length && !$target.closest('.context-menu').length &&
                $settings.hasClass('active')) {
                $settings.trigger('click.media-viewer');
            }
        });

        // Bind Playback Speed context menu
        $('.context-menu.playback-speed button', $wrapper).rebind('click.media-viewer', function() {
            let rate = 1;
            let cl = '1x';
            let icon = '';
            const $this = $(this);

            $speed.removeClass('margin-2');

            if ($this.hasClass('05x')) {
                cl = '05x';
                rate = 0.5;
                icon = 'icon-size-36';
                $speed.addClass('margin-2');
            }
            else if ($this.hasClass('15x')) {
                cl = '15x';
                rate = 1.5;
                icon = 'icon-size-36';
                $speed.addClass('margin-2');
            }
            else if ($this.hasClass('2x')) {
                cl = '2x';
                rate = 2;
            }

            $('.context-menu.playback-speed button i', $wrapper).addClass('hidden');
            $(`.context-menu.playback-speed button.${cl} i`, $wrapper).removeClass('hidden');
            $('i', $speed)
                .removeClass()
                .addClass(`${SPRITE} icon-playback-${cl}-small-regular-outline ${icon}`);

            streamer.playbackRate = rate;
        });

        // Video playback keyboard event handler.
        var videoKeyboardHandler = function(ev) {

            if (window.disableVideoKeyboardHandler) {
                return false;
            }

            var bubble = false;
            var key = !ev.ctrlKey && ev.target.nodeName !== 'INPUT' && playevent && (ev.code || ev.key);

            switch (key) {
                case 'KeyK':
                case 'Space':
                case 'MediaPlayPause':
                    $playpause.trigger('click');
                    break;
                case 'ArrowUp':
                    setVideoVolume(0.1);
                    break;
                case 'ArrowDown':
                    setVideoVolume(-0.1);
                    break;
                case 'ArrowLeft':
                    seekBy(-5);
                    break;
                case 'ArrowRight':
                    seekBy(5);
                    break;
                case 'KeyJ':
                    seekBy(-10);
                    break;
                case 'KeyL':
                    seekBy(10);
                    break;
                case 'KeyF':
                    fullScreenManager.switchFullscreen();
                    break;
                case 'KeyM':
                    $mute.trigger('click');
                    break;
                case 'Home':
                case 'Digit0':
                    streamer.currentTime = 0;
                    break;
                case 'End':
                    streamer.currentTime = props.duration - 0.2;
                    break;
                case 'Digit1':
                case 'Digit2':
                case 'Digit3':
                case 'Digit4':
                case 'Digit5':
                case 'Digit6':
                case 'Digit7':
                case 'Digit8':
                case 'Digit9':
                    streamer.currentTime = props.duration * key.substr(5) / 10;
                    break;
                case 'Numpad0':
                case 'Numpad1':
                case 'Numpad2':
                case 'Numpad3':
                case 'Numpad4':
                case 'Numpad5':
                case 'Numpad6':
                case 'Numpad7':
                case 'Numpad8':
                case 'Numpad9':
                    setVideoFilter(key.substr(6) | 0);
                    break;
                default:
                    if (ev.key === '<' || ev.key === '>') {
                        setVideoSpeed(ev.ctrlKey ? null : 0.25 * (ev.key.charCodeAt(0) - 0x3d));
                    }
                    else {
                        bubble = true;
                    }
                    break;
            }

            if (!bubble) {
                ev.preventDefault();
                ev.stopPropagation();
            }
        };
        window.addEventListener('keydown', videoKeyboardHandler, true);

        if (options.vad) {
            $progress.off();
            window.removeEventListener('keydown', videoKeyboardHandler, true);
            onTimeUpdate = function(offset, length) {
                offset = offset > length ? length : offset;
                videoTimingElement.textContent = secondsToTimeShort(offset, 1);
                $('.video-time-bar', $wrapper).css('width',  `${100 * offset / length}%`);
            };
        }

        $wrapper.rebind('is-over-quota', function() {
            fullScreenManager.exitFullscreen();
            $pendingBlock.addClass('hidden');
            videoElement.pause();
            return false;
        });

        $wrapper.rebind('video-destroy', function() {
            if ($repeat.mnh) {
                $repeat.trigger('click');
            }
            $mute.off();
            $video.off();
            $progress.off();
            $playpause.off();
            $volumeBar.off();
            $repeat.off();
            $speed.off();
            $settings.off();
            $vcSettingsBar.off();
            $vcSResetAll.off();
            delay.cancel(MOUSE_IDLE_TID);
            if (videoElement) {
                videoElement.style.filter = 'none';
            }
            if (options.vad) {
                return false;
            }
            if (subtitlesManager) {
                subtitlesManager.destroy();
            }
            if (speedMenu) {
                contextMenu.close(speedMenu);
            }
            if (settingsMenu) {
                contextMenu.close(settingsMenu);
            }
            fullScreenManager.destroy(!!$.videoAutoFullScreen);
            window.removeEventListener('keydown', videoKeyboardHandler, true);
            $wrapper.removeClass('mouse-idle video-theatre-mode video').off('is-over-quota');
            $pendingBlock.addClass('hidden');
            $('.vol-wrapper', $wrapper).off();
            $document.off('mousemove.video-player');
            $document.off('mouseup.video-player');
            $wrapper.off('mouseup.video-player');
            $wrapper.off('mousedown.video-player');
            $document.off('mousemove.idle');
            $(window).off('video-destroy.main');
            videoElement = streamer = null;
            dlmanager.isStreaming = false;
            pagemetadata();
            return false;
        });

        dlmanager.isStreaming = true;
    };

    // @private get additional video instance..
    var _getVideoAdInstance = function(node, $wrapper, videoElement, options) {
        var pan, vad;
        var vAdInstance = Object.create(null);
        var opt = {autoplay: options.autoplay};
        var $control = $('.viewer-vad-control', $wrapper).removeClass('skip');
        var $thumb = $('.thumb', $control).removeClass('active');
        var $pendingBlock = $('.loader-grad', $wrapper);
        var nop = function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
        };
        var dsp = function(ev) {
            nop(ev);
            if (vAdInstance) {
                vAdInstance.skip();
            }
            return false;
        };

        vAdInstance.skip = function() {
            this.kill();

            if (this.parent) {
                videoElement.classList.remove('hidden');
                _initVideoControls($wrapper, this.parent, node, options);

                var error = this.parent.error;
                if (error) {
                    onIdle(function() {
                        msgDialog('warninga', l[135], l[47], error);
                    });
                    this.abort();
                }
                else if (opt.autoplay) {
                    options.autoplay = true;
                    this.parent.play();
                }
                else {
                    this.start = this.parent.play.bind(this.parent);
                }
                this.parent = null;
            }
        };

        vAdInstance.kill = function() {
            if (pan) {
                $wrapper.removeClass('vad');
                $control.addClass('hidden');
                $thumb.removeClass('active');
                pan.removeChild(vad);
                pan = null;
            }

            if (vAdInstance) {
                if (vAdInstance.stream) {
                    $wrapper.trigger('video-destroy');
                    vAdInstance.stream.destroy();
                    vAdInstance.stream = null;
                }
                vAdInstance = null;
            }
        };

        vAdInstance.start = function() {
            if (this.stream) {
                this.stream.play();
            }
            opt.autoplay = true;
        };

        if (options.vad === false || is_audio(node)) {
            pan = null;
            vAdInstance.disabled = true;
            return vAdInstance;
        }
        videoElement.addEventListener('click', nop, true);
        videoElement.addEventListener('contextmenu', nop, true);

        var rs = {};
        var ts = 15807e5;
        var now = Date.now() / 1e3;
        var pra = JSON.parse(localStorage.pra || '{}');
        var ids = Object.keys(pra);
        for (var i = ids.length; i--;) {
            var t = pra[ids[i]] + ts;

            if (now > t + 3600) {
                delete pra[ids[i]];
            }
            else {
                rs[ids[i]] = t;
            }
        }

        var req = {a: 'pra', rs: rs, d: d ? 1e3 : undefined};
        if (node.ph) {
            req.ph = node.ph;
        }
        else if (node.h) {
            req.h = node.h;
        }
        api.req(req).always(({result: res}) => {
            if (d) {
                console.debug('pra', res, [vAdInstance]);
            }
            videoElement.removeEventListener('click', nop, true);
            videoElement.removeEventListener('contextmenu', nop, true);

            if (!vAdInstance || !res || res < 0 || typeof res !== 'object') {
                return vAdInstance && vAdInstance.skip();
            }
            pra[res.id] = now - ts | 0;
            localStorage.pra = JSON.stringify(pra);

            getImage(node, 1)
                .then((uri) => {
                    $('img', $thumb.addClass('active')).attr('src', uri);
                })
                .catch(dump);

            pan = videoElement.parentNode;
            vad = videoElement.cloneNode();
            vad.id = '';
            vad.style.zIndex = 9;
            $wrapper.addClass('vad');
            videoElement.before(vad);
            videoElement.classList.add('hidden');
            vad.addEventListener('ended', dsp);
            vad.addEventListener('click', nop, true);
            vad.addEventListener('contextmenu', nop, true);

            vAdInstance.stream = Streamer(res.l, vad, opt);
            vAdInstance.stream.on('playing', function() {
                var count = parseInt(res.cds) | 0;
                if (count < 1) {
                    count = Math.min(this.duration | 0, 9);
                }
                var $counter = $('.counter', $control.removeClass('hidden')).text(count);
                var timer = setInterval(function() {
                    $counter.text(--count);
                    if (count < 1) {
                        clearInterval(timer);
                        $control.addClass('skip');
                        $control.rebind('click.ctl', function(ev) {
                            eventlog(99731);
                            return dsp(ev);
                        });
                    }
                }, 1000);

                if (res.aurl) {
                    var onclick = function(ev) {
                        nop(ev);
                        open(res.aurl);
                        eventlog(99732);
                    };
                    vad.style.cursor = 'pointer';
                    vad.removeEventListener('click', nop, true);
                    vad.addEventListener('click', onclick, true);
                }
                $pendingBlock.addClass('hidden');

                eventlog(99730);
            });

            if (opt.autoplay) {
                vAdInstance.start();
            }

            vAdInstance.stream.abort = vAdInstance.abort;
            _initVideoControls($wrapper, vAdInstance.stream, node, {vad: true});
        });

        if (options.autoplay) {
            $('.loader-grad', $wrapper).removeClass('hidden');
        }
        options.autoplay = false;

        return vAdInstance;
    };

    // @private obtain streamer instance with as needed expanded methods at runtime.
    var _getStreamerInstance = function(node, $wrapper, videoElement, options) {
        var vAdInstance = _getVideoAdInstance.apply(this, arguments);
        var vStream = Streamer(node.link || node.h, videoElement, options);

        console.assert(!vStream.kill);
        console.assert(!vStream.start);

        vStream.kill = function() {
            if (vAdInstance) {
                vAdInstance.kill();
                vAdInstance = null;
            }

            if (vStream) {
                var abort = vStream.abort;
                vStream.abort = null;

                if (typeof abort === 'function') {
                    abort.call(vStream);
                }

                if (vStream) {
                    vStream.destroy();
                }
                vStream = null;
            }
        };

        vStream.start = function() {
            if (vAdInstance) {
                vAdInstance.start();
            }
            else if (vStream) {
                vStream.play();
            }
        };

        vAdInstance.parent = vStream;
        vAdInstance.abort = vStream.kill;

        if (d) {
            window.vStream = vStream;
            window.vAdInstance = vAdInstance;
        }

        if (vAdInstance.disabled) {
            vAdInstance.skip();
            vAdInstance = null;
        }

        return vStream;
    };

    // @private Launch video streaming
    var _initVideoStream = function(node, $wrapper, destroy, options) {
        var onOverQuotaCT;
        var videoElement = $('video', $wrapper).get(0);

        if (typeof destroy === 'object') {
            options = destroy;
            destroy = null;
        }
        options = Object.assign(Object.create(null), {autoplay: true}, options);

        // Hide the default controls
        videoElement.controls = false;

        // If a preview time is set, use it as the starting time.
        if (sessionStorage.previewTime) {
            if (node.h && sessionStorage.previewNode === node.h) {
                options.startTime = sessionStorage.previewTime;
            }
            sessionStorage.removeItem('previewTime');
        }

        if ($.playbackOptions) {
            String($.playbackOptions).replace(/(\d+)(\w)/g, function(m, v, k) {
                if (k === 's') {
                    options.startTime = v | 0;
                }
                else if (k === 'f') {
                    v = String(v | 0);
                    while (v.length < 6) {
                        if (v.length & 1) {
                            v = '1' + v;
                        }
                        v = '0' + v;
                    }
                    options.filter = v.slice(-6).split(/(.{2})/).filter(String);
                }
                else if (k === 'a') {
                    options.autoplay = options.preBuffer = v | 0;
                }
                else if (k === 'm') {
                    options.muted = videoElement.muted = v | 0;
                }
            });
            $.playbackOptions = null;
        }

        if (!options.type) {
            var c = MediaAttribute.getCodecStrings(node);
            if (c) {
                options.type = c && c[0];
            }
        }

        options.filesize = node.s;
        options.playtime = MediaAttribute(node).data.playtime;
        options.bitrate = options.filesize / options.playtime;

        if (d && options.bitrate && typeof bytesToSize === 'function') {
            console.info('%s, %s', node.name, bytesToSize(node.s),
                         secondsToTime(options.playtime), bytesToSpeed(options.bitrate));
        }

        var s = _getStreamerInstance(node, $wrapper, videoElement, options);

        destroy = destroy || function() {
            s.kill();
            $wrapper.trigger('video-destroy');
        };
        s.abort = destroy;

        if (!u_type) {
            mBroadcaster.once('login', function() {
                if (s.isOverQuota) {
                    s.file.flushRetryQueue();
                }
            });
        }

        s.on('inactivity', function(ev) {
            // Event invoked when the video becomes stalled, we'll show the loading/buffering spinner
            if (d) {
                console.debug(ev.type, ev);
            }

            var $pinner = $('.loader-grad', $wrapper);
            $pinner.removeClass('hidden');
            $('span', $pinner).text(navigator.onLine === false ? 'No internet access.' : '');

            if (this.isOverQuota) {
                var self = this;
                var file = this.file;
                var video = this.video;

                $wrapper.trigger('is-over-quota');
                dlmanager.showOverQuotaDialog(function() {
                    dlmanager.onNolongerOverquota();
                    file.flushRetryQueue();

                    if (video.paused) {
                        $pinner.removeClass('hidden');
                        onIdle(self.play.bind(self));
                    }
                });

                onOverQuotaCT = (s.currentTime | 0) + 1;

                eventlog(is_embed ? 99708 : folderlink ? 99709 : fminitialized ? 99710 : 99707);
            }
            else if (navigator.onLine && this.gotIntoBuffering) {
                var data = [
                    3,
                    s.hasVideo, s.hasAudio, Math.round(s.getProperty('bitrate')), s.getProperty('server'),
                    s.playbackTook, node.ph || node.h
                ];

                if (d) {
                    console.log(ev.type, data, this);
                }
                eventlog(99694, JSON.stringify(data), true);
            }

            return true; // continue listening
        });

        s.on('activity', function(ev) {
            // Event invoked when the video is no longer stalled
            if (d) {
                console.debug(ev.type, ev);
            }

            var $pinner = $('.loader-grad', $wrapper);
            if (this.file.playing) {
                // only hide the spinner if we are not in the initial loading state
                $pinner.addClass('hidden');
            }
            $pinner.find('span').text('');

            // if resumed from over bandwidth quota state.
            if (onOverQuotaCT && s.currentTime > onOverQuotaCT) {
                onOverQuotaCT = false;
                eventlog(99705);
            }

            return true; // continue listening
        });

        s.on('error', function(ev, error) {
            // <video>'s element `error` handler

            var emsg;
            var info = [2].concat(MediaAttribute.getCodecStrings(node)).concat(s.hasVideo, s.hasAudio);

            if (!$.dialog) {
                var hint = error.message || error;
                info.push(String(hint || 'na'));

                if (!hint && !mega.chrome) {
                    // Suggest Chrome...
                    hint = l[16151] + ' ' + l[242];
                }

                switch (String(hint)) {
                    case api_strerror(EBLOCKED):
                        if (!window.is_iframed) {
                            emsg = l.not_avbl_tos_msg;
                        }
                    /* fallthrough */
                    case api_strerror(ENOENT):
                    case api_strerror(EACCESS):
                        emsg = emsg || l[23];
                        break;
                    case 'The provided type is not supported':
                        emsg = l[17743];
                        break;
                    default:
                        emsg = hint;
                }

                if (s.options.autoplay) {
                    msgDialog('warninga', l[135], l[47], emsg);
                }
                else {
                    // $wrapper.removeClass('video-theatre-mode video');
                }
            }
            if (d) {
                console.debug('ct=%s, buf=%s', this.video.currentTime, this.stream.bufTime, error, info);
            }
            destroy();
            s.error = emsg;

            if (!d && String(Object.entries).indexOf('native') > 0
                && !window.buildOlderThan10Days && emsg && emsg !== l[23]) {

                eventlog(99669, JSON.stringify(info));
            }
            mBroadcaster.sendMessage('trk:event', 'videostream', 'error');
        });

        s.on('playing', function() {
            var events = {
                'WebM': 99681, 'MPEG Audio': 99684, 'M4A ': 99687, 'Wave': 99688, 'Ogg': 99689,
                'FLAC': 99712, 'Matroska': 99722, 'qt  ': 99725
            };
            var eid = events[s.options.type] || 99668;

            if (eid === 99684 && node.s > 41943040) {
                eid = 99685;
            }
            else if (eid === 99712 && node.s > 134217728) {
                eid = 99713;
            }

            console.assert(eid !== 99668 || is_video(node) !== 2, 'This is not a video...');
            eventlog(eid);

            if (/av0?1\b/i.test(s.hasVideo)) {
                eventlog(99721, JSON.stringify([1, s.hasVideo, s.hasAudio, s.options.type]));
            }
            if (/^h(?:ev|vc)1\b/i.test(s.hasVideo)) {
                var audio = s.hasAudio || '~' + s.hasUnsupportedAudio;
                eventlog(99738, JSON.stringify([1, s.hasVideo, audio, s.options.type]));
            }
            if (s.hasAudio && /\b[ae]+c-?3\b/i.test(s.hasAudio)) {
                eventlog(99820, JSON.stringify([1, s.hasVideo, s.hasAudio, s.options.type]));
            }
            if (is_embed) {
                // Watch correlation with 99686
                eventlog(99824, true);
            }
            mBroadcaster.sendMessage('trk:event', 'videostream', 'playing', s);

            if (!is_audio(node)) {
                $(videoElement).css('background-image', ``);
            }
        });

        if (typeof dataURLToAB === 'function') {
            _makethumb(node, s);
        }

        $(window).rebind('video-destroy.main', function() {
            $('.mobile.filetype-img').removeClass('hidden');
            s.kill();
        });

        return s;
    };

    /**
     * Toggle hiding and showing the mobile video controls
     * @param $wrapper
     * @private
     */
    mega.initMobileVideoControlsToggle = function($wrapper) {
        var $video = $('.video-block', $wrapper);
        var $videoControl = $('.video-controls', $wrapper);
        var $adControl = $('.viewer-vad-control', $wrapper);
        var videoElement = $('video', $video).get(0);

        _initHideMobileVideoControls($wrapper);

        $video.rebind('touchstart', ev => {
            if (videoElement && videoElement.ended) {
                $('.play-video-button', $wrapper).trigger('click');
                return false;
            }
            if ($(ev.target).is('.mobile-gallery, #video, #mobile-video')) {
                if ($videoControl.hasClass('invisible')) {
                    $adControl.removeClass('bottom');
                    $videoControl.removeClass('invisible');
                    _initHideMobileVideoControls($wrapper);
                }
                else {
                    $videoControl.addClass('invisible');
                    $adControl.addClass('bottom');
                }
            }
            else {
                var $videoControls = $(ev.target).closest('.video-controls');
                if ($videoControls.length && !$videoControls.hasClass('timeDrag')) {
                    _initHideMobileVideoControls($wrapper);
                }
            }
        });
    };

    /**
     * Fire video stream
     * @param {MegaNode} node An ufs node
     * @param {Object} wrapper Video element wrapper
     * @param {Function} [destroy] Function to invoke when the video is destroyed
     * @param {Object} [options] Streamer options
     * @returns {MegaPromise}
     * @global
     */
    global.initVideoStream = function(node, wrapper, destroy, options) {
        var _init = function() {
            dlmanager.setUserFlags();
            return _initVideoStream(node, wrapper, destroy, options);
        };
        return new MegaPromise(function(resolve, reject) {
            if (typeof Streamer !== 'undefined') {
                return resolve(_init());
            }
            M.require('videostream').tryCatch(function() {
                resolve(_init());
            }, function(ex) {
                msgDialog('warninga', l[135], l[47], ex);
                reject(ex);
            });
        });
    };

    /**
     * Initialize common video player layout for the downloads and embed pages
     * @param {MegaNode} node An ufs node
     * @param {Object} $wrapper Video element wrapper
     * @param {Object} [options] Streamer options
     * @returns {MegaPromise}
     * @global
     */
    global.iniVideoStreamLayout = function(node, $wrapper, options) {
        var $fileinfoBlock = $('.download.file-info', $wrapper);
        var $fn = $('.big-txt', $fileinfoBlock);

        if (!$.trim($fn.text())) {
            $fn.text(node.name);
        }

        return new MegaPromise(function(resolve, reject) {
            MediaAttribute.canPlayMedia(node).then(function(yup) {
                var $video = $('video', $wrapper);
                var c = MediaAttribute.getCodecStrings(node);
                if (c) {
                    $fn.attr('title', node.name + ' (' + c + ')');
                    getImage(node, 1).then(uri => {
                        const a = !is_audio(node) && MediaAttribute(node).data || false;
                        $video.css('background-size', a.width > a.height ? 'cover' : 'contain');
                        $video.css('background-image', `url(${uri})`);
                    }).catch(dump);
                }

                var $videoControls = $('.video-controls', $wrapper);
                var $playVideoButton = $('.play-video-button', $wrapper);

                if (!$video.length) {
                    return reject(new Error('No video element found...'));
                }

                if (!yup) {
                    if (String(node.fa).indexOf(':8*') > 0 && isMediaSourceSupported()) {
                        eventlog(99714, JSON.stringify([1, node.ph || node.h].concat(c)));
                    }
                    return resolve(false);
                }

                // Disable default video controls
                $video.get(0).controls = false;

                options = Object.assign({autoplay: false, preBuffer: true}, options);

                var vsp = options.preBuffer && initVideoStream(node, $wrapper, options);

                $playVideoButton.rebind('click', function() {
                    if (dlmanager.isOverQuota) {
                        $wrapper.trigger('is-over-quota');
                        return dlmanager.showOverQuotaDialog();
                    }

                    if (typeof mediaCollectFn === 'function') {
                        onIdle(mediaCollectFn);
                        mediaCollectFn = null;
                    }

                    // Show Loader until video is playing
                    $('.loader-grad', $wrapper).removeClass('hidden');
                    $(this).addClass('hidden');

                    if (!vsp) {
                        vsp = initVideoStream(node, $wrapper, options);
                        resolve(vsp);
                    }

                    vsp.done(function(stream) {
                        if (stream.error) {
                            onIdle(function() {
                                $wrapper.removeClass('video-theatre-mode video');
                            });
                            return msgDialog('warninga', l[135], l[47], stream.error);
                        }

                        // _makethumb(node, stream);
                        if (is_embed) {
                            node.stream = stream;
                        }
                        stream.start();
                    }).fail(console.warn.bind(console));

                    $wrapper.addClass('video-theatre-mode');
                    $videoControls.removeClass('hidden');

                    if (is_mobile) {
                        requestAnimationFrame(() => mega.initMobileVideoControlsToggle($wrapper));
                    }
                });

                if (vsp) {
                    resolve(vsp);
                }
            }).catch(reject);
        });
    };

})(self);

// ---------------------------------------------------------------------------------------------------------------

(function _MediaInfoLib(global) {
    'use strict';

    var mediaCodecs = null;
    var mediaInfoLib = null;
    var mediaInfoTasks = null;
    var mediaInfoExtensions =
        '.264.265.3g2.3ga.3gp.3gpa.3gpp.3gpp2.aac.aacp.ac3.act.adts.aif.aifc.aiff.als.apl.at3.avc' +
        '.avi.dd+.dde.divx.dts.dtshd.eac3.ec3.evo.f4a.f4b.f4v.flac.gvi.h261.h263.h264.h265.hevc.isma' +
        '.ismt.ismv.ivf.jpm.k3g.m1a.m1v.m2a.m2p.m2s.m2t.m2v.m4a.m4b.m4p.m4s.m4t.m4v.m4v.mac.mkv.mk3d' +
        '.mka.mks.mlp.mov.mp1.mp1v.mp2.mp2v.mp3.mp4.mp4v.mpa1.mpa2.mpeg.mpg.mpgv.mpv.mqv.ogg.ogm.ogv' +
        '.omg.opus.qt.sls.spx.thd.tmf.trp.ts.ty.vc1.vob.vr.w64.wav.webm.wma.wmv.';

    if (d > 7) {
        mediaInfoExtensions +=
            '.aa3.amr.ape.asf.au.caf.dif.drc.dv.jpx.la.lxf.mpc.mp+.mtv.nsv.nut.oma.pss.qcp.rka.shn.tak.tp.vqf.wv.y4m.';
    }

    /**
     * Creates a new MediaInfo report. Do not use except for instanceof tests.
     * @constructor
     * @private
     */
    var MediaInfoReport = function MediaInfoReport() {
        var data = JSON.parse(mediaInfoLib.inform());
        var keys = Object.keys(data);

        for (var i = keys.length; i--;) {
            var k = keys[i];
            var v = data[k];

            if (Array.isArray(v)) {
                var a = [];

                for (var j = v.length; j--;) {
                    a.unshift(Object.assign(Object.create(null), v[j]));
                }

                v = a.map(Object.freeze);
            }
            else {
                v = Object.assign(Object.create(null), v);
            }

            Object.defineProperty(this, k, {value: Object.freeze(v), enumerable: true});
        }
    };
    MediaInfoReport.prototype = Object.create(null);

    Object.defineProperty(MediaInfoReport.prototype, 'getCodecID', {
        value: function(type, codec) {
            return mediaCodecs && mediaCodecs[type] && Object(mediaCodecs[type][codec]).idx | 0;
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'getCodec', {
        value: function(type) {
            var codec = Object(this[type] && this[type][0]);
            if (codec.CodecID || codec.Format) {
                codec = String(codec.CodecID || codec.Format).split(' / ');

                for (var i = codec.length; i--;) {
                    if (this.getCodecID(type.toLowerCase(), codec[i])) {
                        return codec[i];
                    }
                }

                return String(codec);
            }

            return '';
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'addMediaData', {
        value: function(file, timeout = 9) {
            return Promise.race([tSleep(timeout), MediaAttribute.getMediaData(file)])
                .then((res) => {
                    if (res) {
                        const {duration, width, height} = res;

                        if (!this.width && width > 0) {
                            Object.defineProperty(this, 'width', {value: width});
                        }
                        if (!this.height && height > 0) {
                            Object.defineProperty(this, 'height', {value: height});
                        }
                        if (!this.playtime && duration > 0) {
                            Object.defineProperty(this, 'playtime', {value: duration});
                        }
                    }
                    return res;
                });
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'container', {
        get: function() {
            return this.General && (this.General.CodecID || this.General.Format) || '';
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'acodec', {
        get: function() {
            return this.getCodec('Audio');
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'vcodec', {
        get: function() {
            return this.getCodec('Video');
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'playtime', {
        get: function() {
            var a = Object(this.Audio && this.Audio[0]);
            var v = Object(this.Video && this.Video[0]);
            return (this.General && this.General.Duration || v.Duration || a.Duration || 0) / 1e3;
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'width', {
        get: function() {
            var v = Object(this.Video && this.Video[0]);
            return v.Width | 0;
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'height', {
        get: function() {
            var v = Object(this.Video && this.Video[0]);
            return v.Height | 0;
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'rotation', {
        get: function() {
            var v = Object(this.Video && this.Video[0]);
            return v.Rotation | 0;
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'shortformat', {
        get: function() {
            var fmt = this.container + ':' + this.vcodec + ':' + this.acodec;
            return (mediaCodecs && Object(mediaCodecs.shortformat)[fmt]) | 0;
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'fps', {
        get: function() {
            var v = Object(this.Video && this.Video[0]);
            var fps = v.FrameRate || this.General && this.General.FrameRate;

            if (!fps) {
                if (v.FrameRate_Den && v.FrameRate_Num) {
                    fps = v.FrameRate_Num / v.FrameRate_Den;
                }

                fps = fps || v.FrameRate_Original;
            }

            return parseFloat(fps) || 0;
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'containerid', {
        get: function() {
            return this.getCodecID('container', this.container);
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'vcodecid', {
        get: function() {
            return this.getCodecID('video', this.vcodec);
        }
    });
    Object.defineProperty(MediaInfoReport.prototype, 'acodecid', {
        get: function() {
            return this.getCodecID('audio', this.acodec);
        }
    });

    /**
     * Instantiates a new instance for mediainfo inspection.
     * @param {String|Object} [entry] The entry to analyze.
     * @param {Object} [options] Options such as chunkSize etc
     * @returns {MediaInfoLib}
     * @constructor
     */
    var MediaInfoLib = function MediaInfoLib(entry, options) {
        if (!(this instanceof MediaInfoLib)) {
            return new MediaInfoLib(entry, options);
        }
        if (typeof options === 'number') {
            options = {chunkSize: options};
        }

        options = Object(options);
        var chunkSize = options.chunkSize;

        this.entry = entry;

        if (!entry || entry instanceof Blob) {
            this.fetcher = this._fileReader;
        }
        else {
            this.fetcher = this._gfsReader;
            chunkSize = chunkSize || 0x40000;
        }

        this.options = options;
        this.chunkSize = chunkSize || 0x400000;
    };
    MediaInfoLib.prototype = Object.create(null);
    MediaInfoLib.prototype.constructor = MediaInfoLib;

    MediaInfoLib.build = 1;
    MediaInfoLib.version = 1710;

    /**
     * Retrieve an object name.
     * @param {File|MegaNode|String} n The entry to get the name from
     * @returns {String}
     */
    MediaInfoLib.getObjectName = function(n) {
        return String(n && n.name || Object(M.d[n]).name || n);
    };

    /**
     * Checks whether the provided file object can be parsed by mediainfo
     * @param {File|MegaNode|String} n The entry to get the name from, as per getObjectName()
     * @returns {Boolean}
     */
    MediaInfoLib.isFileSupported = function(n) {
        var ext = fileext(MediaInfoLib.getObjectName(n));

        return mediaInfoExtensions.indexOf('.' + ext + '.') >= 0;
    };

    /**
     * Retrieve the Media Codecs list, either from API or indexedDB
     * @returns {Promise}
     */
    MediaInfoLib.getMediaCodecsList = function() {
        if (mediaCodecs) {
            if (mediaCodecs instanceof Promise) {
                return mediaCodecs;
            }

            return Promise.resolve(mediaCodecs);
        }

        const cls = tryCatch(() => {
            // This is 84KB, let's expunge it until the user comes back to an embed player.
            delete localStorage['<mc>'];
        });

        mediaCodecs = new Promise(function(resolve, reject) {
            var db;
            var apiReq = function() {
                var prc = function(res) {
                    if (!Array.isArray(res) || res.length !== 2) {
                        if (d) {
                            console.warn('Unexpected response, will keep using cached codecs..if any', res);
                        }
                        return reject(res);
                    }

                    var data = {
                        container: {byIdx: {}},
                        video: {byIdx: {}},
                        audio: {byIdx: {}},
                        shortformat: {byIdx: {}}
                    };
                    var keys = Object.keys(data);
                    var stringify = function(s) {
                        return String(s || '');
                    };

                    for (var i = 0; i < res[1].length; i++) {
                        var sec = res[1][i];
                        var key = keys[i];
                        if (i > 2) {
                            for (var j = 0; j < sec.length; j++) {
                                var fmt =
                                    stringify(data.container.byIdx[sec[j][1]])
                                    + ':' + stringify(data.video.byIdx[sec[j][2]])
                                    + ':' + stringify(data.audio.byIdx[sec[j][3]]);
                                data[key][fmt] = sec[j][0];
                                data[key].byIdx[sec[j][0]] = fmt;
                            }
                        }
                        else {
                            for (var x = 0; x < sec.length; x++) {
                                var id = sec[x][0];
                                var codec = sec[x][1];
                                data[key][codec] = {idx: id, mime: stringify(sec[x][2])};
                                data[key].byIdx[id] = codec;
                            }
                        }
                    }

                    if (!data.shortformat['mp42:avc1:mp4a-40-2']) {
                        if (d) {
                            console.warn('Invalid mediaCodecs list...', data);
                        }
                        return reject(EFAILED);
                    }

                    data.version = res[0] | 0;
                    mediaCodecs = deepFreeze(data);

                    if (data.version < 3) {
                        console.error('Got unexpected mc-list version.', data.version, res);
                    }
                    resolve(mediaCodecs);

                    if (db) {
                        queueMicrotask(cls);
                        return db.kv.put({k: 'l', t: Date.now(), v: data});
                    }

                    tryCatch(() => {
                        if (data.version > 2) {
                            localStorage['<mc>'] = JSON.stringify([Date.now(), data]);
                        }
                    })();
                };
                return api.req({a: 'mc'}).then(({result}) => prc(result));
            };

            reject = (function(reject) {
                return function(e) {
                    if (mediaCodecs instanceof Promise) {
                        mediaCodecs = false;
                        if (d) {
                            console.warn('Media codecs list retrieval failed...', e);
                        }
                        reject(e);
                    }
                    else {
                        resolve(mediaCodecs);
                    }
                };
            })(reject);

            if (typeof Dexie === 'undefined') {

                const data = tryCatch(() => {
                    if (localStorage['<mc>']) {
                        const [ts, data] = JSON.parse(localStorage['<mc>']);

                        if (Date.now() < ts + 864e6) {

                            return deepFreeze(data);
                        }
                    }
                })();

                if (data) {
                    queueMicrotask(() => resolve(mediaCodecs = data));
                }
                else {
                    queueMicrotask(cls);
                    apiReq().catch(reject);
                }
            }
            else {
                const timer = setTimeout(() => apiReq().catch(reject), 1400);

                db = new Dexie('$mcv1');
                db.version(1).stores({kv: '&k'});

                db.kv.get('l')
                    .then((r) => {
                        if (!r) {
                            throw ENOENT;
                        }
                        mediaCodecs = deepFreeze(r.v);

                        if (Date.now() < r.t + 864e6) {
                            clearTimeout(timer);
                            resolve(mediaCodecs);
                        }
                    })
                    .catch((ex) => {
                        dump(db.name, ex);
                        clearTimeout(timer);
                        if (ex !== ENOENT) {
                            db = null;
                        }
                        return apiReq();
                    })
                    .catch(reject);
            }
        });

        return mediaCodecs;
    };

    /**
     * Collect mediainfo metadata from a list of provided entries
     * @param {Array|FileList} entries An iterable list of entries
     * @param {Object} [options]
     * @returns {Promise}
     */
    MediaInfoLib.collect = function(entries, options) {
        return new Promise(function(resolve) {
            var pending = 0;
            var bytesRead = 0;
            var totalBytes = 0;
            var result = Object.create(null);
            var summary = Object.create(null);
            var saveNode = function(n, err, res) {
                if (err) {
                    result[n.h] = new Error(err);
                }
                else {
                    res.n = n;
                    result[n.h] = res;
                    bytesRead += res.bytesRead;
                    summary[n.h] = n.h + ':...' + String(n.name).substr(-7)
                        + ':' + res.container + ':' + res.vcodec + ':' + res.acodec;
                }

                if (!--pending) {
                    result.summary = summary;
                    result.totalBytes = totalBytes;
                    result.totalBytesRead = bytesRead;
                    resolve(result);
                }
            };
            var parse = function(n) {
                totalBytes += n.s;

                MediaInfoLib(n.file || n.h, options)
                    .getMetadata()
                    .then(function(res) {
                        saveNode(n, false, res);
                    })
                    .catch(function(err) {
                        saveNode(n, err || true);
                    });
            };

            options = Object.assign({
                maxAtOnce: 10,
                chunkSize: -1,
                maxBytesRead: 6291456
            }, options);

            for (var i = entries.length; i--;) {
                var entry = new MediaAttribute(entries[i]);
                var size = M.getNodeShare(entry).down ? -1 : entry.s || entry.size || 0;

                if (size > 16 && MediaInfoLib.isFileSupported(entry) && entry.weak) {
                    parse(entry);
                    if (++pending > options.maxAtOnce) {
                        break;
                    }
                }
            }

            if (pending < 1) {
                resolve({});
            }
        });
    };

    /**
     * Test files against mediainfo
     * @param {FileList} files An iterable list of Files
     * @private
     */
    MediaInfoLib.test = function(files) {
        var extensions = Object.create(null);

        for (var i = files.length; i--;) {
            extensions[fileext(files[i].name)] = 1;
        }

        console.time('MediaInfoLibTest');

        MediaInfoLib.collect(files, {
            maxAtOnce: 0x20000,
            chunkSize: 0x400000,
            maxBytesRead: 0x1000000
        }).then(function(res) {
            var containers = [];
            var audiocodecs = [];
            var videocodecs = [];
            var unknown = [];
            var newaudio = [];
            var newvideo = [];
            var newcontainer = [];
            var errors = [];
            var overread = [];
            var overtime = [];
            var combos = {};
            var cnt = 0;

            console.debug('MediaInfo.collect result', res);

            for (var k in res) {
                if (res[k] instanceof MediaInfoReport) {
                    var r = res[k];
                    var n = r.n;
                    var combo = r.container + ':' + r.vcodec + ':' + r.acodec;

                    if (!combos[combo]) {
                        combos[combo] = 1;
                    }
                    else {
                        combos[combo]++;
                    }

                    r.fa = n.toAttributeString(r);
                    r.a = n.fromAttributeString(
                        String(r.fa).split('/').map(function(a) {
                            return 'cl:' + a;
                        }).join('/')
                    );

                    containers.push(r.container);
                    audiocodecs.push(r.acodec);
                    videocodecs.push(r.vcodec);

                    if (!r.containerid) {
                        newcontainer.push(r.container);
                    }
                    if (!r.vcodecid) {
                        newvideo.push(r.vcodec);
                    }
                    if (!r.acodecid) {
                        newaudio.push(r.acodec);
                    }

                    if (r.a.shortformat === 0xff) {
                        unknown.push(r);
                    }

                    if (r.bytesRead > 0x1000000) {
                        overread.push(r);
                    }
                    if (r.entry.took > 450) {
                        overtime.push(r);
                    }

                    ++cnt;
                }
                else if (res[k] instanceof Error) {
                    errors.push(res[k]);
                }
            }

            console.log('containers', array.unique(containers).filter(String));
            console.log('audiocodecs', array.unique(audiocodecs).filter(String));
            console.log('videocodecs', array.unique(videocodecs).filter(String));
            console.log('new-containers', array.unique(newcontainer).filter(String));
            console.log('new-audiocodecs', array.unique(newaudio).filter(String));
            console.log('new-videocodecs', array.unique(newvideo).filter(String));
            console.log('Unknown(shortformat=255)', unknown.length ? unknown : 'NONE!');
            console.log('Files with errors', errors.length ? errors : 'NONE!');
            console.log('overread', overread.length ? overread : 'NONE!');
            console.log('overtime', overtime.length ? overtime : 'NONE!');
            console.log('extensions', Object.keys(extensions));
            console.log('combos', combos);
            console.log('MediaInfoLib.test finished, processed %s/%s (%s%% media) files, %s%% were unrecognized',
                cnt, files.length, cnt * 100 / files.length | 0, unknown.length * 100 / cnt | 0);

            console.timeEnd('MediaInfoLibTest');

        }).catch(console.warn.bind(console));
    };

    /**
     * Returns the Media Codecs list, if already retrieved...
     * @name avflist
     */
    Object.defineProperty(MediaInfoLib, 'avflist', {
        get: function() {
            return mediaCodecs;
        }
    });

    /**
     * Inspect file with mediainfo
     * @param {File|MegaNode|String} [file] The file entry to inspect, if not provided with the constructor
     * @returns {Promise}
     */
    MediaInfoLib.prototype.getMetadata = function(file) {
        var self = this;
        file = file || self.entry;

        return new Promise(function(resolve, reject) {
            /*if (!MediaInfoLib.isFileSupported(file)) {
                // unsupported/non-media file.
                return reject(null);
            }*/

            reject = self._wrapOnNextTask(reject);
            resolve = self._wrapOnNextTask(resolve);

            var task = [file, resolve, reject];
            if (mediaInfoTasks) {
                mediaInfoTasks.push(task);
            }
            else {
                mediaInfoTasks = [];

                Promise.all([
                    self._loadMediaInfo(),
                    MediaInfoLib.getMediaCodecsList()
                ]).then(self._parseMediaFile.bind(self, task)).catch(reject);
            }
        });
    };

    /**
     * Load mediainfo.js
     * @returns {Promise}
     * @private
     */
    MediaInfoLib.prototype._loadMediaInfo = function() {
        return new Promise(function(resolve, reject) {
            if (mediaInfoLib) {
                resolve();
            }
            else {
                var xhr = new XMLHttpRequest();
                var urlPath = is_extension ? '' : '/';
                var memFile = urlPath + 'mediainfo.mem';

                xhr.open('GET', memFile);
                xhr.responseType = 'arraybuffer';
                xhr.send(null);

                M.require('mediainfo')
                    .tryCatch(function() {
                        var options = {
                            memoryInitializerRequest: xhr,
                            memoryInitializerPrefixURL: urlPath
                        };
                        MediaInfo(options)
                            .then(function(lib) {
                                mediaInfoLib = lib;
                                if (d) {
                                    global.mediaInfoLib = lib;
                                    console.log('Using %s', lib.getOption('info_version'));
                                }
                                resolve();
                            }).catch(reject);
                    }, reject);
            }
        });
    };

    /**
     * Dispatch next queued task, if any
     * @private
     */
    MediaInfoLib.prototype._dspNextTask = function() {
        var nextTask = mediaInfoTasks && mediaInfoTasks.pop();

        if (nextTask) {
            onIdle(this._parseMediaFile.bind(this, nextTask));
        }
        else {
            mediaInfoTasks = false;
        }

        // in case it was used
        if (mediaInfoLib) {
            mediaInfoLib.close();
        }
    };

    /**
     * Wrap a function call through auto-dispatching of queued pending tasks
     * @param {Function} callback
     * @returns {Function}
     * @private
     */
    MediaInfoLib.prototype._wrapOnNextTask = function(callback) {
        var self = this;

        return function _miTaskDSP() {
            self._dspNextTask();
            return callback.apply(this, arguments);
        };
    };

    /**
     * MediaInfo parsing logic used by getMetadata()
     * @param {Array} task
     * @private
     */
    MediaInfoLib.prototype._parseMediaFile = function(task) {
        var self = this;
        var entry = {file: task[0]};
        var reject = task[2].bind(this);
        var resolve = task[1].bind(this);
        var initialized = false;

        if (!mediaCodecs) {
            if (d) {
                console.warn('will not parse this media file since no media codecs list found...', entry);
            }
            return reject(ENOENT);
        }

        if (d) {
            console.time('mediaInfoLibTask');
        }

        var bytesRead = 0;
        var byteOffset = 0;
        var took = Date.now();
        (function _nextChunk(byteLength) {
            self.fetcher(entry, byteOffset, byteLength)
                .then(function(chunk) {
                    var file = entry.file;

                    if (!initialized) {
                        if (!mediaInfoLib.openBufferInit(file.size, 0)) {
                            return reject(EFAILED);
                        }
                        initialized = true;
                    }

                    var finished = false;
                    var length = chunk.byteLength;
                    var state = mediaInfoLib.openBufferContinue(chunk, length);
                    bytesRead += length;

                    if (state & 8 || !length) {
                        if (d && !length) {
                            console.warn('MediaInfoLib(%s:%s) Premature EOF!', file.name, file.size);
                        }
                        finished = true;
                    }
                    else if (bytesRead > self.options.maxBytesRead) {
                        if (d) {
                            console.debug('MediaInfoLib(%s:%s) maxBytesRead...', file.name, file.size, bytesRead);
                        }
                        finished = true;
                    }
                    else {
                        var seekTo = mediaInfoLib.openBufferGetSeekTo();

                        if (d) {
                            console.debug('MediaInfoLib(%s:%s) len=%s, state=%s, offset=%s',
                                file.name, file.size, length, state, byteOffset, seekTo);
                        }

                        if (seekTo === -1) {
                            byteOffset += length;

                            if (byteOffset === file.size) {
                                if (d) {
                                    console.debug('MediaInfoLib(%s:%s) EOF Reached.', file.name, file.size);
                                }
                                finished = true;
                            }
                        }
                        else if (seekTo === file.size) {
                            if (d) {
                                console.debug('MediaInfoLib(%s:%s) No more data needed.', file.name, file.size);
                            }
                            finished = true;
                        }
                        else {
                            byteOffset = seekTo;
                            mediaInfoLib.openBufferInit(file.size, seekTo);
                        }
                    }

                    if (state & 3 && !finished && self._isInformReady()) {
                        if (d) {
                            console.debug('MediaInfoLib(%s:%s) Enough data, apparently...', file.name, file.size);
                        }
                        finished = true;
                    }

                    if (finished) {
                        mediaInfoLib.openBufferFinalize();

                        if (Object.isExtensible(file)) {
                            file.took = Date.now() - took;
                        }

                        if (d) {
                            console.timeEnd('mediaInfoLibTask');
                            console.debug('MediaInfoLib(%s:%s) Parsing finished, state=%s, bytesRead=%s',
                                file.name, file.size, state, bytesRead, byteOffset);
                        }

                        var res = new MediaInfoReport();
                        res.bytesRead = bytesRead;
                        res.entry = file;

                        Promise.resolve(res.playtime)
                            .then((time) => {
                                if (!time && file instanceof Blob) {
                                    return res.addMediaData(file);
                                }
                            })
                            .catch(dump)
                            .finally(() => resolve(res));
                    }
                    else {
                        _nextChunk(self.chunkSize < 0x2000 ? Math.min(0x80000, length << 1) : self.chunkSize);
                    }
                })
                .catch(reject);
        })(16384);
    };

    /**
     * Check whether we need to continue feeding mediainfo with more data
     * @returns {Boolean}
     * @private
     */
    MediaInfoLib.prototype._isInformReady = function() {
        // TODO: find a more proper way to query this...

        try {
            var r = JSON.parse(mediaInfoLib.inform());
            if (d) {
                console.debug('MediaInfoLib(in-progress-report)', r);
            }
            var g = r.General;
            var v = r.Video;
            var a = r.Audio;
            if (g) {
                // we do assume that if the duration is set everything else must be as well
                if (g.Duration) {
                    return true;
                }
                var mime = g.InternetMediaType;

                if (String(mime).startsWith('audio/')) {
                    return a && a[0].Duration;
                }

                // FIXME: we'd read more data than needed for videos with no audio
                return v && v[0].Duration && a && a[0].Duration;
            }
        }
        catch (ex) {
        }

        return false;
    };

    /**
     * MediaInfo's local file reader
     * @param {File|Blob} entry The entry to read from
     * @param {Number} byteOffset
     * @param {Number} byteLength
     * @returns {Promise}
     * @private
     */
    MediaInfoLib.prototype._fileReader = function(entry, byteOffset, byteLength) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            var blob = entry.file.slice(byteOffset, byteOffset + byteLength);
            reader.onload = function(ev) {
                if (ev.target.error) {
                    reject(ev.target.error);
                }
                else {
                    resolve(ev.target.result);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
            reader = blob = undefined;
        });
    };

    /**
     * MediaInfo's network file reader
     * @param {String} entry The entry to read from
     * @param {Number} byteOffset
     * @param {Number} byteLength
     * @returns {Promise}
     * @private
     */
    MediaInfoLib.prototype._gfsReader = function(entry, byteOffset, byteLength) {
        return new Promise(function(resolve, reject) {
            if (byteOffset > entry.file.size) {
                // this should throw a premature eof
                return resolve(new ArrayBuffer(0));
            }

            M.gfsfetch(entry.file, byteOffset, byteOffset + byteLength)
                .then((data) => {
                    const {buffer} = data;
                    if (typeof entry.file === 'string') {
                        data = data.payload;
                        data.size = data.s;
                        entry.file = data;
                    }
                    resolve(buffer);
                })
                .catch(reject);
        });
    };

    /**
     * @name MediaInfoLib
     * @global
     */
    Object.defineProperty(global, 'MediaInfoLib', {value: Object.freeze(MediaInfoLib)});
    /**
     * @name MediaInfoReport
     * @global
     */
    Object.defineProperty(global, 'MediaInfoReport', {value: Object.freeze(MediaInfoReport)});

    if (d) {
        global.mediaInfoTasks = mediaInfoTasks;
    }

    var miCollectedBytes = 0;
    var miCollectRunning = 0;
    const miCollectProcess = function(force, nodes) {
        // @todo improve depending whether 'nodes' is provided..
        if (!force && miCollectedBytes > 0x4000000 || M.chat) {
            return;
        }

        if (miCollectRunning) {
            if (d) {
                console.debug('MediaInfo collect already running...');
            }
            return;
        }

        if (M.currentrootid === M.RubbishID) {
            delay.cancel('mediainfo:collect');
            return;
        }

        delay('mediainfo:collect', () => {
            miCollectRunning = true;

            if (d) {
                console.debug('MediaInfo collect running...');
                console.time('mediainfo:collect');
            }

            var finish = function() {
                if (d) {
                    console.debug('MediaInfo collect finished.');
                    console.timeEnd('mediainfo:collect');
                }
                miCollectRunning = false;
            };
            nodes = nodes || M.v;

            const opt = {
                maxAtOnce: force && nodes.length || 32
            };
            MediaInfoLib.collect(nodes, opt)
                .then((res) => {
                    var pending = 0;
                    var process = function() {
                        if (--pending < 1) {
                            onIdle(finish);
                        }
                    };
                    var submit = function(res) {
                        var n = res.n;

                        n.store(res).then(function() {
                            if (d) {
                                console.debug('MediaInfo submit successful', res, arguments);
                            }
                            process();
                        }).catch(function() {
                            if (d) {
                                console.warn('MediaInfo submit error...', res, arguments);
                            }
                            process();
                        });

                        ++pending;
                    };

                    if (d) {
                        console.debug('MediaInfo collect completed, submitting file attributes...', res);
                    }
                    miCollectedBytes += res.totalBytesRead | 0;

                    for (var k in res) {
                        if (res[k] instanceof MediaInfoReport) {
                            submit(res[k]);
                        }
                    }

                    if (!pending) {
                        if (d) {
                            console.debug('No media attributes to submit...');
                        }
                        finish();
                    }
                })
                .catch(function(e) {
                    if (d) {
                        console.warn('MediaInfo collect error...', e);
                    }
                    finish();
                });
        }, force || 4e3);
    };

    const dayOfMonth = new Date().getDate();

    if (!localStorage.noMediaCollect) {
        const shouldRun = () => {
            const n = M.getNodeByHandle(M.currentCustomView.nodeID || M.currentdirid);

            return n && mega.fileRequest.publicFolderExists(n.h);
        };
        const collector = tryCatch((...args) => {
            const force = args[0] > 0;

            if (force || dayOfMonth > 27 || shouldRun()) {

                miCollectProcess.apply(self, force && args || []);
            }
        });
        mBroadcaster.addListener('mega:openfolder', collector);
        mBroadcaster.addListener('mediainfo:collect', collector);
    }

})(self);

(function _MediaAttribute(global) {
    'use strict';

    const mp4brands = new Set([
        'mp41', 'mp42', 'mp4v',
        'isom', 'iso2', 'iso4', 'iso5',
        '3gp4', '3gp5', '3gp6', '3gp7', '3gp8',
        'avc1', 'f4v ', 'nvr1', 'FACE', 'M4V ', 'M4VH', 'M4VP', 'XAVC', 'MSNV'
    ]);

    function xxkey(k) {
        var key = new Uint32Array(4);

        for (var i = 4; i--;) {
            key[i] = k[i + 4];
        }

        return key;
    }

    function formatfileattr(id, v, k) {
        v = xxtea.encryptUint32Array(v, xxkey(k));

        return id + '*' + ab_to_base64(v.buffer);
    }

    /**
     * Initializes an entry to handle media file attributes
     * @param {File|MegaNode} [entry]
     * @param {Array} [key] 8-element Array with the file's key
     * @returns {MediaAttribute}
     * @constructor
     */
    function MediaAttribute(entry, key) {
        if (!(this instanceof MediaAttribute)) {
            return new MediaAttribute(entry, key);
        }

        if (entry instanceof MegaNode) {
            Object.assign(this, entry);
        }
        else if (entry instanceof File) {
            // File entries are only used during tests
            this.file = entry;
            this.name = entry.name;
            this.k = [1, 2, 3, 4, 5, 6, 7, 8];
            this.s = entry.size;
            this.h = makeUUID().substr(8, 8).toUpperCase();
        }

        this.k = this.k || key || entry;
    }

    MediaAttribute.prototype = Object.create(null);
    MediaAttribute.prototype.constructor = MediaAttribute;

    /**
     * Set media attributes if not already set
     * @param {MegaNode|Object} entry The node
     * @returns {Promise}
     */
    MediaAttribute.setAttribute = function(entry) {
        return new Promise(function(resolve, reject) {
            if (!(entry instanceof MegaNode)) {
                if (typeof entry !== 'object'
                    || String(entry.h).length !== 8
                    || !Array.isArray(entry.k)
                    || entry.k.length !== 8) {

                    return reject(EINCOMPLETE);
                }

                entry = new MegaNode(entry);
            }

            entry = new MediaAttribute(entry);

            if (!MediaInfoLib.isFileSupported(entry) || !((entry.s || entry.size) > 16)) {
                resolve(ENOENT);
            }
            else if (!entry.weak) {
                resolve(EEXIST);
            }
            else {
                MediaInfoLib(entry.link || entry.h, -1)
                    .getMetadata()
                    .then(entry.store.bind(entry))
                    .then(resolve)
                    .catch(reject);
            }
        });
    };

    var audioElement = document.createElement('audio');

    /**
     * Test a media attribute's decoded properties against MediaSource.isTypeSupported()
     * @param {String} container
     * @param {String} [videocodec]
     * @param {String} [audiocodec]
     * @returns {Number} 1: is video, 2: is audio, 0: not supported
     */
    MediaAttribute.isTypeSupported = function(container, videocodec, audiocodec) {
        var mime;
        var canPlayMSEAudio = function() {
            if (!videocodec && audiocodec) {
                audiocodec = String(audiocodec).replace(/-/g, '.').toLowerCase(); // fLaC

                if (String(audiocodec).startsWith('mp4a')) {
                    var swap = {'mp4a': 'mp4a.40.2', 'mp4a.69': 'mp3', 'mp4a.6b': 'mp3'};
                    audiocodec = swap[audiocodec] || audiocodec;
                }
                var amime = 'audio/mp4; codecs="' + audiocodec + '"';
                if (mega.chrome && audiocodec === 'mp3') {
                    amime = 'audio/mpeg';
                }
                return MediaSource.isTypeSupported(amime) ? 2 : 0;
            }
            return 0;
        };

        const format = isMediaSourceSupported() ? mp4brands.has(container) ? '--mp4-brand--$' : container : 0;
        switch (format) {
            case '--mp4-brand--$':
            case 'qt  ' + (mega.chrome || audiocodec ? '$' : ''):
                if (videocodec === 'avc1') {
                    mime = 'video/mp4; codecs="avc1.640029';

                    if (0 && String(audiocodec).startsWith('mp4a')) {
                        if (audiocodec === 'mp4a') {
                            audiocodec = 'mp4a.40.2';
                        }
                        mime += ', ' + audiocodec.replace(/-/g, '.');
                    }

                    return MediaSource.isTypeSupported(mime + '"') ? 1 : 0;
                }
                else if (videocodec === 'av01') {
                    return MediaSource.isTypeSupported('video/mp4; codecs="av01.2.23M.12"') ? 1 : 0;
                }
                else if (videocodec === 'vp09') {
                    return MediaSource.isTypeSupported('video/mp4; codecs="vp09.03.62.12"') ? 1 : 0;
                }
                else if (videocodec === 'hev1' || videocodec === 'hvc1') {
                    return MediaSource.isTypeSupported('video/mp4; codecs="' + videocodec + '.1.6.L93.90"') ? 1 : 0;
                }
                return canPlayMSEAudio();

            case 'Matroska':
                if (audiocodec && audiocodec !== 'A_OPUS') {
                    return 0;
                }
                /* falls through */
            case 'WebM':
                switch (isMediaSourceSupported.webm && videocodec) {
                    case 'V_AV1':
                        return MediaSource.isTypeSupported('video/webm; codecs="av01.2.23M.12"') ? 1 : 0;
                    case 'V_VP8':
                    case 'V_VP9':
                        var codec = videocodec.substr(2).toLowerCase();
                        return MediaSource.isTypeSupported('video/webm; codecs="' + codec + '"') ? 1 : 0;
                }
                break;

            case 'M4A ':
                if (!mega.fullAudioContextSupport) {
                    return canPlayMSEAudio();
                }
                mime = 'audio/aac';
            /* fallthrough */
            case 'Ogg':
                mime = mime || 'audio/ogg';
            /* fallthrough */
            case 'Wave':
                mime = mime || 'audio/wav';
            /* fallthrough */
            case 'FLAC':
                mime = mime || 'audio/flac';
            /* falls through */
            case 'MPEG Audio':
                if (!videocodec) {
                    mime = mime || (audiocodec === container ? 'audio/mpeg' : 'doh');
                    return mega.fullAudioContextSupport && audioElement.canPlayType(mime) ? 2 : 0;
                }
                break;
        }

        return 0;
    };

    var mediaTypeCache = Object.create(null);

    /**
     * Check whether a node is streamable, this is basically a synchronous version of canPlayMedia()
     * @param {MegaNode|Object} n The ufs-node
     * @returns {Number} 1: is video, 2: is audio, 0: not supported
     */
    MediaAttribute.getMediaType = function(n) {
        if (mediaTypeCache[n.h] === undefined) {
            // we won't initialize an usual MediaAttribute instance to make this as
            // lightweight as possible as used by is_video over a whole cloud folder contents.
            var a = MediaAttribute.prototype.fromAttributeString(n.fa, n.k);
            var r = 0;

            if (a && a.shortformat !== 0xff) {
                a = MediaAttribute.getCodecStrings(a);
                r = MediaAttribute.isTypeSupported.apply(null, a);
            }

            mediaTypeCache[n.h] = r;
        }

        return mediaTypeCache[n.h];
    };

    /**
     * Retrieve codecs/format string from decoded media attributes
     * @param {MegaNode|Object} a The decoded media attribute, or MegaNode
     * @param {Object} [mc] The media codecs list
     * @returns {Array|undefined}
     */
    MediaAttribute.getCodecStrings = function(a, mc) {
        mc = mc || MediaInfoLib.avflist;

        if (a instanceof MegaNode) {
            a = MediaAttribute.prototype.fromAttributeString(a.fa, a.k);

            if (!a || a.shortformat === 0xff) {
                return;
            }
        }

        if (mc) {
            var container = mc.container.byIdx[a.container];
            var videocodec = mc.video.byIdx[a.videocodec];
            var audiocodec = mc.audio.byIdx[a.audiocodec];

            if (a.shortformat) {
                var fmt = String(mc.shortformat.byIdx[a.shortformat]).split(':');

                container = fmt[0];
                videocodec = fmt[1];
                audiocodec = fmt[2];
            }

            mc = Object.create(Array.prototype, {
                toJSON: {
                    value: function() {
                        return this.slice();
                    }
                },
                toString: {
                    value: function() {
                        return array.unique(this).map(function(k) {
                            return String(k || '').trim();
                        }).filter(String).join('/');
                    }
                }
            });

            mc.push(container, videocodec, audiocodec);
            return mc;
        }

        delay('mc:missing', console.warn.bind(console, 'Media codecs list not loaded.'));
    };

    /**
     * Check whether can play media..
     * @param {MegaNode|Object} entry
     * @returns {Promise}
     */
    MediaAttribute.canPlayMedia = function(entry) {
        return new Promise(function(resolve, reject) {
            entry = new MediaAttribute(entry);

            var mfa = entry.data;
            if (!mfa || !isMediaSourceSupported()) {
                return resolve(false);
            }

            MediaInfoLib.getMediaCodecsList()
                .then(function(mc) {
                    mfa = MediaAttribute.getCodecStrings(mfa, mc);
                    resolve(MediaAttribute.isTypeSupported.apply(null, mfa));
                })
                .catch(reject);
        });
    };

    /**
     * Retrieve HTMLMediaElement meta data.
     * @param {File|Blob} entry File entry or Blob.
     * @returns {Promise<*>} metadata
     */
    MediaAttribute.getMediaData = function(entry) {
        return new Promise((resolve) => {
            const elm = document.createElement('video');
            elm.preload = 'metadata';
            elm.currentTime = 0x80000;
            elm.ondurationchange = function() {
                if (elm.duration !== Infinity) {
                    const {videoWidth: width, videoHeight: height, duration, src, videoTracks, audioTracks} = elm;

                    URL.revokeObjectURL(src);
                    elm.ondurationchange = null;
                    resolve(freeze({width, height, duration, video: videoTracks, audio: audioTracks}));
                }
            };
            elm.src = URL.createObjectURL(entry);
        });
    };

    MediaAttribute.test = function() {
        var n = new MegaNode({
            h: '876543x1',
            fa: '470:8*COXwfdF5an8',
            k: [-989750631, -795573481, -2084370882, 1515041341, -5120575, 233480270, -727919728, 1882664925]
        });
        var l = MediaInfoLib.avflist;
        var a = new MediaAttribute(n);
        var d = a.fromAttributeString();
        var s = MediaAttribute.getCodecStrings(d);

        console.log('MediaAttribute.test', s, d, a);

        d.containerid = l.container[s[0]].idx;
        d.vcodecid = l.video[s[1]].idx;
        d.acodecid = l.audio[s[2]].idx;

        console.log('MediaAttribute.test %s', a.toAttributeString(d) === n.fa.split(':')[1] ? 'OK' : 'FAILED');
    };

    /**
     * Returns a file attribute string for the specified media info properties
     * @param {MediaInfoReport} res Media info report.
     * @returns {String} file attribute string
     */
    MediaAttribute.prototype.toAttributeString = function(res) {
        var fps = res.fps;
        var width = res.width;
        var height = res.height;
        var vcodec = res.vcodecid;
        var acodec = res.acodecid;
        var playtime = res.playtime;
        var container = res.containerid;
        var shortformat = res.shortformat;
        var filekey = this.k;

        if (!Array.isArray(filekey) || filekey.length !== 8) {
            return '';
        }

        if (!(container && (vcodec && (acodec || !res.acodec) && width && height || acodec && !vcodec))) {
            shortformat = 255;
            fps = MediaInfoLib.build;
            width = MediaInfoLib.version;
            playtime = this.avflv;
        }
        else {
            var r = res.rotation;

            if (r === 90 || r === 270) {
                r = width;
                width = height;
                height = r;
            }
        }

        width <<= 1;
        if (width >= 32768) {
            width = ((width - 32768) >> 3) | 1;
        }
        if (width >= 32768) {
            width = 32767;
        }

        height <<= 1;
        if (height >= 32768) {
            height = ((height - 32768) >> 3) | 1;
        }
        if (height >= 32768) {
            height = 32767;
        }

        playtime <<= 1;
        if (playtime >= 262144) {
            playtime = Math.floor((playtime - 262200) / 60) | 1;
        }
        if (playtime >= 262144) {
            playtime = 262143;
        }

        fps <<= 1;
        if (fps >= 256) {
            fps = ((fps - 256) >> 3) | 1;
        }
        if (fps >= 256) {
            fps = 255;
        }

        // LE code below
        var v = new Uint8Array(8);

        v[7] = shortformat;
        v[6] = playtime >> 10;
        v[5] = (playtime >> 2) & 255;
        v[4] = ((playtime & 3) << 6) + (fps >> 2);
        v[3] = ((fps & 3) << 6) + ((height >> 9) & 63);
        v[2] = (height >> 1) & 255;
        v[1] = ((width >> 8) & 127) + ((height & 1) << 7);
        v[0] = width & 255;

        var attrs = formatfileattr(8, new Uint32Array(v.buffer), filekey);

        // must be 0 if the format is exotic - in that case, container/videocodec/audiocodec
        // must be valid, if shortformat is > 0, container/videocodec/audiocodec are ignored
        // and no attribute 9 is returned
        if (!shortformat) {
            v = new Uint8Array(8);

            v[3] = (acodec >> 4) & 255;
            v[2] = ((vcodec >> 8) & 15) + ((acodec & 15) << 4);
            v[1] = vcodec & 255;
            v[0] = container;

            attrs += '/' + formatfileattr(9, new Uint32Array(v.buffer), filekey);
        }

        return attrs;
    };

    /**
     * Get media properties from a file attribute string.
     * @param {String} [attrs] File attributes string (n.fa)
     * @param {Array} [filekey] an 8-element Array with the file's key
     * @returns {Object}
     */
    MediaAttribute.prototype.fromAttributeString = function(attrs, filekey) {
        var r = null;
        attrs = attrs || this.fa;
        filekey = filekey || this.k;
        if (!Array.isArray(filekey) || filekey.length !== 8) {
            attrs = null;
        }
        var pos = String(attrs).indexOf(':8*');

        if (pos >= 0) {
            var v = new Uint32Array(base64_to_ab(attrs.substr(pos + 3, 11)), 0, 2);
            v = xxtea.decryptUint32Array(v, xxkey(filekey));
            v = new Uint8Array(v.buffer);

            r = Object.create(null);

            r.width = (v[0] >> 1) + ((v[1] & 127) << 7);
            if (v[0] & 1) {
                r.width = (r.width << 3) + 16384;
            }

            r.height = v[2] + ((v[3] & 63) << 8);
            if (v[1] & 128) {
                r.height = (r.height << 3) + 16384;
            }

            r.fps = (v[3] >> 7) + ((v[4] & 63) << 1);
            if (v[3] & 64) {
                r.fps = (r.fps << 3) + 128;
            }

            r.playtime = (v[4] >> 7) + (v[5] << 1) + (v[6] << 9);
            if (v[4] & 64) {
                r.playtime = r.playtime * 60 + 131100;
            }

            if (!(r.shortformat = v[7])) {
                pos = attrs.indexOf(':9*');

                if (pos >= 0) {
                    v = new Uint32Array(base64_to_ab(attrs.substr(pos + 3, 11)), 0, 2);
                    v = xxtea.decryptUint32Array(v, xxkey(filekey));
                    v = new Uint8Array(v.buffer);

                    r.container = v[0];
                    r.videocodec = v[1] + ((v[2] & 15) << 8);
                    r.audiocodec = (v[2] >> 4) + (v[3] << 4);
                }
            }
        }

        return r;
    };

    /**
     * Send pfa command to store a node's file attribute
     * @param {MediaInfoReport} res The media info report gathered from MediaInfoLib.getMetadata()
     * @returns {Promise}
     */
    MediaAttribute.prototype.store = function(res) {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (!(res instanceof MediaInfoReport)) {
                console.error('Unexpected MediaInfoLib.getMetadata() result...', res);
                return reject(EFAILED);
            }
            var req = {a: 'pfa', fa: self.toAttributeString(res)};
            if (self.ph && (!self.u || self.u !== u_handle)) {
                req.ph = self.ph;
            }
            else {
                req.n = self.h;
            }

            if (d) {
                console.debug('Storing media file attr for node.', req, res, self.fromAttributeString(req.fa));
            }

            var success = function({result: fa}) {
                MEGAException.assert(typeof fa === 'string' && /:\d+\*/.test(fa));
                var n = M.d[req.n];

                if (n) {
                    // n.fa = fa;
                    // M.nodeUpdated(n);

                    if (res.playtime && M.viewmode && n.p === M.currentdirid) {
                        $('#' + n.h)
                            .find('.data-block-bg').addClass('video')
                            .find('.video-thumb-details span').text(secondsToTimeShort(res.playtime));
                    }
                }
                self.fa = fa;

                resolve(self);
            };

            const promise = api.screq(req).then(success).catch(reject);

            if (Object(res.General).InternetMediaType === 'video/mp4') {
                const known = new Set(['qt  ', 'M4A ', ...mp4brands]);

                if (!known.has(res.container)) {
                    eventlog(99729, JSON.stringify([3, res.containerid, res.container, res.vcodec, res.height]));
                }
            }

            promise.finally(() => {
                if (res.vcodec || req.ph) {
                    if (d) {
                        console.debug('Not adding cover-art...', res, [req]);
                    }
                    return;
                }
                if (Object(res.General).Cover_Data) {
                    try {
                        setImage(self, str_to_ab(atob(res.General.Cover_Data)));
                    }
                    catch (ex) {
                        console.warn(ex);
                    }
                }
                else if (res.container === 'MPEG Audio' || res.container === 'FLAC') {
                    getID3CoverArt(res.entry).then(setImage.bind(null, self)).catch(console.debug.bind(console));
                }
            });
        });
    };

    /**
     * Parse media file and store its file attribute
     * @param {File|MegaNode|String} entry The entry passed to MediaInfoLib
     * @returns {Promise}
     */
    MediaAttribute.prototype.parse = function(entry) {
        if (!MediaInfoLib.isFileSupported(entry)) {
            return false;
        }

        var self = this;
        return new Promise(function(resolve, reject) {
            MediaInfoLib(entry)
                .getMetadata()
                .then(function(r) {
                    if (d) {
                        console.debug('MediaInfoReport(%s)', MediaInfoLib.getObjectName(entry), r);
                    }
                    self.store(r).then(resolve).catch(reject);
                }).catch(reject);
        });
    };

    MediaAttribute.prototype.toString = function() {
        return String(this.fa);
    };

    Object.defineProperty(MediaAttribute.prototype, 'data', {
        get: function() {
            var a = this.fa && this.fromAttributeString(this.fa);
            return a && a.shortformat !== 0xff ? a : false;
        }
    });

    Object.defineProperty(MediaAttribute.prototype, 'avflv', {
        get: function() {
            return Object(MediaInfoLib.avflist).version | 0;
        }
    });

    Object.defineProperty(MediaAttribute.prototype, 'weak', {
        get: function() {
            var a = this.fromAttributeString();

            if (a && !localStorage.resetMediaAttributes) {
                if (a.shortformat < 255) {
                    return false;
                }

                if (this.u && this.u !== u_handle) {
                    if (d) {
                        console.debug('Ignoring media attribute state for non-own node...', this);
                    }
                    return false;
                }

                return a.fps < MediaInfoLib.build || a.width < MediaInfoLib.version || a.playtime < this.avflv;
            }

            return true;
        }
    });

    if (sessionStorage.vsPlayAnything) {
        MediaAttribute.getMediaType = () => 1;
        MediaAttribute.isTypeSupported = () => 1;
        MediaAttribute.canPlayMedia = async() => 1;
    }

    /**
     * @name MediaAttribute
     * @global
     */
    Object.defineProperty(global, 'MediaAttribute', {value: Object.freeze(MediaAttribute)});

})(self);

mBroadcaster.once('startMega', function isAudioContextSupported() {
    'use strict';

    if (isMediaSourceSupported()) {
        onIdle(tryCatch(() => {
            if (!localStorage.vsWebM) {
                if (mega.chrome) {
                    Object.defineProperty(isMediaSourceSupported, 'webm', {value: 2});
                }
                return;
            }
            const ms = new MediaSource();
            const uri = URL.createObjectURL(ms);
            const video = document.getElementById('video');
            const onOpen = tryCatch(() => {
                ms.removeEventListener('sourceopen', onOpen);
                URL.revokeObjectURL(uri);

                const sb = ms.addSourceBuffer('video/webm; codecs="vp8, vorbis"');

                if (sb.timestampOffset === 0) {
                    sb.timestampOffset = true;

                    if (sb.timestampOffset === 1) {
                        /** @property isMediaSourceSupported.webm */
                        Object.defineProperty(isMediaSourceSupported, 'webm', {value: true});

                        if (d) {
                            console.debug('[MSE] WebM support enabled.');
                        }
                    }
                }

            }, false);

            ms.addEventListener('sourceopen', onOpen);
            video.src = uri;
        }, false));
    }

    /** @property mega.fullAudioContextSupport */
    lazy(mega, 'fullAudioContextSupport', () => {
        return tryCatch(() => {
            const ctx = new AudioContext();
            onIdle(() => ctx && typeof ctx.close === 'function' && ctx.close());

            let stream = new MediaStream();
            console.assert('active' in stream);
            stream = ctx.createMediaStreamDestination();
            if (stream.stream.getTracks()[0].readyState !== 'live' || stream.numberOfInputs !== 1) {
                throw new Error('audio track is not live');
            }
            return true;
        }, (ex) => {
            console.debug('This browser does not support advanced audio streaming...', ex);
        })();
    });
});

/**
 * Functions for popping up a dialog to recommend MEGA Lite mode and other related functionality.
 * The MEGA Lite mode which has a bunch of visual changes for the user to show they are in this special mode and also
 * hides various functionality which doesn't work. It is only available if the localStorage.megaLiteMode is on, or
 * they are a Pro user AND have more than x nodes (from API, if rwdnc flag set) AND their loading time is > x minutes.
 * These functions are accesible externally via mega.lite.{functionName}
 *
 * @property {object} mega.lite
 */
lazy(mega, 'lite', () => {
    'use strict';

    /** Max load time in milliseconds */
    const maxLoadTimeInMs = localStorage.testLargeNodes ? 1000 : 1000 * 60 * 2;

    /** Flag to let UI code know if the site is currently in Lite mode or not */
    const inLiteMode = Boolean(localStorage.megaLiteMode);

    /** Timer to count how long the load is taking */
    let liteModeTimeoutId;

    /**
     * Recommend MEGA Lite mode (if applicable). For the dialog to be shown, they must be a PRO user
     * AND they have over x nodes AND also their load time takes over x minutes
     * @returns {undefined}
     */
    function recommendLiteMode() {

        // Only Pro users can get Lite mode and skip checking the remaining logic if already in Infinity or Lite mode
        // NB: mega.infinity is the same mode but without any UI changes or options hidden (useful for future dev).
        if (!u_attr.p || mega.infinity) {
            return false;
        }

        // Check if API flag rwdnc exists which is turned on if the ufssizecache > x nodes for the
        // current user. If so, give the user the option to use MEGA Lite or continue loading normally.
        if (mega.flags.rwdnc || localStorage.testLargeNodes === '1') {

            // Initiate a counter and if it runs over the max load time, clear the timer and show the Lite Mode dialog
            liteModeTimeoutId = setTimeout(() => {
                showLiteModeDialog();
            }, maxLoadTimeInMs);
        }
    }

    /**
     * Show the MEGA Lite mode dialog
     * @returns {undefined}
     */
    function showLiteModeDialog() {

        // Clear the timer if it's running
        clearTimeout(liteModeTimeoutId);

        // Check we have not already shown this prompt this session
        // NB: later there may be a Don't Show Again checkbox, but not implemented at the moment
        if (sessionStorage.promptedAboutLiteMode) {
            return false;
        }

        // If already loaded we don't need to show the dialog
        if (loadfm.loaded) {
            return false;
        }

        // Store a log for statistics (User was prompted to use MEGA Lite)
        eventlog(99894);

        const confirmLabel = l.launch_mega_lite;
        const cancelLabel = l.keep_loading;
        const dialogTitle = l.mega_lite;
        const dialogText = l.mega_lite_dialog_description;
        const type = `warninga:!^${confirmLabel}!${cancelLabel}`;

        // Show the message dialog
        $.closeMsgDialog = 1;
        msgDialog(type, 'LiteModeDialog', dialogTitle, dialogText, (res) => {

            // Store flag so it doesn't get shown again this session
            sessionStorage.promptedAboutLiteMode = '1';

            // Shall not signal the close of a message-dialog once the account finished loaded.
            $.closeMsgDialog = 0;

            // If the green Launch MEGA Lite button is clicked
            if (res === false) {

                // Flag to let us know we are in MEGA Lite mode
                localStorage.megaLiteMode = '1';

                if (window.waitsc) {
                    // Stop the SC connection.
                    waitsc.stop();
                }

                // stop ongoing SC processing
                window.execsc = nop;

                // and error reporting, if any
                window.onerror = null;

                // these comments are redundant
                loadingDialog.show();

                // Store a log for statistics (User chose to launch MEGA Lite mode - green button click)
                // Then reload into MEGA Lite (aka Infinity mode)
                Promise.resolve(eventlog(99895)).finally(() => location.reload());
                return false;
            }

            // Store a log for statistics (User chose to keep loading the regular MEGA)
            eventlog(99896);
            return false;
        });
    }

    /**
     * Initialise a button to go back to regular MEGA Cloud Drive from the top bar
     * @param {Object} topbarSelector The selector for the top bar
     * @returns {undefined}
     */
    function initBackToMegaButton(topbarSelector) {

        $('.js-back-to-mega-button', topbarSelector).rebind('click.backtomega', () => {

            // Remove the local storage variable which triggers MEGA Lite mode to load
            delete localStorage.megaLiteMode;

            // Store a log for statistics (User decided to go back to regular MEGA - Back to MEGA button)
            // Then reload the account back into regular MEGA
            loadingDialog.show();
            Promise.resolve(eventlog(99897)).finally(() => location.reload());
        });
    }

    /**
     * Check if there is at least 1 folder in the selected nodes
     * @param {Array} selectedNodes An array of selected node handles e.g. from $.selected
     * @returns {Boolean}
     */
    function containsFolderInSelection(selectedNodes) {

        // If at least 1 thing is selected
        if (selectedNodes && selectedNodes.length > 0) {
            for (let i = 0; i < selectedNodes.length; i++) {
                const handle = selectedNodes[i];

                // If type is folder, return true
                if (M.d[handle].t === 1) {
                    return true;
                }
            }
        }

        return false;
    }

    // Make public the following:
    return freeze({
        inLiteMode,
        recommendLiteMode,
        initBackToMegaButton,
        containsFolderInSelection,
        abort() {
            clearTimeout(liteModeTimeoutId);
        }
    });
});

/**
 * Retrieve data from storage servers.
 * @param {String|Object} aData           ufs-node's handle or public link
 * @param {Number}        [aStartOffset]  offset to start retrieveing data from
 * @param {Number}        [aEndOffset]    retrieve data until this offset
 * @param {Function}      [aProgress]     callback function which is called with the percent complete
 * @returns {Promise} Uint8Array
 */
async function megaUtilsGFSFetch(aData, aStartOffset, aEndOffset, aProgress) {
    'use strict';

    if (typeof aData !== 'object') {
        aData = await megaUtilsGFSFetch.getTicketData(aData);
    }

    if (aStartOffset === undefined) {
        aEndOffset = -1;
        aStartOffset = 0;
    }

    aEndOffset = parseInt(aEndOffset);
    aStartOffset = parseInt(aStartOffset);

    if (aEndOffset === -1 || aEndOffset > aData.s) {
        aEndOffset = aData.s;
    }

    if (!aStartOffset && aStartOffset !== 0
        || aStartOffset > aData.s || !aEndOffset
        || aEndOffset < aStartOffset) {

        return Promise.reject(ERANGE);
    }
    const byteOffset = aStartOffset % 16;

    if (byteOffset) {
        aStartOffset -= byteOffset;
    }

    const request = {
        method: 'POST',
        type: 'arraybuffer',
        url: `${aData.g}/${aStartOffset}-${aEndOffset - 1}`
    };

    if (typeof aProgress === 'function') {
        aProgress = ((cb) => (ev) =>
            ev.lengthComputable && cb(ev.loaded / ev.total * 100, ev.loaded, ev.total))(aProgress);

        request.prepare = function(xhr) {
            xhr.addEventListener('progress', aProgress, false);
        };
    }

    const ev = await(
        Array.isArray(aData.g)
            ? CloudRaidRequest.fetch(aData, aStartOffset, aEndOffset, aProgress)
            : M.xhr(request)
    );
    aData.macs = {};
    aData.writer = [];

    if (!aData.nonce) {
        const {key} = aData;

        aData.nonce = JSON.stringify([
            key[0] ^ key[4], key[1] ^ key[5], key[2] ^ key[6], key[3] ^ key[7], key[4], key[5]
        ]);
    }

    return new Promise((resolve, reject) => {
        const uint8 = new Uint8Array(ev.target.response);
        const method = window.dlmanager && dlmanager.isDownloading ? 'unshift' : 'push';

        Decrypter[method]([[aData, aStartOffset], aData.nonce, aStartOffset / 16, uint8], tryCatch(() => {
            let {data: uint8} = aData.writer.shift();

            if (byteOffset) {
                uint8 = new Uint8Array(uint8.buffer.slice(byteOffset));
            }

            uint8.payload = aData;
            resolve(uint8);
        }, reject));
    });
}

megaUtilsGFSFetch.getTicket = (aData) => {
    'use strict';
    let key, n, handle;
    const payload = {a: 'g', v: 2, g: 1, ssl: use_ssl};
    const options = {
        channel: pfid ? 1 : 0
    };

    // If a ufs-node's handle provided
    if (String(aData).length === 8) {
        handle = aData;
    }
    else if (aData.customRequest) {
        payload.a = aData.customRequest;
        handle = aData.dl_id;
        n = aData;
    }
    else if (typeof aData === 'object') {
        // if a download-instance provided.
        handle = aData.dl_id;
        n = aData.nauth && aData;
        key = aData.ph && aData.key;
    }
    else {
        // if a public-link provided, eg #!<handle>!<key>
        aData = String(aData).replace(/^.*?#!/, '').split('!');

        if (aData.length === 2 && aData[0].length === 8) {
            handle = aData[0];
            key = base64_to_a32(aData[1]).slice(0, 8);
        }
    }

    if (key) {
        payload.p = handle;
    }
    else {
        payload.n = handle;
        key = (n = n || M.getNodeByHandle(handle)).k;
    }

    if (!handle || !Array.isArray(key) || key.length !== 8) {
        return {error: EARGS};
    }

    // IF this is an anonymous chat OR a chat that I'm not a part of
    if (M.chat && megaChatIsReady) {
        megaChat.eventuallyAddDldTicketToReq(payload);
    }

    if (self.d && String(apipath).includes('staging')) {
        const s = sessionStorage;
        if (s.dltfefq || s.dltflimit) {
            payload.f = [s.dltfefq | 0, s.dltflimit | 0];
        }
    }

    if ((n = n || M.getNodeByHandle(handle))) {
        const {foreign: f, nauth: a} = n;

        if (a && (!pfid || f)) {
            // options.queryString = `n=${n.nauth}`;
            payload.enp = a;
        }
        if (f) {
            options.channel = 6;
        }
    }

    return {payload, key, handle, options};
};

megaUtilsGFSFetch.getTicketData = async(aData) => {
    'use strict';

    if (typeof aData === 'object') {
        aData.dlTicketData = false;
    }
    const {payload, options, key, handle, error} = megaUtilsGFSFetch.getTicket(aData);
    const res = error || (await api.req(payload, options)).result;

    if (typeof res === 'object' && res.g) {
        let error = !!res.d;

        res.key = key;
        res.handle = handle;

        if (typeof res.g === 'object') {
            // API may gives a fake array...
            res.g = Object.values(res.g);

            if (res.g[0] < 0) {
                error = res.g[0];
            }
        }
        res.e = res.e || error || !res.g;

        if (!res.e) {
            delete dlmanager.efq;
            if (res.efq) {
                dlmanager.efq = true;
            }
            if (typeof aData === 'object') {
                aData.dlTicketData = res;
            }
            return res;
        }
    }

    throw res && res.e || res || EINTERNAL;
};

megaUtilsGFSFetch.roundOffsetBoundary = (value, min, max) => {
    'use strict';
    return value > max ? max : value <= min ? min : min * Math.floor(value / min);
};

megaUtilsGFSFetch.getOffsets = (length) => {
    'use strict';
    let offset = 0;
    const res = [];
    const KiB = 0x1ffec;
    const MiB = 0x100000;

    for (let i = 1; i < 9 && offset < length - i * KiB; ++i) {
        const end = i * KiB;
        res.push([offset, end]);
        offset += end;
    }
    const size = megaUtilsGFSFetch.roundOffsetBoundary(length >> 4, MiB, MiB << 4);

    while (offset < length) {
        const end = Math.min(size, Math.floor((length - offset) / MiB + 1) * MiB);
        res.push([offset, end]);
        offset += end;
    }

    offset = res[res.length - 1];
    if (length - offset[0] > 0) {
        offset[1] = length - offset[0];
    }

    return res.reverse();
};

/**
 * @param {Blob|MegaNode} file a Blob, File or MegaNode instance.
 * @param {Number} [start] offset to start retrieving data from
 * @param {Number} [end] retrieve data until this offset
 * @returns {Promise<Uint8Array>}
 */
megaUtilsGFSFetch.managed = async(file, start, end) => {
    'use strict';

    if (self.dlmanager && dlmanager.isOverQuota) {
        // @todo check dependants and do this on megaUtilsGFSFetch()
        throw EOVERQUOTA;
    }
    const payload = typeof file.seen === 'object' && file.seen || file.link || file.h || file;

    return megaUtilsGFSFetch(payload, start, start + end)
        .catch((ex) => {
            const {status} = ex && ex.target || false;

            switch (status) {
                case 0:
                    ex = EAGAIN;
                    break;
                case 403:
                    file.seen = -1;
                    return megaUtilsGFSFetch.managed(file, start, end);
                case 509:
                    ex = EOVERQUOTA;
                    break;
            }

            if (ex === EOVERQUOTA && self.dlmanager && !dlmanager.isOverQuota) {
                dlmanager.showOverQuotaDialog();
            }

            throw ex;
        });
};

/**
 * @param {Blob|MegaNode} file a Blob, File or MegaNode instance.
 * @param {*} [options] guess it.
 */
megaUtilsGFSFetch.getReadableStream = (file, options) => {
    'use strict';
    let offsets, size;

    options = options || Object.create(null);

    return new ReadableStream({
        async start(controller) {
            if (!((size = parseInt(file.size || file.s)) > 0)) {
                return controller.close();
            }
            offsets = megaUtilsGFSFetch.getOffsets(size);
            return this.pull(controller);
        },
        async pull(controller) {
            if (!offsets.length) {
                controller.close();
                return;
            }
            const [start, end] = offsets.pop();

            // @todo fire more parallel downloads per stream regardless of queueing strategy(?)
            let chunk = await megaUtilsGFSFetch.managed(file, start, end)
                .catch((ex) => {
                    if (ex === EOVERQUOTA) {
                        controller.error(ex);
                    }
                    return ex;
                });

            if (chunk instanceof Uint8Array && chunk.byteLength > 0) {

                if (options.progress) {
                    options.progress((start + end) / size * 100, file);
                }
                file.seen = chunk.payload;
            }
            else {
                if (options.error) {
                    options.error(chunk, file, controller);
                }
                chunk = new Uint8Array(0);
            }

            controller.enqueue(chunk);
        }
    }, options.queuingStrategy);
};

freeze(megaUtilsGFSFetch);

/**
 * Promise-based XHR request
 * @param {Object|String} aURLOrOptions   URL or options
 * @param {Object|String} [aData]         Data to send, optional
 * @returns {MegaPromise}
 */
function megaUtilsXHR(aURLOrOptions, aData) {
    'use strict';

    /* jshint -W074 */
    var xhr;
    var url;
    var method;
    var options;
    var json = false;
    var promise = new MegaPromise();

    if (typeof aURLOrOptions === 'object') {
        options = aURLOrOptions;
        url = options.url;
    }
    else {
        options = {};
        url = aURLOrOptions;
    }
    aURLOrOptions = undefined;

    aData = options.data || aData;
    method = options.method || (aData && 'POST') || 'GET';

    xhr = new XMLHttpRequest();

    if (typeof options.prepare === 'function') {
        options.prepare(xhr);
    }

    xhr.onloadend = function(ev) {
        var error = false;

        if (this.status === 200) {
            try {
                return promise.resolve(ev, json ? JSON.parse(this.response) : this.response);
            }
            catch (ex) {
                error = ex;
            }
        }

        promise.reject(ev, error);
    };

    try {
        if (d) {
            console.info(`${method}ing`, url, options, aData);
        }
        xhr.open(method, url);
        if (options.timeout) {
            xhr.timeout = options.timeout;
        }

        if (options.type) {
            xhr.responseType = options.type;
            if (xhr.responseType !== options.type) {
                if (options.type === 'json') {
                    xhr.responseType = 'text';
                    json = true;
                }
                else {
                    xhr.abort();
                    throw new Error('Unsupported responseType');
                }
            }
        }

        if (typeof options.beforeSend === 'function') {
            options.beforeSend(xhr);
        }

        xhr.send(aData);
    }
    catch (ex) {
        onIdle(function() {
            promise.reject(ex);
        });
    }

    xhr = options = undefined;

    return promise;
}

function hostname(url) {
    'use strict';

    if (d && !String(url).startsWith('http')) {
        console.warn('Invalid URL passed to hostname()', url);
    }

    url = String(url).match(/https?:\/\/([^.]+)/);
    return url && url[1];
}


// fire an event log
function eventlog(id, msg, once) {
    'use strict';

    if ((id = parseInt(id)) >= 99600) {
        const req = {a: 'log', e: id};
        const {jid} = mega.flags;

        if (msg === true) {
            once = true;
            msg = 0;
        }

        if (jid) {
            req.v = mega.viewID;
            req.j = localStorage.jid || jid;
            req.ms = Date.now();
        }

        if (msg) {
            req.m = String(msg).replace(/[\t\n\v\f\r\u200E\u200F\u202E]+/g, ' ');

            if (req.m.length > 666) {
                if (d) {
                    console.error('The message provided for %s is too large...', id, [req.m]);
                }
                delete req.m;
            }
        }

        if (!once || !eventlog.sent[id]) {
            eventlog.sent[id] = [Date.now(), M.getStack()];
            return api.req(req).catch((ex) => dump(id, ex));
        }
    }
    else {
        console.error('Invalid event log.', arguments);
    }
}

eventlog.sent = Object.create(null);

/* eslint-disable strict, max-depth, complexity */

// JSON parser/splitter
// (this is tailored to processing what the API actually generates
// i.e.: NO whitespace, NO non-numeric/string constants ("null"), etc...)
// accepts string and Uint8Array input, but not a mixture of the two
(function(global) {
    "use strict";

    function JSONSplitter(filters, ctx, format_uint8array) {

        // position in source string
        this.p = 0;

        // remaining part of previous chunk (chunked feeding only)
        this.rem = false;

        // enclosing object stack at current position (type + name)
        this.stack = [];

        // 0: no value expected, 1: optional value expected, -1: compulsory value expected
        this.expectvalue = -1;

        // last hash name seen
        this.lastname = '';

        // hash of exfiltration vector callbacks
        this.filters = filters;

        // bucket stack
        this.buckets = [];
        this.lastpos = 0;

        // optional callee scope
        this.ctx = ctx;

        if (format_uint8array) {
            // extraction/manipulation helpers for Uint8Array inputs

            // convert input Uint8Array to string
            this.tostring = function(u8) {
                if (u8.byteLength > 0x1ff && u8.byteLength < 0x10000) {
                    return String.fromCharCode.apply(null, u8);
                }
                var b = '';

                for (var i = 0; i < u8.length; i++) {
                    b = b + String.fromCharCode(u8[i]);
                }

                return b;
            };

            // convert char to Uint8Array element (number)
            this.fromchar = function(c) {
                return c.charCodeAt(0);
            };

            // convert Uint8Array element (number) to char
            this.tochar = function(c) {
                return String.fromCharCode(c);
            };

            // concatenate two Uint8Arrays (a can be false - relies on boolean.length to be undefined)
            this.concat = function(a, b) {
                var t = new Uint8Array(a.length + b.length);
                if (a) {
                    t.set(a, 0);
                }
                t.set(b, a.length + 0);
                return t;
            };

            // sub-Uint8Array of a Uint8Array given position p and optional length l
            this.sub = function(s, p, l) {
                return l >= 0 ? new Uint8Array(s.buffer, p, l)
                    : new Uint8Array(s.buffer, p);
            };
        }
        else {
            // extraction/manipulation helpers (mostly no-ops) for string inputs

            // convert input string to string
            this.tostring = function(s) {
                return s;
            };

            // convert char to string element (char)
            this.fromchar = function(c) {
                return c;
            };

            // convert string element (char) to char
            this.tochar = function(c) {
                return c;
            };

            // concatenate two strings (a can be false)
            this.concat = function(a, b) {
                return a ? a + b : b;
            };

            // substring
            this.sub = function(s, p, l) {
                return s.substr(p, l);
            };
        }

        // console logging
        this.logger = global.d && new MegaLogger('JSONSplitter', null, ctx && ctx.logger);
    }

    // returns the position after the end of the JSON string at o or -1 if none found
    // (does not perform a full validity check on the string)
    JSONSplitter.prototype.strend = function strend(s, o) {
        let oo = o;
        const ch = this.fromchar('"');

        // find non-escaped "
        while ((oo = s.indexOf(ch, oo + 1)) >= 0) {
            let e = oo;
            while (this.tochar(s[--e]) === '\\') {
                /* noop */
            }

            e = oo - e;
            if (e & 1) {
                return oo + 1;
            }
        }

        return -1;
    };

    // returns the position after the end of the JSON number at o or -1 if none found
    JSONSplitter.prototype.numberre = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;

    JSONSplitter.prototype.numend = function numend(s, o) {
        var oo = o;

        // (we do not set lastIndex due to the potentially enormous length of s)
        while ('0123456789-+eE.'.includes(this.tochar(s[oo]))) {
            oo++;
        }

        if (oo > o) {
            var r = this.numberre.exec(this.tostring(this.sub(s, o, oo - o)));

            if (r) {
                return o + r[0].length;
            }
        }

        return -1;
    };

    // process a JSON chunk (of a stream of chunks, if the browser supports it)
    // FIXME: rewrite without large string concatenation
    JSONSplitter.prototype.chunkproc = function json_chunkproc(chunk, inputcomplete) {
        // we are not receiving responses incrementally: process as growing buffer
        // if (!chunked_method) {
        //     return this.proc(chunk, inputcomplete);
        // }

        // otherwise, we just retain the data that is still going to be needed in the
        // next round... enabling infinitely large accounts to be "streamed" to IndexedDB
        // (in theory)
        if (this.rem.length) {
            // append to previous residue
            if (chunk) {
                this.rem = this.concat(this.rem, chunk);
            }
            chunk = this.rem;
        }

        // process combined residue + new chunk
        var r = this.proc(chunk, inputcomplete);

        if (r >= 0) {
            // processing ended
            this.rem = false;
            return r;
        }

        if (this.lastpos) {
            // remove processed data
            this.rem = this.sub(chunk, this.lastpos);

            this.p -= this.lastpos;
            this.lastpos = 0;
        }
        else {
            // no data was processed: store entire chunk
            this.rem = chunk;
        }

        return r;
    };

    // returns -1 if it wants more data, 0 in case of a fatal error, 1 when done
    JSONSplitter.prototype.proc = function json_proc(json, inputcomplete) {
        let node, filter, callback, usn;

        if (inputcomplete && !this.p && json.length > 7 && this.tostring(this.sub(json, 0, 7)) === '{"err":') {
            callback = this.filters['#'];
            node = JSON.parse(this.tostring(json));

            if (global.d) {
                this.logger.debug('APIv2 Custom Error Detail', node, [this.ctx]);
            }
            if (callback) {
                callback.call(this.ctx, node);
            }
            if (this.ctx) {
                this.ctx.error = node;
            }
            return (node.err << 1 | 1) >>> 0;
        }

        while (this.p < json.length) {
            const c = this.tochar(json[this.p]);

            if (c === '[' || c === '{') {
                if (!this.expectvalue) {
                    if (global.d) {
                        this.logger.error("Malformed JSON - unexpected object or array");
                    }
                    return 0;
                }

                this.stack.push(c + this.lastname);

                if (this.filters[this.stack.join('')]) {
                    // a filter is configured for this path - recurse
                    const len = this.p - this.lastpos;
                    if (len > 0) {
                        this.buckets[0] += this.tostring(this.sub(json, this.lastpos, len));
                    }
                    this.lastpos = this.p;
                    this.buckets.unshift('');
                }

                this.p++;
                this.lastname = '';
                this.expectvalue = c === '[';
            }
            else if (c === ']' || c === '}') {
                if (this.expectvalue < 0) {
                    if (global.d) {
                        this.logger.error("Malformed JSON - premature array closure");
                    }
                    return 0;
                }

                if (!this.stack.length || "]}".indexOf(c) !== "[{".indexOf(this.stack[this.stack.length - 1][0])) {
                    if (global.d) {
                        this.logger.error("Malformed JSON - mismatched close");
                    }
                    return 0;
                }

                this.lastname = '';

                // check if this concludes an exfiltrated object and return it if so
                filter = this.stack.join('');
                callback = this.filters[filter];
                this.p++;

                if (callback) {
                    let bucket;
                    // we have a filter configured for this object
                    // eslint-disable-next-line local-rules/hints
                    try {
                        // pass filtrate to application and empty bucket
                        bucket = this.buckets[0] + this.tostring(this.sub(json, this.lastpos, this.p - this.lastpos));

                        node = JSON.parse(bucket);

                        if (filter === '[{[f2{' || filter === '{[a{{t[f2{') {
                            node.fv = 1; // file version
                        }
                        else if (filter === '{[a{') {
                            if (!usn && inputcomplete && json.length > 31) {
                                usn = this.tostring(this.sub(json, json.length - 13, 11));
                            }
                            if (usn) {
                                // inject upcoming sn into packet
                                node.usn = usn;
                            }
                        }
                        callback.call(this.ctx, node);
                    }
                    catch (ex) {
                        if (global.d) {
                            this.logger.error(`Malformed JSON - parse error in filter element ${callback.name}`, ex);

                            tryCatch(() => {
                                const str = bucket || String.fromCharCode.apply(null, json);
                                this.logger.error('JSON bucket/payload (%s/%s):', this.lastpos, this.p, [str]);

                                if (bucket) {
                                    let n = String(ex).match(/(?:position|column)\s+(\d+)/);
                                    if (n) {
                                        n = n[1] | 0;
                                        this.logger.error(`${bucket.substr(Math.max(0, n - 15), 64)}...`);
                                        this.logger.error('^^^'.padStart(17, ' '));
                                    }
                                }
                            })();
                        }
                        return 0;
                    }

                    this.buckets.shift();
                    this.lastpos = this.p;
                }

                this.stack.pop();
                this.expectvalue = 0;
            }
            else if (c === ',') {
                if (this.expectvalue) {
                    if (global.d) {
                        this.logger.error("Malformed JSON - stray comma");
                    }
                    return 0;
                }
                if (this.lastpos === this.p) {
                    this.lastpos++;
                }
                this.p++;
                this.expectvalue = this.stack[this.stack.length - 1][0] === '[';
            }
            else if (c === '"') {
                const t = this.strend(json, this.p);
                if (t < 0) {
                    break;
                }

                if (this.expectvalue) {
                    this.p = t;
                    this.expectvalue = false;
                }
                else {
                    // (need at least one char after end of property string)
                    if (t === json.length) {
                        break;
                    }

                    if (this.tochar(json[t]) !== ':') {
                        if (global.d) {
                            this.logger.error("Malformed JSON - no : found after property name");
                        }
                        return 0;
                    }

                    this.lastname = this.tostring(this.sub(json, this.p + 1, t - this.p - 2));
                    this.expectvalue = -1;
                    this.p = t + 1;
                }
            }
            else if (c >= '0' && c <= '9' || c === '.' || c === '-') {
                if (!this.expectvalue) {
                    if (global.d) {
                        this.logger.error("Malformed JSON - unexpected number");
                    }
                    return 0;
                }

                const j = this.numend(json, this.p);

                if (j === json.length) {
                    // numbers, on the face of them, do not tell whether they are complete yet
                    // fortunately, we have the "inputcomplete" flag to assist
                    if (inputcomplete && !this.stack.length) {
                        // this is a stand-alone number, do we have a callback for them?
                        callback = this.filters['#'];
                        node = this.tostring(json);

                        if (callback) {
                            callback.call(this.ctx, node);
                        }
                        return (node << 1 | 1) >>> 0;
                    }
                    break;
                }

                if (j < 0) {
                    break;
                }

                this.p = j;
                this.expectvalue = false;
            }
            else if (c === ' ') {
                // a concession to the API team's aesthetic sense
                // FIXME: also support tab, CR, LF
                this.p++;
            }
            else {
                if (global.d) {
                    this.logger.error(`Malformed JSON - bogus char at position ${this.p}`);
                }
                return 0;
            }
        }

        return !this.expectvalue && !this.stack.length ? 3 : inputcomplete ? json === false : -1;
    };

    freeze(JSONSplitter.prototype);
    Object.defineProperty(global, 'JSONSplitter', {value: JSONSplitter});
})(self);

(function(global) {
    'use strict'; /* jshint -W089 */

    var patchAccountData;
    var storage = Object.create(null);
    var debloat = function(data) {
        var keys = Object.keys(storage);
        var result = Object.create(null);

        for (var key in data) {
            if (parseInt(key) !== (key | 0) && !keys.includes(key)) {
                result[key] = data[key];
            }
        }
        return result;
    };

    var dialog = storage.dialog = function() {
        console.error('Unhandled condition.', arguments);
    };

    dialog.quota = function(data) {
        // REGISTERED = 1
        // ACHIEVEMENTS = 4
        // REGISTERED + PRO = 3
        // REGISTERED + ACHIEVEMENTS = 5
        // REGISTERED + PRO + ACHIEVEMENTS = 7
        var flags = parseInt(data.flags) | 0;

        if (flags & 1) {
            u_type = 3;
            u_attr = Object(window.u_attr);
            u_handle = u_handle || "AAAAAAAAAAA";
            Object.defineProperty(u_attr, 'flags', {
                configurable: true,
                value: {...u_attr.flags}
            });
            u_attr.flags.ach = flags & 4;
        }

        if (flags & 2 && !u_attr.p) {
            u_attr.p = u_attr.p || 1;
            patchAccountData();
        }

        if (data.type === 'limited') {
            dlmanager.showLimitedBandwidthDialog(1, closeDialog, flags);
        }
        else if (data.type === 'upload') {
            dlmanager.lmtUserFlags = flags;
            ulmanager.ulShowOverStorageQuotaDialog();
        }
        else if (data.type === 'import' || data.type === 'storage') {
            var val = 4294967297;
            var cur = 210453397504;

            if (data.state === 'full') {
                val = -1;
                cur = 214748364800;
            }

            patchAccountData({cstrg: cur});

            if (data.type === 'import') {
                M.checkGoingOverStorageQuota(val);
            }
            else {
                M.checkStorageQuota(1);
            }
        }
        else {
            if (data.efq) {
                dlmanager.efq = true;
            }
            else {
                delete dlmanager.efq;
            }

            if (data.streaming) {
                dlmanager.isStreaming = true;
            }

            dlmanager.showOverQuotaDialog(null, flags);
        }
    };

    var set = storage.set = function(data) {
        data = debloat(data);

        var rsv = ['sid', 'k', 'privk', 'v', 'handle', 'fmconfig', 'attr', 'link'];
        for (var key in data) {
            if (!rsv.includes(key)) {
                var value = data[key];

                if (key === 'apipath') {
                    value = value || 'prod';
                    var target = ['prod', 'staging'].includes(value) ? 'api' : 'developers';
                    value = apipath = 'https://' + value + '.' + target + '.mega.co.nz/';
                }

                if (value) {
                    if (localStorage[key] !== String(value)) {
                        console.log('"%s" changed to "%s" from "%s"', key, value, localStorage[key]);
                    }
                    else {
                        console.log('"%s" set to "%s"', key, value);
                    }
                    localStorage[key] = value;
                }
                else {
                    if (localStorage[key]) {
                        console.log('Removed "%s", was "%s"', key, localStorage[key]);
                    }
                    delete localStorage[key];
                }
            }
        }

        top.location = getAppBaseUrl() + '#' + (data.link || 'fm');
    };

    set.dl = function(data) {
        data = debloat(data);

        for (var key in data) {
            if (key !== 'link') {
                sessionStorage['dltf' + key] = data[key] || 1;
            }
        }

        set({apipath: 'staging', link: data.link, d: 1, minLogLevel: '0', jj: location.host !== 'mega.nz'});
    };

    patchAccountData = function(data) {
        data = Object.assign({
            "mstrg": 214748364800,
            "pstrg": 214748364800,
            "mxfer": 1099511627776,
            "pxfer": 1099511627776,
            "caxfer": 609161627,
            "csxfer": 0,
            "cstrgn": {
                "cERvbHpM": [172403889248, 297153, 59114, 1290742857, 2732],
                "WmFKaUFE": [1496628, 1, 1, 0, 0],
                "WVhKSG5a": [0, 0, 0, 0, 0],
                "OVRvM0JM": [4126895, 7, 1, 0, 0],
                "QzRObFVB": [203630834, 3, 1, 0, 0]
            },
            "servbw_limit": 10,
            "downbw_used": 6091616270004,
            "cstrg": 176492551747, "uslw": 9800, "srvratio": 0, "balance": [["5.01", "EUR"]], "utype": 4, "smixed": 0,
            "stype": "O", "suntil": 1556535999, "bt": 19809, "tah": [0, 0, 0, 0, 0, 0], "tar": 0, "tuo": 0, "tua": 0,
            "ruo": 0, "rua": 0, "rtt": 1, "type": 4, "expiry": 1556535999, "space": 214748364800, "vouchers": [],
            "space_used": 176492551747, "bw": 1099511627776, "servbw_used": 0, "ssrs": 19294,
            "transactions": [["YjBLNXhhZFE", 1509922004, "10.00", "EUR"], ["TmZWTmFyNlE", 1509922318, "-4.99", "EUR"]],
            "contactLink": "C!d0w1RzFT", "purchases": [["bVhVLXNuSUI", 1509922318, "4.99", "EUR", 0, 4, 1]],
            "tfsq": {
                "max": 1099511627776,
                "used": 609161627,
                "left": 1098902466149,
                "perc": 0
            }
        }, data);

        M['account' + 'Data'] = function(cb) {
            return cb(data);
        };

        M['getStor' + 'ageQuota'] = function() {
            var res = data;
            return MegaPromise.resolve(Object.assign({}, res, {
                max: res.mstrg,
                used: res.cstrg,
                isFull: res.cstrg / res.mstrg >= 1,
                percent: Math.floor(res.cstrg / res.mstrg * 100),
                isAlmostFull: res.cstrg / res.mstrg >= res.uslw / 10000
            }));
        };
    };

    global.test = function(data) {
        data = String(data).split(/(\.\w+=?)/);

        for (var i = 1; i < data.length; i += 2) {
            data[data[i] = String(data[i]).replace(/\W/g, '')] = mURIDecode(data[i + 1]);
        }
        ['closeDialog', 'eventlog']
            .forEach((meth) => {
                window[meth] = (...args) => console.warn(meth, args);
            });
        window.addEventListener('click', function(ev) {
            const msg = "Nothing on this page is clickable, it's meant to test/verify visual changes.";

            ev.preventDefault();
            ev.stopPropagation();

            if (typeof window.showToast === 'function') {
                showToast('warning', msg);
            }
            console.warn(msg);
        }, true);

        var name = data[1];
        return storage[name] ? (storage[name][data[name]] || storage[name])(data) : loadSubPage('debug');
    };
})(self);

function later(callback) {
    'use strict';
    return tSleep(1).then(callback);
}

/**
 * @param {Function} callback function
 * @returns {void}
 * @deprecated we shall use onIdle() or delay()
 */
function Soon(callback) {
    'use strict';
    queueMicrotask(callback);
}

/**
 *  Delays the execution of a function
 *
 *  Wraps a function to execute at most once
 *  in a 100 ms time period. Useful to wrap
 *  expensive jQuery events (for instance scrolling
 *  events).
 *
 *  All argument and *this* is passed to the callback
 *  after the 100ms (default)
 *
 *  @param {Number} [ms] Timeout in milliseconds, 160 by default
 *  @param {Boolean} [global] Set to false to attach to instantiated class.
 *  @param {Function} callback  Function to wrap
 *  @returns {Function} wrapped function
 */
function SoonFc(ms, global, callback) {
    'use strict';
    const expando = `__delay_call_wrap_${Math.random() * Math.pow(2, 56)}`;

    // Handle arguments optionality
    ms = global = callback = null;
    for (var i = arguments.length; i--;) {
        var value = arguments[i];
        var type = typeof value;

        if (type === 'number' || type === 'string') {
            ms = value | 0;
        }
        else if (type === 'boolean') {
            global = value;
        }
        else {
            callback = value;
        }
    }
    ms = ms || 160;

    const sfc = function __soonfc(...args) {
        let idx = expando;

        if (global === false) {
            if (!(expando in this)) {
                Object.defineProperty(this, expando, {value: makeUUID()});
            }

            idx += this[expando];
        }

        delay(idx, () => callback.apply(this, args), ms);
    };
    if (d > 1) {
        Object.defineProperty(sfc, Symbol(callback.name || 'callback'), {value: callback});
    }
    return sfc;
}

/**
 * Delay a function execution, like Soon() does except it accept a parameter to
 * identify the delayed function so that consecutive calls to delay the same
 * function will make it just fire once. Actually, this is the same than
 * SoonFc() does, but it'll work with function expressions as well.
 *
 * @param {String}   aProcID     ID to identify the delayed function
 * @param {Function} [aFunction] The function/callback to invoke
 * @param {Number}   [aTimeout]  The timeout, in ms, to wait.
 */
function delay(aProcID, aFunction, aTimeout) {
    'use strict';
    let q = delay.queue[aProcID];
    const t = Math.max(aTimeout | 0 || 200, 40);

    if (d > 2) {
        console.warn(`delaying <<${aProcID}>> for ${aTimeout}ms...`, q);
    }

    if (!q) {
        q = delay.queue[aProcID] = Object.create(null);

        q.pun = aProcID;
        q.tid = setTimeout(() => {
            const rem = q.tde - (performance.now() - q.tik);
            const rdy = rem < 50 || rem * 100 / q.tde < 2;

            if (d > 2) {
                console.warn('dispatching delayed function...', aProcID, q.tde, rem, rdy);
            }
            delete delay.queue[q.pun];

            if (rdy) {
                queueMicrotask(q.tsk);
            }
            else {
                delay(q.pun, q.tsk, rem);
            }
        }, t);
    }
    q.tde = t;
    q.tsk = aFunction;
    q.tik = performance.now();

    return aProcID;
}
delay.queue = Object.create(null);
delay.has = function(aProcID) {
    'use strict';
    return delay.queue[aProcID] !== undefined;
};
delay.cancel = function(aProcID) {
    'use strict';

    if (delay.has(aProcID)) {
        clearTimeout(delay.queue[aProcID].tid);
        delete delay.queue[aProcID];
        return true;
    }
    return false;
};
delay.abort = () => {
    'use strict';

    if (d) {
        console.warn('Aborting all pending scheduled timers...', Object.keys(delay.queue));
    }
    Object.keys(delay.queue).forEach((t) => delay.cancel(t));
};

/**
 * @function window.tSleep
 * @see {@link window.sleep}
 */
lazy(self, 'tSleep', function tSleep() {
    'use strict';
    const RFP_THRESHOLD = 20;
    const MIN_THRESHOLD = 100;
    const MAX_THRESHOLD = 4e7;

    const pending = new Set();
    const symbol = Symbol('^^tSleep::scheduler~~');

    let tid = null;
    let threshold = MAX_THRESHOLD;

    const dequeue = () => {
        const tick = performance.now();

        tid = null;
        threshold = MAX_THRESHOLD;

        for (const resolve of pending) {
            const {ts, now, data} = resolve;
            const elapsed = tick - now;

            if (elapsed + RFP_THRESHOLD > ts) {
                if (ts !== -1) {
                    resolve(data);
                }
                pending.delete(resolve);
            }
            else {
                threshold = Math.max(MIN_THRESHOLD, Math.min(ts - elapsed, threshold));
            }
        }

        if (pending.size) {
            if (self.d > 2) {
                console.warn(`tSleep rescheduled for ${threshold | 0}ms`, pending);
            }
            tid = gSetTimeout(dequeue, threshold);
        }
    };

    const dispatcher = () => {
        if (tid) {
            gClearTimeout(tid);
        }
        dequeue();
    };

    const schedule = (resolve, ts, data) => {
        ts = Math.min(MAX_THRESHOLD - 1, Math.max(MIN_THRESHOLD, ts | 0));

        resolve.ts = ts;
        resolve.data = data;
        resolve.id = ++mIncID;
        resolve.now = performance.now();
        pending.add(resolve);

        if (ts < threshold || !tid) {

            dispatcher();
        }

        return mIncID;
    };

    const lookup = (pid) => {
        for (const obj of pending) {
            if (obj.id === pid) {
                return obj;
            }
        }
    };

    const restart = (promise) => {
        const timer = lookup(promise.pid);
        if (timer) {
            const tick = performance.now();
            const elapsed = tick - timer.now;

            if (self.d > 2) {
                const {id, ts} = timer;
                console.warn(`tSleep(${id}) restarted after ${elapsed | 0}/${ts}ms elapsed...`, promise);
            }

            timer.now = tick;
            return elapsed;
        }

        console.error('Unknown timer...', promise);
    };

    const abort = (promise, state = 'aborted', data = null) => {
        let res = false;

        if (!Object.isFrozen(promise)) {
            const {pid} = promise;
            const timer = lookup(pid);

            if (timer) {
                res = timer.data || -pid;

                if (state === 'aborted') {
                    timer.ts = -1;
                    timer.data = null;
                }
                else {
                    queueMicrotask(dispatcher);

                    timer.ts = 0;
                    timer.data = data || timer.data;
                }
                Object.defineProperty(promise, state, {value: -pid | 1});
            }

            freeze(promise);
        }

        return res;
    };

    /**
     * Promise-based setTimeout() replacement.
     * @param {Number} ts time to wait in seconds.
     * @param {*} [data] arbitrary data to pass through.
     * @returns {Promise<*>} promise
     * @name tSleep
     * @memberOf window
     */
    const tSleep = (ts, data) => {
        let pid;
        const promise = new Promise((resolve) => {
            pid = schedule(resolve, ts * 1e3, data);
        });
        return Object.defineProperties(promise, {
            'pid': {
                value: pid
            },
            'abort': {
                value() {
                    return abort(this);
                }
            },
            'expedite': {
                value(data) {
                    return this.signal('expedited', data);
                }
            },
            'restart': {
                value() {
                    return restart(this);
                }
            },
            'signal': {
                value(state, data) {
                    return abort(this, state, data);
                }
            }
        });
    };

    /**
     * Helper around Promise.race()
     * @param {Number} timeout in seconds, per {@link tSleep}
     * @param {Promise[]} args promises to race against.
     * @returns {Promise} eventual state of the first promise in the iterable to settle.
     * @memberOf tSleep
     */
    tSleep.race = (timeout, ...args) => {
        return Promise.race([tSleep(timeout), ...args]);
    };

    /**
     * Scheduler helper. This is similar to delay(), but without adding new setTimeout()s per call.
     * @param {Number} timeout in seconds (9s min recommended, to prevent unnecessary abort()s)
     * @param {Object|*} instance holder to attach private timer properties
     * @param {Function} [callback] function notifier
     * @memberOf tSleep
     * @returns {*} timer
     */
    tSleep.schedule = (timeout, instance, callback) => {
        const obj = instance[symbol] = instance[symbol] || {timer: null, tick: Date.now() / 1e3, timeout};

        if (obj.timer) {
            const now = Date.now() / 1e3;

            if (obj.timer.aborted) {
                obj.tick = now;
                obj.timer = null;
            }
            else if (timeout < obj.timeout) {
                obj.tick = now;
                obj.timer.abort();
                obj.timer = null;
            }
            else if (now - obj.tick > timeout >> 3) {
                obj.tick = now;
                obj.timer.restart();
            }
        }

        if (!obj.timer) {
            if (callback === undefined) {
                assert(typeof instance === 'function');
                callback = instance;
            }
            (obj.timer = tSleep(obj.timeout = timeout))
                .then(() => {
                    if (obj === instance[symbol]) {
                        instance[symbol] = null;

                        if (!obj.timer.aborted) {
                            queueMicrotask(callback);
                            obj.timer.aborted = -1;
                        }
                    }
                    else if (d) {
                        console.warn('tSleep() instance hot-swapped', obj, instance);
                    }
                })
                .catch(nop);
        }

        return obj.timer;
    };

    return freeze(tSleep);
});

/**
 * Sleep for a given number of seconds.
 * @param {Number} ts Number of seconds.
 * @param {*} [data] Any data to pass through.
 * @returns {Promise} fulfilled on timeout.
 * @function window.sleep
 * @description This is a low-level high performance non-throttled helper whose use takes careful thought.
 */
lazy(self, 'sleep', function sleep() {
    'use strict';

    if (!window.isSecureContext || typeof Worklet === 'undefined' || !Worklet.prototype.addModule) {
        if (d) {
            console.warn('Weak sleep() implementation, using throttled-setTimeout()');
        }
        return tSleep;
    }

    const MIN_THRESHOLD = 100;
    const MAX_THRESHOLD = 4e6;

    const pending = new Set();
    let threshold = MAX_THRESHOLD;

    let worklet = class extends AudioWorkletNode {
        constructor(ctx) {
            super(ctx, 'mega-worklet-messenger');
            this.port.onmessage = (ev) => this.handleMessage(ev);
            this._connected = false;
            this.attach().catch(dump);
        }

        get ready() {
            return true;
        }

        async attach() {
            if (!this._connected) {
                this.connect(this.context.destination);
                this._connected = true;
            }
            this.port.postMessage({threshold, message: 'schedule'});
        }

        async detach() {
            if (this._connected) {
                this._connected = false;
                this.port.postMessage({message: 'sleep'});
                return this.disconnect(this.context.destination);
            }
        }

        handleMessage(ev) {
            // console.debug('worklet-message', ev.data);

            if (ev.data.message !== 'dispatch') {
                return;
            }
            const tick = performance.now();

            threshold = MAX_THRESHOLD;
            for (const res of pending) {
                const {ts, now, data} = res;
                const elapsed = tick - now;

                if (elapsed + 21 > ts) {
                    res(data);
                    pending.delete(res);
                }
                else {
                    threshold = Math.max(MIN_THRESHOLD, Math.min(ts - elapsed, threshold));
                }
            }

            if (pending.size) {
                // re-schedule as per new threshold
                queueMicrotask(() => this.attach().catch(dump));
            }
            else {
                queueMicrotask(() => this.detach().catch(dump));
            }
        }
    };

    Promise.race([
        mega.worklet, tSleep(11).then(() => {
            if (!worklet.ready) {
                throw new SecurityError('Timed out.');
            }
        })
    ]).then((ctx) => {
        // override as the only class instance.
        worklet = new worklet(ctx);
    }).catch(ex => {
        if (d) {
            console.warn('The audio worklet failed to start, falling back to low-precision sleep()...', ex);
        }

        delete window.sleep;
        window[`sl${'e'}ep`] = tSleep;

        for (const res of pending) {
            tSleep(res.ts / 1e3, res.data).then(res);
        }
        pending.clear();
    }).finally(() => {
        delete mega.worklet;
    });

    return (ts, data) => new Promise(resolve => {
        ts = ts * 1e3 | 0;

        resolve.ts = ts;
        resolve.data = data;
        resolve.now = performance.now();
        pending.add(resolve);

        // resist-fingerprint-aware..
        threshold = Math.max(MIN_THRESHOLD, Math.min(ts, threshold));

        if (worklet.ready) {
            queueMicrotask(() => worklet.attach().catch(dump));
        }
    });
});

(() => {
    'use strict';

    let ctx;
    const onClick = tryCatch((ev) => {
        window.removeEventListener('click', onClick, true);

        tryCatch(() => {
            ctx = ctx || new AudioContext();
            Promise.resolve(ctx.resume()).catch(dump);
        }, false)();

        return ev.defaultPrevented;
    });
    window.addEventListener('click', onClick, true);

    /** @property mega.worklet */
    lazy(mega, 'worklet', function worklet() {
        return Promise.resolve((async() => {
            ctx = ctx || new AudioContext();

            if (ctx.state !== 'running') {
                if (d) {
                    console.warn('[AudioWorklet] context state is %s...', ctx.state);
                }
                await Promise.resolve(ctx.resume()).catch(dump);

                if (ctx.state !== 'running') {
                    throw new SecurityError(`The AudioContext was not allowed to start (${ctx.state})`);
                }
            }
            await ctx.audioWorklet.addModule(`${is_extension ? '' : '/'}worklet.js?v=1`);
            return ctx;
        })());
    });
})();

tryCatch(() => {
    'use strict';
    window.setInterval = () => {

        throw new TypeError(`Invalid setInterval() invocation at runtime.`);
    };
})();

mBroadcaster.once('boot_done', tryCatch(() => {
    'use strict';
    let pid = Math.random() * Date.now() >>> 9;

    const running = Object.create(null);
    const logger = new MegaLogger(`GTR:${pid.toString(16)}`);
    const dump = (ex) => logger.error(ex, reportError(ex));

    const IDLE_TIMEOUT = freeze({timeout: 100});
    const IDLE_PIPELINE = {ts: 0, pid: 0, tasks: []};

    const idleCallbackTaskSorter = (a, b) => b.ms - a.ms || b.pri - a.pri;

    const idleCallbackTaskDispatcher = (pid, ms, f, args) => {

        if (ms < 30) {
            if (self.d > 2) {
                logger.warn('Expediting ICTask...', ms, pid);
            }
            delete running[pid];
            queueMicrotask(() => f(...args));
        }
        else {

            (running[pid] = tSleep(ms / 1e3))
                .then(() => {
                    if (running[pid]) {
                        running[pid] = 'dispatching';
                        return f(...args);
                    }
                })
                .catch(dump)
                .finally(() => {
                    delete running[pid];
                });
        }
    };

    const idleCallbackHandler = (res) => {
        const {ts, tasks} = IDLE_PIPELINE;
        const elapsed = performance.now() - ts;

        // Sort tasks so that there can only be ONE tSleep()'s dispatcher invocation.
        tasks.sort(idleCallbackTaskSorter);

        for (let i = tasks.length; i--;) {
            const {ms, f, args, pid} = tasks[i];

            if (running[pid] === 'starting') {

                idleCallbackTaskDispatcher(pid, ms - elapsed, f, args);
            }
        }

        if (self.d > 2) {
            const rem = res.didTimeout ? -1 : res.timeRemaining();

            // Print out a warning if there are less than 5ms left until the next re-paint.
            logger[rem < 0 ? 'debug' : rem < 5 ? 'warn' : 'info'](`${tasks.length} ICTask(s) handled...`, elapsed, rem);
        }

        IDLE_PIPELINE.pid = null;
        IDLE_PIPELINE.tasks = [];
    };

    const scheduleIdleCallback = (task) => {
        IDLE_PIPELINE.tasks.push(task);

        if (!IDLE_PIPELINE.pid) {
            IDLE_PIPELINE.ts = performance.now();
            IDLE_PIPELINE.pid = requestIdleCallback(idleCallbackHandler, IDLE_TIMEOUT);
        }
    };

    const dspInterval = async(pid, ms, callback) => {
        running[pid] = 1;

        do {
            await tSleep(ms);

            if (running[pid]) {

                // logger.warn('tick', pid);
                callback();
            }
        }
        while (running[pid]);
    };

    window.setInterval = function(f, ms, ...args) {
        dspInterval(++pid, Math.max(ms | 0, 1e3) / 1e3, tryCatch(() => f(...args))).catch(dump);

        // logger.warn('setInterval', pid, ms);
        return pid;
    };

    window.clearInterval = function(pid) {

        // logger.warn('clearInterval', pid, running[pid]);
        delete running[pid];
    };

    window.setTimeout = function(f, ms, ...args) {

        if (typeof f !== 'function') {
            console.error('Invalid call...', f, ms, args);
            return 0;
        }

        if ((ms |= 0) < 30) {
            // logger.warn(`Short timeout (${ms}ms), dispatching micro-task...`);
            queueMicrotask(() => f(...args));
            return 0;
        }
        const pid = makeUUID();

        running[pid] = 'starting';
        scheduleIdleCallback({ms, f, args, pid, pri: ++mIncID});

        // logger.warn('setTimeout', pid, ms);
        return pid;
    };

    window.clearTimeout = function(pid) {
        // logger.warn('clearTimeout', pid, running[pid]);

        if (pid) {
            if (typeof pid === 'string') {

                if (running[pid]) {

                    if (running[pid] instanceof Promise) {

                        running[pid].abort();
                    }
                    delete running[pid];
                }
            }
            else {
                gClearTimeout(pid);
            }
        }
    };
}));

/**
 * Cross-tab communication using WebStorage
 * @name watchdog
 * @memberOf window
 */
lazy(self, 'watchdog', () => {
    'use strict';

    const storage = Object.create(null);
    const channel = mBroadcaster.getBroadcastChannel('watchdog');

    // Hols promises waiting for a query reply
    const queryQueue = Object.create(null);
    // Holds query replies if cached
    const replyCache = Object.create(null);
    // waiting queries
    const waitingQueries = Object.create(null);
    // event overriders
    const overrides = Object.create(null);

    // statically defined handlers, for anything transient do consider using registerOverrider() or attach()!
    const mWatchDogHandlers = freeze({
        'Q!Rep!y'(data) {
            const {query, token, value} = data;

            if (queryQueue[token]) {
                queryQueue[token].push(value);
            }

            if (replyCache[query]) {
                replyCache[query].push(value);
            }

            // if there is a promise in waitingQueries, that means that this query
            // is expecting only 1 response, so we can resolve it immediately.
            const resolver = waitingQueries[token];
            if (resolver) {
                const {timer} = resolver;

                if (value) {
                    timer.abort();
                    queueMicrotask(() => {
                        delete queryQueue[token];
                        delete waitingQueries[token];
                    });
                    resolver([value]);
                }
                else {
                    // Got falsy value, wait for more
                    timer.poke(value);
                }
            }
        },
        'loadfm_done'(data, origin) {
            if (storage.login === origin) {
                location.reload(true);
            }
        },
        'setrsa'(data) {
            if (typeof dlmanager === 'object'
                && (dlmanager.isOverFreeQuota || dlmanager.onOverquotaWithAchievements)) {

                const [type, sid] = data;

                u_storage = init_storage(localStorage);
                u_checklogin4(sid)
                    .then((r) => {
                        channel.logger.assert(u_type === type, 'Unexpected user-type: got %s, expected %s', r, type);

                    })
                    .dump('watchdog.setrsa');
            }
        },
        'setsid'(data, origin) {
            if (storage.login === origin && data) {

                if (!isPublicLink()) {
                    loadingDialog.show(0, l[17794]);
                    return tSleep(3).then(() => location.reload(true));
                }

                const sid = data;
                delay('watchdog:setsid', () => u_checklogin4(sid).dump('watchdog.setsid'), 750);

                // @todo receive from what page the user logged in, and if he's getting into the FM don't delete this
                delete storage.login;
            }
        },
        'login'(data, origin) {
            if (data[0]) {
                u_storage = init_storage(sessionStorage);
                u_storage.k = JSON.stringify(data[0]);
                if (data[2]) {
                    u_storage.privk = data[2];
                }
            }
            else {
                u_storage = init_storage(localStorage);
            }
            storage.login = origin;
        },
        'user-created'(data, origin) {
            if (!M.hasPendingTransfers()) {
                loadingDialog.show(0, l[17794]);
                storage.login = origin;
            }
        },
        'logout'() {
            if (storage.atfs || !M.hasPendingTransfers()) {
                loadingDialog.show(0, l[17794]);
                tSleep.race(2, storage.atfs)
                    .then(() => tSleep.race(3, u_logout(-0xDEADF)))
                    .finally(() => location.reload());
            }
        },
        'abort-transfers'() {
            if (M.hasPendingTransfers()) {
                // to be used in 'logout' event, as this is only invoked from M.logoutAbortTransfers()
                storage.atfs = M.abortTransfers(true);
            }
        },
        'chat-event'(data) {
            if (data.state === 'DISCARDED' && self.megaChatIsReady) {
                const chatRoom = megaChat.plugins.chatdIntegration._getChatRoomFromEventData(data);
                megaChat.plugins.chatdIntegration.discardMessage(chatRoom, data.messageId);
            }
        },
    });

    // ------------------------------------------------------------------------------------------

    return freeze({
        get origin() {
            return storage.origin;
        },

        /**
         * Attach a self-managed handler for watchdog-events.
         * @param {Function|Object} what event handler
         */
        attach(what) {
            return what !== this && channel.attachEvent(what);
        },

        /**
         * Detach a self-managed handler for watchdog-events.
         * @param {Function|Object} what event handler
         */
        detach(what) {
            return what !== this && channel.detachEvent(what);
        },

        /** setup watchdog listener */
        setup() {
            if (!('origin' in storage)) {
                Object.defineProperty(storage, 'origin', {
                    value: channel.origin
                });
                channel.attachEvent(this);
            }
        },

        /**
         * Notify watchdog event/message
         * @param {String} msg  The message
         * @param {*} [data] Any data sent to other tabs
         */
        notify(msg, data) {
            channel.dispatchEvent(msg, data);
        },

        /**
         * Perform a query to other tabs and wait for reply through a Promise
         * @param {String} what Parameter
         * @param {Number|String} timeout ms
         * @param {String} cache   preserve result
         * @param {Object} [data]   data to be sent with the query
         * @param {bool} [expectsSingleAnswer]   pass true if your query is expected to receive only single answer (this
         * would speed up and resolve the returned promise when the first answer is received and won't wait for the full
         * `timeout` to gather more replies)
         * @return {Promise}
         */
        query(what, timeout, cache, data, expectsSingleAnswer) {
            return new Promise((resolve, reject) => {
                if (replyCache[what]) {
                    // a prior query was launched with the cache flag
                    cache = replyCache[what];
                    delete replyCache[what];
                    return resolve(cache);
                }
                const tabs = mBroadcaster.crossTab.peers;
                if (!tabs) {
                    // Nothing to do here.
                    return reject(EEXIST);
                }
                const token = makeUUID();
                const tmpData = structuredClone(data || {});

                if (cache) {
                    replyCache[what] = [];
                }
                tmpData.reply = token;
                queryQueue[token] = [];

                queueMicrotask(() => {
                    this.notify(`Q!${what}`, tmpData);
                });
                timeout = parseInt(timeout || 384) / 1e3;

                if (expectsSingleAnswer) {
                    let pokes = 0;
                    const ack = () => {
                        if (pokes > 0) {
                            // all tabs returned a falsy value
                            resolve([false]);
                        }
                        else {
                            reject(EACCESS);
                        }

                        delete queryQueue[token];
                        delete waitingQueries[token];
                    };
                    const timer = tSleep(timeout);

                    timer.poke = () => {
                        if (!pokes++) {
                            tSleep(0.3 * tabs).then(ack);
                        }
                    };
                    timer.then(ack);

                    resolve.timer = timer;
                    waitingQueries[token] = resolve;
                }
                else {
                    // wait for reply and fulfill/reject the promise
                    tSleep(timeout).then(() => {
                        if (queryQueue[token].length) {
                            resolve(queryQueue[token]);
                        }
                        else {
                            reject(EACCESS);
                        }
                        delete queryQueue[token];
                    });
                }
            });
        },

        /**
         * Register event handling overrider
         * @param {String} event The event name
         * @param {Function|*} [callback] Optional function to invoke on overriding
         */
        registerOverrider(event, callback) {

            overrides[event] = callback || true;
        },

        /**
         * Unregister event handling overrider
         * @param {String} event The event name
         */
        unregisterOverrider(event) {

            delete overrides[event];
        },

        /** Handle watchdog/webstorage event */
        handleEvent({data}) {
            const {message, origin, data: payload} = data;

            if (channel.debug) {
                channel.debug(`\u{1F4E9} Received '${message}' message from ${origin.toString(36)}`, payload);
            }

            if (origin === channel.origin) {

                if (self.d) {
                    channel.logger.warn('Ignoring mWatchDog event', message);
                }
            }
            else if (overrides['*'] || overrides[message]) {

                if (channel.debug) {
                    channel.debug(`\u{1F3C4} dispatching overrider for ${message}`, payload);
                }
                if (typeof overrides[message] === 'function') {

                    tryCatch(overrides[message])(payload, data);
                }
                else {
                    mBroadcaster.sendMessage(`watchdog:${message}`, data);
                }
            }
            else if (mWatchDogHandlers[message]) {

                tryCatch(mWatchDogHandlers[message])(payload, origin);
            }
            else if (!mBroadcaster.sendMessage(`watchdog:${message}`, data) && message.startsWith('Q!')) {
                let value = false;
                const query = message.slice(2);

                switch (query) {
                    case 'dlsize':
                        value = dlmanager.getCurrentDownloadsSize();
                        break;

                    case 'dling':
                        value = dlmanager.getCurrentDownloads();
                        break;

                    case 'qbqdata':
                        value = dlmanager.getQBQData();
                        break;

                    case 'transfers':
                        value = M.hasPendingTransfers();
                        break;

                    case 'rad-flush':
                        value = 'rad' in mega && mega.rad.flush().always(nop);
                        break;
                }

                Promise.resolve(value)
                    .then((value) => {
                        this.notify('Q!Rep!y', {query, value, token: payload.reply});
                    })
                    .catch(dump);
            }
        }
    });
});

mBroadcaster.once('boot_done', () => {
    'use strict';
    watchdog.setup();

    api.observe('setsid', (sid) => {
        watchdog.notify('setsid', sid);
    });
});

/**
 * Create a pool of workers, it returns a Queue object
 * so it can be called many times and it'd be throttled
 * by the queue
 *
 * @param {String} url Script url/filename
 * @param {Function} message Worker's message dispatcher
 * @param {Number} [size] Number of workers
 * @returns {MegaQueue}
 */
function CreateWorkers(url, message, size) {
    "use strict";

    var worker = [];
    var backoff = 400;
    var instances = [];
    var wid = url + '!' + makeUUID();

    var terminator = function() {
        tSleep.schedule(130, worker, () => {
            let kills = 0;
            const now = Date.now();

            for (let i = worker.length; i--;) {
                if (worker[i] && !worker[i].busy && now - worker[i].tts > 4e4) {
                    tryCatch(() => worker[i].terminate())();
                    worker[i] = null;
                    kills++;
                }
            }

            if (kills) {
                onIdle(() => {
                    mBroadcaster.sendMessage('createworkers:terminated', kills);
                });
            }
        });
    };

    var handler = function(id) {
        return function(e) {
            message(this.context, e, function(r) {
                if (d > 1) {
                    console.debug('[%s] Worker #%s finished...', wid, id);
                }

                worker[id].onerror = null;
                worker[id].context = null;
                worker[id].busy = false;
                worker[id].tts = Date.now();
                terminator();

                /* release worker */
                const done = instances[id];
                instances[id] = null;

                done(r);
            });
        }
    };

    var workerLoadFailure = function(ex) {
        if (d) {
            console.error(wid, ex);
        }
        msgDialog('warninga', l[47], '' + ex, l[20858]);
    };

    var create = function(i) {
        var w;

        try {
            w = new Worker(url);
        }
        catch (e) {
            // deal with QuotaExceededError: Failed to construct 'Worker': Maximum worker number has been reached.
            if (e.name === 'QuotaExceededError') {
                return false;
            }
            console.assert(navigator.onLine !== false, e);
            if (navigator.onLine === false) {
                // this should not happens, onerror shall be reached instead, if some fancy browser does it fix this!
                return false;
            }
            return workerLoadFailure(e);
        }

        w.id = i;
        w.busy = false;
        w.postMessage = w.webkitPostMessage || w.postMessage;
        w.onmessage = handler(i);
        return w;
    };

    if (!is_karma && !is_extension) {
        url = '/' + url;
    }
    size = size || mega.maxWorkers;

    for (var i = size; i--;) {
        worker.push(null);
    }

    if (d > 1) {
        if (!window._cwWorkers) {
            window._cwWorkers = Object.create(null);
        }
        if (!window._cwInstances) {
            window._cwInstances = Object.create(null);
        }
        window._cwWorkers[wid] = worker;
        window._cwInstances[wid] = instances;
    }

    return new MegaQueue(function _(task, done) {
        var i = size;
        var self = this;

        while (i--) {
            if (!worker[i] && !(worker[i] = create(i))) {
                continue;
            }
            if (!worker[i].busy) {
                break;
            }
        }

        if (i < 0) {
            console.error('Workers subsystem exhausted... holding.', mega.maxWorkers, size);
            mBroadcaster.once('createworkers:terminated', _.bind(this, task, done));
            return;
        }

        instances[i] = done;
        worker[i].busy = true;
        worker[i].onerror = function(ex) {
            console.warn('[%s] Worker #%s error on %s:%d, %s.',
                wid, i, ex.filename || 0, ex.lineno | 0, ex.message || 'Failed to load', ex, task);

            tryCatch(() => worker[i].terminate())();
            worker[i] = instances[i] = null;

            if ((backoff | 0) < 100) {
                backoff = 200;
            }
            tSleep(Math.min(8e3, backoff <<= 1) / 1e3)
                .then(() => _(task, done))
                .catch(dump);
        };

        if (d > 1) {
            console.debug('[%s] Sending task to worker #%s', wid, i, task);
        }

        $.each(task, function(e, t) {
            if (e === 0) {
                worker[i].context = t;
            }
            // Unfortunately, we had to cease to use transferables for the onerror handler to work properly..
            // else if (t.constructor === Uint8Array && typeof MSBlobBuilder !== "function") {
            //     worker[i].postMessage(t.buffer, [t.buffer]);
            // }
            else {
                if (e === 2) {
                    worker[i].byteOffset = t * 16;
                }

                try {
                    worker[i].postMessage(t);
                }
                catch (ex) {
                    if (ex.name === 'DataCloneError' && t.constructor === Uint8Array) {
                        worker[i].postMessage(t.buffer, [t.buffer]);
                    }
                    else {
                        console.error(' --- FATAL UNRECOVERABLE ERROR --- ', ex);

                        onIdle(function() {
                            throw ex;
                        });
                    }
                }
            }
        });
    }, size, url.split('/').pop().split('.').shift() + '-worker');
}

/** @property window.backgroundNacl */
lazy(self, 'backgroundNacl', function backgroundNacl() {
    "use strict";

    var x = 0;
    var backgroundNacl = Object.create(null);

    /** @property window.backgroundNacl.workers */
    lazy(backgroundNacl, 'workers', () => {
        const mw = Math.min(mega.maxWorkers, 4);
        const workers = CreateWorkers('naclworker.js', (ctx, e, release) => release(e.data), mw);

        workers._taggedTasks = Object.create(null);
        workers.removeTasksByTagName = function(tagName) {
            if (this._taggedTasks[tagName]) {
                const tasks = this._taggedTasks[tagName];

                for (let i = tasks.length; i--;) {
                    if (tasks[i]) {
                        this.filter(tasks[i].taskId);
                        tasks[i].reject(0xDEAD);
                    }
                }

                delete this._taggedTasks[tagName];
            }
        };

        return workers;
    });

    // create aliases for all (used by us) nacl funcs, that return promises
    backgroundNacl.sign = {
        'detached': {
            /**
             * Alias of nacl.sign.detached.verify.
             *
             * Note: msg, sig and publicKey should be strings, NOT ArrayBuffers as when using nacl directly.
             *
             * @param msg
             * @param sig
             * @param publicKey
             * @returns {MegaPromise}
             */
            'verify': function(msg, sig, publicKey, tagName) {
                var masterPromise = new MegaPromise();

                var taskId = (tagName ? tagName + "_" : "") + "req" + (x++);
                backgroundNacl.workers.push(
                    [
                        taskId,
                        [
                            "verify", msg, sig, publicKey
                        ]
                    ],
                    function() {
                        masterPromise.resolve(
                            arguments[1][0]
                        );
                    }
                );
                masterPromise.taskId = taskId;

                if (tagName) {
                    if (!backgroundNacl.workers._taggedTasks[tagName]) {
                        backgroundNacl.workers._taggedTasks[tagName] = [];
                    }
                    backgroundNacl.workers._taggedTasks[tagName].push(masterPromise);

                    masterPromise.always(function() {
                        if (backgroundNacl.workers._taggedTasks[tagName]) {
                            array.remove(backgroundNacl.workers._taggedTasks[tagName], masterPromise);
                        }
                    });
                }

                return masterPromise;
            }
        }
    };

    return backgroundNacl;
});

mega.utils = mega.utils || {};

mega.utils.trans = mega.utils.trans || {};

mega.utils.trans.listFormatMeta = {};
mega.utils.trans.listFormatMeta.customCommas = {
    "ar": " \u0648",
    "jp": "\u3001",
    "cn": "\u3001",
    "ct": "\u3001",
    "th": " "
};
mega.utils.trans.listFormatMeta.conjunctions = {
    "br": "e",
    "cn": "\u548C",
    "ct": "\u548C",
    "de": "und",
    "en": "and",
    "es": "y",
    "fr": "et",
    "id": "dan",
    "it": "e",
    "kr": "\uBC0F",
    "nl": "en",
    "pl":"i",
    "ro": "\u0219i",
    "ru": "\u0438",
    "th": "\u0E41\u0E25\u0E30",
    "vi": "v\u00e0"
};

/**
 * Should be used to translate multiple items in strings, as:
 * "Call with %s ended." -> "Call with Ivan, John and Peter ended."
 *
 * @param {Array} items array of strings
 * @param {String} translationString string to be used for replacing %s/[X] w/ the list of items
 * @param {boolean} [translationAndOr] Pass true for when "or" should be used and false/falsy value for when "and" is
 * needed
 */
mega.utils.trans.listToString = function(items, translationString, translationAndOr) {
    "use strict";

    assert(items && items.concat, "invalid items passed (can't be a non-array)");
    assert(translationString, 'missing translationString');

    if (items.length === 0) {
        return '';
    }

    translationString = translationString.replace("[X]", "%s");

    if (items.length === 1) {
        return translationString.replace("%s", items[0]);
    }
    // don't modify the passed array, but cloned it!
    var clonedItems = clone(items);
    var lastItem = "";
    var replacement = "";

    var customComma = mega.utils.trans.listFormatMeta.customCommas[lang];
    customComma = typeof customComma === "undefined" ? ", " : customComma;

    // Arabic does have a special order in which items are "joined"/glued

    lastItem = clonedItems.pop();
    replacement = clonedItems.join(customComma);

    if (translationAndOr) {
        throw new Error("Not implemented");
        // TODO: translate!
        // replacement = "%s1 or %s2".replace("%s1", replacement);
    }
    else {
        var space1 = " ";
        var space2 = " ";
        var defConj = l.and_conjunction || mega.utils.trans.listFormatMeta.conjunctions[lang];

        // thai specific spaces configuration
        if (lang === "th") {
            space1 = items.length === 2 ? "" : space1;
            space2 = "";
        }
        // jp and ar uses "A and B and C", with custom "comma"
        else if (lang === "jp" || lang === "ar") {
            space1 = space2 = "";
            defConj = mega.utils.trans.listFormatMeta.customCommas[lang];
        }
        // "cn" and "ct" does have a "space"-like character embedded in the conjunction string
        else if (lang === "cn" || lang === "ct") {
            space1 = space2 = "";
        }
        // indonesian have a special "oxford comma"-like ending comma that needs to be appended in some cases
        else if (lang === "id" && items.length > 2 && replacement) {
            replacement += ",";
        }

        // debug/development helper:
        // console.error(JSON.stringify({
        //     "replacement": replacement,
        //     "lang": lang,
        //     "conj": mega.utils.trans.listFormatMeta.conjunctions[lang],
        //     "comma": mega.utils.trans.listFormatMeta.customCommas[lang]
        // }, null, "\t", 2));

        replacement = `%s1${lang === 'en' && clonedItems.length > 1 ? ',' : ''}${space1}${defConj}${space2}%s2`
            .replace("%s1", replacement);
    }
    replacement = replacement.replace("%s2", lastItem);

    return translationString
        .replace("%s", replacement);
};

/* global EXIF, dcraw, exifImageRotation, mThumbHandler, makeUUID */
/* eslint-disable no-use-before-define, strict, max-params, max-classes-per-file */

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
    Object.defineProperty(self, 'isWorkerScope', {value: true});

    self.echo = (v) => v;
    self.lazy = (t, p, s) => Object.defineProperty(t, p, {
        get() {
            Object.defineProperty(this, p, {value: s.call(this)});
            return this[p];
        },
        configurable: true
    });
    self.eventlog = (e) => fetch(`${apipath}cs?id=0&wwk=1`, {method: 'post', body: JSON.stringify([{a: 'log', e}])});
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * The MEGAException interface represents an abnormal event (called an exception) that occurs
 * as a result of calling a method or accessing a property of a Web API.
 * It does extends DOMException adding a stack trace record and a weak reference to some data.
 * @param {Error|String} ex description associated with the given error name.
 * @param {*} [data] arbitrary data to pass through the event.
 * @param {String} [name] A standard DOMException error name.
 */
class MEGAException extends DOMException {
    constructor(ex, data = null, name = 'InvalidStateError') {
        let stack;
        if (ex instanceof Error) {
            stack = ex.stack;
            ex = ex.message || ex;
        }
        if (data && typeof data === 'string' && /^[A-Z].*Error$/.test(data)) {
            name = data;
            data = null;
        }
        super(ex, name);

        if (data !== null) {
            if (typeof data === 'object') {
                const ref = new WeakRef(data);
                Object.defineProperty(this, 'data', {
                    get() {
                        return ref.deref();
                    }
                });
            }
            else {
                Object.defineProperty(this, 'data', {value: data});
            }
        }

        if (!stack) {
            stack = new Error(ex).stack;

            if (stack && typeof stack === 'string') {
                stack = stack.replace('Error:', `${name}:`)
                    .split('\n')
                    .filter(MEGAException.stackFilter)
                    .join('\n');
            }
        }

        Object.defineProperty(this, 'stack', {
            configurable: true,
            value: String(stack || '')
        });
    }

    toString() {
        return `${this.name}: ${this.message}`;
    }

    valueOf() {
        const {stack, name} = this;
        return stack.startsWith(name) ? stack : `${this.toString()}\n${stack}`;
    }

    get [Symbol.toStringTag]() {
        return 'MEGAException';
    }
}

Object.defineProperty(MEGAException, 'assert', {
    value: function assert(expr, msg, ...args) {
        if (!expr) {
            throw new MEGAException(msg || 'Failed assertion.', ...args);
        }
    }
});

/** @property MEGAException.stackFilter */
lazy(MEGAException, 'stackFilter', () => {
    'use strict';
    const assert = self.ua && ua.details.engine === 'Gecko' ? 'assert@' : 'assert ';

    return (ln) => !ln.includes('MEGAException') && !ln.includes(assert);
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * The MEGAImageElement interface provides utility functions to load and/or decode images in different formats.
 * @param {String|Blob|ArrayBufferLike} source The resource to load.
 * @param {String} [type] The mime type associated with the resource being loaded.
 */
class MEGAImageElement {
    constructor(source, type = MEGAImageElement.DEFAULT_FORMAT) {
        if (source) {
            this.type = type;
            this.source = source;
        }
    }

    loadImage(source, type = MEGAImageElement.DEFAULT_FORMAT, options = null) {
        return new Promise((resolve, reject) => {
            let objectURL;

            if (typeof type === 'object') {
                options = type;
                type = options.type || MEGAImageElement.DEFAULT_FORMAT;
            }

            if (typeof source === 'object' && "byteLength" in source) {
                source = new Blob([source], {type});
            }

            if (source instanceof Blob) {
                if (self.isWorkerScope) {
                    return this.createImageBitmap(source).then(resolve).catch(reject);
                }
                source = objectURL = URL.createObjectURL(source);
            }

            if (self.isWorkerScope) {
                fetch(source, {mode: 'cors'})
                    .then(resp => resp.blob())
                    .then(blob => this.createImageBitmap(blob))
                    .then(resolve)
                    .catch(reject);
                return;
            }

            const loadend = (error) => {
                if (objectURL) {
                    URL.revokeObjectURL(objectURL);
                }
                image.onload = image.onerror = null;

                if (!(image.width + image.height)) {
                    error = error || true;
                }
                if (error) {
                    const message = error.message || 'The source image cannot be decoded!';
                    return reject(new MEGAException(message, image, 'EncodingError'));
                }
                resolve(image);
            };

            const image = new Image();
            image.crossOrigin = '';
            image.src = source;

            if ('decode' in image) {
                return image.decode().then(() => loadend()).catch(loadend);
            }

            image.onerror = loadend;
            image.onload = () => loadend();
        });
    }

    async decodeTIFFImage(data) {
        if (typeof Tiff === 'undefined') {
            return false;
        }
        Tiff.initialize({TOTAL_MEMORY: 128 * 1048576});

        const tiff = new Tiff(new Uint8Array(data.buffer || data));
        const res = this.createImageData(tiff.readRGBAImage(), tiff.width(), tiff.height());

        this.tryCatch(() => {
            tiff.close();
            Tiff.Module.FS_unlink(tiff._filename);
        });
        return res;
    }

    decodeRAWImage(type, data) {
        const d = self.d > 0;
        const uint8 = new Uint8Array(data);
        const {FS, run} = self.dcraw || !1;
        const filename = `${Math.random().toString(26).slice(-9)}.${type}`;
        let orientation, cwd;

        if (d) {
            console.group(`decodeRAWImage(${filename})`);
            console.time(filename);
        }

        this.tryCatch(() => {
            cwd = `/MEGA-${Date.now()}`;
            FS.mkdir(cwd);
            FS.chdir(cwd);

            if (d) {
                console.time('dcraw-load');
            }
            FS.createDataFile('.', filename, uint8, true, false);

            if (d) {
                console.timeEnd('dcraw-load');
            }

            if (d) {
                console.time('dcraw-proc');
            }
            if (d) {
                run(['-i', '-v', filename]);
            }
            run(['-e', filename]);
            if (d) {
                console.timeEnd('dcraw-proc');
            }
        })();

        const thumb = filename.substr(0, filename.lastIndexOf('.'));

        const getPPMThumbnail = () => FS.readFile(`${thumb}.thumb.ppm`);
        const getJPEGThumbnail = () => FS.readFile(`${thumb}.thumb.jpg`);

        const convertImage = () => {
            if (d) {
                this.debug(`${filename} has no thumbnail, converting whole image...`);
                console.time('dcraw-conv');
            }

            if (typeof eventlog !== 'undefined') {
                // log 'RAW image w/o thumbnail'
                eventlog(99662);
            }

            run(['-O', `${thumb}.ppm`, filename]);

            const result = this.tryCatch(() => this.convertPPMToImageData(FS.readFile(`${thumb}.ppm`)))();

            if (d) {
                console.timeEnd('dcraw-conv');
            }

            return result;
        };

        const step3 = this.tryCatch(convertImage);
        const step2 = this.tryCatch(() => this.convertPPMToImageData(getPPMThumbnail()), step3);

        data = this.tryCatch(getJPEGThumbnail, step2)();

        this.tryCatch(() => FS.unlink(filename))();
        this.tryCatch(() => {
            FS.readdir('.').map((n) => n !== '.' && n !== '..' && FS.unlink(n));
            FS.readdir('/tmp').map((n) => n !== '.' && n !== '..' && FS.unlink(`/tmp/${n}`));
            FS.chdir('..');
            FS.rmdir(cwd);
        })();

        if (typeof eventlog !== 'undefined') {
            // 'RAW image processed.' : 'Failed to decode RAW image.'
            eventlog(data ? 99663 : 99664);
        }

        if (type === 'PEF') {
            orientation = +uint8[115];
        }

        if (d) {
            console.timeEnd(filename);
            console.groupEnd();
        }
        return data && {data, orientation} || false;
    }

    convertPPMToImageData(ppm) {
        let imageData;

        // Check for P6 header
        if (ppm[0] === 80 && ppm[1] === 54) {
            let i = 2;
            let dim = '';

            if (self.d) {
                console.time('convertPPMToImageData');
            }

            while (ppm[++i] !== 10) {
                dim += String.fromCharCode(ppm[i]);
            }

            // check for 255 identifier.
            if (ppm[i + 1] === 50 && ppm[i + 2] === 53 && ppm[i + 3] === 53) {
                const [width, height] = dim.split(' ').map(Number);
                const {ctx} = new MEGACanvasElement(width, height, '2d');

                ppm = ppm.subarray(i + 5);
                imageData = ctx.createImageData(width, height);

                const ppmLen = ppm.byteLength;
                const iLen = width * height * 4;
                let blank = true;
                let j = 0;
                i = 0;
                while (i < ppmLen && j < iLen) {
                    if (blank) {
                        blank = !(ppm[i] | ppm[i + 1] | ppm[i + 2]);
                    }
                    imageData.data[j] = ppm[i];         // R
                    imageData.data[j + 1] = ppm[i + 1]; // G
                    imageData.data[j + 2] = ppm[i + 2]; // B
                    imageData.data[j + 3] = 255;        // A
                    i += 3;
                    j += 4;
                }

                if (blank) {
                    imageData = null;
                }
            }

            if (self.d) {
                console.timeEnd('convertPPMToImageData');
            }
        }

        return imageData;
    }

    identify(data) {
        if (data instanceof Blob) {
            return this.readAsArrayBuffer(data.slice(0, 32)).then(ab => this.identify(ab));
        }
        const res = Object.create(null);
        const dv = new DataView(data.buffer || data);
        const getUint32 = (offset) => dv.byteLength > 4 + offset && dv.getUint32(offset);

        // Perform magic number checks for each recognized image type by is_image() per file extension.
        // Anything handled from mThumbHandler is meant to return a PNG, so we don't need to add a magic for eg SVG.
        switch (dv.getUint16(0)) {
            case 0xFFD8:
                res.format = 'JPEG';
                res.type = 'image/jpeg';
                break;
            case 0x4D4D: // TIFF, big-endian
                res.bigEndian = true;
            /* fallthrough */
            case 0x4949: // TIFF, little-endian
                res.format = 'TIFF';
                res.type = 'image/tiff';
                break;
            case 0x424D:
                res.format = 'BMP';
                res.type = 'image/bmp';
                break;
            case 0xFF0A:
                // JPEG-XL 'naked' codestream.
                res.format = 'JXL';
                res.type = 'image/jxl';
                res.doesSupportAlpha = true;
                break;

            default:
                if (getUint32(20) === 0x68656963) {
                    res.format = 'HEIC';
                    res.type = 'image/heic';
                    break;
                }
                if (getUint32(20) === 0x61766966) {
                    res.format = 'AVIF';
                    res.type = 'image/avif';
                    break;
                }
                if (getUint32(8) === 0x57454250) {
                    res.format = 'WEBP';
                    res.type = 'image/webp';
                    res.doesSupportAlpha = true;
                    break;
                }
                if (getUint32(4) === 0x4A584C20) {
                    // JPEG-XL ISOBMFF-based container.
                    res.format = 'JXL';
                    res.type = 'image/jxl';
                    res.doesSupportAlpha = true;
                    break;
                }

                switch (getUint32(0)) {
                    case 0x89504e47:
                        res.format = 'PNG';
                        res.type = 'image/png';
                        res.doesSupportAlpha = true;
                        break;
                    case 0x47494638: // GIF8
                    case 0x47494639: // GIF9
                        res.format = 'GIF';
                        res.type = 'image/gif';
                        break;

                    default:
                        if (self.d) {
                            this.debug('Unrecognized image format.', dv);
                        }
                        res.format = 'UNK';
                }
        }

        return res;
    }

    readAs(file, method = 'ArrayBuffer') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = (ev) => resolve(ev.target.result);
            reader[`readAs${method}`](file);
        });
    }

    readAsDataURL(file) {
        return this.readAs(file, 'DataURL');
    }

    readAsArrayBuffer(file) {
        if ('byteLength' in file) {
            return file.buffer || file;
        }
        if ('arrayBuffer' in file) {
            return file.arrayBuffer();
        }
        return this.readAs(file, 'ArrayBuffer');
    }

    async readAsAESCBCBuffer(file) {
        const buffer = await this.readAsArrayBuffer(file);
        const uint8 = new Uint8Array(buffer.byteLength + 15 & -16);
        uint8.set(new Uint8Array(buffer));
        return uint8.buffer;
    }

    readEXIFMetaData(buffer, tag = 'Orientation') {
        if (self.d) {
            console.time('exif');
        }
        const exif = EXIF.readFromArrayBuffer(buffer, true);

        if (self.d) {
            this.debug('readEXIFMetaData', exif);
            console.timeEnd('exif');
        }
        return tag ? exif[tag] : exif;
    }

    dataURLToUint8(url) {
        let [type, data] = String(url).split(',');

        const bp = type.indexOf(';base64');
        if (bp > 0) {
            data = atob(data);
            type = type.substr(0, bp);
        }
        data = Uint8Array.from(data, c => c.charCodeAt(0));
        data.type = type.substr(5);

        return data;
    }

    dataURLToBlob(url) {
        const data = this.dataURLToUint8(url);
        return new Blob([data], {type: data.type});
    }

    createImageData(data, width, height) {
        data = new Uint8ClampedArray(data);
        return new ImageData(data, width, height);
    }

    async createImageBitmap(source) {
        // https://caniuse.com/createimagebitmap

        // @todo https://crbug.com/979890
        // @todo https://bugzilla.mozilla.org/show_bug.cgi?id=1367251

        if (self.supImageBitmap) {
            const bitmap = await createImageBitmap(source)
                .catch(ex => {
                    if (self.d) {
                        this.debug(`Failed to create ImageBitmap from ${source[Symbol.toStringTag]}...`, ex, source);
                    }
                });

            if (bitmap) {
                return bitmap;
            }
        }

        if (source instanceof Blob) {
            if (self.isWorkerScope) {
                // @todo Blob support..
                throw new MEGAException('TBD: Blob Support.', 'NotSupportedError');
            }
            return this.loadImage(source);
        }

        const {ctx} = new MEGACanvasElement(source.width, source.height);
        if (source instanceof ImageData) {
            ctx.putImageData(source, 0, 0);
        }
        else {
            ctx.drawImage(source, 0, 0);
        }

        return ctx.canvas;
    }

    async getRotatedImageData(source) {
        const isBlob = source instanceof Blob;
        const isBuffer = !isBlob && source && source.byteLength > 32;

        if (!(isBlob || isBuffer)) {
            throw new MEGAException('Unable to decode input file.', source);
        }

        let rv = source.orientation;
        const type = source.type || (await this.identify(source)).type;

        if (rv === undefined && type === 'image/jpeg') {
            if (isBlob) {
                source = await this.readAsArrayBuffer(source);
            }
            rv = this.readEXIFMetaData(source, 'Orientation');
        }

        source.type = type;
        return exifImageRotation(source, rv);
    }

    debug(m, ...args) {
        if (!this.pid) {
            this.pid = `${this[Symbol.toStringTag]}:${Math.random().toString(36).slice(-7).toUpperCase()}`;
        }

        return self.dump(`[${this.pid}] ${m}`, ...args);
    }

    assert(expr, message) {
        if (!expr) {
            throw new MEGAException(message || 'Failed assertion.');
        }
    }

    getError() {
        return 0;
    }

    getErrorString(code) {
        return String(code);
    }

    tryCatch(cb, onerror) {
        return (...args) => {
            // eslint-disable-next-line local-rules/hints
            try {
                return cb(...args);
            }
            catch (ex) {
                if (self.d > 1) {
                    console.warn(ex);
                }
                if (onerror) {
                    return onerror(ex);
                }
            }
        };
    }

    get [Symbol.toStringTag]() {
        return 'MEGAImageElement';
    }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * The MEGACanvasElement interface provides a means for drawing graphics via JavaScript and the HTML <canvas> element.
 * Among other things, it can be used for animation, game graphics, data visualization, and photo manipulation.
 * This API largely focuses on 2D graphics.
 * @param {Number} [width] logical pixels (or RGBA values) going across one row of the canvas.
 * @param {Number} [height] logical pixels (or RGBA values) going down one column of the canvas.
 * @param {String} [ctx] the context identifier defining the drawing context associated to the canvas.
 * @param {Object} [options] context attributes for the rendering context.
 */
class MEGACanvasElement extends MEGAImageElement {
    constructor(width = 1, height = 1, ctx = '', options = null) {
        super();
        if (!ctx || typeof ctx === 'object') {
            options = ctx;
            ctx = '2d';
        }

        if (self.supOffscreenCanvas > 1 || self.supOffscreenCanvas && ctx === '2d') {

            this.ctx = this.getRenderingContext(new OffscreenCanvas(width, height), ctx, options);
        }
        else {
            if (typeof document === 'undefined') {
                throw new MEGAException('Out of scope.');
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            this.ctx = this.getRenderingContext(canvas, ctx, options);
        }

        this.faced = null;
        this.bitmaprenderer = null;
        this.renderingContextType = this.ctx && (ctx === 'webgl2' ? 'webgl' : ctx) || null;

        /** @property MEGACanvasElement.engine */
        lazy(this, 'engine', () => {
            let res = 'Unknown';

            if (self.isWorkerScope) {
                res = self.engine;
            }
            else if (self.ua && self.ua.details) {
                res = self.ua.details.engine;
            }
            else if ('mozInnerScreenX' in self) {
                res = 'Gecko';
            }
            else if (self.d) {
                self.dump(`Unknown engine.`);
            }
            return res;
        });
    }

    get [Symbol.toStringTag]() {
        return 'MEGACanvasElement';
    }

    doesSupport(name) {
        return !!(MEGACanvasElement.sup & MEGACanvasElement[`SUPPORT_${String(name).toUpperCase()}`]);
    }

    async resample(source, width, height, type, quality = MEGAImageElement.DEFAULT_QUALITY) {
        this.assert(this.doesSupport('BitmapRenderer'));

        source = await createImageBitmap(source, {resizeWidth: width, resizeHeight: height, resizeQuality: 'high'});

        if (!this.bitmaprenderer) {
            this.bitmaprenderer = new MEGACanvasElement(1, 1, 'bitmaprenderer');
        }
        const {ctx} = this.bitmaprenderer;
        ctx.canvas.width = source.width;
        ctx.canvas.height = source.height;
        ctx.transferFromImageBitmap(source);

        return type ? this.bitmaprenderer.convertTo(type, quality) : ctx;
    }

    viewport(width, height) {
        const {canvas} = this.ctx;

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
    }

    getDrawingContext(width, height) {
        this.viewport(width, height);
        return this;
    }

    getRenderingContext(canvas, type, options, rec) {
        let ctx = null;

        if (options && typeof options === 'object') {
            ctx = this.tryCatch(() => canvas.getContext(type, options))();

            if (!ctx && !rec) {
                const opt = {...options};
                delete opt.willReadFrequently;
                return this.getRenderingContext(canvas, type, Object.keys(opt).length && opt, 1);
            }
        }

        return ctx || canvas.getContext(type);
    }

    async getIntrinsicImage(source, maxSize = 2160) {
        if (!exifImageRotation.fromImage) {
            source = await this.getRotatedImageData(source);
        }
        const {width = maxSize, height = maxSize} = await webgl.loadImage(source).catch(nop) || source;

        maxSize = Math.min(maxSize, width, height);
        source = await this.createPreviewImage(source, {type: 'image/png', maxWidth: maxSize, maxHeight: maxSize});

        return source;
    }

    getImageData(sx, sy, sw, sh, flip = true) {
        const {ctx, renderingContextType} = this;

        sx = sx || 0;
        sy = sy || 0;
        sw = sw || ctx.canvas.width;
        sh = sh || ctx.canvas.height;

        if (renderingContextType === '2d') {
            return ctx.getImageData(sx, sy, sw, sh);
        }

        // WebGL context.
        const data = new Uint8Array(sw * sh * 4);
        ctx.readPixels(sx, sy, sw, sh, ctx.RGBA, ctx.UNSIGNED_BYTE, data);

        if (flip) {
            const dw = sw * 4;
            const dh = sh / 2 | 0;
            if (dh > 0) {
                for (let i = 0, t = new Uint8Array(dw); i < dh; ++i) {
                    sx = i * dw;
                    sy = (sh - i - 1) * dw;
                    t.set(data.subarray(sx, sx + dw));
                    data.copyWithin(sx, sy, sy + dw);
                    data.set(t, sy);
                }
            }
        }
        return this.createImageData(data.buffer, sw, sh);
    }

    isTainted(aImageData) {
        const {data, width, height} = aImageData || this.getImageData(0, 0, 0, 0, false);
        let result = true;

        let len = data.byteLength;
        while (len--) {
            if (data[len] && data[len] !== 0xff) {
                result = false;
                break;
            }
        }

        if (!result && width > 7 && data.byteLength > 63) {
            // Detect randomness pattern used by Firefox..
            const fv2 = (v) => Math.floor(v / 4) << 2;
            const u32 = new Uint32Array(data.buffer.slice(0, fv2(data.byteLength)));
            const wl4 = fv2(width);

            const cmp = (i) => {
                let l = wl4;
                let j = l;
                while (!(u32[i] === u32[0] && u32[i + 1] === u32[1]) && --j) {
                    if (u32.length < ++i + l) {
                        return false;
                    }
                }
                while (l--) {
                    if (u32[l] !== u32[i + l]) {
                        return true;
                    }
                }
                return false;
            };

            let solid = true;
            for (let i = width << 3, p = data.length - i, ed = 0; i > 4;) {
                ed += Math.pow(data[i - 4] - data[p], 2)
                    + Math.pow(data[i - 3] - data[p + 1], 2)
                    + Math.pow(data[i - 2] - data[p + 2], 2);

                if (Math.sqrt(ed) > 9) {
                    solid = false;
                    break;
                }

                i -= 4;
                p += 4;
            }

            if (!solid) {

                let i = width;
                while (i < u32.length) {
                    if (cmp(i)) {
                        break;
                    }
                    i += width;
                }

                result = i >= u32.length;
            }
        }

        if (self.d > 2 && result) {
            this.debug('isTainted?', result, width, height, [data], new Uint32Array(data.buffer));

            // webgl.putImageDataIntoTerminal(aImageData);
        }

        return result;
    }

    isTransparent(aImageData) {
        const {data} = aImageData || this.getImageData(0, 0, 0, 0, false);

        for (let i = 0; i < data.byteLength; i += 4) {
            if (data[i + 3] < 0xff) {
                return true;
            }
        }
    }

    async contentAwareCroppingMethod() {
        if (this.faced === null) {
            this.faced = await self.faceDetector.catch(dump);
        }

        return this.faced ? 'FaceDetector' : 'SmartCrop';
    }

    getScaledCropArea(source, sx, sy, sw, sh, maxWidth, maxHeight) {
        const eq = (x, y, s, l) => x / s + y * s > l;
        const sc = (sw, sx, scale, max) => {
            while (scale < 1.0 && eq(sw, sx, scale, max)) {
                scale += 0.01;
            }
            return scale;
        };
        let scale, fscale;

        // @todo simplify & improve ...

        const ratio = Math.min(source.width / maxWidth, source.height / maxHeight);
        if (ratio > 1) {
            maxHeight = maxWidth *= ratio;// Math.max(1, ratio >> 1);
            if (self.d) {
                this.debug('ratio', ratio, {maxWidth, maxHeight}, source.width, source.height);
            }
        }

        if (maxWidth > sw && maxHeight > sh) {
            const cx = maxWidth - sw >> 1;
            const cy = maxHeight - sh >> 1;

            sx = Math.max(sx - cx, 0);
            sw = Math.min(sw + (cx << 1), source.width - sx);
            sy = Math.max(sy - cy, 0);
            sh = Math.min(sh + (cy << 1), source.height - sy);

            if (self.d) {
                this.debug('scale', {sx, sy, sw, sh}, cx, cy);
            }
            scale = 1 / sc(sw, sx, 1 / (sw / maxWidth), source.width);
            fscale = 1 / sc(sh, sy, 1 / (sh / maxHeight), source.height);
        }
        else {
            scale = sc(sw, sx, sw / maxWidth, source.width);
            fscale = sc(sh, sy, sh / maxHeight, source.height);
        }

        sx = ~~(sx * scale);
        sy = ~~(sy * fscale);
        sw = ~~(sw / scale);
        sh = ~~(sh / fscale);

        let tx = sx + sw - source.width;
        if (tx > 0) {
            sx = Math.max(0, sx - tx);
            sw = source.width - sx;
        }

        tx = sy + sh - source.height;
        if (tx > 0) {
            sy = Math.max(0, sy - tx);
            sh = source.height - sy;
        }

        return [sx, sy, sw, sh];
    }

    async alignTargetSize({sw, sh, maxWidth, maxHeight}) {
        this.assert(maxWidth > 0 && maxWidth === maxHeight);

        const mn = Math.min(sw, sh);
        if (mn <= maxWidth) {
            // Original image is smaller than desired crop size
            maxWidth = maxHeight = mn;
        }
        else if (maxWidth > MEGAImageElement.THUMBNAIL_SIZE
            && await this.contentAwareCroppingMethod() === 'SmartCrop') {

            const alignedWidth = mn + 15 & -16;
            let targetSize = Math.min(mn, Math.max(MEGAImageElement.THUMBNAIL_SIZE, alignedWidth >> 1));

            if (!(targetSize & targetSize - 1)) {
                targetSize += 16;
            }

            if (self.d) {
                this.debug(`maxWH of ${maxWidth}px changed to ${targetSize}px for ${sw}x${sh} image.`);
            }

            maxWidth = maxHeight = targetSize;
        }

        return [maxWidth, maxHeight];
    }

    async getCropCoords(source, maxWidth, maxHeight) {

        if (source.width >= maxWidth || source.height >= maxHeight) {
            const method = await this.contentAwareCroppingMethod();

            if (method === 'FaceDetector') {
                const faces = await this.faced.detect(source).catch(dump);

                if (faces && faces.length) {
                    let fx = 0;
                    let sx = Infinity;
                    let sy = Infinity;
                    let sw = -Infinity;
                    let sh = -Infinity;
                    const ds = (face) => Math.min(face.width, face.height) >> 1;

                    for (let i = faces.length; i--;) {
                        const face = faces[i].boundingBox;

                        if (face) {
                            fx = Math.max(fx, ds(face));
                        }
                    }

                    for (let i = faces.length; i--;) {
                        const face = faces[i].boundingBox;

                        if (face && ds(face) >= fx) {
                            sy = Math.min(sy, face.top);
                            sx = Math.min(sx, face.left);
                            sw = Math.max(sw, face.right);
                            sh = Math.max(sh, face.bottom);
                        }
                    }

                    if (self.d) {
                        this.debug('FACEdS', faces, {sx, sy, sw, sh}, source);
                    }

                    if (sx | sy | sw | sh) {
                        [sx, sy, sw, sh] =
                            this.getScaledCropArea(source, sx, sy, sw - sx, sh - sy, maxWidth, maxHeight);

                        if (self.d) {
                            this.debug('FACEdSr', {sx, sy, sw, sh});
                        }
                        return {sx, sy, sw, sh};
                    }
                }
            }

            const {topCrop} = await SmartCrop.crop(source, {
                ...MEGACanvasElement.SMARTCROP_OPTIONS,
                width: maxWidth, height: maxHeight
            });

            return {sx: topCrop.x, sy: topCrop.y, sw: topCrop.width, sh: topCrop.height};
        }

        return {
            dw: maxWidth,
            dh: maxHeight,
            dx: maxWidth - source.width >> 1,
            dy: maxHeight - source.height >> 1
        };
    }

    async getCropRect({source, crop, maxRatio, maxWidth, maxHeight, dest, ats}) {
        const {width, height} = source;

        let sx = 0;
        let sy = 0;
        let sw = width;
        let sh = height;
        const ratio = Math.max(sw / sh, sh / sw);

        if (crop === 'guess') {
            crop = false;

            if (sw > maxWidth && ratio > MEGAImageElement.ASPECT_RATIO_16_9) {
                maxRatio = MEGAImageElement.ASPECT_RATIO_16_9;
            }
        }

        if (maxRatio && ratio > maxRatio) {
            if (sw > sh) {
                sw = ~~(sh * maxRatio);
            }
            else {
                sh = ~~(sw * maxRatio);
            }
            sx = width - sw >> 2;
            sy = height - sh >> 2;
        }

        if (crop === 'center') {
            sw = Math.round(sw / ratio);
            sh = Math.round(sh / ratio);
            sx = width - sw >> 1;
            sy = height - sh >> 1;
        }
        else if (crop === 'smart') {
            maxWidth = maxWidth || sw;
            maxHeight = maxHeight || sh;

            ats = ats || sw < maxWidth && sh < maxHeight;

            // @todo deprecate the following at the earliest convenience.
            // i.e. those are experiments to make the on-the-fly cropping in line with current live-site thumbnails.
            const thumbnail = maxWidth === maxHeight && ats > 0;

            if (thumbnail) {
                [maxWidth, maxHeight] = await this.alignTargetSize({sw, sh, maxWidth, maxHeight});

                dest.maxWidth = maxWidth;
                dest.maxHeight = maxHeight;
            }
            return this.getCropCoords(source, maxWidth, maxHeight);
        }

        return {sx, sy, sw, sh};
    }

    async getBoundingRect({source, maxWidth, maxHeight, ...options}) {
        const dest = {};
        let {sx, sy, sw, sh, dx, dy, dw, dh}
            = await this.getCropRect({source, maxWidth, maxHeight, ...options, dest});

        maxWidth = dest.maxWidth || maxWidth;
        maxHeight = dest.maxHeight || maxHeight;

        if (dw === undefined) {
            dw = sw;
        }
        if (dh === undefined) {
            dh = sh;
        }

        return this.getBoundingBox({sx, sy, sw, sh, dx, dy, dw, dh, maxWidth, maxHeight, ...options});
    }

    getBoundingBox({sx, sy, sw, sh, dx, dy, dw, dh, maxWidth, maxHeight, minWidth, minHeight, allowUpScale}) {

        if (maxWidth && sw > maxWidth) {
            dh = Math.round(sh * maxWidth / sw);
            dw = maxWidth;
        }
        else if (maxHeight && sh > maxHeight) {
            dw = Math.round(sw * maxHeight / sh);
            dh = maxHeight;
        }

        if (minWidth && dw < minWidth && (allowUpScale || sw > minWidth)) {
            dw = minWidth;
            dh = Math.round(dw * sh / sw);
        }
        else if (minHeight && dh < minHeight && (allowUpScale || sh > minHeight)) {
            dh = minHeight;
            dw = Math.round(dh * sw / sh);
        }

        return {sx, sy, sw, sh, dx, dy, dw, dh};
    }

    async createThumbnailImage(source, options = false) {
        const defSize = MEGAImageElement.THUMBNAIL_SIZE;
        const defQuality = MEGAImageElement.THUMBNAIL_QUALITY;
        const {maxWidth = defSize, maxHeight = defSize, quality = defQuality} = options;

        options = {crop: 'smart', type: 'thumb', quality, maxWidth, maxHeight, ...options};
        return this.createPreviewImage(source, options);
    }

    async createPreviewImage(source, options = false) {
        const defSize = MEGAImageElement.PREVIEW_SIZE;
        const defType = MEGAImageElement.PREVIEW_TYPE;
        const defQuality = MEGAImageElement.PREVIEW_QUALITY;
        const {
            crop = 'none',
            type = defType,
            maxWidth = defSize,
            maxHeight = defSize,
            quality = defQuality
        } = options;

        source = await this.getCanvasImageSource(source);
        const {sx, sy, sw, sh, dx, dy, dw, dh} =
            await this.getBoundingRect({crop, source, maxWidth, maxHeight, ...options});

        /** @todo https://crbug.com/1082451
        const {width, height} = image;
        if (!(sx | sy) && sw === width && sh === height
            && (this.bitmaprenderer || this.doesSupport('BitmapRenderer'))) {

            if (self.d > 1) {
                dump(
                    `Creating ${dw}x${dh} image using high-quality bitmap resizer.`,
                    {sx, sy, sw, sh}, {dx, dy, dw, dh}, source
                );
            }
            return this.resample(image, dw, dh, type, quality);
        }
        else*/ if (self.d > 1) {
            this.debug(
                `Creating ${dw}x${dh} image using ${this.renderingContextType}...`,
                {sx, sy, sw, sh}, {dx, dy, dw, dh}, source
            );
        }

        return this.drawImage(source, sx, sy, sw, sh, dx | 0, dy | 0, dw, dh, type, quality);
    }

    clearRect(sx, sy, sw, sh) {
        this.viewport(sw, sh, sx, sy);
        this.ctx.clearRect(0, 0, sw, sh);
    }

    drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh, type, quality = MEGAImageElement.DEFAULT_QUALITY) {
        if (typeof sw === 'string') {
            dx = sw;
            dy = sh;
            sw = sh = undefined;
        }
        if (typeof dx === 'string') {
            type = dx;
            quality = dy || quality;
            dx = dy = dw = dh = undefined;
        }
        else if (typeof dw === 'string') {
            type = dw;
            quality = dh || quality;
            dw = dh = undefined;
        }

        if (sx === undefined) {
            sx = 0;
        }
        if (sy === undefined) {
            sy = 0;
        }
        if (dx === undefined) {
            dx = sx;
            sx = 0;
        }
        if (dy === undefined) {
            dy = sy;
            sy = 0;
        }
        if (sw === undefined) {
            sw = image.width;
        }
        if (sh === undefined) {
            sh = image.height;
        }
        if (dw === undefined) {
            dw = sw;
            sw = image.width;
        }
        if (dh === undefined) {
            dh = sh;
            sh = image.height;
        }

        return this._drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh, type, quality)
            .catch((ex) => {

                if (this instanceof WebGLMEGAContext) {
                    if (self.d) {
                        const error = typeof ex === 'number' ? `${this.getErrorString(ex)} (${ex})` : ex;

                        this.debug(`WebGL Error: ${error}, trying to fall back to canvas...`);
                    }

                    type = type === 'thumb' ? 'broken' : type;
                    return new MEGACanvasElement()._drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh, type, quality);
                }

                throw ex;
            });
    }

    async _drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh, type, quality = MEGAImageElement.DEFAULT_QUALITY) {
        this.clearRect(0, 0, dw, dh);
        this.ctx.drawImage(image, sx, sy, sw, sh, dx, dy, Math.min(sw, dw), Math.min(sh, dh));
        return type && this.convertTo(type, quality);
    }

    putImageDataIntoTerminal(aImageData) {
        const {width, height, data} = aImageData;
        const len = data.byteLength;
        const line = Array(width + 1).join("%c\u25a0");
        const rows = Array(height).join('!').split('!').map(() => line);
        const colors = [];

        const to16 = (v) => v.toString(16).padStart(2, '0');
        const rgba = (p, i) => to16(p[i]) + to16(p[i + 1]) + to16(p[i + 2]) + to16(p[i + 3]);

        let i = 0;
        while (len > i) {
            colors.push(`color:#${rgba(data, i)}`);
            i += 4;
        }
        console.info(`\n${rows.join('\n')}`, ...colors);
    }

    async convertTo(type, quality) {
        if (type === 'imaged') {
            return this.getImageData();
        }
        if (type === 'terminal') {
            return this.putImageDataIntoTerminal(this.getImageData());
        }
        const {canvas} = this.ctx;
        const typed = [quality, MEGAImageElement.DEFAULT_QUALITY];

        if (type === 'buffer') {
            return this.convertToArrayBuffer(...typed);
        }

        if (type === 'bitmap') {
            if ('transferToImageBitmap' in canvas) {
                return canvas.transferToImageBitmap();
            }
            return this.createImageBitmap(this.getImageData());
        }

        if (type === 'dataurl') {
            if ('toDataURL' in canvas) {
                return canvas.toDataURL(...typed);
            }
            return this.convertToDataURL(...typed);
        }

        const data = this.getImageData(0, 0, 0, 0, false);
        if (this.isTainted(data)) {
            throw new MEGAException('The image is tainted!', {data, ctx: this}, 'SecurityError');
        }

        if (type === 'broken') {
            type = MEGAImageElement.THUMBNAIL_TYPE;
        }
        else if (type === 'thumb') {
            type = this.isTransparent(data) ? MEGAImageElement.ALPHA_FORMAT : MEGAImageElement.THUMBNAIL_TYPE;
        }
        const blob = await this.convertToBlob(type, quality);

        if (this.engine === 'Gecko' && !this.postTaintedChecked) {
            const t = this.isTainted(await this.createImage(blob, 0, 0, 'imaged'));
            if (t) {
                throw new MEGAException('The image is tainted', this, 'SecurityError');
            }
            this.postTaintedChecked = 1;
        }

        return blob;
    }

    convertToBlob(type, quality) {
        const {canvas} = this.ctx;

        if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
            return canvas.convertToBlob({type, quality});
        }

        return new Promise((resolve) => {
            canvas.toBlob(resolve, type, quality);
        });
    }

    convertToArrayBuffer(type, quality) {
        return this.convertToBlob(type, quality).then(blob => this.readAsArrayBuffer(blob));
    }

    convertToDataURL(type, quality) {
        return this.convertToBlob(type, quality).then(blob => this.readAsDataURL(blob));
    }

    async getCanvasImageSource(data) {

        if (typeof data === 'string') {
            data = await this.loadImage(data);
        }

        if (typeof data === 'object') {
            if (data instanceof Blob) {
                const {format} = await this.identify(data).catch(echo);

                if (format === 'TIFF' || format === 'UNK') {
                    if (self.d) {
                        this.debug(`Attempting to decode RAW image...`, format);
                    }
                    const image = this.decodeRAWImage('raw', await this.readAsArrayBuffer(data)).data;

                    if (image) {
                        data = image instanceof ImageData ? image : await this.loadImage(image);
                    }
                }
            }
            else if ('byteLength' in data) {
                data = await this.loadImage(data);
            }

            if (data instanceof ImageData || data instanceof Blob) {
                data = await this.createImageBitmap(data);
            }
        }

        return data;
    }

    async createPattern(image, repetition) {
        const source = await this.getCanvasImageSource(image);

        // Safari may unexpectedly throw a mysterious 'Type error', e.g., by providing an ImageBitmap
        // eslint-disable-next-line local-rules/hints -- @todo https://bugs.webkit.org/show_bug.cgi?id=149986
        try {
            return this.ctx.createPattern(source, repetition);
        }
        catch (ex) {
            if (!self.supImageBitmap || !(source instanceof ImageBitmap)) {

                this.debug('Unexpected createPattern() failure...', ex);
            }
            else {
                image = await this.createImage(source);
                return this.ctx.createPattern(await this.loadImage(image), repetition);
            }

            throw ex;
        }
    }

    async createImage(data, width = 27, height = 31, type = 'image/webp', quality = 1) {
        if (data === 'pattern') {
            const patterns = [];
            const bw = width / 4 | 0;
            const bh = height / 4 | 0;
            const canvas = new MEGACanvasElement(width, height);
            const safari = window.safari && new Uint32Array(width * height);
            for (let x = bw; x--;) {
                let source = this.createImageData(mega.getRandomValues(4), 1, 1);
                if (safari) {
                    safari.fill(new Uint32Array(source.data.buffer)[0]);
                    source = this.createImageData(safari.buffer, width, height);
                }

                const pattern = await canvas.createPattern(source, 'repeat').catch(nop);
                if (pattern && patterns.push(pattern) > 15) {
                    break;
                }
            }
            const n = patterns.length >> 2;
            for (let x = n, sy = 0; x--;) {
                for (let i = n, sx = 0; i--;) {
                    canvas.ctx.fillStyle = patterns.pop();
                    canvas.ctx.fillRect(sx, sy, bw, bh);
                    sx += bw;
                }
                sy += bh;
            }
            data = canvas.ctx.getImageData(0, 0, width, height);
        }
        else if (typeof data === 'number') {
            const pixel = (data < 0x100 ? data << 24 | data >> 4 << 16 | (data & 15) << 8 | 0xff : data) >>> 0;
            data = new Uint32Array(width * height).fill(pixel);
            data = this.createImageData(data.buffer, width, height);
            if (self.d > 1) {
                this.debug('createImage, %s (0x%s)', pixel >>> 0, pixel.toString(16), pixel >>> 16, data);
            }
        }
        else if (!data) {
            const size = 0xffff;
            const length = width * height * 4;
            const buffer = new Uint8ClampedArray(length);
            for (let offset = 0; offset < length; offset += size) {
                buffer.set(mega.getRandomValues(Math.min(length - offset, size)), offset);
            }
            data = new ImageData(buffer, width, height);
        }
        data = await this.getCanvasImageSource(data);

        width = data.width || width;
        height = data.height || height;
        if (type === 'terminal') {
            const ratio = Math.min(208 / width, 176 / height);
            if (ratio < 1) {
                width *= ratio;
                height *= ratio;
            }
        }
        return this.drawImage(data, 0, 0, width, height, type, quality);
    }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * The WebGLMEGAContext interface provides a means for drawing graphics via WebGL2 (Web Graphics Library)
 * This API conforms to OpenGL ES 3.0 that can be used in HTML5 <canvas> elements for rendering high-performance
 * interactive 3D and 2D graphics within any compatible web browser without the use of plug-ins.
 * This conformance makes it possible to take advantage of hardware graphics acceleration provided by the user's device.
 * @param {Number} [width] logical pixels (or RGBA values) going across one row of the canvas.
 * @param {Number} [height] logical pixels (or RGBA values) going down one column of the canvas.
 * @param {Object} [options] context attributes for the rendering context.
 */
class WebGLMEGAContext extends MEGACanvasElement {
    constructor(width = 1, height = 1, options = null) {
        super(width, height, 'webgl2', {
            ...WebGLMEGAContext.DEFAULT_OPTIONS,
            ...options
        });

        const gl = this.ctx;
        if (gl) {
            this.setupWebGLContext(gl);
        }
    }

    get [Symbol.toStringTag]() {
        return 'WebGLMEGAContext';
    }

    setupWebGLContext(gl) {
        const {canvas} = gl;

        if (self.d > 1) {
            this.debug('Setting up new WebGL context...', [this]);
        }

        this.onContextLost = tryCatch((ev) => {
            ev.preventDefault();

            this.cleanup();
            this.didLoseContext = true;
            this.debug('context lost.');

            setTimeout(() => this.restoreContext(), 300);
        });

        this.onContextRestore = tryCatch(() => {
            this.debug('context restored.');

            this.initWebGLContext(gl);
        });

        canvas.addEventListener('webglcontextlost', this.onContextLost, false);
        canvas.addEventListener('webglcontextrestored', this.onContextRestore, false);

        this.glLoseExtension = gl.getExtension('WEBGL_lose_context');

        return this.initWebGLContext(gl);
    }

    initWebGLContext(gl) {
        this.didLoseContext = false;

        if ((this.program = this.createProgram(gl))) {
            this.loc = {
                position: gl.getAttribLocation(this.program, "a_position"),
                texcoord: gl.getAttribLocation(this.program, "a_texcoord"),
                resolution: gl.getUniformLocation(this.program, "u_resolution")
            };
            this.createTexture(gl);
        }

        this.gl = gl;
        this.ready = false;
    }

    restoreContext() {
        if (this.glLoseExtension && this.gl && this.gl.isContextLost()) {

            this.glLoseExtension.restoreContext();
        }
    }

    cleanup() {
        if (this.program) {
            if (this.gl) {
                this.gl.deleteProgram(this.program);
            }
            this.program = null;
        }
        this.ready = false;
    }

    getDrawingContext(width, height) {
        let ctx = this.ctx && this;
        if (!ctx || ctx.gl.isContextLost()) {
            // WebGL2 is not available.
            ctx = new MEGACanvasElement(width, height, '2d');
        }
        ctx.viewport(width, height);
        return ctx;
    }

    attachShader(gl, program, type, source) {
        const shader = gl.createShader(type);

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        gl.attachShader(program, shader);
    }

    createProgram(gl) {
        const program = gl.createProgram();

        const vertexSource = `
            attribute vec2 a_position;
            attribute vec2 a_texcoord;
            uniform vec2 u_resolution;
            varying vec2 v_texcoord;
            void main(void) {
              gl_Position = vec4((((a_position / u_resolution) * 2.0) - 1.0) * vec2(1, -1), 0.0, 1.0);
              v_texcoord = a_texcoord;
            }`;

        const fragmentSource = `
            precision highp float;
            varying vec2 v_texcoord;
            uniform sampler2D u_texture;
            void main(void) {
              gl_FragColor = texture2D(u_texture, v_texcoord);
            }`;

        this.attachShader(gl, program, gl.VERTEX_SHADER, vertexSource);
        this.attachShader(gl, program, gl.FRAGMENT_SHADER, fragmentSource);

        gl.linkProgram(program);
        gl.validateProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            this.debug('Error linking program.', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }

        return program;
    }

    createBuffer(gl, data, usage) {
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
        return buf;
    }

    enableVertexAttrib(gl, index, data) {
        const buf = this.createBuffer(gl, data);
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index, 2, gl.FLOAT, false, 0, 0);
        return buf;
    }

    bindBuffers(gl, image, sx, sy, sw, sh, dx, dy, dw, dh) {
        const {position, texcoord, resolution} = this.loc;

        const u0 = sx / image.width;
        const v0 = sy / image.height;
        const u1 = (sx + sw) / image.width;
        const v1 = (sy + sh) / image.height;

        const tex = this.enableVertexAttrib(
            gl, texcoord, new Float32Array([u0, v0, u1, v0, u0, v1, u0, v1, u1, v0, u1, v1])
        );

        const x1 = dx;
        const x2 = dx + dw;
        const y1 = dy;
        const y2 = dy + dh;

        const pos = this.enableVertexAttrib(
            gl, position, new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2])
        );

        gl.uniform2f(resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);

        return [tex, pos];
    }

    createTexture(gl) {
        // gl.getExtension('OES_texture_float');
        // gl.getExtension('OES_texture_float_linear');

        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);

        // const ext = gl.getExtension('EXT_texture_filter_anisotropic');
        // if (ext) {
        //     const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        //     gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
        //     console.info('Anisotropic filtering enabled', max);
        // }

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        // gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    viewport(width, height, sx = 0, sy = 0) {
        super.viewport(width, height);
        this.gl.viewport(sx, sy, width, height);
    }

    getError() {
        const rc = this.gl.getError();
        const LOST = WebGL2RenderingContext.CONTEXT_LOST_WEBGL;

        if (rc === LOST && !this.didLoseContext) {
            this.didLoseContext = true;
            queueMicrotask(() => this.cleanup());
        }

        return rc || this.didLoseContext && LOST;
    }

    getErrorString(code) {
        if (!WebGLMEGAContext.glContextErrorMap) {
            WebGLMEGAContext.glContextErrorMap = Object.keys(WebGL2RenderingContext)
                .reduce((o, p) => {
                    const n = WebGL2RenderingContext[p];
                    if (typeof n === 'number') {
                        o[n] = p;
                    }
                    return o;
                }, Object.create(null));
        }
        return WebGLMEGAContext.glContextErrorMap[code | 0] || 'Unknown error';
    }

    clearRect(sx, sy, sw, sh) {
        const {gl} = this;
        this.viewport(sw, sh, sx, sy);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    async _drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh, type, quality = MEGAImageElement.DEFAULT_QUALITY) {
        const {gl, program, ready} = this;
        if (!ready) {
            if (!program) {
                throw new MEGAException('WebGL2 cannot be used.');
            }
            this.ready = true;
            gl.useProgram(program);
        }

        this.clearRect(0, 0, dw, dh);
        const [b1, b2] = this.bindBuffers(gl, image, sx, sy, sw, sh, dx, dy, Math.min(sw, dw), Math.min(sh, dh));

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.flush();

        let error = this.getError();
        let result = false;

        if (!error && type) {
            result = await this.convertTo(type, quality)
                .catch((ex) => {
                    error = ex;
                });
        }

        gl.deleteBuffer(b1);
        gl.deleteBuffer(b2);

        if (error) {
            throw error;
        }

        return result;
    }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * The MEGAWorker interface implements a pool of Web Workers that does represents background tasks.
 * @param {String|Function|Blob} url Web Worker resource.
 * @param {Number} [size] Maximum number of concurrent Web Workers.
 * @param {*} [hello] Initial payload to send to newly created workers.
 * @param {Number} [jpw] Maximum number of concurrent jobs per Worker.
 */
class MEGAWorker extends Array {
    constructor(url, size = 2, hello = false, jpw = 4) {
        super();

        if (typeof url === 'function') {
            url = new Blob([`(${url})()`], {type: 'text/javascript'});
        }

        if (url instanceof Blob) {
            url = URL.createObjectURL(url);
        }

        if (!url.startsWith('blob:')) {
            let [base, params] = url.split('?');

            if (self.is_karma) {
                params = `${params ? '&' : ''}karma=1`;
            }
            url = `${base}?wk=${MEGAWorker.VERSION}&${params || ''}`;
            if (!url.includes('//')) {
                url = `${MEGAWorker.wBasePath}${url}`;
            }
        }

        Object.defineProperty(this, 'url', {value: url});
        Object.defineProperty(this, 'size', {value: size});
        Object.defineProperty(this, 'pending', {value: []});
        Object.defineProperty(this, 'hello', {value: hello});
        Object.defineProperty(this, 'maxWkJobs', {value: jpw});
        Object.defineProperty(this, 'running', {value: new Map()});
        Object.defineProperty(this, '__ident_0', {value: `mWorker.${makeUUID()}`});

        Object.defineProperty(this, 'wkErrorHandler', {
            value: (ev) => {
                const error = ev.error || ev.message || ev || 'unknown';

                if (String(error).includes('throw-test')) {
                    return this.dispatch({token: ev.token, error: ev.payload});
                }

                if (!self.is_karma || self.d > 1) {
                    console.error('FATAL Error in MEGAWorker SubSystem!', error, [this]);
                }

                this.kill(error, ev.payloads, true);
            }
        });

        Object.defineProperty(this, 'wkMessageHandler', {
            value: ({data}) => {

                if (data.error) {
                    return this.wkErrorHandler(data);
                }

                this.dispatch(data);
            }
        });

        Object.defineProperty(this, 'wkCompletedJobs', {writable: true, value: 0});
        Object.defineProperty(this, 'wkDisposalThreshold', {writable: true, value: 0});
    }

    get [Symbol.toStringTag]() {
        return 'MEGAWorker';
    }

    get busy() {
        return this.running.size || this.pending.length;
    }

    get stats() {
        const res = [
            this.running.size,
            this.pending.length,
            this.wkCompletedJobs,
            this.wkDisposalThreshold,
            Object.isFrozen(this) | 0
        ];

        for (let i = this.length; i--;) {
            const {wkc, jobs} = this[i];

            res.push([wkc, jobs]);
        }

        return res;
    }

    kill(error, payloads, freeze) {
        const pending = [...this.running.values(), ...this.pending];

        this.running.clear();
        this.pending.length = 0;

        for (let i = pending.length; i--;) {
            const {token, reject} = pending[i];
            const payload = payloads && payloads[token];

            reject({error, payload});
        }

        for (let i = this.length; i--;) {
            const worker = this[i];
            worker.jobs = NaN;
            worker.onerror = worker.onmessage = null;
            this.wkCompletedJobs += worker.wkc;
            worker.terminate();
        }
        this.length = 0;

        if (freeze) {
            Object.defineProperty(this, 'queue', {value: () => Promise.reject('unstable')});
            Object.freeze(this);
        }
    }

    attachNewWorker() {
        const worker = new Worker(this.url);
        worker.wkc = 0;
        worker.jobs = 0;
        worker.onerror = this.wkErrorHandler;
        worker.onmessage = this.wkMessageHandler;
        if (this.hello) {
            worker.postMessage({token: 'init', command: 'hello', payload: this.hello});
        }
        return this.push(worker) - 1;
    }

    dispose() {
        delay(this.__ident_0, () => {
            if (this.length > 2 && !this.busy) {
                if (d) {
                    dump('Terminating worker pool...', this);
                }
                this.kill();
            }
        }, 450 + -Math.log(Math.random()) * ++this.wkDisposalThreshold);
    }

    dispatch({token, result, error}) {
        if (this.running.has(token)) {
            const {worker, resolve, reject} = this.running.get(token);

            worker.wkc++;
            worker.jobs--;
            this.running.delete(token);

            while (this.pending.length) {
                if (this.post(worker, this.pending.pop())) {
                    break;
                }
            }

            if (!this.running.size) {
                this.dispose();
            }

            if (!error && (self.d || self.is_karma)) {
                // just to identify the work comes from a worker.
                result.token = token;
            }
            return error ? reject(error) : resolve(result);
        }
        else if (this.pending.length) {
            const {resolve, reject, command, payload} = this.pending.pop();
            this.queue(command, payload).then(resolve).catch(reject);
        }

        if (self.d && token !== 'init') {
            console.error('No worker running with token %s', token, error || result);
        }
    }

    post(worker, {resolve, reject, command, payload}) {
        return tryCatch(() => {
            const token = makeUUID();
            const t = MEGAWorker.getTransferable(payload);

            worker.postMessage({token, command, payload}, t);
            this.running.set(token, {token, worker, resolve, reject});
            return ++worker.jobs;
        }, reject)();
    }

    queue(command, payload) {
        return new Promise((resolve, reject) => {
            let idx = this.length;
            while (idx--) {
                if (this[idx].jobs < this.maxWkJobs) {
                    break;
                }
            }

            if (idx < 0 && this.size > this.length) {
                idx = this.attachNewWorker();
            }

            const worker = this[idx];
            if (worker) {
                this.post(worker, {resolve, reject, command, payload});
            }
            else {
                // All workers are busy.
                this.pending.push({command, payload, resolve, reject});
            }
        });
    }
}

Object.defineProperties(MEGAWorker, {
    VERSION: {value: 1},
    wBasePath: {
        get() {
            return self.is_karma ? 'base/' : self.is_extension ? '' : '/';
        }
    },
    isTransferable: {
        value: (data) => {
            data = data && data.buffer || data;
            return (data instanceof ArrayBuffer
                || typeof ImageBitmap !== 'undefined' && data instanceof ImageBitmap
                || typeof OffscreenCanvas !== 'undefined' && data instanceof OffscreenCanvas) && data;
        }
    },
    getTransferable: {
        value: (payload, refs = new WeakSet()) => {
            const transferable = [];

            if (payload) {
                const nonIterable = typeof payload !== 'object'
                    || payload instanceof Blob || 'BYTES_PER_ELEMENT' in payload || 'width' in payload;
                const add = (v) => transferable.includes(v) || transferable.push(v);

                if (nonIterable) {
                    payload = [payload];
                }
                else if (refs.has(payload)) {
                    return false;
                }
                else {
                    refs.add(payload);
                }

                const keys = Object.keys(payload);
                for (let i = keys.length; i--;) {
                    const value = payload[keys[i]];

                    if (value) {
                        const nt = !nonIterable && MEGAWorker.getTransferable(value, refs);

                        if (nt.length) {
                            for (let i = nt.length; i--;) {
                                add(nt[i]);
                            }
                        }
                        else {
                            const data = MEGAWorker.isTransferable(value.buffer || value.data || value);

                            if (data) {
                                add(data);
                            }
                        }
                    }
                }
            }
            return transferable;
        }
    }
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/**
 * Cancellable wrapper around MEGAWorker and WebGL/Canvas Utilities.
 * @param {Function} aMessageHandler Worker message handler.
 * @param {Object} [aHello] If Worker() is supported, the initial payload to send them.
 * @param {Object} [options] Additional optinal options.
 */
class MEGAWorkerController {
    constructor(aMessageHandler, aHello = null, options = false) {
        Object.defineProperty(this, 'hello', {value: aHello});
        Object.defineProperty(this, 'branches', {value: Object.create(null)});
        Object.defineProperty(this, 'syncMessageHandler', {value: aMessageHandler});
        Object.defineProperty(this, 'syncQueue', {value: []});

        this.syncPending = 0;
        this.branches.main = false;

        const defOptions = {
            syncMethod: 'pop', // LIFO
            syncConcurrency: 1
        };
        Object.defineProperty(this, 'options', {
            value: Object.assign(defOptions, options)
        });
        Object.setPrototypeOf(this.options, null);

        Object.defineProperty(this, 'handler', {
            value: typeof aHello === 'object' ? this._workerHandler : this._syncHandler
        });
    }

    async attach() {
        const name = makeUUID();
        this.branches[name] = null;
        return name;
    }

    async detach(branch = 'main') {
        MEGAException.assert(branch in this.branches, `Unknown branch ${branch}.`);
        MEGAException.assert(branch !== 'main', 'You cannot detach the main branch.');

        const abortError = new MEGAException('Aborted.', 'AbortError');

        if (this.branches[branch]) {
            MEGAException.assert(this.branches[branch] instanceof MEGAWorker);
            this.branches[branch].kill(abortError, null, true);
        }
        delete this.branches[branch];

        branch += '.sync';
        for (let i = this.syncQueue.length; i--;) {
            const {branch: bch, reject} = this.syncQueue[i];

            if (branch === bch) {
                reject(abortError);
                this.syncQueue.splice(i, 1);
            }
        }
        delete this.branches[branch];
    }

    _syncDispatcher() {
        if (this.syncQueue.length && this.syncPending < this.options.syncConcurrency) {
            const {resolve, reject, command, payload} = this.syncQueue[this.options.syncMethod]();

            this.syncPending++;
            this.syncMessageHandler({data: {command, payload}})
                .then(res => this.catchFailure(res, true))
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    this.syncPending--;
                    onIdle(() => this._syncDispatcher());
                });
        }
    }

    _syncHandler(command, payload, branch = 'main') {
        return new Promise((resolve, reject) => {
            if (!(branch in this.branches)) {
                return reject(new MEGAException(`Unknown branch ${branch}.`));
            }
            branch += '.sync';

            this.branches[branch] = this.syncQueue.push({resolve, reject, command, payload, branch});
            this._syncDispatcher();
        });
    }

    async _workerHandler(command, payload, branch = 'main') {
        MEGAException.assert(branch in this.branches, `Unknown branch ${branch}.`);

        if (!this.worker) {
            await this.workerURL();
        }
        if (!this.branches[branch]) {
            this.branches[branch] = new MEGAWorker(this.worker, 4, this.hello);
        }

        let result = await this.branches[branch].queue(command, payload).catch(echo);
        if (result === 'unstable') {
            this.branches[branch] = result = null;
        }
        if (!this.catchFailure(result)) {
            if (self.d) {
                dump('Worker failed, falling back to main thread..', command, result);
            }
            payload = result && result.payload || payload;
            result = await this._syncHandler(command, payload, branch);
        }

        return result;
    }

    async workerURL() {
        await Promise.resolve(M.require('webgl')).catch(dump);

        if (!this.worker) {
            let url = 'js/utils/webgl.js';
            if (self.sbj5rsc_webgl) {
                url = mObjectURL([`(() => {exports=self;${self.sbj5rsc_webgl}})()`], 'text/javascript');
            }
            Object.defineProperty(this, 'worker', {value: url});
        }

        return this.worker;
    }

    catchFailure(res, fail) {
        if (!res || res instanceof Error || res.error) {
            const name = res && res.error && res.error.name;

            if (self.d && res) {
                dump(`${res.error || res}`);
            }

            if (fail || name === 'SecurityError' || name === 'AbortError') {
                throw res && res.error || res || new Error('NULL');
            }
            return false;
        }
        return res;
    }
}

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// @todo remove
if (typeof zSleep === 'undefined') {
    zSleep = () => new Promise(onIdle);
}

WebGLMEGAContext.test = async(...files) => {
    const canvas = new MEGACanvasElement();
    const now = Date.now();
    const promises = [];

    console.time('webgl-bulk-test');

    for (let i = 0; i < files.length; ++i) {
        const file = files[i];

        if (now) {
            // promises.push(webgl.worker('scissor', file).then(({preview, thumbnail}) => [file, thumbnail, preview]));
            promises.push(webgl.worker('thumbnail', file).then((blob) => [file, blob]));
            continue;
        }

        await zSleep();
        console.time(`c2d-${file.name}`);
        file.c2dResult = await canvas.createPreviewImage(file);
        console.timeEnd(`c2d-${file.name}`);

        await zSleep();
        console.time(`webgl-${file.name}`);
        file.webglResult = await webgl.createPreviewImage(file);
        console.timeEnd(`webgl-${file.name}`);

        const name = file.name.slice(0, 32);
        M.saveAs(file.c2dResult, `${now}.${name}-2d.jpg`);
        M.saveAs(file.webglResult, `${now}.${name}-webgl.jpg`);
    }

    if (promises.length) {
        const res = await Promise.allSettled(promises);
        for (let i = res.length; i--;) {
            if (res[i].reason) {
                console.error(res[i].reason);
                continue;
            }
            const [file, thumbnail, preview] = res[i].value;
            if (preview) {
                M.saveAs(preview, `${now}-preview-${file.name}`);
            }
            M.saveAs(thumbnail, `${now}-thumbnail-${file.name}`);
        }
    }
    console.timeEnd('webgl-bulk-test');

    if (files.length && files[0].webglResult) {
        dump(webgl.ctx.getContextAttributes());
        await webgl.createImage(files[0].webglResult, 0, 0, 'terminal');
    }
    console.log(files);
};

if (self.isWorkerScope) {
    self.tryCatch = MEGAImageElement.prototype.tryCatch;
}

/** @property self.isWebGLSupported */
lazy(self, 'isWebGLSupported', () => {
    let result = false;
    if (typeof WebGL2RenderingContext !== 'undefined') {
        tryCatch(() => {
            const {ctx} = new MEGACanvasElement(1, 1, 'webgl2', {antialias: true});

            if (ctx instanceof WebGL2RenderingContext) {

                if (typeof ctx.getContextAttributes === 'function') {
                    result = ctx.getContextAttributes().antialias === true;
                }

                tryCatch(() => {
                    const glCtx = ctx.getExtension('WEBGL_lose_context');
                    if (glCtx) {
                        glCtx.loseContext();
                    }
                })();
            }
        })();
    }
    return result;
});

/** @property self.faceDetector */
lazy(self, 'faceDetector', () => Promise.resolve((async() => {
    const fd = 'FaceDetector' in self && new FaceDetector();
    const ex = fd && await fd.detect(new MEGACanvasElement().ctx.canvas).catch(echo);
    return !ex || ex.name !== 'NotSupportedError' ? fd : false;
})()));

((self) => {
    'use strict';
    let waiter = false;
    const stats = [[]];
    const debug = self.d > 0 ? self.d : self.is_karma || self.location.host !== 'mega.nz';

    const dump = (() => {
        if (!self.isWorkerScope) {
            return (m, ...a) => console.warn(`[webgl] ${m}`, ...a);
        }
        const pid = `${Math.random().toString(26).slice(-6)}-${self.location.href.split('/').pop().slice(-17)}`;
        const rgb = [
            `color:#${((r) => (r() << 16 | r() << 8 | r()).toString(16))(() => ~~(Math.random() * 0x9f + 96))}`,
            'color:inherit'
        ];
        return (m, ...a) => console.warn(`[webgl:worker/%c${pid}%c] ${m}`, ...rgb, ...a);
    })();

    if (self.OffscreenCanvas) {
        // @todo https://bugs.webkit.org/show_bug.cgi?id=183720
        // @todo https://bugzilla.mozilla.org/show_bug.cgi?id=801176
        const res = tryCatch(() => {
            let value = Boolean(new self.OffscreenCanvas(1, 1).getContext('2d'));

            if (typeof WebGL2RenderingContext !== 'undefined') {
                const ctx = new self.OffscreenCanvas(1, 1).getContext('webgl2');

                if (ctx instanceof WebGL2RenderingContext) {

                    value = 2;
                }
            }
            return value;
        }, (ex) => {
            dump('This browser does lack proper OffscreenCanvas support.', [ex]);
        })();
        Object.defineProperty(self, 'supOffscreenCanvas', {value: res | 0});
    }

    if (!self.isWorkerScope && self.ImageBitmap && typeof createImageBitmap === 'function') {
        // Test for proper ImageBitmap compliance.
        // https://bugs.webkit.org/show_bug.cgi?id=182424

        waiter = (async() => {
            const sample =
                'data:image/jpeg;base64,/9j/4QBiRXhpZgAATU0AKgAAAAgABQESAAMAAAABAAcAAAEaAAUAAAABAAAASgEbAAUAAAA' +
                'BAAAAUgEoAAMAAAABAAIAAAITAAMAAAABAAEAAAAAAAAAAABIAAAAAQAAAEgAAAAB/9sAQwABAQEBAQEBAQEBAQEBAQEBA' +
                'QEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB/9sAQwEBAQEBAQEBAQEBAQEBAQEBAQE' +
                'BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB/8AAEQgAAQADAwERAAIRAQMRAf/EABQAA' +
                'QAAAAAAAAAAAAAAAAAAAAr/xAAZEAABBQAAAAAAAAAAAAAAAAAGAAcxd7f/xAAVAQEBAAAAAAAAAAAAAAAAAAAFBv/EACA' +
                'RAAADCQEAAAAAAAAAAAAAAAAEBwECBQY0N3J2srX/2gAMAwEAAhEDEQA/ADvj0lloPDqxmrGF0BbBvbwWSW1qdaTLHjEx/9kK';

            const ctx = new MEGACanvasElement();
            let temp = ctx.dataURLToBlob(sample);
            temp = await createImageBitmap(temp).catch(echo);
            temp = await ctx.drawImage(temp, 0, 0, 'imaged').catch(echo);

            const value = temp && temp.data && temp.data[9];
            Object.defineProperty(self, 'supImageBitmap', {value: value === 123});

            if (!self.supImageBitmap && debug) {
                dump('This browser does lack proper ImageBitmap support.', value, temp);
            }

            queueMicrotask(() => {
                waiter = null;
            });
        })();
    }

    const handlers = {
        'hello': async(data) => {
            Object.assign(self, data);
        },
        'throw-test': (data, token) => {
            if (self.isWorkerScope) {
                throw new MEGAException('throw-test', token);
            }
            return Promise.resolve(data);
        },
        'thumbnail': async(data) => {
            const {blob, buffer, source, options = false} = data;
            return webgl.createThumbnailImage(blob || buffer || source || data, options);
        },
        'preview': async(data) => {
            const {blob, buffer, source, options = false} = data;
            return webgl.createPreviewImage(blob || buffer || source || data, options);
        },
        'scissor': async(data) => {
            let {blob, buffer, source, createPreview = true, createThumbnail = true} = data;
            source = await webgl.getCanvasImageSource(blob || buffer || source || data);

            const thumbnail = createThumbnail
                && await webgl.createThumbnailImage(source).then(blob => webgl.readAsAESCBCBuffer(blob));
            const preview = createPreview
                && await webgl.createPreviewImage(source).then(blob => webgl.readAsAESCBCBuffer(blob));

            return {thumbnail, preview};
        },
        'convert': async(data) => {
            const {blob, buffer, target = 'image/jpeg', quality = 0.9} = data;

            data = blob || buffer || data;
            const image = await webgl.loadImage(data, data.type);

            return webgl.drawImage(image, 0, 0, image.width, image.height, target, quality);
        }
    };
    Object.setPrototypeOf(handlers, null);

    const gMessageHandler = async({data}) => {
        const {token, command, payload} = data;
        let result = payload || Object.create(null);

        if (self.isWorkerScope) {
            self.wkPayloads[token] = payload;
        }

        if (debug > 1) {
            dump(`gMessageHandler(${command})`, token, payload);
        }

        if (handlers[command]) {
            result = await handlers[command](payload, token).catch((ex) => ({error: ex, payload}));
        }
        else {
            dump('Unknown command.', command, payload);
        }

        if (debug > 1) {
            dump(`gMessageHandler(${command}).reply`, token, result);
        }

        if (self.isWorkerScope) {
            delete self.wkPayloads[token];
            self.postMessage({token, result}, MEGAWorker.getTransferable(result));
        }

        return result;
    };

    /**
     *  @name webgl
     *  @memberOf window
     */
    lazy(self, 'webgl', () => {
        const props = lazy(Object.create(null), 'canUseWorker', () => {
            return !self.isWorkerScope && self.supOffscreenCanvas > 1 && self.supImageBitmap;
        });
        const MEGARenderingContext = self.isWebGLSupported ? WebGLMEGAContext : MEGACanvasElement;
        const webgl = new MEGARenderingContext();

        /**
         * @name getDynamicThumbnail
         * @memberOf webgl
         */
        lazy(webgl, 'getDynamicThumbnail', () => {
            const type = mThumbHandler.sup.WEBP ? 'image/png' : 'image/webp';

            return async(buffer, size, options, branch) => {
                if (typeof options === 'string') {
                    branch = options;
                    options = false;
                }
                if (typeof size === 'object') {
                    options = size;
                    size = 0;
                }
                if ((size | 0) < 1) {
                    size = MEGAImageElement.THUMBNAIL_SIZE << 1;
                }

                options = {type, maxWidth: size, maxHeight: size, quality: 1.0, ...options};
                return webgl.worker('thumbnail', {buffer, options}, branch);
            };
        });

        /**
         * @name worker
         * @memberOf webgl
         */
        lazy(webgl, 'worker', () => {
            const parity = lazy(Object.create(null), 'worker', () => {
                const data = {
                    apipath,
                    d: debug,
                    supImageBitmap: !!self.supImageBitmap,
                    engine: self.ua && self.ua.details.engine
                };
                return new MEGAWorkerController(gMessageHandler, props.canUseWorker ? data : false);
            });
            const wrap = (method) => {
                if (!waiter) {
                    return (...args) => parity.worker[method](...args);
                }
                return (...args) => Promise.resolve(waiter).then(() => parity.worker[method](...args));
            };
            const handler = wrap('handler');

            if (self.d && !waiter) {
                dump('waiter wrap was unneeded...', waiter);
            }

            Object.defineProperties(handler, {
                stats: {
                    get() {
                        const res = [...stats];
                        const {branches} = parity.worker;

                        if (branches.main) {
                            res.push(branches.main.stats);
                        }

                        res[0] = res[0].join('');
                        res.push($.len(branches));

                        return res;
                    }
                },
                attach: {
                    value: wrap('attach')
                },
                detach: {
                    value: wrap('detach')
                }
            });
            return handler;
        });

        waiter = (async() => {
            const res = [];
            const colors = [];
            const check = (feat, msg) => {
                stats[0].push((self[feat] && (self[feat] | 0 || 1)) | 0);
                res.push(`%c${msg || feat} ${self[feat] ? "\u2714" : "\u2716"}`);
                colors.push(self[feat] ? 'color:#0f0' : 'color:#f00', 'color:inherit');
                MEGACanvasElement.sup |= self[feat] && MEGACanvasElement[`SUPPORT_${(msg || feat).toUpperCase()}`];
            };

            if (waiter) {
                await waiter;
            }
            check('isWebGLSupported', 'WebGL2');
            check(props.canUseWorker && 'Worker', 'Worker');
            check('supOffscreenCanvas', 'OffscreenCanvas');
            check('supImageBitmap', 'ImageBitmap');

            await(async() => {
                let v = 'yes!';
                if (self.supImageBitmap) {
                    // eslint-disable-next-line local-rules/hints
                    try {
                        await self.createImageBitmap(new ImageData(1, 1), {
                            get resizeQuality() {
                                throw v;
                            }
                        });
                    }
                    catch (ex) {
                        v = ex !== v;
                    }
                }
                check(!v && 'ImageBitmap', 'BitmapOptions');

                v = !v && typeof ImageBitmapRenderingContext !== 'undefined'
                    && new MEGACanvasElement(1, 1, 'bitmaprenderer').ctx;

                v = v && 'transferFromImageBitmap' in v || false;

                check(v && 'ImageBitmap', 'BitmapRenderer');
            })();
            check(await self.faceDetector.catch(dump) && 'FaceDetector', 'FaceDetector');

            if (debug) {
                if (self.is_karma) {
                    console.info(res.join(' ').replace(/%c/g, ''));
                }
                else {
                    let ua = '';
                    if (self.ua) {
                        const oss = {
                            'Windows': 'x',
                            'Apple': 'y',
                            'Linux': 'z',
                            'Android': 'a',
                            'iPhone': 'b',
                            'iPad': 'c'
                        };
                        const {engine, browser, version, os} = self.ua.details;
                        ua = `${browser}${parseInt(version)}${oss[os] || '!'}${engine} `;
                    }
                    dump(`${ua}components support:  ${res.join('%c   ')}`, ...colors.slice(0, -1));
                }
            }

            queueMicrotask(() => {
                waiter = null;
            });
        })();

        return Object.defineProperties(webgl, {
            sendTimeoutError: {
                value() {
                    const {gLastError: ex, worker: {stats}} = this;
                    const payload = JSON.stringify([
                        1,
                        buildVersion.website || 'dev',
                        stats,
                        String(ex && ex.message || ex || 'na').split('\n')[0].substr(0, 98)
                    ]);

                    dump(payload);
                    return eventlog(99829, payload, true);
                }
            }
        });
    });

    if (self.isWorkerScope) {
        Object.defineProperty(self, 'wkPayloads', {value: Object.create(null)});
        Object.defineProperty(self, 'wkKarmaRunner', {value: self.location.search.split('karma=')[1]});

        self.addEventListener('error', (ev) => {
            const error = ev.error || ev.message || ev.type || 'wtf';

            console.error('WorkerGlobalScope', ev);
            ev.preventDefault();

            if (String(error).includes('throw-test')) {
                const message = {error, token: error.data, payload: self.wkPayloads[error.data]};
                return self.postMessage(message, MEGAWorker.getTransferable(message));
            }

            const payloads = self.wkPayloads;
            const tfs = MEGAWorker.getTransferable({payloads, error});
            self.postMessage({payloads, error}, tfs);
        });

        self.addEventListener('unhandledrejection', (ev) => {
            ev.preventDefault();
            throw ev.reason;
        });

        self.addEventListener('message', gMessageHandler);
        self.is_karma = self.is_karma || !!self.wkKarmaRunner;
        self.dump = dump;
        self.d = debug;
    }
})(self);

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// static properties

Object.defineProperties(MEGAImageElement, {
    PREVIEW_SIZE: {value: 1024},
    THUMBNAIL_SIZE: {value: 240},
    PREVIEW_QUALITY: {value: 0.85},
    THUMBNAIL_QUALITY: {value: 0.80},
    DEFAULT_QUALITY: {value: 0.9},
    DEFAULT_FORMAT: {value: 'image/jpeg'},
    ALPHA_FORMAT: {value: 'image/png'},
    PREVIEW_TYPE: {value: 'image/jpeg'},
    THUMBNAIL_TYPE: {value: 'image/jpeg'},
    ASPECT_RATIO_4_3: {value: 4 / 3},
    ASPECT_RATIO_8_5: {value: 8 / 5},
    ASPECT_RATIO_16_9: {value: 16 / 9},
    ASPECT_RATIO_21_9: {value: 21 / 9},
    ASPECT_RATIO_25_16: {value: 25 / 16},
    ASPECT_RATIO_32_9: {value: 32 / 9}
});

Object.defineProperties(WebGLMEGAContext, {
    DEFAULT_OPTIONS: {
        value: {
            antialias: true,
            // desynchronized: true,
            preserveDrawingBuffer: false,
            premultipliedAlpha: false,
            // failIfMajorPerformanceCaveat: true,
            powerPreference: 'high-performance'
        }
    }
});

Object.defineProperties(MEGACanvasElement, {
    sup: {
        value: 0,
        writable: true
    },
    SMARTCROP_OPTIONS: {
        value: {
            width: MEGAImageElement.THUMBNAIL_SIZE,
            height: MEGAImageElement.THUMBNAIL_SIZE,
            canvasFactory(width, height) {
                return new MEGACanvasElement(width, height, {willReadFrequently: true}).ctx.canvas;
            },
            get resampleWithImageBitmap() {
                return webgl.doesSupport('BitmapOptions');
            }
        }
    },
    SUPPORT_WEBGL2: {value: 1 << 0},
    SUPPORT_WORKER: {value: 1 << 1},
    SUPPORT_OFFSCREENCANVAS: {value: 1 << 2},
    SUPPORT_IMAGEBITMAP: {value: 1 << 3},
    SUPPORT_BITMAPOPTIONS: {value: 1 << 4},
    SUPPORT_BITMAPRENDERER: {value: 1 << 5},
    SUPPORT_FACEDETECTOR: {value: 1 << 8}
});

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// static methods

Object.defineProperty(MEGAImageElement, 'load', {value: (...args) => new MEGAImageElement().loadImage(...args)});

/** @property mega.utils.subtitles */
lazy(mega.utils, 'subtitles', () => {
    'use strict';

    /**
     * @type {MutationObserver?}
     */
    let rowsObserver = null;

    /**
     * @type {String}
     */
    let selectedHandle = '';

    /**
     * @param {AddSubtitlesDialog} dialog
     * @param {jQuery.Event} evt
     */
    const selectTableRow = (dialog, { currentTarget }) => {
        const currentlySelected = currentTarget.parentNode.querySelector('tr.ui-selected');
        selectedHandle = currentTarget.id;

        currentTarget.classList.toggle(
            'ui-selected',
            !currentlySelected
                || currentlySelected.id === selectedHandle
                || !currentlySelected.classList.remove('ui-selected') // If landed here, it's always true
        );

        dialog.enable();
    };

    const fileName = (node) => {
        return node.name.substring(0, node.name.lastIndexOf('.'));
    };

    const fileExt = (node) => {
        return node.name.substring(node.name.lastIndexOf('.'));
    };

    const subtitlesGridTable = document.getElementById('subtitles-dialog-subtitles-grid-table')
        .content.querySelector("div");
    const emptySubtitles = document.getElementById('subtitles-dialog-empty-subtitles').content.querySelector("div");

    class AddSubtitlesDialog extends MDialog {
        constructor(subtitlesManager, continuePlay) {
            super({
                ok: {
                    label: l.album_done,
                    callback: async() => {
                        const node = selectedHandle && M.d[selectedHandle];

                        if (!node) {
                            return false;
                        }
                        mBroadcaster.sendMessage('trk:event', 'media-journey', 'subtitles', 'add', node);

                        this.disable();
                        await this.subtitlesManager.addSubtitles(node);
                    }
                },
                cancel: true,
                dialogClasses: 'add-subtitles-dialog theme-dark-forced',
                contentClasses: 'px-2 border-top border-bottom',
                onclose: () => {
                    if (this.continuePlay) {
                        $('.media-viewer-container .video-controls .playpause').trigger('click');
                    }

                    if (rowsObserver) {
                        rowsObserver.disconnect();
                        rowsObserver = null;
                    }

                    $(this.el).off('click.subtitle_row');
                    $(document).off('keydown.subtitle_row');
                    $('.mega-button:not(.positive)', this.el).off('click.cancel');
                    $('.close', this.el).off('click.close');
                    delete window.disableVideoKeyboardHandler;
                    delete $.subtitlesMegaRender;
                },
                dialogName: 'subtitles-dialog'
            });

            this.subtitlesManager = subtitlesManager;
            this.continuePlay = continuePlay;
            this.setContent();
            this._title.classList.add('text-center');
        }

        setContent() {
            this.slot = document.createElement('div');
            this.slot.className = 'files-grid-view';
            this.title = l.video_player_add_subtitle_files;
        }

        async onMDialogShown() {
            document.activeElement.blur();
            window.disableVideoKeyboardHandler = true;

            this.disable();

            const nodes = await this.subtitlesManager.searchSubtitles();
            this.nodes = nodes;

            if (this.nodes.length) {
                const container = subtitlesGridTable.cloneNode(true);
                this.slot.appendChild(container);

                const megaRender = new MegaRender('subtitles');
                megaRender.renderLayout(undefined, this.nodes);
                Ps.initialize(container);
                const table = this.el.querySelector('.subtitles-grid-table');
                const rows = table.querySelector('tbody');
                $.subtitlesMegaRender = megaRender;

                rowsObserver = new MutationObserver(() => {
                    const el = rows.querySelector('tr.ui-selected');

                    if (!el) {
                        selectedHandle = '';
                        this.disable();
                    }
                });

                rowsObserver.observe(rows, { childList: true });

                $(this.el).rebind('click.subtitle_row', '.file', (e) => selectTableRow(this, e));

                $(document).rebind('keydown.subtitle_row', tryCatch((e) => {
                    const isDown = e.keyCode === 40;
                    const isUp = !isDown && e.keyCode === 38;

                    const specialKeysOn = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;

                    if (specialKeysOn) {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }

                    if (!isDown && !isUp) {
                        return;
                    }

                    const currentTarget = (selectedHandle)
                        ? rows.querySelector(`tr.ui-selected`)[e.keyCode === 38
                            ? 'previousElementSibling'
                            : 'nextElementSibling'
                        ]
                        : rows.querySelector('tr:first-child');

                    if (!currentTarget) {
                        return;
                    }

                    selectTableRow(this, { currentTarget });

                    const loc = (currentTarget.rowIndex - 1) * currentTarget.offsetHeight;

                    if (loc < table.scrollTop) {
                        table.scrollTop = loc;
                    }
                    else if (loc >= table.scrollTop + table.offsetHeight - 50) {
                        table.scrollTop += currentTarget.offsetHeight;
                    }

                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }));
            }
            else {
                const container = emptySubtitles.cloneNode(true);
                this.slot.appendChild(container);

                $('.add-subtitles-dialog .border-top.border-bottom').removeClass('border-bottom');
                $('.add-subtitles-dialog footer').addClass('height-84');
                $('.add-subtitles-dialog footer div').addClass('hidden');
            }

            mBroadcaster.once('slideshow:close', () => {
                this.hide();
            });

            $('.mega-button:not(.positive)', this.el).rebind('click.cancel', () => {
                mBroadcaster.sendMessage('trk:event', 'media-journey', 'subtitles', 'cancel');
            });

            $('.close', this.el).rebind('click.close', () => {
                mBroadcaster.sendMessage('trk:event', 'media-journey', 'subtitles', 'close');
            });
        }

        hide() {
            super.hide();
        }
    }

    class Subtitles {
        constructor(ext, timeLineRegex) {
            this.ext = ext;
            this._timeLineRegex = timeLineRegex;
        }

        supports(ext) {
            return ext.toLowerCase() === this.ext;
        }

        parse(lines, i = 0) {
            const cues = [];

            while (i < lines.length) {
                const line = lines[i].trim();
                const match = this.matchTimeLine(line);
                if (match) {
                    const start = this.parseTime(match[1]);
                    const end = this.parseTime(match[2]);
                    if (isNaN(start) || isNaN(end)) {
                        continue;
                    }

                    i++;
                    let cue = '';
                    while (i < lines.length && lines[i].trim() !== '') {
                        cue = `${cue}${this.removeTags(lines[i]).trim()}<br>`;
                        i++;
                    }
                    cues.push({ cue, start, end });
                }
                else {
                    i++;
                }
            }
            return cues;
        }

        matchTimeLine(line) {
            return line.match(this._timeLineRegex);
        }

        parseTime(time) {
            const parts = time.split(':');
            const hours = parseInt(parts[0]) || 0;
            const minutes = parseInt(parts[1]) || 0;
            const seconds = parseFloat(parts[2]) || 0;
            const milliseconds = parts[3] ? parseInt(parts[3].replace('.','')) : 0;
            return (hours * 60 * 60 + minutes * 60 + seconds) * 1000 + milliseconds;
        }

        removeTags(cue) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(cue, 'text/html');
            return doc.body.textContent
                .replace(/<(?!\/?([biu]|br))[^>]*>/gi, '')
                .replace(/(\[|{)(\/?)([biu]|br)(]|})/gi, '<$2$3>');
        }
    }

    class SRTSubtitles extends Subtitles {
        constructor() {
            const ext = '.srt';
            const timeRegex = /(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})/;
            super(ext, timeRegex);
        }

        parse(raw) {
            return super.parse(raw.split('\n'));
        }
    }

    class VTTSubtitles extends Subtitles {
        constructor() {
            const ext = '.vtt';
            const timeRegex = /(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})(\s*.*)/;
            super(ext, timeRegex);
        }

        parse(raw) {
            const lines = raw.split('\n');
            return super.parse(lines, lines[0].trim() === 'WEBVTT' ? 1 : 0);
        }
    }

    class SubtitlesFactory {
        constructor() {
            /** @property SubtitlesFactory._parsers */
            lazy(this, '_parsers', () => {
                return [
                    new SRTSubtitles(),
                    new VTTSubtitles()
                ];
            });
        }

        get extensions() {
            return this._parsers.map((parser) => parser.ext);
        }

        parse(node, raw) {
            const ext = fileExt(node);
            const parser = this._parsers.find((parser) => parser.supports(ext));
            return parser.parse(raw);
        }
    }

    class SubtitlesManager {
        constructor() {
            /** @property SubtitlesManager._factory */
            lazy(this, '_factory', () => new SubtitlesFactory());
            this.init();
        }

        resetIndex() {
            this._index = {
                node: -1,
                cue: -1
            };
            return this;
        }

        init(wrapper) {
            this.wrapper = wrapper;
            this._nodes = [];
            this._cues = [];
            this._subtitles = [];

            return this.resetIndex();
        }

        initSubtitlesMenu() {
            const $subtitlesMenu = $('.context-menu.subtitles .options-wrapper', this.wrapper)[0];
            const subtitlesNodes = this._nodes;

            for (let i = 0; i < subtitlesNodes.length; i++) {
                const button = document.createElement('button');
                button.className = subtitlesNodes[i].h;
                const span = document.createElement('span');
                span.textContent = subtitlesNodes[i].name;
                const icon = document.createElement('i');
                icon.className = 'sprite-fm-mono icon-active icon-check-small-regular-outline hidden';
                button.appendChild(span);
                button.appendChild(icon);
                $subtitlesMenu.appendChild(button);
            }

            Ps.initialize($subtitlesMenu.parentNode);
        }

        async configure(vNode) {
            const vName = fileName(vNode);
            const {extensions} = this._factory;
            const promises = [];

            const nodesIds = Object.keys(M.c[vNode.p] || {});
            const nodes = [];

            for (const id of nodesIds) {
                if (M.d[id]) {
                    nodes.push(M.d[id]);
                }
            }

            for (const ext of extensions) {
                for (const n of nodes) {
                    if (n.name === `${vName}${ext}`) {
                        if (this._nodes.length >= extensions.length) {
                            break;
                        }
                        this._nodes.unshift(n);
                        const promise = this.fetch(0).then((raw) => {
                            const cues = this._factory.parse(n, raw);
                            this._subtitles.unshift(cues);
                        }).catch(() => {
                            this._subtitles.unshift([]);
                        });
                        promises.push(promise);
                    }
                }
            }

            await Promise.all(promises);

            // Init subtitles context menu options
            this.initSubtitlesMenu();
        }

        select(index) {
            if (!this._nodes.length || index === this._index.node || index < 0 || index > this._nodes.length - 1) {
                if (index < 0) {
                    this.resetIndex();
                }
                return;
            }

            this._cues = this._subtitles[index];

            let result;
            if (this._cues.length) {
                this._index.node = index;
                this._index.cue = -1;
                result = true;
                eventlog(99990);
            }
            else {
                $(document).fullScreen(false);
                toaster.main.show({
                    icons: ['error sprite-fm-uni icon-error'],
                    content: l.video_player_display_subtitles_error_msg.replace('%s', this._nodes[index].name),
                    classes: ['theme-dark-forced']
                });
                this._cues = this._subtitles[this._index.node];
                result = false;
                eventlog(99991);
            }
            return result;
        }

        cue(time, onSuccess, onError) {
            const index = this._cues.findIndex((cue) => cue.start <= time && cue.end >= time);
            if (index !== this._index.cue) {
                if (index === -1 || !this._cues[index].cue) {
                    if (typeof onError === 'function') {
                        onError();
                    }
                }
                else if (typeof onSuccess === 'function') {
                    onSuccess(this._cues[index].cue);
                }
                this._index.cue = index;
            }
        }

        async fetch(index) {
            return new Promise((resolve, reject) => {
                M.gfsfetch(this._nodes[index].h, 0, -1).then((data) => {
                    if (data.buffer === null) {
                        return reject();
                    }

                    const reader = new FileReader();
                    reader.addEventListener('loadend', () => resolve(reader.result));
                    reader.readAsText(new Blob([data.buffer], { type: "text/plain" }));
                }).catch(() => {
                    return reject();
                });
            });
        }

        async searchSubtitles() {
            const nodes = [];
            const {extensions} = this._factory;

            for (const ext of extensions) {
                if (folderlink) {
                    for (let i = 0; i < M.v.length; i++) {
                        if (M.v[i].name && M.v[i].name.endsWith(ext) && !this._nodes.includes(M.v[i])) {
                            nodes.push(M.v[i]);
                        }
                    }
                }
                else {
                    await M.fmSearchNodes(ext).then(() => {
                        for (const n of Object.keys(M.d)) {
                            if (M.d[n].name && M.d[n].name.endsWith(ext) && !this._nodes.includes(M.d[n]) &&
                                !M.getTreeHandles(M.RubbishID).includes(M.d[n].p) &&
                                !M.getTreeHandles('shares').includes(M.d[n].p)) {
                                nodes.push(M.d[n]);
                            }
                        }
                    });
                }
            }
            return nodes;
        }

        async addSubtitles(node) {
            this._nodes.unshift(node);
            await this.fetch(0).then((raw) => {
                const cues = this._factory.parse(node, raw);
                this._subtitles.unshift(cues);
                if (this._index.node !== -1) {
                    this._index.node++;
                }

                const button = document.createElement('button');
                button.className = node.h;
                const span = document.createElement('span');
                span.textContent = node.name;
                const icon = document.createElement('i');
                icon.className = 'sprite-fm-mono icon-active icon-check-small-regular-outline hidden';
                button.appendChild(span);
                button.appendChild(icon);
                const $subtitlesMenu = $('.media-viewer-container .context-menu.subtitles .options-wrapper')[0];
                $subtitlesMenu.insertBefore(button, $('.context-menu.subtitles .options button')[1]);

                $(`.media-viewer-container .context-menu.subtitles button.${node.h}`).trigger('click.media-viewer');
            }).catch(() => {
                this._nodes.shift();
                toaster.main.show({
                    icons: ['error sprite-fm-uni icon-error'],
                    content: l.video_player_add_subtitles_error_msg.replace('%s', node.name),
                    classes: ['theme-dark-forced']
                });
                eventlog(99991);
            });
        }

        addSubtitlesDialog(continuePlay) {
            $(document).fullScreen(false);
            const dialog = new AddSubtitlesDialog(this, continuePlay);
            dialog.show();
        }

        displaySubtitles(streamer, subtitles) {
            this.cue(
                streamer ? streamer.currentTime * 1000 : 0,
                (cue) => subtitles.safeHTML(cue),
                () => subtitles.empty()
            );
        }

        destroySubtitlesMenu() {
            $('.context-menu.subtitles .options-wrapper button:gt(0)', this.wrapper).remove();
        }
    }

    return new SubtitlesManager();
});

/** @property mega.sets */
lazy(mega, 'sets', () => {
    'use strict';

    /**
     * This value is for checking whether the DB has been already initialised
     */
    let isDbInitialised = false;

    /**
     * This value is for checking whether the DB can be queried
     * @type {Boolean}
     */
    let isDbOperational = false;

    /**
     * A variable to store promise while the DB is being checked whether it is operational
     */
    let isDBChecking = null;

    /**
     * Storing all handlers from all subscribed sections
     * @type {Object.<String, Object.<String, Function>>}
     */
    const subscribers = {
        asp: {},
        asr: {},
        aep: {},
        aer: {},
        ass: {}
    };

    /**
     * @type {Object[]}
     */
    let dbQueue = [];

    /**
     * @type {Promise<void>|null}
     */
    let buildingTmp = null;

    const allowedAttrKeys = {
        n: true,
        c: true
    };

    const local = {
        tmpAesp: {
            isCached: false,
            s: Object.create(null)
        }
    };

    const checkDb = () => {
        isDBChecking = new Promise((resolve) => {
            if (isDbOperational) {
                resolve(true);
                return;
            }

            local.db.s.limit(1).toArray()
                .then(() => {
                    resolve(true);
                })
                .catch(() => {
                    resolve(false);
                })
                .finally(() => {
                    isDBChecking = null;
                });
        });
    };

    const setDb = () => {
        if (isDbInitialised) {
            return;
        }

        lazy(local, 'db', () => new MegaDexie('AESP', 'aesp', '', true, { s: '&id, cts, ts, u' }));
        isDbInitialised = true;

        checkDb();
    };

    const dbPrepare = async() => {
        setDb();

        if (isDBChecking) {
            isDbOperational = await isDBChecking;
        }
    };

    /**
     * Runs the DB tasks in the transaction ensuring the consistency
     * @param {String} command Command to call (a - add, ba - bulkAdd, u - update, d - delete)
     * @param {String} id Document id to reference
     * @param {Object} data Data to add/update
     * @returns {void}
     */
    const queueDbTask = async(command, id, data) => {
        await dbPrepare();

        if (!isDbOperational) {
            return;
        }

        dbQueue.push({ command, id, data });

        delay(`sets:db_queue`, () => {
            if (!dbQueue.length) {
                return;
            }

            const { db: { s } } = local;
            const commands = dbQueue;
            dbQueue = [];

            const bulks = {
                a: [], // Array of additions
                d: [], // Array of removals
                u: {} // Changes per set
            };

            for (let i = 0; i < commands.length; i++) {
                const { command, id, data } = commands[i];

                switch (command) {
                    case 'a': bulks.a.push(data); break;
                    case 'ba': bulks.a.push(...data); break;
                    case 'u': bulks.u[id] = (bulks.u[id]) ? { ...bulks.u[id], ...data } : data ; break;
                    case 'd': bulks.d.push(id); break;
                    default: break;
                }
            }

            if (bulks.a.length) {
                s.bulkPut(bulks.a).catch(dump);
            }

            const keys = Object.keys(bulks.u);

            if (keys.length) {
                for (let i = 0; i < keys.length; i++) {
                    s.update(keys[i], bulks.u[keys[i]]).catch(dump);
                }
            }

            if (bulks.d.length) {
                s.bulkDelete(bulks.d).catch(dump);
            }
        }, 500);
    };

    /**
     * Grouping the array by the unique id
     * @param {Object[]} array Array to convert
     * @returns {Object.<String, Object.<String, any>>}
     */
    const groupById = array => array.reduce(
        (obj, v) => Object.assign(obj, { [v.id]: v }),
        {}
    );

    /**
     * Triggers all predefined callbacks
     * @param {String} key Key of the subscribers array
     * @param {any} payload Data to pass as arguments
     * @returns {void}
     */
    const runSubscribedMethods = (key, payload) => {
        if (subscribers[key]) {
            const callbacks = Object.values(subscribers[key]);

            if (callbacks.length) {
                for (let i = 0; i < callbacks.length; i++) {
                    callbacks[i](payload);
                }
            }
        }
    };

    /**
     * @param {Object.<String, any>} attrData Set attribute data to encrypt
     * @param {String} [key] The already generated key in Base64 format, used when re-encryption is needed
     * @returns {Object.<String, String>}
     */
    const encryptSetAttr = (attrData, key = undefined) => {
        const keyArr = (typeof key === 'string')
            ? decrypt_key(u_k_aes, base64_to_a32(key))
            : [...crypto.getRandomValues(new Uint32Array(4))];

        return {
            at: tlvstore.encrypt(attrData, true, keyArr),
            k: key || a32_to_base64(encrypt_key(u_k_aes, keyArr))
        };
    };

    /**
     * Wiping the cached values to re-render, in case something has been changed
     * @returns {void}
     */
    const renderCleanup = () => {
        if (!M.albums) {
            mega.gallery.albumsRendered = false;
            MegaGallery.dbactionPassed = false;
        }
    };

    /**
     * Getting all sets from the database and storing them into the memory for the future use
     * @returns {Object[]}
     */
    const buildTmp = async() => {
        await dbPrepare();

        if (!isDbOperational) {
            return {};
        }

        if (buildingTmp) {
            await buildingTmp;
        }

        const { tmpAesp, db } = local;

        if (tmpAesp.isCached) {
            return tmpAesp.s;
        }

        buildingTmp = new Promise((resolve) => {
            db.s.toArray()
                .then((sets) => {
                    tmpAesp.s = groupById(sets);
                    tmpAesp.isCached = true;
                })
                .catch(dump)
                .finally(() => {
                    buildingTmp = null;
                    resolve();
                });
        });

        await buildingTmp;
        return tmpAesp.s;
    };

    /**
     * Send a specific Set or Element command to API (V3)
     * @param {String} a Action to send to API
     * @param {Object<String, String|Number>} options options to pass with the action
     * @returns {function(...[*]): Promise<void>}
     */
    const sendScReq = (a, options) => api.screq({ a, ...options }).then(({ result }) => result);

    /**
     * Send a specific Set or Element command to API (V2)
     * @param {String} a Action to send to API
     * @param {Object<String, String|Number>} options options to pass with the action
     * @returns {function(...[*]): Promise<void>}
     */
    const sendReq = (a, options) => api.req({ a, ...options }).then(({ result }) => result);

    /**
     * @param {String} name Set name to add
     * @param {Number} [ts] Indicates when the album was created
     * @returns {function(...[*]): Promise<void>}
     */
    const add = async(name, ts) => {
        const data = encryptSetAttr({ n: name || '', t: (ts || Date.now()).toString() });
        const res = await sendScReq('asp', data);

        res.k = data.k;
        res.at = data.at;

        return res;
    };

    /**
     * @param {String} id Set id to retrieve
     * @returns {Promise}
     */
    const getSetById = async(id) => {
        await dbPrepare();
        return local.db.s.get(id);
    };

    /**
     * Decrypting the User's private set attribute
     * @param {String} attr Encrypted set's attribute
     * @param {String} key Decryption key
     * @returns {Object.<String, any>}
     */
    const decryptSetAttr = (attr, key) => tlvstore.decrypt(attr, true, decrypt_key(u_k_aes, base64_to_a32(key)));

    /**
     * Decrypting the public set attribute
     * @param {String} attr Encrypted set's attribute
     * @param {String} key Public key
     * @returns {Object.<String, any>}
     */
    const decryptPublicSetAttr = (attr, key) => tlvstore.decrypt(attr, true, base64_to_a32(key));

    const elements = {
        /**
         * @param {String} h Node handle to assosiate with the set
         * @param {String} setId Set id to add the element to
         * @param {String} setKey Set key to use for encryption
         * @returns {function(...[*]): Promise<void>}
         */
        add: (h, setId, setKey) => {
            const n = M.d[h];

            if (!n) {
                throw new Error('Cannot find the node to add to the set...');
            }

            return sendScReq('aep', {
                h,
                s: setId,
                k: ab_to_base64(
                    asmCrypto.AES_CBC.encrypt(
                        a32_to_ab(n.k),
                        a32_to_ab(decrypt_key(u_k_aes, base64_to_a32(setKey))),
                        false
                    )
                )
            });
        },
        /**
         * @param {String[]} handles Node handles to assosiate with the set
         * @param {String} setId Set id to add elements to
         * @param {String} setKey Set key to use for encryption
         * @returns {function(...[*]): Promise<void>}
         */
        bulkAdd: async(handles, setId, setKey) => {
            const setPubKey = a32_to_ab(decrypt_key(u_k_aes, base64_to_a32(setKey)));
            const e = [];
            const savingEls = {};

            for (let i = 0; i < handles.length; i++) {
                const { h, o } = handles[i];
                const n = M.d[h];

                if (!n) {
                    dump(`Node ${h} cannot be added to the set...`);
                    continue;
                }

                const el = {
                    h,
                    o,
                    k: ab_to_base64(
                        asmCrypto.AES_CBC.encrypt(
                            a32_to_ab(n.k),
                            setPubKey,
                            false
                        )
                    )
                };

                if (!savingEls[o]) {
                    savingEls[o] = el;
                    e.push(el);
                }
            }

            const res = await sendScReq('aepb', { s: setId, e });

            for (let i = 0; i < res.length; i++) {
                if (!res[i] || !res[i].id) {
                    continue;
                }

                const { id, o } = res[i];

                if (savingEls[o]) {
                    savingEls[o].id = id;
                }
            }

            return Object.values(savingEls);
        },
        /**
         * @param {String} id Element id to remove
         * @param {String} s Set id to remove from
         * @returns {function(...[*]): Promise<void>}
         */
        remove: (id, s) => sendReq('aer', { id, s }),
        /**
         * @param {String[]} ids Element ids to remove
         * @param {String} s Set id to remove from
         * @returns {function(...[*]): Promise<void>}
         */
        bulkRemove: (ids, s) => sendReq('aerb', { e: ids, s })
    };

    const copySetFromHandles = async(handles, albumName) => {
        if (!Array.isArray(handles) || !handles.length) {
            dump('Cannot create the set on empty nodes...');
            return;
        }

        await buildTmp();

        const handlesToAdd = [];

        for (let i = 0; i < handles.length; i++) {
            const node = M.d[handles[i]];

            if (!node) {
                dump(`Cannot find node ${handles[i]} to be imported into set...`);
            }
            else if (!node.t) {
                handlesToAdd.push({ h: handles[i], o: (i + 1) * 1000});
            }
        }

        // No need in tmp value, can be removed now
        if ($.albumImport) {
            delete mega.gallery.albums.store[$.albumImport.id];
            delete $.albumImport;
        }

        const payload = await add(albumName);
        const { id, k } = payload;
        const elArr = await elements.bulkAdd(handlesToAdd, id, k);

        payload.e = {};

        for (let i = 0; i < elArr.length; i++) {
            const e = elArr[i];
            e.s = id;

            payload.e[e.id] = e;
        }

        local.tmpAesp.s[id] = payload;

        await dbPrepare();

        if (isDbOperational) {
            local.db.s.put(payload);
        }

        loadingDialog.hide('SetImport');

        toaster.main.show({
            icons: ['sprite-fm-mono icon-check-circle text-color-medium'],
            content: l.album_added.replace('%s', albumName)
        });

        return M.openFolder('albums', true);
    };

    /**
     * Checking files and folders for duplicated names and returns either
     * the same name if unique or hitting the length limit
     * or a unique name with (1) suffix
     * @param {String} name Name to check
     * @param {String} target The handle of the enclosing folder to work with
     * @returns {String}
     */
    const getUniqueFolderName = (name, target) => {
        target = target || M.RootID;

        name = M.getSafeName(name);
        if (fileconflict.getNodeByName(target, name)) {
            name = fileconflict.findNewName(name, target);
        }

        return name;
    };

    /**
     * Processing $.onImportCopyNodes in a Folder link way but for a new set
     * @param {String[]} selectedNodes File or Folder handles to import
     * @param {String} targetHandle The handle of the target folder
     * @returns {Promise}
     */
    const copyNodesAndSet = async(selectedNodes, targetHandle) => {
        // Temporarily adding the importing album data to the albums list
        if (!mega.gallery.albums[$.albumImport.id]) {
            mega.gallery.albums.store[$.albumImport.id] = $.albumImport;
        }

        const tree = $.onImportCopyNodes;
        const [albumNode] = tree;
        const node = crypto_decryptnode({...albumNode});
        let {name} = node;

        onIdle(() => eventlog(99969));

        if (name) {
            name = await mega.gallery.albums.getUniqueSetName(node);

            // The user discarded a new name
            if (name === null) {
                return;
            }

            const newName = getUniqueFolderName(name, targetHandle);

            if (node.name !== newName) {
                node.name = newName;
                albumNode.a = ab_to_base64(crypto_makeattr(node));
            }
        }

        if (albumNode.t > 1) {
            // Mimicking its type to be created as a folder
            albumNode.t = 1;
        }

        const handles = await M.copyNodes(selectedNodes, targetHandle, false, tree);

        loadingDialog.show('SetImport');

        return copySetFromHandles(handles, name);
    };

    /**
     * Mimicking the response from the API to get-tree (f) call
     * @param {Object.<String, String|Number>} s Set data to convert to folder data
     * @param {Object.<String, String|Number>[]} e Set elements
     * @param {Object.<String, String|Number>[]} n Encrypted nodes associated with the elements
     * @param {*} sn Sequence number to use for the integrity of the folder link procedure
     * @returns {Object.<String, MegaNode[]|String>}
     */
    const getPublicSetTree = (s, e, n, sn) => {
        assert(s && s.id, 'The set is either broken or not found...');

        // pretend to be a normal root node.
        s.t = 2;
        s.h = pfid;
        s.k = pfkey;
        M.addNode(s);
        crypto_setsharekey2(M.RootID, base64_to_a32(pfkey));
        s.name = tlvstore.decrypt(s.at, true, u_sharekeys[M.RootID][0]).n;

        // fake get-tree (f) response.
        const res = { f: [], sn };

        if (Array.isArray(e) && e.length) {
            const psKeyAb = base64_to_ab(pfkey);

            const decrNodeKey = tryCatch(
                k => base64_to_a32(ab_to_base64(asmCrypto.AES_CBC.decrypt(base64_to_ab(k), psKeyAb, false)))
            );

            const tmpE = [];
            const tmpN = {};

            for (let i = 0; i < n.length; i++) {
                tmpN[n[i].h] = n[i];
            }

            for (let i = 0; i < e.length; i++) {
                const { h, k } = e[i];
                const node = tmpN[h];

                if (!node) {
                    console.warn(`The Album element ${h} is not available anymore...`);
                    continue;
                }

                const nodeKey = decrNodeKey(k);

                tmpE.push(e[i]);
                node.t = 0;
                node.k = nodeKey;
                node.a = node.at;
                node.p = M.RootID;
                M.addNode(node);

                res.f.push(node);
            }

            s.e = tmpE;
        }

        return res;
    };

    return {
        getPublicSetTree,
        decryptSetAttr,
        decryptPublicSetAttr,
        buildTmp,
        getSetById,
        copyNodesAndSet,
        add,
        elements,
        /**
         * Sending the request to add share to an album
         * @param {String} id Set id to share
         * @returns {function(...[*]): Promise<void>}
         */
        addShare: (id) => sendScReq('ass', { id }),
        /**
         * Sending the request to remove share from an album
         * @param {String} id Set id to drop the share for
         * @returns {function(...[*]): Promise<void>}
         */
        removeShare: (id) => sendScReq('ass', { id, d: 1 }),
        /**
         * @param {String} set Set to update
         * @param {String} key Key for the set attribute
         * @param {String|Number} value Value for the set attribute
         * @returns {function(...[*]): Promise<void>}
         */
        updateAttrValue: ({ at, k, id }, key, value) => {
            if (!allowedAttrKeys[key]) {
                console.warn('Trying to edit the non-existent key...');
                return;
            }

            at[key] = value;

            return sendScReq('asp', { id, at: encryptSetAttr(at, k).at });
        },
        /**
         * @param {String} setId Set id to remove
         * @returns {void}
         */
        remove: setId => sendScReq('asr', { id: setId }),
        /**
         * Clearing the existing local aesp database and applying the new data
         * @param {Object.<String, Object[]>} aesp New aesp data from the API
         * @returns {void}
         */
        resetDB: async({ s, e, p }) => {
            const { tmpAesp } = local;

            tmpAesp.s = Object.create(null);

            // Array of sets received
            if (s) {
                for (let i = 0; i < s.length; i++) {
                    const set = Object.assign({}, s[i]);
                    set.e = {};
                    tmpAesp.s[set.id] = set;
                }

                tmpAesp.isCached = true;
            }

            // Array of elements received
            if (e) {
                for (let i = 0; i < e.length; i++) {
                    const el = e[i];

                    if (tmpAesp.s[el.s]) {
                        tmpAesp.s[el.s].e[el.id] = el;
                    }
                }
            }

            // Array of shares received
            if (p) {
                for (let i = 0; i < p.length; i++) {
                    const { ph, ts, s: setId } = p[i];

                    if (tmpAesp.s[setId]) {
                        tmpAesp.s[setId].p = { ph, ts };
                    }
                }
            }

            await dbPrepare();

            if (isDbOperational && local.db) {
                await local.db.s.clear();
                queueDbTask('ba', '', Object.values(tmpAesp.s));
            }
        },
        /**
         * Usage example: const unsubscribe = `mega.sets.subscribe('asp', 'album_added', () => { ... })`
         * @param {String} ap Action packet name to subscribe to
         * @param {String} id Unique identifier of the subscriber
         * @param {Function} fn Action to perform when the action packet is received
         * @returns {Function} Returns an unsubscribe method to remove the handler
         */
        subscribe: (ap, id, fn) => {
            if (!subscribers[ap][id]) {
                subscribers[ap][id] = fn;
            }

            return () => {
                delete subscribers[ap][id];
            };
        },
        parseAsp: async(payload) => {
            delete payload.a;

            await buildTmp();

            const { tmpAesp: { s } } = local;
            const { id, at, ts } = payload;
            const isExisting = s[id];
            const e = (isExisting) ? s[id].e : {};
            const p = (isExisting) ? s[id].p : undefined;

            payload.e = e;
            payload.p = p;

            s[id] = payload;

            renderCleanup();
            runSubscribedMethods('asp', payload);

            if (isExisting) { // The album is already stored, hence needs an update only
                queueDbTask('u', id, { at, ts });
            }
            else {
                queueDbTask('a', id, payload);
            }
        },
        parseAsr: async(payload) => {
            await buildTmp();

            const { tmpAesp: { s } } = local;
            const { id } = payload;

            if (s[id]) {
                delete s[id];
            }

            renderCleanup();
            runSubscribedMethods('asr', payload);
            queueDbTask('d', id);
        },
        parseAss: async(payload) => {
            await buildTmp();

            const { tmpAesp: { s } } = local;
            const { ph, ts, r, s: setId } = payload;
            const changes = (r === 1) ? undefined : { ph, ts };

            renderCleanup();

            if (s[setId]) {
                s[setId].p = changes;
            }
            else {
                return; // The set must have been deleted already, nothing to update
            }

            runSubscribedMethods('ass', payload);
            queueDbTask('u', setId, { p: changes });
        },
        parseAep: async(payload) => {
            await buildTmp();

            const { tmpAesp: { s } } = local;
            const { id, s: setId } = payload;
            delete payload.a;

            renderCleanup();

            if (s[setId]) {
                s[setId].e[id] = payload;
            }
            else {
                return; // The set must have been deleted already, nothing to update
            }

            runSubscribedMethods('aep', payload);
            queueDbTask('u', setId, { [`e.${id}`]: payload });
        },
        parseAer: async(payload) => {
            await buildTmp();

            const { tmpAesp: { s } } = local;
            const { id, s: setId } = payload;

            renderCleanup();

            if (s[setId] && s[setId].e[id]) {
                delete s[setId].e[id];
            }
            else {
                return; // The set must have been deleted already, nothing to update
            }

            runSubscribedMethods('aer', payload);
            queueDbTask('u', setId, { [`e.${id}`]: undefined });
        }
    };
});
