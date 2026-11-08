import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';
import Model from '../../Model.js';

/**
 * Component for showing multiple images as one collage.
 * Supports a timeline with navigation (e.g. for all sky images) and keograms,
 * where stripes of the images are drawn side by side by their timestamp.
 * The stripes can be stored with the sets or cut out of the images in the browser.
 */
export default class Collage extends View {

    constructor(options = {}) {
        super(options);
        this.name = 'Collage';
        this.desc.text = 'Shows multiple images as collage. Supports a navigable timeline of images and keograms from image stripes.';
        this.desc.developers = 'HELIOS Gruppe 1, WebEngineering WS26/27 (HSBI)';
        this.desc.license = 'GNU Lesser General Public License';

        this.desc.templates[0] = {
            name: 'collage',
            style: 'collage',
            desc: 'Large view of the selected image with a navigable timeline below.'
        };
        this.desc.reqPerTpl[0] = {
            selc: '.swac_collage_strip',
            desc: 'Area where the timeline thumbnails or the keogram are placed.'
        };
        this.desc.optPerTpl[0] = {
            selc: '.swac_collage_mainimg',
            desc: 'Image element that shows the selected image in large.'
        };
        this.desc.optPerTpl[1] = {
            selc: '.swac_collage_caption',
            desc: 'Element where time and position of the selected image is shown.'
        };
        this.desc.optPerTpl[2] = {
            selc: '.swac_collage_prev',
            desc: 'Button that loads the previous images.'
        };
        this.desc.optPerTpl[3] = {
            selc: '.swac_collage_next',
            desc: 'Button that loads the next images.'
        };
        this.desc.optPerTpl[4] = {
            selc: '.swac_collage_jumpback',
            desc: 'Button for jumping back (jumpSeconds if sets have a timestamp, otherwise jumpImages).'
        };
        this.desc.optPerTpl[5] = {
            selc: '.swac_collage_jumpfwd',
            desc: 'Button for jumping forward (jumpSeconds if sets have a timestamp, otherwise jumpImages).'
        };
        this.desc.optPerTpl[6] = {
            selc: '.swac_collage_msg',
            desc: 'Element where hints like "no older images" are shown.'
        };
        this.desc.optPerTpl[7] = {
            selc: '.swac_collage_play',
            desc: 'Button that plays the images like a video and pauses the playback.'
        };
        this.desc.optPerTpl[8] = {
            selc: '.swac_collage',
            desc: 'Container of the whole collage.'
        };
        this.desc.optPerTpl[9] = {
            selc: '.swac_collage_viewer',
            desc: 'Area with the large image and its caption.'
        };
        this.desc.optPerTpl[10] = {
            selc: '.swac_collage_nav',
            desc: 'Area with the navigation buttons and the timeline. Its buttons are disabled while images are loading.'
        };
        this.desc.reqPerSet[0] = {
            name: 'id',
            desc: 'The attribute id is required for the component to work properly.'
        };
        this.desc.reqPerSet[1] = {
            name: 'path',
            desc: 'Path relative to docroot, URL or base64 encoded content of the image. Name can be changed with option pathAttr.'
        };
        this.desc.optPerSet[0] = {
            name: 'ts',
            desc: 'Timestamp of the image. Used for ordering, time jumps and loading previous / next images. Name can be changed with option tsAttr.'
        };
        this.desc.optPerSet[1] = {
            name: 'keogram_column_png',
            desc: 'Keogram stripe of the image as base64 PNG, URL or path. Name is set with option keogramAttr.'
        };

        this.options.showWhenNoData = true;
        this.desc.opts[0] = {
            name: "mode",
            desc: "Display mode: auto (detect from first image), timeline, keogram_columns or keogram_rows.",
            example: 'timeline'
        };
        if (!options.mode)
            this.options.mode = 'auto';
        this.desc.opts[1] = {
            name: "pathAttr",
            desc: "Name of the attribute that contains the image path.",
            example: 'path'
        };
        if (!options.pathAttr)
            this.options.pathAttr = 'path';
        // Required attribute is the configured one, otherwise SWAC reports path as missing
        this.desc.reqPerSet[1].name = this.options.pathAttr;
        this.desc.opts[2] = {
            name: "tsAttr",
            desc: "Name of the attribute that contains the timestamp of the image.",
            example: 'ts'
        };
        if (!options.tsAttr)
            this.options.tsAttr = 'ts';
        this.desc.opts[3] = {
            name: "docroot",
            desc: "Root directory that is prepended to relative image paths.",
            example: '/'
        };
        if (!options.docroot)
            this.options.docroot = '/';
        this.desc.opts[4] = {
            name: "pageSize",
            desc: "Number of images that are shown in the timeline at once. Defaults to the size from the WHERE clause or 20.",
            example: 20
        };
        if (!options.pageSize)
            this.options.pageSize = null;
        this.desc.opts[5] = {
            name: "jumpImages",
            desc: "Number of images to jump with the jump buttons, if sets have no timestamp. Jumps outside the shown images are limited to pageSize.",
            example: 10
        };
        if (!options.jumpImages)
            this.options.jumpImages = 10;
        this.desc.opts[6] = {
            name: "jumpSeconds",
            desc: "Seconds to jump with the jump buttons, if sets have a timestamp.",
            example: 3600
        };
        if (!options.jumpSeconds)
            this.options.jumpSeconds = 3600;
        this.desc.opts[7] = {
            name: "keogramMaxSize",
            desc: "Maximum width (columns) or height (rows) in pixel of an image to be detected as keogram stripe.",
            example: 10
        };
        if (!options.keogramMaxSize)
            this.options.keogramMaxSize = 10;
        this.desc.opts[8] = {
            name: "playInterval",
            desc: "Milliseconds each image is shown while playing. Longer if the next image needs more time to load. Can be changed while playing.",
            example: 500
        };
        if (!options.playInterval)
            this.options.playInterval = 500;
        this.desc.opts[9] = {
            name: "keogramAttr",
            desc: "Name of the attribute that contains the keogram stripe of the image (e.g. keogram_column_png from SmartDataPorter). The image from pathAttr is then shown in large. If not set, the image from pathAttr is used as stripe.",
            example: 'keogram_column_png'
        };
        if (!options.keogramAttr)
            this.options.keogramAttr = null;
        this.desc.opts[10] = {
            name: "keogramGapFactor",
            desc: "A gap in the keogram is shown if the time between two images is more than this factor times the usual time between images. Smaller gaps are filled with the previous stripe. Example: 3 shows gaps from about 3 missing images on.",
            example: 3
        };
        if (!options.keogramGapFactor)
            this.options.keogramGapFactor = 3;
        this.desc.opts[11] = {
            name: "keogramFromImage",
            desc: "Cut the keogram stripes out of the images in the browser instead of using stored stripes. "
                    + "true: always cut out of the image from pathAttr, mode auto then uses keogram_columns. "
                    + "false: use the image as stripe. "
                    + "auto: cut only if the image is wider (columns) or higher (rows) than keogramMaxSize, so stored stripes are used as they are. "
                    + "Cutting needs the whole images, so it loads much more data than stored stripes.",
            example: true
        };
        if (options.keogramFromImage === undefined)
            this.options.keogramFromImage = 'auto';
        this.desc.opts[12] = {
            name: "keogramPosition",
            desc: "Position of the cut in percent of the image width (columns) or height (rows), from the left or top edge. 50 is the middle of the image.",
            example: 50
        };
        if (options.keogramPosition === undefined)
            this.options.keogramPosition = 50;
        this.desc.opts[13] = {
            name: "keogramThickness",
            desc: "Number of pixels that are cut out of each image across the stripe.",
            example: 1
        };
        if (options.keogramThickness === undefined)
            this.options.keogramThickness = 1;
        this.desc.opts[14] = {
            name: "keogramStripeWidth",
            desc: "Size of each cut stripe in the keogram along the time axis in pixel. Defaults to keogramThickness. "
                    + "Smaller values average the cut pixels, larger values stretch them.",
            example: 1
        };
        if (options.keogramStripeWidth === undefined)
            this.options.keogramStripeWidth = null;
        this.desc.opts[15] = {
            name: "keogramStart",
            desc: "Start of the cut along the stripe in percent of the image height (columns) or width (rows), e.g. to leave out the border or the caption of the camera.",
            example: 0
        };
        if (options.keogramStart === undefined)
            this.options.keogramStart = 0;
        this.desc.opts[16] = {
            name: "keogramEnd",
            desc: "End of the cut along the stripe in percent of the image height (columns) or width (rows).",
            example: 100
        };
        if (options.keogramEnd === undefined)
            this.options.keogramEnd = 100;
        this.desc.opts[17] = {
            name: "keogramInterval",
            desc: "Seconds between the images drawn in the keogram. Only the first image of each interval is drawn and stretched to the next one. "
                    + "Click, arrow keys and playback then use only these images. 0 draws all images. Needs timestamps.",
            example: 30
        };
        if (options.keogramInterval === undefined)
            this.options.keogramInterval = 0;
        this.desc.opts[18] = {
            name: "playPreload",
            desc: "Number of images that are loaded in advance while playing, so that the playback does not wait for each image.",
            example: 10
        };
        if (!options.playPreload)
            this.options.playPreload = 10;

        this.desc.funcs[0] = {
            name: 'select',
            desc: 'Selects the image at the given position of the timeline.',
            params: [
                {
                    name: 'index',
                    desc: 'Position of the image in the currently shown timeline',
                    type: 'Number'
                }
            ]
        };
        this.desc.funcs[1] = {
            name: 'showTimepoint',
            desc: 'Loads the images beginning at the given timepoint and selects the first one.',
            params: [
                {
                    name: 'timepoint',
                    desc: 'Timepoint as Date or as string that can be parsed by Date',
                    type: 'Date|String'
                }
            ],
            returns: {
                desc: 'Promise that resolves when the images are loaded.',
                type: 'Promise'
            }
        };
        this.desc.funcs[2] = {
            name: 'loadPrevious',
            desc: 'Loads the images before the first shown image.',
            returns: {
                desc: 'Promise that resolves with true if images were loaded, false if there are no older images.',
                type: 'Promise<Boolean>'
            }
        };
        this.desc.funcs[3] = {
            name: 'loadNext',
            desc: 'Loads the images after the last shown image.',
            returns: {
                desc: 'Promise that resolves with true if images were loaded, false if there are no newer images.',
                type: 'Promise<Boolean>'
            }
        };
        this.desc.funcs[4] = {
            name: 'play',
            desc: 'Plays the images like a video. Loads the next images when reaching the end of the timeline.'
        };
        this.desc.funcs[5] = {
            name: 'pause',
            desc: 'Pauses the playback.'
        };
        this.desc.funcs[6] = {
            name: 'redraw',
            desc: 'Changes options and draws the collage again without loading the data again. '
                    + 'Useful to change the cut of the keogram (e.g. keogramPosition, keogramThickness) or the mode.',
            params: [
                {
                    name: 'options',
                    desc: 'Options to change, e.g. {keogramPosition: 30, keogramThickness: 5}',
                    type: 'Object'
                }
            ],
            returns: {
                desc: 'Promise that resolves when the collage is drawn.',
                type: 'Promise'
            }
        };

        this.desc.events[0] = {
            name: 'swac_REQUESTOR_ID_collage_select',
            desc: 'Fired when an image is selected.',
            data: 'Delivers {requestor, set, index} with the selected set and its position in the timeline.'
        };
        this.desc.events[1] = {
            name: 'swac_REQUESTOR_ID_collage_mode',
            desc: 'Fired when the display mode is determined.',
            data: 'Delivers {requestor, mode} with the used mode.'
        };
        this.desc.events[2] = {
            name: 'swac_REQUESTOR_ID_collage_play',
            desc: 'Fired when the playback starts or stops.',
            data: 'Delivers {requestor, playing} with true if the playback started.'
        };

        // internal values
        this.images = [];       // Sets shown in the timeline, ordered by time
        this.selected = -1;     // Position of the selected image
        this.mode = null;       // Used display mode
        this.hasTs = false;     // If the sets have a timestamp
        this.loading = false;
        this.renderTimeout = null;
        this.ownRequestIds = new Set();  // Requests made by loadImages()
        this.playing = false;
        this.playTimeout = null;
        this.playRun = 0;       // Number of the current playback
        this.playPreloads = new Map();  // Images of the playback loaded in advance, by image source
        this.keogramRun = 0;    // Number of the current keogram drawing
        this.keogramLayout = null;  // Position of the stripes in the shown keogram
        this.stripeCache = new Map();   // Stripes cut out of the images, by image source
        this.stripeCacheParams = null;  // Cut parameters of the cached stripes
    }

