import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';
import Model from '../../Model.js';

/**
 * Component for showing multiple images as one collage.
 * Currently supports a timeline with navigation (e.g. for all sky images).
 * Keogram modes are detected, but not rendered yet.
 */
export default class Collage extends View {

    constructor(options = {}) {
        super(options);
        this.name = 'Collage';
        this.desc.text = 'Shows multiple images as collage. Supports a navigable timeline of images and detects keogram stripes.';
        this.desc.developers = 'HELIOS Gruppe 1, WebEngineering WS26/27 (HSBI)';
        this.desc.license = 'GNU Lesser General Public License';

        this.desc.templates[0] = {
            name: 'collage',
            style: 'collage',
            desc: 'Large view of the selected image with a navigable timeline below.'
        };
        this.desc.reqPerTpl[0] = {
            selc: '.swac_collage_strip',
            desc: 'Area where the timeline thumbnails are placed.'
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
            desc: "Milliseconds each image is shown while playing. Longer if the next image needs more time to load.",
            example: 500
        };
        if (!options.playInterval)
            this.options.playInterval = 500;

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
            this.renderKeogram();
        } else {
            this.renderTimeline();
        }
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
            img.src = this.getImageSrc(set);
        });
    }

    /**
     * Renders keogram stripes as one image.
     *
     * DEVNOTE: Not implemented yet, see js/media/image_cloudview.js in
     * SmartMonitoringFrontend for the drawing of keograms on a canvas.
     * Until then the stripes are shown in the timeline.
     *
     * @returns {undefined}
     */
    renderKeogram() {
        Msg.warn('Collage', 'Display mode >' + this.mode + '< is not implemented yet. Showing images as timeline.', this.requestor);
        this.showMsg(SWAC.lang.dict.Collage.keogramtodo);
        this.renderTimeline();
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
            let caption = SWAC.lang.dict.Collage.image + ' ' + (index + 1) + ' ' + SWAC.lang.dict.Collage.of + ' ' + this.images.length;
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
            if (this.selected > 0)
                this.select(this.selected - 1);
            else
                this.loadPrevious();
        } else if (evt.key === 'ArrowRight') {
            evt.preventDefault();
            if (this.selected < this.images.length - 1)
                this.select(this.selected + 1);
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
        let start = Date.now();
        if (this.selected >= this.images.length - 1) {
            // End of timeline reached, continue with the next images
            let loaded = await this.loadNext();
            if (run !== this.playRun)
                return;
            if (!loaded) {
                this.pause();
                return;
            }
        } else {
            let next = this.images[this.selected + 1];
            await this.preloadImage(this.getImageSrc(next));
            if (!this.playing || run !== this.playRun)
                return;
            this.select(this.selected + 1);
        }
        let wait = Math.max(0, this.options.playInterval - (Date.now() - start));
        this.playTimeout = setTimeout(this.playStep.bind(this, run), wait);
    }

    /**
     * Loads an image into the browser cache
     *
     * @param {String} src Source of the image
     * @returns {Promise} Resolves when the image is loaded or could not be loaded
     */
    preloadImage(src) {
        return new Promise((resolve) => {
            let img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
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
     * Gets the src for an image element from the set
     *
     * @param {WatchableSet} set Set with image information
     * @returns {String} URL, data URL or path below docroot
     */
    getImageSrc(set) {
        let value = set[this.options.pathAttr];
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