    init() {
        return new Promise((resolve, reject) => {
            let prevBtn = this.requestor.querySelector('.swac_collage_prev');
            if (prevBtn)
                prevBtn.addEventListener('click', this.loadPrevious.bind(this));
            let nextBtn = this.requestor.querySelector('.swac_collage_next');
            if (nextBtn)
                nextBtn.addEventListener('click', this.loadNext.bind(this));
            let jumpBackBtn = this.requestor.querySelector('.swac_collage_jumpback');
            if (jumpBackBtn)
                jumpBackBtn.addEventListener('click', this.jump.bind(this, -1));
            let jumpFwdBtn = this.requestor.querySelector('.swac_collage_jumpfwd');
            if (jumpFwdBtn)
                jumpFwdBtn.addEventListener('click', this.jump.bind(this, 1));
            let playBtn = this.requestor.querySelector('.swac_collage_play');
            if (playBtn) {
                playBtn.addEventListener('click', this.togglePlay.bind(this));
                this.updatePlayButton();
            }
            let strip = this.requestor.querySelector('.swac_collage_strip');
            if (strip) {
                strip.addEventListener('keydown', this.onKeyDown.bind(this));
            } else {
                Msg.error('Collage', 'Template contains no element with class >swac_collage_strip<.', this.requestor);
            }
            resolve();
        });
    }

    //Inheritted
    afterAddSet(set, repeateds) {
        // Sets from loadImages() are shown with showImages() instead
        let fromOwnRequest = set.swac_dataRequest && this.ownRequestIds.has(set.swac_dataRequest.requestId);
        if (!fromOwnRequest && !this.images.find(curImg => curImg.id === set.id)) {
            this.images.push(set);
            if (set[this.options.tsAttr])
                this.hasTs = true;
        }
        // Render once after all sets of a request are added
        clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(this.render.bind(this), 0);

        super.afterAddSet(set, repeateds);
    }

    /**
     * Gets the number of images shown at once
     *
     * @returns {Number} Number of images
     */
    getPageSize() {
        if (this.options.pageSize)
            return this.options.pageSize;
        if (this.requestor.fromWheres && this.requestor.fromWheres.size)
            return parseInt(this.requestor.fromWheres.size);
        return 20;
    }

    /**
     * Renders the collage depending on the mode
     *
     * @returns {undefined}
     */
    async render() {
        if (this.images.length === 0)
            return;
        this.sortImages(this.images);
        if (!this.mode) {
            this.mode = await this.detectMode(this.images[0]);
            Msg.info('Collage', 'Useing display mode >' + this.mode + '<', this.requestor);
            document.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_collage_mode', {
                detail: {requestor: this.requestor, mode: this.mode}
            }));
        }
        if (this.mode === 'keogram_columns' || this.mode === 'keogram_rows') {
            await this.renderKeogram();
        } else {
            this.renderTimeline();
        }
    }

    /**
     * Changes options and draws the collage again without loading the data again
     *
     * @param {Object} options Options to change, e.g. {keogramPosition: 30, keogramThickness: 5}
     * @returns {Promise} Resolves when the collage is drawn
     */
    redraw(options = {}) {
        Object.assign(this.options, options);
        // A new mode is determined again, auto detects it from the first image
        if (options.mode)
            this.mode = options.mode === 'auto' ? null : options.mode;
        this.showMsg('');
        return this.render();
    }

    /**
     * Detects the display mode from the size of the given image
     *
     * @param {WatchableSet} set Set with image to check
     * @returns {Promise<String>} Detected mode
     */
    detectMode(set) {
        return new Promise((resolve, reject) => {
            if (this.options.mode !== 'auto') {
                resolve(this.options.mode);
                return;
            }
            // Stripes cut out of whole images can not be detected by their size
            if (this.getKeogramFromImage() === true) {
                resolve('keogram_columns');
                return;
            }
            let img = new Image();
            img.onload = () => {
                let max = this.options.keogramMaxSize;
                if (img.naturalWidth <= max && img.naturalHeight > img.naturalWidth) {
                    resolve('keogram_columns');
                } else if (img.naturalHeight <= max && img.naturalWidth > img.naturalHeight) {
                    resolve('keogram_rows');
                } else {
                    resolve('timeline');
                }
            };
            img.onerror = () => {
                Msg.warn('Collage', 'Could not load image of set >' + set.id + '< for mode detection. Useing timeline.', this.requestor);
                resolve('timeline');
            };
            img.src = this.getStripeSrc(set);
        });
    }

    /**
     * Draws the keogram stripes side by side on a canvas.
     * Columns are placed from left to right, rows from top to bottom.
     * Each stripe is placed by its timestamp, so gaps in the data stay visible.
     * The stripes are drawn as soon as they are loaded, because cutting them
     * out of whole images takes a while.
     *
     * @returns {Promise} Resolves when the keogram is drawn
     */
    async renderKeogram() {
        let strip = this.requestor.querySelector('.swac_collage_strip');
        if (!strip)
            return;
        // New run number stops an earlier drawing that is still loading stripes
        let run = ++this.keogramRun;
        let sets = this.images.slice();
        let columns = this.mode === 'keogram_columns';
        let params = this.getKeogramParams();
        let cache = this.getStripeCache(sets, columns, params);
        let keys = this.getKeogramKeys(sets);
        let total = keys.filter(curKey => !isNaN(curKey)).length;
        let keogram = null;     // Created with the first loaded stripe, that gives the size
        let failed = new Set(); // Stripes that failed before the keogram was created
        let done = 0;
        let cut = false;
        // Limit parallel loading of images from a server, so that a new drawing does not
        // wait for many old requests. Stripes stored as base64 need no server.
        let firstSrc = sets.length > 0 ? this.getStripeSrc(sets[0]) : '';
        let limit = firstSrc.startsWith('data:') ? 64 : 6;
        await this.forEachLimited(sets.length, limit, async i => {
            // Images left out by keogramInterval need no stripe
            if (isNaN(keys[i]))
                return true;
            let stripe = await this.loadStripe(sets[i], columns, params, cache);
            if (run !== this.keogramRun)
                return false;
            done++;
            if (!stripe) {
                if (keogram)
                    keogram.spans[i] = null;
                else
                    failed.add(i);
                return true;
            }
            if (stripe instanceof HTMLCanvasElement)
                cut = true;
            if (!keogram)
                keogram = this.createKeogram(strip, sets, keys, stripe, columns, failed);
            this.drawStripe(keogram, i, stripe);
            if (cut)
                this.showMsg(SWAC.lang.dict.Collage.keogramcutting + ' ' + done + ' / ' + total);
            return true;
        });
        if (run !== this.keogramRun)
            return;
        if (!keogram) {
            Msg.error('Collage', 'Could not load any keogram stripe.', this.requestor);
            this.showMsg(SWAC.lang.dict.Collage.loaderror);
            return;
        }
        if (cut)
            this.showMsg('');
    }

    /**
     * Creates the canvas of the keogram with cursor, hover label and time axis
     * and places it in the strip.
     *
     * @param {HTMLElement} strip Element where the keogram is placed
     * @param {WatchableSet[]} sets Sets of the keogram, ordered by time
     * @param {Number[]} keys Positions of the sets (time in ms or index)
     * @param {HTMLImageElement|HTMLCanvasElement} first First loaded stripe, gives the size of all stripes
     * @param {Boolean} columns True for columns (time from left to right), false for rows
     * @param {Set<Number>} failed Positions of stripes that could not be loaded
     * @returns {Object} {ctx, thickness, length, spans} needed to draw the stripes
     */
    createKeogram(strip, sets, keys, first, columns, failed) {
        let firstWidth = first.naturalWidth || first.width;
        let firstHeight = first.naturalHeight || first.height;
        // Size of one stripe along the time axis and across it
        let thickness = columns ? firstWidth : firstHeight;
        let length = columns ? firstHeight : firstWidth;
        let scale = this.calcKeogramScale(keys, thickness);
        let slots = keys.map(curKey => Math.round((curKey - scale.start) / scale.step));

        // Slots of each stripe, used to draw it and to find the clicked stripe
        let spans = [];
        // Next stripe with a slot, images left out by keogramInterval have none
        let next = -1;
        for (let i = sets.length - 1; i >= 0; i--) {
            spans[i] = null;
            if (isNaN(slots[i]))
                continue;
            if (!failed.has(i)) {
                // Stretch the stripe to the next one, unless there is a gap in the data
                let width = 1;
                if (next >= 0 && keys[next] - keys[i] <= scale.step * this.options.keogramGapFactor)
                    width = Math.max(slots[next] - slots[i], 1);
                spans[i] = {start: slots[i], end: slots[i] + width};
            }
            next = i;
        }

        let canvas = document.createElement('canvas');
        canvas.classList.add('swac_collage_keogram', columns ? 'swac_collage_keogram_columns' : 'swac_collage_keogram_rows');
        canvas.width = columns ? scale.count * thickness : length;
        canvas.height = columns ? length : scale.count * thickness;
        this.keogramLayout = {columns: columns, count: scale.count, start: scale.start, step: scale.step, spans: spans};
        canvas.addEventListener('click', this.onKeogramClick.bind(this));
        canvas.addEventListener('mousemove', this.onKeogramHover.bind(this));

        let box = document.createElement('div');
        box.classList.add('swac_collage_keogram_box', columns ? 'swac_collage_keogram_box_columns' : 'swac_collage_keogram_box_rows');
        // Not stretched, so a keogram with fewer stripes (e.g. by keogramInterval) is shorter
        if (columns)
            box.style.maxWidth = canvas.width + 'px';
        else
            canvas.style.height = 'min(60vh, ' + canvas.height + 'px)';
        box.appendChild(canvas);
        let cursor = document.createElement('div');
        cursor.classList.add('swac_collage_keogram_cursor');
        box.appendChild(cursor);
        let hover = document.createElement('div');
        hover.classList.add('swac_collage_keogram_hover');
        hover.style.display = 'none';
        box.appendChild(hover);
        canvas.addEventListener('mouseleave', () => hover.style.display = 'none');
        strip.innerHTML = '';
        strip.appendChild(box);
        // Show stripes sharp instead of blurred when the canvas is enlarged
        if (columns ? canvas.width < canvas.clientWidth : canvas.height < canvas.clientHeight)
            canvas.classList.add('swac_collage_pixelated');
        if (this.hasTs)
            box.appendChild(this.createKeogramAxis(columns ? canvas.clientWidth : canvas.clientHeight));

        this.updateJumpButtons();
        if (this.selected < 0 || this.selected >= this.images.length)
            this.selected = 0;
        // The selected image may be left out by keogramInterval
        if (!spans[this.selected]) {
            let nearest = this.getNeighbourIndex(this.selected, 1);
            if (nearest < 0)
                nearest = this.getNeighbourIndex(this.selected, -1);
            if (nearest >= 0)
                this.selected = nearest;
        }
        this.select(this.selected);
        return {ctx: canvas.getContext('2d'), columns: columns, thickness: thickness, length: length, spans: spans};
    }

    /**
     * Gets the positions of the sets in the keogram. With the option keogramInterval
     * only the first set of each interval gets a position.
     *
     * @param {WatchableSet[]} sets Sets of the keogram, ordered by time
     * @returns {Number[]} Time in ms or index, NaN for sets that are not drawn
     */
    getKeogramKeys(sets) {
        let keys = sets.map((curSet, i) => this.hasTs ? this.getKey(curSet) : i);
        let interval = Number(this.options.keogramInterval) * 1000;
        if (!this.hasTs || !(interval > 0))
            return keys;
        let lastSlot = null;
        return keys.map(curKey => {
            let slot = Math.floor(curKey / interval);
            if (isNaN(curKey) || slot === lastSlot)
                return NaN;
            lastSlot = slot;
            return curKey;
        });
    }

    /**
     * Gets the previous or next image. In a keogram images without stripe,
     * e.g. left out by keogramInterval, are skipped.
     *
     * @param {Number} index Position of the image to start from
     * @param {Number} direction -1 for the previous, 1 for the next image
     * @returns {Number} Position of the image or -1 if there is none
     */
    getNeighbourIndex(index, direction) {
        let spans = this.keogramLayout ? this.keogramLayout.spans : null;
        for (let i = index + direction; i >= 0 && i < this.images.length; i += direction) {
            if (!spans || spans[i])
                return i;
        }
        return -1;
    }

    /**
     * Draws one stripe into its slots of the keogram
     *
     * @param {Object} keogram Keogram from createKeogram()
     * @param {Number} index Position of the stripe in the keogram
     * @param {HTMLImageElement|HTMLCanvasElement} stripe Stripe to draw
     * @returns {undefined}
     */
    drawStripe(keogram, index, stripe) {
        let span = keogram.spans[index];
        if (!span)
            return;
        let pos = span.start * keogram.thickness;
        let size = (span.end - span.start) * keogram.thickness;
        if (keogram.columns)
            keogram.ctx.drawImage(stripe, pos, 0, size, keogram.length);
        else
            keogram.ctx.drawImage(stripe, 0, pos, keogram.length, size);
    }

    /**
     * Loads the keogram stripe of a set. Whole images are cut to a stripe
     * depending on the option keogramFromImage.
     *
     * @param {WatchableSet} set Set to load the stripe for
     * @param {Boolean} columns True for columns, false for rows
     * @param {Object} params Cut parameters from getKeogramParams()
     * @param {Map} cache Cache for cut stripes from getStripeCache()
     * @returns {Promise<HTMLImageElement|HTMLCanvasElement>} Stripe or null if it could not be loaded
     */
    async loadStripe(set, columns, params, cache) {
        let src = this.getStripeSrc(set);
        if (!src)
            return null;
        if (cache.has(src))
            return cache.get(src);
        let img = await this.preloadImage(src);
        if (!img)
            return null;
        let across = columns ? img.naturalWidth : img.naturalHeight;
        // Stored stripes are used as they are
        if (params.fromImage === false || (params.fromImage === 'auto' && across <= this.options.keogramMaxSize))
            return img;
        let stripe = this.cutStripe(img, columns, params);
        cache.set(src, stripe);
        return stripe;
    }

    /**
     * Cuts a stripe out of an image.
     * Uses drawImage, so it works with images from other servers without CORS too.
     *
     * @param {HTMLImageElement} img Loaded image
     * @param {Boolean} columns True cuts a column, false a row
     * @param {Object} params Cut parameters from getKeogramParams()
     * @returns {HTMLCanvasElement} Canvas with the stripe
     */
    cutStripe(img, columns, params) {
        let across = columns ? img.naturalWidth : img.naturalHeight;
        let along = columns ? img.naturalHeight : img.naturalWidth;
        let thickness = Math.min(params.thickness, across);
        // The position is the middle of the cut, the cut always stays inside the image
        let from = Math.round(across * params.position / 100 - thickness / 2);
        from = Math.min(Math.max(from, 0), across - thickness);
        let start = Math.round(along * params.start / 100);
        let length = Math.max(Math.round(along * params.end / 100) - start, 1);
        let stripeWidth = params.stripeWidth || thickness;

        let canvas = document.createElement('canvas');
        canvas.width = columns ? stripeWidth : length;
        canvas.height = columns ? length : stripeWidth;
        let ctx = canvas.getContext('2d');
        // A thick cut drawn into a thin stripe is scaled down, that averages its pixels
        ctx.imageSmoothingQuality = 'high';
        if (columns)
            ctx.drawImage(img, from, start, thickness, length, 0, 0, stripeWidth, length);
        else
            ctx.drawImage(img, start, from, length, thickness, 0, 0, length, stripeWidth);
        return canvas;
    }

    /**
     * Gets the cache for cut stripes. The cache is emptied when the cut parameters
     * change and keeps only the stripes of the given sets.
     *
     * @param {WatchableSet[]} sets Sets of the keogram
     * @param {Boolean} columns True for columns, false for rows
     * @param {Object} params Cut parameters from getKeogramParams()
     * @returns {Map} Cut stripes by image source
     */
    getStripeCache(sets, columns, params) {
        let paramsKey = JSON.stringify([columns, params]);
        if (paramsKey !== this.stripeCacheParams) {
            this.stripeCache = new Map();
            this.stripeCacheParams = paramsKey;
        }
        let srcs = new Set(sets.map(curSet => this.getStripeSrc(curSet)));
        for (let curSrc of this.stripeCache.keys()) {
            if (!srcs.has(curSrc))
                this.stripeCache.delete(curSrc);
        }
        return this.stripeCache;
    }

    /**
     * Gets the options for cutting stripes with checked values.
     * Options from the URL are strings, so they are converted here.
     *
     * @returns {Object} {fromImage, position, thickness, stripeWidth, start, end}
     */
    getKeogramParams() {
        let num = (value, def) => {
            let number = Number(value);
            return value === null || value === undefined || value === '' || isNaN(number) ? def : number;
        };
        let limit = (value, min, max) => Math.min(Math.max(value, min), max);
        let start = limit(num(this.options.keogramStart, 0), 0, 100);
        let end = limit(num(this.options.keogramEnd, 100), 0, 100);
        if (end <= start) {
            Msg.warn('Collage', 'keogramEnd >' + end + '< must be greater than keogramStart >' + start + '<. Useing the whole image.', this.requestor);
            start = 0;
            end = 100;
        }
        let thickness = Math.max(Math.round(num(this.options.keogramThickness, 1)), 1);
        return {
            fromImage: this.getKeogramFromImage(),
            position: limit(num(this.options.keogramPosition, 50), 0, 100),
            thickness: thickness,
            stripeWidth: Math.max(Math.round(num(this.options.keogramStripeWidth, thickness)), 1),
            start: start,
            end: end
        };
    }

    /**
     * Gets the option keogramFromImage, also if it is given as string in the URL
     *
     * @returns {Boolean|String} true, false or 'auto'
     */
    getKeogramFromImage() {
        let fromImage = this.options.keogramFromImage;
        if (fromImage === true || fromImage === 'true')
            return true;
        if (fromImage === false || fromImage === 'false')
            return false;
        return 'auto';
    }

    /**
     * Runs a task for the numbers 0 to count - 1 with a limited number of parallel tasks
     *
     * @param {Number} count Number of tasks
     * @param {Number} limit Maximum number of parallel tasks
     * @param {Function} task Async function that gets the number, returning false stops all further tasks
     * @returns {Promise} Resolves when all started tasks are done
     */
    async forEachLimited(count, limit, task) {
        let next = 0;
        let worker = async () => {
            while (next < count) {
                let index = next++;
                if (await task(index) === false)
                    next = count;
            }
        };
        let workers = [];
        for (let i = 0; i < Math.min(limit, count); i++) {
            workers.push(worker());
        }
        await Promise.all(workers);
    }

    /**
     * Creates the time axis of the keogram with labels at full local times
     *
     * @param {Number} length Shown length of the keogram along the time axis in pixel
     * @returns {HTMLElement} Element with the labels
     */
    createKeogramAxis(length) {
        let layout = this.keogramLayout;
        let axis = document.createElement('div');
        axis.classList.add('swac_collage_keogram_axis');
        let duration = layout.count * layout.step;
        // Smallest interval that leaves enough space for each label
        let maxLabels = Math.max(Math.floor(length / (layout.columns ? 70 : 30)), 1);
        let minutes = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440];
        let interval = minutes.map(curMin => curMin * 60000).find(curInterval => duration / curInterval <= maxLabels);
        if (!interval)
            interval = Math.ceil(duration / maxLabels / 86400000) * 86400000;
        // Start at a full interval of the local time, e.g. a full hour
        let offset = new Date(layout.start).getTimezoneOffset() * 60000;
        let first = Math.ceil((layout.start - offset) / interval) * interval + offset;
        for (let time = first; time <= layout.start + duration; time += interval) {
            let percent = (time - layout.start) / duration * 100;
            // Labels at the edges would be cut off
            if (percent < 2 || percent > 98)
                continue;
            let date = new Date(time);
            let label = document.createElement('span');
            label.classList.add('swac_collage_keogram_tick');
            label.innerHTML = interval >= 86400000 ? date.toLocaleDateString() : date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
            if (layout.columns)
                label.style.left = percent + '%';
            else
                label.style.top = percent + '%';
            axis.appendChild(label);
        }
        return axis;
    }

    /**
     * Moves the cursor of the keogram to the selected image
     *
     * @returns {undefined}
     */
    updateKeogramCursor() {
        let cursor = this.requestor.querySelector('.swac_collage_keogram_cursor');
        if (!cursor)
            return;
        let layout = this.keogramLayout;
        let span = layout ? layout.spans[this.selected] : null;
        if (!span) {
            cursor.style.display = 'none';
            return;
        }
        let percent = (span.start + span.end) / 2 / layout.count * 100;
        cursor.style.display = '';
        if (layout.columns)
            cursor.style.left = percent + '%';
        else
            cursor.style.top = percent + '%';
    }

    /**
     * Selects the image of the clicked keogram stripe.
     * A click into a gap selects the nearest stripe.
     *
     * @param {MouseEvent} evt Click on the keogram
     * @returns {undefined}
     */
    onKeogramClick(evt) {
        let index = this.findKeogramStripe(this.getKeogramRatio(evt));
        if (index >= 0)
            this.select(index);
    }

    /**
     * Shows the time of the stripe under the mouse
     *
     * @param {MouseEvent} evt Mouse movement over the keogram
     * @returns {undefined}
     */
    onKeogramHover(evt) {
        let hover = this.requestor.querySelector('.swac_collage_keogram_hover');
        if (!hover)
            return;
        let ratio = this.getKeogramRatio(evt);
        let index = this.findKeogramStripe(ratio);
        if (index < 0) {
            hover.style.display = 'none';
            return;
        }
        let date = this.getDate(this.images[index]);
        hover.innerHTML = date ? date.toLocaleTimeString() : SWAC.lang.dict.Collage.image + ' ' + (index + 1);
        // Shift the label with the position, so that it stays inside the keogram
        let percent = Math.min(Math.max(ratio, 0), 1) * 100;
        if (this.keogramLayout.columns) {
            hover.style.left = percent + '%';
            hover.style.transform = 'translateX(-' + percent + '%)';
        } else {
            hover.style.top = percent + '%';
            hover.style.transform = 'translateY(-' + percent + '%)';
        }
        hover.style.display = '';
    }

    /**
     * Gets the position of the mouse along the time axis of the keogram
     *
     * @param {MouseEvent} evt Mouse event on the keogram
     * @returns {Number} Position from 0 (start) to 1 (end)
     */
    getKeogramRatio(evt) {
        // The canvas is stretched to its element, so use the shown size
        let rect = evt.currentTarget.getBoundingClientRect();
        if (this.keogramLayout && this.keogramLayout.columns)
            return (evt.clientX - rect.left) / rect.width;
        return (evt.clientY - rect.top) / rect.height;
    }

    /**
     * Finds the stripe at the given position of the keogram.
     * In a gap the nearest stripe is found.
     *
     * @param {Number} ratio Position from 0 (start) to 1 (end) of the keogram
     * @returns {Number} Position of the image in the timeline or -1 if there is none
     */
    findKeogramStripe(ratio) {
        let layout = this.keogramLayout;
        if (!layout)
            return -1;
        let slot = ratio * layout.count;
        let nearest = -1;
        let nearestDist = Infinity;
        for (let i = 0; i < layout.spans.length; i++) {
            let span = layout.spans[i];
            if (!span)
                continue;
            let dist = 0;
            if (slot < span.start)
                dist = span.start - slot;
            else if (slot >= span.end)
                dist = slot - span.end;
            if (dist < nearestDist) {
                nearest = i;
                nearestDist = dist;
            }
        }
        return nearest;
    }

    /**
     * Calculates the time axis of the keogram.
     * One slot is as long as the usual interval between two images.
     *
     * @param {Number[]} keys Sorted positions of the stripes (time in ms or index)
     * @param {Number} thickness Size of one stripe along the time axis in pixel
     * @returns {Object} {start, step, count} with the first key, the keys per slot and the number of slots
     */
    calcKeogramScale(keys, thickness) {
        let valid = keys.filter(curKey => !isNaN(curKey));
        let intervals = [];
        for (let i = 1; i < valid.length; i++) {
            if (valid[i] > valid[i - 1])
                intervals.push(valid[i] - valid[i - 1]);
        }
        let step = 1;
        if (intervals.length > 0) {
            intervals.sort((a, b) => a - b);
            let median = intervals[Math.floor(intervals.length / 2)];
            // Mean of the usual intervals, because gaps would make the slots too long
            let usual = intervals.filter(curInterval => curInterval <= median * 1.5);
            step = usual.reduce((sum, curInterval) => sum + curInterval, 0) / usual.length;
        }
        let span = valid.length > 0 ? valid[valid.length - 1] - valid[0] : 0;
        let count = Math.round(span / step) + 1;
        // Browsers limit the canvas size, large gaps would exceed it
        let maxCount = Math.floor(16384 / thickness);
        if (count > maxCount) {
            count = maxCount;
            step = span / (count - 1);
        }
        return {start: valid.length > 0 ? valid[0] : 0, step: step, count: count};
    }

    /**
     * Renders the timeline with thumbnails of the images
     *
     * @returns {undefined}
     */
    renderTimeline() {
        let strip = this.requestor.querySelector('.swac_collage_strip');
        if (!strip)
            return;
        // Stop a keogram that is still drawing, it would replace the timeline
        this.keogramRun++;
        this.keogramLayout = null;
        strip.innerHTML = '';
        for (let i = 0; i < this.images.length; i++) {
            let set = this.images[i];
            let thumbElem = document.createElement('figure');
            thumbElem.classList.add('swac_collage_thumb');
            thumbElem.setAttribute('swac_setid', set.id);
            let imgElem = document.createElement('img');
            imgElem.setAttribute('loading', 'lazy');
            imgElem.setAttribute('alt', '');
            imgElem.src = this.getImageSrc(set);
            thumbElem.appendChild(imgElem);
            let date = this.getDate(set);
            if (date) {
                let capElem = document.createElement('figcaption');
                capElem.innerHTML = date.toLocaleTimeString();
                thumbElem.appendChild(capElem);
            }
            thumbElem.addEventListener('click', this.select.bind(this, i));
            strip.appendChild(thumbElem);
        }
        this.updateJumpButtons();
        // Keep selection or select first image
        if (this.selected < 0 || this.selected >= this.images.length)
            this.selected = 0;
        this.select(this.selected);
    }

    /**
     * Selects the image at the given position
     *
     * @param {Number} index Position of the image in the timeline
     * @returns {undefined}
     */
    select(index) {
        let set = this.images[index];
        if (!set)
            return;
        this.selected = index;

        let mainImg = this.requestor.querySelector('.swac_collage_mainimg');
        if (mainImg)
            mainImg.src = this.getImageSrc(set);
        let captionElem = this.requestor.querySelector('.swac_collage_caption');
        if (captionElem) {
            let number = index + 1;
            let total = this.images.length;
            // In a keogram only the drawn images are counted
            if (this.keogramLayout) {
                number = this.keogramLayout.spans.slice(0, index + 1).filter(curSpan => curSpan).length;
                total = this.keogramLayout.spans.filter(curSpan => curSpan).length;
            }
            let caption = SWAC.lang.dict.Collage.image + ' ' + number + ' ' + SWAC.lang.dict.Collage.of + ' ' + total;
            let date = this.getDate(set);
            if (date)
                caption = date.toLocaleString() + ' · ' + caption;
            captionElem.innerHTML = caption;
        }

        for (let curThumb of this.requestor.querySelectorAll('.swac_collage_thumb')) {
            curThumb.classList.remove('swac_collage_selected');
        }
        let thumbElem = this.requestor.querySelector('.swac_collage_thumb[swac_setid="' + set.id + '"]');
        if (thumbElem) {
            thumbElem.classList.add('swac_collage_selected');
            // Center thumbnail in the timeline without scrolling the page
            let strip = thumbElem.parentElement;
            strip.scrollLeft = thumbElem.offsetLeft - (strip.clientWidth - thumbElem.offsetWidth) / 2;
        }
        this.updateKeogramCursor();

        document.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_collage_select', {
            detail: {requestor: this.requestor, set: set, index: index}
        }));
    }

    /**
     * Selects the previous or next image with the arrow keys
     *
     * @param {KeyboardEvent} evt Event of the key press
     * @returns {undefined}
     */
    onKeyDown(evt) {
        if (evt.key === 'ArrowLeft') {
            evt.preventDefault();
            let prev = this.getNeighbourIndex(this.selected, -1);
            if (prev >= 0)
                this.select(prev);
            else
                this.loadPrevious();
        } else if (evt.key === 'ArrowRight') {
            evt.preventDefault();
            let next = this.getNeighbourIndex(this.selected, 1);
            if (next >= 0)
                this.select(next);
            else
                this.loadNext();
        } else if (evt.key === ' ') {
            evt.preventDefault();
            this.togglePlay();
        }
    }

    /**
     * Starts or pauses the playback
     *
     * @returns {undefined}
     */
    togglePlay() {
        if (this.playing)
            this.pause();
        else
            this.play();
    }

    /**
     * Plays the images like a video
     *
     * @returns {undefined}
     */
    play() {
        if (this.playing || this.images.length === 0)
            return;
        this.playing = true;
        this.showMsg('');
        this.updatePlayButton();
        document.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_collage_play', {
            detail: {requestor: this.requestor, playing: true}
        }));
        // New run number stops steps of an earlier playback that are still waiting for images
        this.playRun++;
        this.playStep(this.playRun);
    }

    /**
     * Pauses the playback
     *
     * @returns {undefined}
     */
    pause() {
        if (!this.playing)
            return;
        this.playing = false;
        clearTimeout(this.playTimeout);
        this.playPreloads.clear();
        this.updatePlayButton();
        document.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_collage_play', {
            detail: {requestor: this.requestor, playing: false}
        }));
    }

    /**
     * Shows the next image and plans the following step.
     * Waits until the next image is loaded, so that the playback does not flicker.
     *
     * @param {Number} run Number of the playback this step belongs to
     * @returns {Promise} Resolves when the step is done
     */
    async playStep(run) {
        if (!this.playing || run !== this.playRun)
            return;
        let nextIndex = this.getNeighbourIndex(this.selected, 1);
        if (nextIndex < 0) {
            // End of the timeline reached, continue with the next images. A keogram has all its images.
            let loaded = !this.keogramLayout && await this.loadNext();
            if (run !== this.playRun)
                return;
            if (!loaded) {
                // Back to the first image, playing again needs the play button
                this.pause();
                this.showMsg('');
                this.select(Math.max(this.getNeighbourIndex(-1, 1), 0));
                return;
            }
        } else {
            // The following images load while the current ones are shown
            this.preloadAhead(nextIndex);
            let src = this.getImageSrc(this.images[nextIndex]);
            await this.playPreloads.get(src);
            this.playPreloads.delete(src);
            if (!this.playing || run !== this.playRun)
                return;
            this.select(nextIndex);
        }
        // Each image is shown for the whole interval, also after waiting for it
        this.playTimeout = setTimeout(this.playStep.bind(this, run), this.options.playInterval);
    }

    /**
     * Loads the next images of the playback in advance (option playPreload).
     * Images that are not needed any more are forgotten.
     *
     * @param {Number} index Position of the next image of the playback
     * @returns {undefined}
     */
    preloadAhead(index) {
        let srcs = new Set();
        let count = Math.max(Number(this.options.playPreload) || 1, 1);
        for (let i = index; i >= 0 && srcs.size < count; i = this.getNeighbourIndex(i, 1)) {
            let src = this.getImageSrc(this.images[i]);
            srcs.add(src);
            if (!this.playPreloads.has(src))
                this.playPreloads.set(src, this.preloadImage(src));
        }
        for (let curSrc of this.playPreloads.keys()) {
            if (!srcs.has(curSrc))
                this.playPreloads.delete(curSrc);
        }
    }

    /**
     * Loads an image into the browser cache
     *
     * @param {String} src Source of the image
     * @returns {Promise<HTMLImageElement>} Resolves with the image or with null if it could not be loaded
     */
    preloadImage(src) {
        return new Promise((resolve) => {
            let img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    /**
     * Shows play or pause symbol on the play button
     *
     * @returns {undefined}
     */
    updatePlayButton() {
        let playBtn = this.requestor.querySelector('.swac_collage_play');
        if (!playBtn)
            return;
        // &#xFE0E; shows the play symbol as text instead of an emoji
        playBtn.innerHTML = this.playing ? '&#10074;&#10074;' : '&#9654;&#xFE0E;';
        if (this.playing)
            playBtn.classList.add('swac_collage_playing');
        else
            playBtn.classList.remove('swac_collage_playing');
    }

    /**
     * Loads the images before the first shown image
     *
     * @returns {Promise<Boolean>} Resolves with true if images were loaded
     */
    async loadPrevious() {
        if (this.images.length === 0)
            return false;
        let sets = await this.loadNeighbours(this.images[0], -1);
        if (sets.length === 0) {
            this.showMsg(SWAC.lang.dict.Collage.noolder);
            return false;
        }
        this.showImages(sets, -1);
        return true;
    }

    /**
     * Loads the images after the last shown image
     *
     * @returns {Promise<Boolean>} Resolves with true if images were loaded
     */
    async loadNext() {
        if (this.images.length === 0)
            return false;
        let sets = await this.loadNeighbours(this.images[this.images.length - 1], 1);
        if (sets.length === 0) {
            this.showMsg(SWAC.lang.dict.Collage.nonewer);
            return false;
        }
        this.showImages(sets, 0);
        return true;
    }

    /**
     * Jumps forward or backward by jumpSeconds or jumpImages
     *
     * @param {Number} direction -1 for backward, 1 for forward
     * @returns {Promise} Resolves when the jump is done
     */
    async jump(direction) {
        let set = this.images[this.selected];
        if (!set)
            return;
        if (this.hasTs) {
            let target = new Date(this.getDate(set).getTime() + direction * this.options.jumpSeconds * 1000);
            await this.showTimepoint(target);
            return;
        }
        let steps = this.options.jumpImages;
        let target = this.selected + direction * steps;
        if (target >= 0 && target < this.images.length) {
            this.select(target);
            return;
        }
        // Target is outside the shown images, load the images next to the selected one
        let sets = await this.loadNeighbours(set, direction);
        if (sets.length === 0) {
            this.showMsg(direction > 0 ? SWAC.lang.dict.Collage.nonewer : SWAC.lang.dict.Collage.noolder);
            return;
        }
        if (direction > 0)
            this.showImages(sets, Math.min(steps, sets.length) - 1);
        else
            this.showImages(sets, Math.max(sets.length - steps, 0));
    }

    /**
     * Loads the images beginning at the given timepoint and selects the first one
     *
     * @param {Date|String} timepoint Timepoint to show
     * @returns {Promise} Resolves when the images are loaded
     */
    async showTimepoint(timepoint) {
        if (!this.hasTs) {
            Msg.warn('Collage', 'Images have no timestamp in attribute >' + this.options.tsAttr + '<.', this.requestor);
            return;
        }
        let target = new Date(timepoint);
        if (isNaN(target.valueOf())) {
            Msg.error('Collage', 'Timepoint >' + timepoint + '< is not a valid date.', this.requestor);
            return;
        }
        // gt-filter with one second less to include images at exactly the timepoint
        let from = new Date(target.getTime() - 1000);
        let sets = await this.loadImages(this.options.tsAttr + ',gt,' + this.formatDate(from), this.options.tsAttr + ',asc');
        sets = sets.filter(curSet => this.getDate(curSet) >= target);
        if (sets.length === 0) {
            this.showMsg(SWAC.lang.dict.Collage.notimepoint);
            return;
        }
        this.sortImages(sets);
        this.showImages(sets.slice(0, this.getPageSize()), 0);
    }

    /**
     * Loads the images before or after the given set.
     * Uses the timestamp if available, otherwise the id.
     *
     * @param {WatchableSet} set Set next to which images should be loaded
     * @param {Number} direction -1 for images before, 1 for images after the set
     * @returns {Promise<WatchableSet[]>} Up to pageSize sets in ascending order
     */
    async loadNeighbours(set, direction) {
        let attr = this.hasTs ? this.options.tsAttr : 'id';
        let value = this.hasTs ? this.formatDate(this.getDate(set)) : set.id;
        let filter = attr + (direction > 0 ? ',gt,' : ',lt,') + value;
        let sets = await this.loadImages(filter, attr + (direction > 0 ? ',asc' : ',desc'));
        // Check again, because sources like static files ignore filters
        let key = this.getKey(set);
        sets = sets.filter(curSet => direction > 0 ? this.getKey(curSet) > key : this.getKey(curSet) < key);
        this.sortImages(sets);
        return direction > 0 ? sets.slice(0, this.getPageSize()) : sets.slice(-this.getPageSize());
    }

    /**
     * Loads images from the components data source with the SWAC Model.
     * Options from the WHERE clause are kept, except filters on id and timestamp,
     * because they would prevent the navigation.
     *
     * @param {String} filter Filter for the navigation (e.g. ts,gt,2026-01-03T12:00:00)
     * @param {String} order Order of the requested sets (e.g. ts,asc)
     * @returns {Promise<WatchableSet[]>} Loaded sets
     */
    async loadImages(filter, order) {
        let fromWheres = {};
        for (let curWhere in this.requestor.fromWheres) {
            if (!['filter', 'order', 'size', 'page'].includes(curWhere))
                fromWheres[curWhere] = this.requestor.fromWheres[curWhere];
        }
        let filters = [];
        if (this.requestor.fromWheres.filter) {
            filters = this.requestor.fromWheres.filter.split('&filter=')
                    .filter(curFilter => !curFilter.startsWith(this.options.tsAttr + ',') && !curFilter.startsWith('id,'));
        }
        filters.push(filter);
        fromWheres.filter = filters.join('&filter=');
        fromWheres.order = order;
        fromWheres.size = this.getPageSize();

        let dataRequest = {
            fromName: this.requestor.fromName,
            fromWheres: fromWheres
        };
        this.setLoading(true);
        try {
            let loadProm = Model.load(dataRequest);
            // requestId is calculated synchronous by Model.load, sets are notified while loading
            this.ownRequestIds.add(dataRequest.requestId);
            let data = await loadProm;
            // Model.load delivers the WatchableSource that can contain sets from earlier requests too
            return Array.from(data).filter(curSet => curSet.swac_dataRequest
                        && curSet.swac_dataRequest.requestId === dataRequest.requestId);
        } catch (e) {
            Msg.error('Collage', 'Could not load images: ' + e, this.requestor);
            this.showMsg(SWAC.lang.dict.Collage.loaderror);
            return [];
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Replaces the shown images
     *
     * @param {WatchableSet[]} sets Sets to show
     * @param {Number} selectIndex Position to select, negative values count from the end
     * @returns {undefined}
     */
    showImages(sets, selectIndex) {
        this.images = sets;
        this.selected = selectIndex < 0 ? sets.length + selectIndex : selectIndex;
        this.showMsg('');
        this.render();
    }

    /**
     * Sorts the sets by timestamp or by id if sets have no timestamp
     *
     * @param {WatchableSet[]} sets Sets to sort
     * @returns {undefined}
     */
    sortImages(sets) {
        sets.sort((a, b) => this.getKey(a) - this.getKey(b));
    }

    /**
     * Gets the value used for ordering and navigation
     *
     * @param {WatchableSet} set Set to get the value for
     * @returns {Number} Time in milliseconds if sets have a timestamp, otherwise the id
     */
    getKey(set) {
        if (this.hasTs) {
            let date = this.getDate(set);
            return date ? date.getTime() : NaN;
        }
        return Number(set.id);
    }

    /**
     * Shows or hides the loading state
     *
     * @param {Boolean} loading If images are loading
     * @returns {undefined}
     */
    setLoading(loading) {
        this.loading = loading;
        if (loading)
            this.requestor.classList.add('swac_collage_loading');
        else
            this.requestor.classList.remove('swac_collage_loading');
        for (let curBtn of this.requestor.querySelectorAll('.swac_collage_nav button')) {
            curBtn.disabled = loading;
        }
    }

    /**
     * Sets the labels of the jump buttons depending on available timestamps
     *
     * @returns {undefined}
     */
    updateJumpButtons() {
        let label;
        if (this.hasTs) {
            label = this.formatDuration(this.options.jumpSeconds);
        } else {
            label = this.options.jumpImages + ' ' + SWAC.lang.dict.Collage.images;
        }
        let jumpBackBtn = this.requestor.querySelector('.swac_collage_jumpback');
        if (jumpBackBtn)
            jumpBackBtn.innerHTML = '−' + label;
        let jumpFwdBtn = this.requestor.querySelector('.swac_collage_jumpfwd');
        if (jumpFwdBtn)
            jumpFwdBtn.innerHTML = '+' + label;
    }

    /**
     * Shows a message to the user, an empty text removes the message
     *
     * @param {String} text Text to show
     * @returns {undefined}
     */
    showMsg(text) {
        let msgElem = this.requestor.querySelector('.swac_collage_msg');
        if (msgElem)
            msgElem.innerHTML = text;
    }

    /**
     * Gets the src of the keogram stripe from the set
     *
     * @param {WatchableSet} set Set with keogram stripe
     * @returns {String} URL, data URL or path below docroot
     */
    getStripeSrc(set) {
        // Stripes cut out of the images always come from the image shown in large
        if (this.getKeogramFromImage() === true)
            return this.getImageSrc(set);
        return this.getImageSrc(set, this.options.keogramAttr || this.options.pathAttr);
    }

    /**
     * Gets the src for an image element from the set
     *
     * @param {WatchableSet} set Set with image information
     * @param {String} attr Attribute with the image, defaults to the option pathAttr
     * @returns {String} URL, data URL or path below docroot
     */
    getImageSrc(set, attr = this.options.pathAttr) {
        let value = set[attr];
        if (!value)
            return '';
        if (value.startsWith('data:') || value.startsWith('/') || value.includes('://'))
            return value;
        // Plain base64 content like keogram stripes from SmartDataPorter
        if (value.length > 64 && /^[A-Za-z0-9+/]+={0,2}$/.test(value))
            return 'data:image/png;base64,' + value;
        return this.options.docroot + value;
    }

    /**
     * Gets the timestamp of the set as Date
     *
     * @param {WatchableSet} set Set with timestamp
     * @returns {Date} Date or null if the set has no valid timestamp
     */
    getDate(set) {
        let ts = set[this.options.tsAttr];
        if (!ts)
            return null;
        let date = new Date(typeof ts === 'string' ? ts.replace(' ', 'T') : ts);
        return isNaN(date.valueOf()) ? null : date;
    }

    /**
     * Formats a date for use in filters (local time without timezone like in SmartData)
     *
     * @param {Date} date Date to format
     * @returns {String} Date formatted as YYYY-MM-DDTHH:mm:ss
     */
    formatDate(date) {
        let pad = num => String(num).padStart(2, '0');
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
                + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
    }

    /**
     * Formats a duration for button labels
     *
     * @param {Number} seconds Duration in seconds
     * @returns {String} Duration like 1 h, 30 min or 10 s
     */
    formatDuration(seconds) {
        if (seconds % 3600 === 0)
            return (seconds / 3600) + ' h';
        if (seconds % 60 === 0)
            return (seconds / 60) + ' min';
        return seconds + ' s';
    }
}
