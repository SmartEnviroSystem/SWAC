import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';
import Mediacode from '../Mediaplayer/Mediacode.js';
import MediaNavigator from './MediaNavigator.js';
import ViewHandler from '../../ViewHandler.js';

export default class Mediapreview extends View {

    constructor(options = {}) {
        super(options);
        this.name = 'Mediapreview';
        this.desc.text = 'Creates a preview for media files.';
        this.desc.developers = 'Florian Fehring (FH Bielefeld)';
        this.desc.license = 'GNU Lesser General Public License';

        this.desc.templates[0] = {
            name: 'mediapreview',
            style: 'mediapreview',
            desc: 'Shows a board with cards for each media and sorting and filtering options.'
        };
        this.desc.reqPerTpl[0] = {
            selc: '.swac_mediapreview_mediaarea',
            desc: 'Area where the media preview should be inserted.'
        };
        this.desc.reqPerTpl[1] = {
            selc: '.swac_mediapreview_filterarea',
            desc: 'Area where the filter options are placed.'
        };
        this.desc.reqPerTpl[2] = {
            selc: '.swac_mediapreview_filterattr',
            desc: 'Area that displays a filter attribute and there in the values where filtering for is possible.'
        };
        this.desc.reqPerTpl[3] = {
            selc: '.swac_mediapreview_filterattrname',
            desc: 'Element where to place a attribute name for filtering.'
        };
        this.desc.reqPerTpl[4] = {
            selc: '.swac_mediapreview_filter',
            desc: 'Element where the filters where palced.'
        };

        this.desc.optPerTpl[0] = {
            selc: '.swac_mediapreview_editbutton',
            desc: 'Button that opens the media editor. Automatically is hidden, when the option.mediaeditor is not set.'
        };
        this.desc.optPerTpl[1] = {
            selc: '.swac_mediapreview_nav',
            desc: 'Area with the page navigation. Shown when the option navigation is active.'
        };
        this.desc.optPerTpl[2] = {
            selc: '.swac_mediapreview_first',
            desc: 'Button that shows the first page.'
        };
        this.desc.optPerTpl[3] = {
            selc: '.swac_mediapreview_prev',
            desc: 'Button that shows the previous page.'
        };
        this.desc.optPerTpl[4] = {
            selc: '.swac_mediapreview_next',
            desc: 'Button that shows the next page.'
        };
        this.desc.optPerTpl[5] = {
            selc: '.swac_mediapreview_last',
            desc: 'Button that shows the last page.'
        };
        this.desc.optPerTpl[6] = {
            selc: '.swac_mediapreview_pageinfo',
            desc: 'Element where the range of the shown page is displayed.'
        };
        this.desc.optPerTpl[7] = {
            selc: '.swac_mediapreview_withoutts',
            desc: 'Button that switches to the media without timestamp. Only shown if some media have a timestamp and some not.'
        };
        this.desc.optPerTpl[8] = {
            selc: '.swac_mediapreview_bigview',
            desc: 'Modal for the big view of the images. Shown when an image is clicked and the option bigView is active.'
        };
        this.desc.optPerTpl[9] = {
            selc: '.swac_mediapreview_bigviewarea',
            desc: 'Element inside the big view where the Collage component is created.'
        };
        this.desc.optPerTpl[10] = {
            selc: '.swac_mediapreview_timenav',
            desc: 'Area with the navigation by time. Shown when the media are navigated by timestamp.'
        };
        this.desc.optPerTpl[11] = {
            selc: '.swac_mediapreview_timecontrols',
            desc: 'Form with the input .swac_mediapreview_timepoint, the button .swac_mediapreview_goto and the jump buttons .swac_mediapreview_jumpback and .swac_mediapreview_jumpfwd.'
        };
        this.desc.optPerTpl[12] = {
            selc: '.swac_mediapreview_timemsg',
            desc: 'Element for messages of the navigation by time.'
        };
        this.desc.optPerTpl[13] = {
            selc: '.swac_mediapreview_timeaxis_bar',
            desc: 'Time axis from the first to the last medium. Contains .swac_mediapreview_timeaxis_page for the shown page and .swac_mediapreview_timeaxis_hover for the time under the mouse.'
        };
        this.desc.optPerTpl[14] = {
            selc: '.swac_mediapreview_timeaxis_ticks',
            desc: 'Element where the labels of the time axis are created.'
        };
        this.desc.optPerTpl[15] = {
            selc: '.swac_mediapreview_timeaxis_start',
            desc: 'Element for the time of the first medium. .swac_mediapreview_timeaxis_end for the time of the last medium.'
        };
        this.desc.reqPerSet[0] = {
            name: 'id',
            desc: 'The attribute id is required for the component to work properly.'
        };
        this.desc.reqPerSet[1] = {
            name: 'mimetype',
            desc: 'Mimetype of the media.'
        };
        this.desc.reqPerSet[2] = {
            name: 'path',
            desc: 'Path / URL to file or base64 encoded dataurl content.'
        };
        
        this.desc.optPerSet[0] = {
            name: 'preview',
            desc: 'URL to preview file or base64 encoded dataurl preview content.'
        };
        this.desc.optPerSet[1] = {
            name: 'preview_mimetype',
            desc: 'Mimetype of the preview media. Only needed if it is other than the main mimetype.'
        };
        this.desc.optPerSet[2] = {
            name: 'title',
            desc: 'Media title'
        };
        this.desc.optPerSet[3] = {
            name: 'name',
            desc: 'Media name'
        };
        this.desc.optPerSet[4] = {
            name: 'link',
            desc: 'Link to follow on click on media file.'
        };

        this.options.showWhenNoData = true;
        this.desc.opts[0] = {
            name: "onClickMediaEdit",
            desc: "Function to execute, when the edit button is clicked. If this is undefined, the edit button is not displayed.",
            example: function (evt) {
                console.log('Event:', evt)
            }
        };
        if (!options.onClickMediaEdit)
            this.options.onClickMediaEdit = null;
        this.desc.opts[1] = {
            name: "filteractive",
            desc: "Sets if the filter function should be active or not."
        };
        if (options.filteractive === undefined)
            this.options.filteractive = true;
        this.desc.opts[2] = {
            name: "docroot",
            desc: "Root dircetory of media files."
        };
        if (!options.docroot)
            this.options.docroot = '/';
        this.desc.opts[3] = {
            name: "hrefToMediaeditor",
            desc: "href to Mediaeditor."
        };
        if (!options.hrefToMediaeditor)
            this.options.hrefToMediaeditor = '';
        this.desc.opts[4] = {
            name: "navigation",
            desc: "If true, a navigation below the media allows to show the previous and next pages of media."
        };
        if (options.navigation === undefined)
            this.options.navigation = true;
        this.desc.opts[5] = {
            name: "pageSize",
            desc: "Number of media per page. Default is the size given in the WHERE clause, otherwise 25."
        };
        if (!options.pageSize)
            this.options.pageSize = null;
        this.desc.opts[6] = {
            name: "tsAttr",
            desc: "Name of the attribute that contains the timestamp of the media."
        };
        if (!options.tsAttr)
            this.options.tsAttr = 'ts';
        this.desc.opts[7] = {
            name: "orderAttr",
            desc: "Attribute the navigation goes by. 'auto' uses the timestamp if the media have one, otherwise the id. "
                    + "If some media have a timestamp and some not, the media without timestamp can be shown separately."
        };
        if (!options.orderAttr)
            this.options.orderAttr = 'auto';
        this.desc.opts[8] = {
            name: "showWithoutTs",
            desc: "If true and some media have a timestamp and some not, a button switches to the media without timestamp."
        };
        if (options.showWithoutTs === undefined)
            this.options.showWithoutTs = true;
        this.desc.opts[9] = {
            name: "pathAttr",
            desc: "Name of the attribute that contains the path, URL or data URL of the media."
        };
        if (!options.pathAttr)
            this.options.pathAttr = 'path';
        // The required path attribute is the configured one
        this.desc.reqPerSet[2].name = this.options.pathAttr;
        this.desc.opts[10] = {
            name: "bigView",
            desc: "If true, a click on an image opens a big view with the Collage component. "
                    + "There the images can be navigated one by one and played like a video. "
                    + "When the big view is closed, the page with the last shown image is shown. "
                    + "Other media and false use the link of the media."
        };
        if (options.bigView === undefined)
            this.options.bigView = true;
        this.desc.opts[11] = {
            name: "bigViewOptions",
            desc: "Options for the Collage component in the big view, e.g. {playInterval: 250}."
        };
        if (!options.bigViewOptions)
            this.options.bigViewOptions = {};
        this.desc.opts[12] = {
            name: "timeNavigation",
            desc: "If true and the media have timestamps, a timepoint can be chosen, "
                    + "the pages can be jumped by time and a time axis shows the shown page."
        };
        if (options.timeNavigation === undefined)
            this.options.timeNavigation = true;
        this.desc.opts[13] = {
            name: "jumpSeconds",
            desc: "Number of seconds the jump buttons move the shown page."
        };
        if (!options.jumpSeconds)
            this.options.jumpSeconds = 3600;
        this.desc.opts[14] = {
            name: "pagePlayInterval",
            desc: "Milliseconds a page is shown when the pages are played. "
                    + "The time starts when the images of the page are loaded."
        };
        if (!options.pagePlayInterval)
            this.options.pagePlayInterval = 2000;
        this.desc.opts[15] = {
            name: "pagePlaySpeeds",
            desc: "Intervals in milliseconds the user can choose for playing the pages. An empty list hides the choice."
        };
        if (!options.pagePlaySpeeds)
            this.options.pagePlaySpeeds = [1000, 2000, 5000, 10000];

        this.desc.events[0] = {
            name: 'swac_REQUESTOR_ID_mediapreview_play',
            desc: 'Fired when playing the pages starts or stops.',
            data: 'Delivers {requestor, playing} with true if playing started.'
        };

        this.desc.funcs[0] = {
            name: 'firstPage',
            desc: 'Shows the first page of media.',
            returns: {
                desc: 'Promise that resolves when the page is shown.',
                type: 'Promise'
            }
        };
        this.desc.funcs[1] = {
            name: 'prevPage',
            desc: 'Shows the page before the shown media.',
            returns: {
                desc: 'Promise that resolves when the page is shown.',
                type: 'Promise'
            }
        };
        this.desc.funcs[2] = {
            name: 'nextPage',
            desc: 'Shows the page after the shown media.',
            returns: {
                desc: 'Promise that resolves when the page is shown.',
                type: 'Promise'
            }
        };
        this.desc.funcs[3] = {
            name: 'lastPage',
            desc: 'Shows the last page of media.',
            returns: {
                desc: 'Promise that resolves when the page is shown.',
                type: 'Promise'
            }
        };
        this.desc.funcs[4] = {
            name: 'toggleWithoutTs',
            desc: 'Switches between the media with timestamp and the media without timestamp.',
            returns: {
                desc: 'Promise that resolves when the page is shown.',
                type: 'Promise'
            }
        };
        this.desc.funcs[5] = {
            name: 'showTimepoint',
            desc: 'Shows the page that begins at the given timepoint. '
                    + 'Before the first or after the last medium the first or last page is shown.',
            params: [
                {
                    name: 'timepoint',
                    desc: 'Date or text like 2026-06-15T02:00:00 (local time)'
                }
            ],
            returns: {
                desc: 'Promise that resolves when the page is shown.',
                type: 'Promise'
            }
        };
        this.desc.funcs[6] = {
            name: 'jump',
            desc: 'Shows the page that begins jumpSeconds before or after the first shown medium.',
            params: [
                {
                    name: 'direction',
                    desc: '-1 for earlier, 1 for later media'
                }
            ],
            returns: {
                desc: 'Promise that resolves when the page is shown.',
                type: 'Promise'
            }
        };
        this.desc.funcs[7] = {
            name: 'play',
            desc: 'Shows the following pages automatically. On the last page it starts with the first page.',
            returns: {
                desc: 'Promise that resolves when playing ends.',
                type: 'Promise'
            }
        };
        this.desc.funcs[8] = {
            name: 'pause',
            desc: 'Stops playing the pages.'
        };
        this.desc.funcs[9] = {
            name: 'togglePlay',
            desc: 'Starts or stops playing the pages.'
        };

        // Load language file for mediacode
        SWAC.lang.loadTranslationFile('../swac/components/Mediaplayer/langs/mediacode', 'Mediacode');

        // internal avalues
        this.mediafiles = 0;
        this.filters = {};
        this.filtersBuildHistory = {};
        this.filterrefers = {};
        this.size = 0;
        this.objscenes = [];
        this.objcameras = [];
        this.objrenderers = [];
        this.lastMtlData = null;
        this.lastMtlTitle = '';
        this.lastobjData = null;
        this.lastobjTitle = '';
        this.lastGlbData = null;
        this.lastGlbFile = null;
        this.lastBinFile = null;
        this.lastGlTFFile = null;
        this.lastGlTFFileContent = '';
        // Navigation
        this.navigator = null;
        this.shownSets = [];        // Sets of the shown page in display order
        this.descending = false;    // Media are shown from the newest / highest to the lowest
        this.hasPrev = false;
        this.hasNext = false;
        this.navLoading = false;
        this.baseWheres = {};       // WHERE clause from the declaration
        // Navigation by time
        this.timeRange = null;      // {start, end} time of the first and last medium in milliseconds
        this.timeMsg = '';          // Message of the navigation by time
        this.axisWidth = 0;         // Width the labels of the time axis were created for
        // Playing the pages
        this.playing = false;
        this.playRun = 0;           // Number of the current playing, older runs stop
        this.playTimeout = null;
        // Big view
        this.bigViewElem = null;
        this.bigViewCollage = null;
        this.bigViewLastSet = null; // Last image shown in the big view
    }

    init() {
        return new Promise((resolve, reject) => {
            // The WHERE clause from the declaration, before loading changes it
            let fromWheres = this.firstDatasource ? this.firstDatasource.fromWheres : this.requestor.fromWheres;
            this.baseWheres = Object.assign({}, fromWheres);
            this.toggleMediaEditorButtons();
            if (this.options.bigView)
                this.initBigView();
            if (this.options.navigation)
                this.initNavigation();
            resolve();

        });
    }

    //Inheritted
    checkAcceptSet(set) {
        // When the navigation shows the pages, sets are only added by showSets()
        if (this.navigator && this.navigator.mode)
            return false;
        return super.checkAcceptSet(set);
    }

    //Inheritted
    afterAddSet(set, repeateds) {
        this.createPreview(set)
        if (this.bigViewElem)
            this.addBigViewClick(set);
    }

    /**
     * Gets the number of media per page
     *
     * @returns {Number} Number of media
     */
    getPageSize() {
        return this.options.pageSize || parseInt(this.baseWheres.size) || 25;
    }

    /**
     * Creates the navigation, detects if the media have timestamps and shows the first page.
     *
     * @returns {Promise} Resolves when the first page is shown
     */
    async initNavigation() {
        let nav = this.requestor.querySelector('.swac_mediapreview_nav');
        if (!nav) {
            Msg.warn('Mediapreview', 'The template has no element .swac_mediapreview_nav. Navigation is not available.', this.requestor);
            return;
        }
        let order = this.baseWheres.order ? this.baseWheres.order.toLowerCase() : '';
        this.descending = order.endsWith(',desc');
        this.navigator = new MediaNavigator(this, {
            tsAttr: this.options.tsAttr,
            orderAttr: this.options.orderAttr,
            pageSize: this.getPageSize(),
            fromWheres: this.baseWheres
        });

        let buttons = {
            first: this.firstPage,
            prev: this.prevPage,
            next: this.nextPage,
            last: this.lastPage,
            withoutts: this.toggleWithoutTs
        };
        for (let curName in buttons) {
            let button = nav.querySelector('.swac_mediapreview_' + curName);
            if (button)
                button.addEventListener('click', this.onUserNavigation.bind(this, buttons[curName]));
        }
        this.initPlay(nav);

        try {
            await this.navigator.detect();
        } catch (e) {
            Msg.error('Mediapreview', 'Could not detect navigation mode: ' + e, this.requestor);
            this.navigator.mode = null;
            return;
        }
        nav.classList.remove('swac_dontdisplay');
        this.loadTotals();
        if (this.options.timeNavigation)
            await this.initTimeNavigation();
        await this.firstPage();
    }

    /**
     * Loads the number of media for the page information and the button for media without timestamp
     *
     * @returns {Promise} Resolves when the numbers are loaded
     */
    async loadTotals() {
        let withoutTs = this.navigator.withoutTs;
        try {
            let total = await this.navigator.loadTotal(withoutTs);
            // The user could have switched the media in the meantime
            if (total !== null && withoutTs === this.navigator.withoutTs)
                this.navigator.total = total;
            if (this.navigator.mode === 'mixed' && this.navigator.withoutTsCount === null)
                this.navigator.withoutTsCount = await this.navigator.loadTotal(true);
        } catch (e) {
            Msg.warn('Mediapreview', 'Could not load the number of media: ' + e, this.requestor);
        }
        this.updateNavigation();
    }

    /**
     * Prepares the navigation by time and loads the time of the first and last medium
     *
     * @returns {Promise} Resolves when the navigation by time is ready
     */
    async initTimeNavigation() {
        let timenav = this.requestor.querySelector('.swac_mediapreview_timenav');
        if (!timenav)
            return;
        try {
            this.timeRange = await this.navigator.loadRange();
        } catch (e) {
            Msg.error('Mediapreview', 'Could not load the time range: ' + e, this.requestor);
        }
        if (!this.timeRange)
            return;

        let dict = SWAC.lang.dict.Mediapreview;
        let duration = this.formatDuration(this.options.jumpSeconds);
        let jumpBack = timenav.querySelector('.swac_mediapreview_jumpback');
        if (jumpBack) {
            jumpBack.textContent = '−' + duration;
            jumpBack.addEventListener('click', this.onUserNavigation.bind(this, this.jump, -1));
        }
        let jumpFwd = timenav.querySelector('.swac_mediapreview_jumpfwd');
        if (jumpFwd) {
            jumpFwd.textContent = '+' + duration;
            jumpFwd.addEventListener('click', this.onUserNavigation.bind(this, this.jump, 1));
        }
        let gotoButton = timenav.querySelector('.swac_mediapreview_goto');
        if (gotoButton)
            gotoButton.textContent = dict.goto;
        let input = timenav.querySelector('.swac_mediapreview_timepoint');
        if (input) {
            input.min = this.navigator.formatDate(new Date(this.timeRange.start));
            input.max = this.navigator.formatDate(new Date(this.timeRange.end));
        }
        let controls = timenav.querySelector('.swac_mediapreview_timecontrols');
        if (controls && input) {
            controls.addEventListener('submit', evt => {
                evt.preventDefault();
                if (input.value)
                    this.onUserNavigation(this.showTimepoint, input.value);
            });
        }

        let bar = timenav.querySelector('.swac_mediapreview_timeaxis_bar');
        if (bar) {
            bar.addEventListener('click', evt => {
                this.onUserNavigation(this.showTimepoint, this.getAxisTime(evt, bar));
            });
            bar.addEventListener('mousemove', this.onAxisHover.bind(this, bar));
            bar.addEventListener('mouseleave', () => {
                let hover = bar.querySelector('.swac_mediapreview_timeaxis_hover');
                if (hover)
                    hover.classList.add('swac_dontdisplay');
            });
        }
        let startElem = timenav.querySelector('.swac_mediapreview_timeaxis_start');
        if (startElem)
            startElem.textContent = new Date(this.timeRange.start).toLocaleString();
        let endElem = timenav.querySelector('.swac_mediapreview_timeaxis_end');
        if (endElem)
            endElem.textContent = new Date(this.timeRange.end).toLocaleString();
        window.addEventListener('resize', () => this.updateTimeNavigation());
    }

    /**
     * Executes a navigation the user started. Playing the pages stops, so the user keeps control.
     *
     * @param {Function} action Navigation function of this component
     * @param {...*} args Arguments for the function
     * @returns {Promise} Resolves when the navigation is done
     */
    onUserNavigation(action, ...args) {
        this.pause();
        return action.apply(this, args);
    }

    /**
     * Prepares the play button and the choice of the speed
     *
     * @param {DOMElement} nav Element of the navigation
     * @returns {undefined}
     */
    initPlay(nav) {
        let playButton = nav.querySelector('.swac_mediapreview_play');
        if (playButton) {
            playButton.addEventListener('click', this.togglePlay.bind(this));
            this.updatePlayButton();
        }
        let speed = nav.querySelector('.swac_mediapreview_playspeed');
        if (!speed)
            return;
        let speeds = this.options.pagePlaySpeeds.slice();
        if (speeds.length === 0) {
            speed.classList.add('swac_dontdisplay');
            return;
        }
        if (!speeds.includes(this.options.pagePlayInterval))
            speeds.push(this.options.pagePlayInterval);
        speeds.sort((a, b) => a - b);
        for (let curSpeed of speeds) {
            let option = document.createElement('option');
            option.value = curSpeed;
            option.textContent = (curSpeed / 1000).toLocaleString() + ' s';
            option.selected = curSpeed === this.options.pagePlayInterval;
            speed.appendChild(option);
        }
        speed.addEventListener('change', () => {
            this.options.pagePlayInterval = parseInt(speed.value);
        });
    }

    /**
     * Starts or stops playing the pages
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
     * Shows the following pages automatically. On the last page it starts with the first page.
     *
     * @returns {Promise} Resolves when the playing ends
     */
    async play() {
        if (this.playing || !this.navigator || !this.navigator.mode)
            return;
        this.playing = true;
        let run = ++this.playRun;
        this.updatePlayButton();
        this.dispatchPlayEvent();
        if (!this.hasNext)
            await this.firstPage();
        while (run === this.playRun) {
            // Each page is shown complete for the interval
            await this.waitForImages();
            if (run !== this.playRun)
                return;
            if (!this.hasNext) {
                this.pause();
                return;
            }
            await new Promise(resolve => {
                this.playTimeout = setTimeout(resolve, this.options.pagePlayInterval);
            });
            if (run !== this.playRun)
                return;
            await this.nextPage();
        }
    }

    /**
     * Stops playing the pages
     *
     * @returns {undefined}
     */
    pause() {
        if (!this.playing)
            return;
        this.playing = false;
        this.playRun++;
        clearTimeout(this.playTimeout);
        this.updatePlayButton();
        this.dispatchPlayEvent();
    }

    /**
     * Shows the state of playing on the play button
     *
     * @returns {undefined}
     */
    updatePlayButton() {
        let playButton = this.requestor.querySelector('.swac_mediapreview_play');
        if (!playButton)
            return;
        // &#xFE0E; shows the play symbol as text instead of an emoji
        playButton.innerHTML = this.playing ? '&#10074;&#10074;' : '&#9654;&#xFE0E;';
        playButton.classList.toggle('uk-button-primary', this.playing);
    }

    /**
     * Informs other components that playing started or stopped
     *
     * @returns {undefined}
     */
    dispatchPlayEvent() {
        document.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_mediapreview_play', {
            detail: {requestor: this.requestor, playing: this.playing}
        }));
    }

    /**
     * Waits until the images of the shown page are loaded
     *
     * @param {Number} maxWait Maximum milliseconds to wait, so that a missing image does not stop playing
     * @returns {Promise} Resolves when the images are loaded
     */
    waitForImages(maxWait = 10000) {
        let loading = [];
        for (let curImg of this.requestor.querySelectorAll('.swac_repeatedForSet .swac_mediapreview_mediaarea img')) {
            if (curImg.complete)
                continue;
            loading.push(new Promise(resolve => {
                curImg.addEventListener('load', resolve, {once: true});
                curImg.addEventListener('error', resolve, {once: true});
            }));
        }
        if (loading.length === 0)
            return Promise.resolve();
        let timeout;
        return Promise.race([
            Promise.all(loading),
            new Promise(resolve => {
                timeout = setTimeout(resolve, maxWait);
            })
        ]).then(() => clearTimeout(timeout));
    }

    /**
     * Shows the page that begins at the given timepoint
     *
     * @param {Date|String} timepoint Date or text like 2026-06-15T02:00:00 (local time)
     * @returns {Promise} Resolves when the page is shown
     */
    async showTimepoint(timepoint) {
        if (!this.navigator || !this.navigator.mode || this.navLoading)
            return;
        if (this.navigator.getAttr() !== this.options.tsAttr) {
            Msg.warn('Mediapreview', 'The shown media are not navigated by timestamp.', this.requestor);
            return;
        }
        let date = timepoint instanceof Date ? timepoint : new Date(timepoint);
        if (isNaN(date.valueOf())) {
            Msg.error('Mediapreview', 'Timepoint >' + timepoint + '< is not a valid date.', this.requestor);
            return;
        }
        let dict = SWAC.lang.dict.Mediapreview;
        let time = date.getTime();
        // Outside of the media the first or last page in the order of time is shown
        let msg = '';
        let edge = null;
        // Timepoints are given in whole seconds, media can have milliseconds
        if (this.timeRange && time < Math.floor(this.timeRange.start / 1000) * 1000) {
            msg = dict.beforefirst;
            edge = this.descending ? 'last' : 'first';
        } else if (this.timeRange && time > this.timeRange.end) {
            msg = dict.afterlast;
            edge = this.descending ? 'first' : 'last';
        }
        if (!edge) {
            // Descending pages go back in time, so they include the whole given second
            let refSet = {};
            refSet[this.options.tsAttr] = new Date(this.descending ? time + 999 : time).toISOString();
            let shown = await this.showPageFrom(refSet);
            if (!shown) {
                // No media after (ascending) or before (descending) the timepoint
                msg = this.descending ? dict.beforefirst : dict.afterlast;
                edge = 'last';
            }
        }
        if (edge)
            await this.showPage(edge);
        this.timeMsg = msg;
        this.updateTimeNavigation();
    }

    /**
     * Shows the page that begins with the given set. Near the end of the media
     * the last full page is shown, it contains the set too.
     *
     * @param {WatchableSet} set Set the page should begin with
     * @returns {Promise<Boolean>} Resolves with true when a page with media was shown
     */
    async showPageFrom(set) {
        let shown = await this.showPage('from', set);
        if (shown && !this.hasNext && this.shownSets.length < this.getPageSize())
            await this.showPage('last');
        return shown;
    }

    /**
     * Shows the page that begins jumpSeconds before or after the first shown medium
     *
     * @param {Number} direction -1 for earlier, 1 for later media
     * @returns {Promise} Resolves when the page is shown
     */
    jump(direction) {
        let first = this.shownSets[0];
        let date = first && this.navigator ? this.navigator.getDate(first) : null;
        if (!date)
            return Promise.resolve();
        return this.showTimepoint(new Date(date.getTime() + direction * this.options.jumpSeconds * 1000));
    }

    /**
     * Shows the first page of media
     *
     * @returns {Promise} Resolves when the page is shown
     */
    firstPage() {
        return this.showPage('first');
    }

    /**
     * Shows the page before the shown media
     *
     * @returns {Promise} Resolves when the page is shown
     */
    prevPage() {
        return this.showPage('prev');
    }

    /**
     * Shows the page after the shown media
     *
     * @returns {Promise} Resolves when the page is shown
     */
    nextPage() {
        return this.showPage('next');
    }

    /**
     * Shows the last page of media
     *
     * @returns {Promise} Resolves when the page is shown
     */
    lastPage() {
        return this.showPage('last');
    }

    /**
     * Switches between the media with timestamp and the media without timestamp
     *
     * @returns {Promise} Resolves when the page is shown
     */
    toggleWithoutTs() {
        if (!this.navigator || this.navigator.mode !== 'mixed')
            return Promise.resolve();
        this.navigator.withoutTs = !this.navigator.withoutTs;
        this.navigator.total = null;
        this.loadTotals();
        return this.showPage('first');
    }

    /**
     * Loads and shows a page of media
     *
     * @param {String} which first, prev, next, last or from
     * @param {WatchableSet} fromSet Set the page begins with, only for from
     * @returns {Promise<Boolean>} Resolves with true when a page with media was shown
     */
    async showPage(which, fromSet = null) {
        if (!this.navigator || !this.navigator.mode || this.navLoading)
            return false;
        // Forward in the display goes back in the order when media are shown descending
        let forward = which === 'first' || which === 'next' || which === 'from';
        let direction = forward !== this.descending ? 1 : -1;
        let refSet = null;
        if (which === 'next')
            refSet = this.shownSets[this.shownSets.length - 1];
        else if (which === 'prev')
            refSet = this.shownSets[0];
        else if (which === 'from')
            refSet = fromSet;
        if (which !== 'first' && which !== 'last' && !refSet)
            return false;

        let shown = false;
        this.timeMsg = '';
        this.navLoading = true;
        try {
            this.updateNavigation();
            let page = await this.navigator.loadPage(direction, refSet, which === 'from');
            if (page.sets.length > 0) {
                if (which === 'from') {
                    this.hasPrev = true;
                    this.hasNext = page.more;
                } else if (which === 'first' || which === 'last') {
                    this.hasPrev = which === 'last' && page.more;
                    this.hasNext = which === 'first' && page.more;
                } else {
                    this.hasPrev = which === 'next' || page.more;
                    this.hasNext = which === 'prev' || page.more;
                }
                let sets = this.descending ? page.sets.reverse() : page.sets;
                this.showSets(sets);
                this.checkTimeRange();
                shown = true;
            } else if (which === 'next') {
                this.hasNext = false;
            } else if (which === 'prev') {
                this.hasPrev = false;
            }
        } catch (e) {
            Msg.error('Mediapreview', 'Could not load page: ' + e, this.requestor);
        } finally {
            this.navLoading = false;
            this.updateNavigation();
        }
        return shown;
    }

    /**
     * Uses the time of the first and last medium to know if there are pages before and after the shown one
     *
     * @returns {undefined}
     */
    checkTimeRange() {
        if (!this.timeRange || this.navigator.getAttr() !== this.options.tsAttr)
            return;
        let times = this.shownSets.map(curSet => this.navigator.getDate(curSet).getTime());
        let earlier = Math.min(...times) > this.timeRange.start;
        let later = Math.max(...times) < this.timeRange.end;
        this.hasPrev = this.descending ? later : earlier;
        this.hasNext = this.descending ? earlier : later;
    }

    /**
     * Replaces the shown media
     *
     * @param {WatchableSet[]} sets Sets to show in display order
     * @returns {undefined}
     */
    showSets(sets) {
        let fromName = this.requestor.fromName;
        // removeData() resets the WHERE clause, but it is needed when sets are checked
        let fromWheres = this.requestor.fromWheres;
        if (this.data[fromName])
            this.removeData(fromName);
        this.requestor.fromWheres = fromWheres;
        this.resetFilters();
        this.shownSets = sets;
        // Sets added this way are not checked by checkAcceptSet()
        this.addData(fromName, sets);
        for (let curRepeated of this.requestor.querySelectorAll('.swac_repeatedForSet')) {
            this.toggleMediaEditorButtons(curRepeated);
        }
    }

    /**
     * Removes the filter controls of the shown media, they are built again for the new media
     *
     * @returns {undefined}
     */
    resetFilters() {
        let filterarea = this.requestor.querySelector('.swac_mediapreview_filterarea');
        if (filterarea) {
            for (let curAttrElem of filterarea.querySelectorAll('.swac_mediapreview_filterattr:not(.swac_dontdisplay)')) {
                curAttrElem.remove();
            }
        }
        this.filters = {};
        this.filtersBuildHistory = {};
    }

    /**
     * Updates buttons and page information of the navigation
     *
     * @returns {undefined}
     */
    updateNavigation() {
        let nav = this.requestor.querySelector('.swac_mediapreview_nav');
        if (!nav || !this.navigator)
            return;
        let atStart = this.navLoading || !this.hasPrev;
        let atEnd = this.navLoading || !this.hasNext;
        let states = {first: atStart, prev: atStart, next: atEnd, last: atEnd};
        for (let curName in states) {
            let button = nav.querySelector('.swac_mediapreview_' + curName);
            if (button)
                button.disabled = states[curName];
        }

        let info = nav.querySelector('.swac_mediapreview_pageinfo');
        if (info)
            info.textContent = this.getPageInfo();

        let withoutTs = nav.querySelector('.swac_mediapreview_withoutts');
        if (withoutTs) {
            let show = this.options.showWithoutTs && this.navigator.mode === 'mixed';
            withoutTs.classList.toggle('swac_dontdisplay', !show);
            withoutTs.classList.toggle('uk-button-primary', this.navigator.withoutTs);
            withoutTs.disabled = this.navLoading;
            let count = this.navigator.withoutTsCount;
            withoutTs.textContent = SWAC.lang.dict.Mediapreview.withoutts + (count !== null ? ' (' + count + ')' : '');
        }
        this.updateTimeNavigation();
    }

    /**
     * Updates the navigation by time: buttons, timepoint, message and time axis
     *
     * @returns {undefined}
     */
    updateTimeNavigation() {
        let timenav = this.requestor.querySelector('.swac_mediapreview_timenav');
        if (!timenav || !this.navigator)
            return;
        let active = this.options.timeNavigation && this.timeRange !== null
                && this.navigator.getAttr() === this.options.tsAttr;
        timenav.classList.toggle('swac_dontdisplay', !active);
        if (!active)
            return;
        for (let curButton of timenav.querySelectorAll('.swac_mediapreview_timecontrols button')) {
            curButton.disabled = this.navLoading;
        }
        let msgElem = timenav.querySelector('.swac_mediapreview_timemsg');
        if (msgElem)
            msgElem.textContent = this.timeMsg;

        let times = this.shownSets.map(curSet => this.navigator.getDate(curSet)).filter(curDate => curDate)
                .map(curDate => curDate.getTime());
        let input = timenav.querySelector('.swac_mediapreview_timepoint');
        if (input && !this.navLoading && times.length > 0)
            input.value = this.navigator.formatDate(new Date(times[0]));

        let bar = timenav.querySelector('.swac_mediapreview_timeaxis_bar');
        if (!bar)
            return;
        let duration = Math.max(this.timeRange.end - this.timeRange.start, 1);
        let pageElem = bar.querySelector('.swac_mediapreview_timeaxis_page');
        if (pageElem && times.length > 0) {
            let min = Math.min(...times);
            let max = Math.max(...times);
            pageElem.style.left = ((min - this.timeRange.start) / duration * 100) + '%';
            pageElem.style.width = ((max - min) / duration * 100) + '%';
        }
        // Labels are created again when the width changed
        let width = bar.offsetWidth;
        if (width > 0 && width !== this.axisWidth) {
            this.axisWidth = width;
            this.createAxisTicks(timenav.querySelector('.swac_mediapreview_timeaxis_ticks'), width);
        }
    }

    /**
     * Creates the labels of the time axis at full local times, e.g. full hours or days
     *
     * @param {DOMElement} ticksElem Element where to create the labels
     * @param {Number} width Width of the time axis in pixel
     * @returns {undefined}
     */
    createAxisTicks(ticksElem, width) {
        if (!ticksElem)
            return;
        ticksElem.innerHTML = '';
        let start = this.timeRange.start;
        let duration = this.timeRange.end - start;
        if (duration <= 0)
            return;
        // Smallest interval that leaves enough space for each label
        let maxLabels = Math.max(Math.floor(width / 80), 1);
        let minutes = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080];
        let interval = minutes.map(curMin => curMin * 60000).find(curInterval => duration / curInterval <= maxLabels);
        if (!interval)
            interval = Math.ceil(duration / maxLabels / 604800000) * 604800000;
        // Start at a full interval of the local time, e.g. a full hour
        let offset = new Date(start).getTimezoneOffset() * 60000;
        let first = Math.ceil((start - offset) / interval) * interval + offset;
        for (let time = first; time <= this.timeRange.end; time += interval) {
            let percent = (time - start) / duration * 100;
            // Labels at the edges would be cut off
            if (percent < 3 || percent > 97)
                continue;
            let date = new Date(time);
            let label = document.createElement('span');
            label.classList.add('swac_mediapreview_timeaxis_tick');
            label.textContent = interval >= 86400000 ? date.toLocaleDateString() : date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
            label.style.left = percent + '%';
            ticksElem.appendChild(label);
        }
    }

    /**
     * Calculates the time at the mouse position on the time axis
     *
     * @param {MouseEvent} evt Mouse event on the time axis
     * @param {DOMElement} bar Element of the time axis
     * @returns {Date} Time at the mouse position
     */
    getAxisTime(evt, bar) {
        let rect = bar.getBoundingClientRect();
        let ratio = Math.min(Math.max((evt.clientX - rect.left) / rect.width, 0), 1);
        return new Date(this.timeRange.start + ratio * (this.timeRange.end - this.timeRange.start));
    }

    /**
     * Shows the time under the mouse on the time axis
     *
     * @param {DOMElement} bar Element of the time axis
     * @param {MouseEvent} evt Mouse event
     * @returns {undefined}
     */
    onAxisHover(bar, evt) {
        let hover = bar.querySelector('.swac_mediapreview_timeaxis_hover');
        if (!hover)
            return;
        let rect = bar.getBoundingClientRect();
        hover.style.left = (evt.clientX - rect.left) + 'px';
        hover.textContent = this.getAxisTime(evt, bar).toLocaleString();
        hover.classList.remove('swac_dontdisplay');
    }

    /**
     * Formats a duration for the jump buttons
     *
     * @param {Number} seconds Duration in seconds
     * @returns {String} Text like 1 h, 30 min or 20 s
     */
    formatDuration(seconds) {
        if (seconds % 3600 === 0)
            return (seconds / 3600) + ' h';
        if (seconds % 60 === 0)
            return (seconds / 60) + ' min';
        return seconds + ' s';
    }

    /**
     * Creates the description of the shown page
     *
     * @returns {String} Text like 15.06.2026, 00:00:06 – 00:03:57 · 24 of 201 media
     */
    getPageInfo() {
        let dict = SWAC.lang.dict.Mediapreview;
        if (this.navLoading)
            return dict.loading;
        if (this.shownSets.length === 0)
            return dict.nomedia;
        let first = this.shownSets[0];
        let last = this.shownSets[this.shownSets.length - 1];
        let range;
        let firstDate = this.navigator.getDate(first);
        let lastDate = this.navigator.getDate(last);
        if (this.navigator.getAttr() === this.options.tsAttr && firstDate && lastDate) {
            range = firstDate.toLocaleString();
            if (firstDate.toDateString() === lastDate.toDateString())
                range += ' – ' + lastDate.toLocaleTimeString();
            else
                range += ' – ' + lastDate.toLocaleString();
        } else {
            let attr = this.navigator.getAttr();
            range = (attr === 'id' ? dict.number + ' ' : attr + ' ') + first[attr] + ' – ' + last[attr];
        }
        let count = this.shownSets.length;
        if (this.navigator.total !== null)
            count += ' ' + dict.of + ' ' + this.navigator.total;
        return range + ' · ' + count + ' ' + dict.media;
    }

    /**
     * Prepares the big view of the images
     *
     * @returns {undefined}
     */
    initBigView() {
        let bigView = this.requestor.querySelector('.swac_mediapreview_bigview');
        if (!bigView || !bigView.querySelector('.swac_mediapreview_bigviewarea')) {
            Msg.warn('Mediapreview', 'The template has no element .swac_mediapreview_bigview with .swac_mediapreview_bigviewarea. Big view is not available.', this.requestor);
            return;
        }
        this.bigViewElem = bigView;
        // UIkit moves the modal to the end of the page, so the element is kept here
        bigView.addEventListener('hidden', evt => {
            // Events of tooltips inside the big view bubble up too
            if (evt.target === bigView)
                this.onBigViewHidden();
        });
    }

    /**
     * Opens the big view when the image of a set is clicked
     *
     * @param {WatchableSet} set Set whose preview was created
     * @returns {undefined}
     */
    addBigViewClick(set) {
        if (!this.isImage(set))
            return;
        let repeated = this.requestor.querySelector('[swac_setid="' + set.id + '"]');
        let mediaarea = repeated ? repeated.querySelector('.swac_mediapreview_mediaarea') : null;
        if (!mediaarea)
            return;
        mediaarea.addEventListener('click', evt => {
            evt.preventDefault();
            this.openBigView(set);
        });
    }

    /**
     * Checks if a set contains an image, the big view can only show images
     *
     * @param {WatchableSet} set Set to check
     * @returns {Boolean} True if the mimetype is an image type
     */
    isImage(set) {
        return typeof set.mimetype === 'string' && set.mimetype.startsWith('image/');
    }

    /**
     * Opens the big view with the images of the shown page, beginning with the given set
     *
     * @param {WatchableSet} set Set of the clicked image
     * @returns {Promise} Resolves when the images are shown
     */
    async openBigView(set) {
        // The big view has its own playing
        this.pause();
        let sets;
        if (this.navigator && this.navigator.mode) {
            sets = this.shownSets.slice();
        } else {
            sets = this.data[this.requestor.fromName].getSets().filter(curSet => curSet);
        }
        sets = sets.filter(curSet => this.isImage(curSet));
        UIkit.modal(this.bigViewElem).show();
        let collage;
        try {
            collage = await this.getBigViewCollage();
        } catch (e) {
            Msg.error('Mediapreview', 'Could not create the big view: ' + e, this.requestor);
            return;
        }
        // The collage navigates by timestamp only if all shown images have one
        collage.hasTs = sets.length > 0 && sets.every(curSet => curSet[this.options.tsAttr]);
        collage.sortImages(sets);
        let index = sets.findIndex(curSet => curSet.id === set.id);
        this.bigViewLastSet = null;
        collage.showImages(sets, Math.max(index, 0));
        let strip = collage.requestor.querySelector('.swac_collage_strip');
        if (strip)
            strip.focus({preventScroll: true});
    }

    /**
     * Gets the Collage component of the big view. It is created on the first call.
     *
     * @returns {Promise<Collage>} Collage component
     */
    async getBigViewCollage() {
        if (this.bigViewCollage)
            return this.bigViewCollage;
        let elem = document.createElement('div');
        elem.id = this.requestor.id + '_bigview';
        // Same data source and WHERE clause, the collage navigates itself
        let wheres = [];
        for (let curWhere in this.baseWheres) {
            if (['order', 'size', 'page'].includes(curWhere))
                continue;
            if (curWhere === 'filter') {
                for (let curFilter of this.baseWheres.filter.split('&filter=')) {
                    wheres.push('filter=' + curFilter);
                }
            } else {
                wheres.push(curWhere + '=' + this.baseWheres[curWhere]);
            }
        }
        wheres.push('order=id,ASC');
        wheres.push('size=' + this.getPageSize());
        elem.setAttribute('swa', 'Collage FROM ' + this.requestor.fromName + ' WHERE ' + wheres.join(' AND '));
        window[elem.id + '_options'] = Object.assign({
            mode: 'timeline',
            pageSize: this.getPageSize(),
            pathAttr: this.options.pathAttr,
            tsAttr: this.options.tsAttr,
            docroot: this.options.docroot
        }, this.options.bigViewOptions);
        this.bigViewElem.querySelector('.swac_mediapreview_bigviewarea').appendChild(elem);
        document.addEventListener('swac_' + elem.id + '_collage_select', evt => {
            this.bigViewLastSet = evt.detail.set;
        });
        await new ViewHandler().load(elem);
        // Let the collage show its own first images before they are replaced
        await new Promise(resolve => setTimeout(resolve, 0));
        this.bigViewCollage = elem.swac_comp;
        return this.bigViewCollage;
    }

    /**
     * Stops the playback and shows the page with the last image of the big view
     *
     * @returns {undefined}
     */
    onBigViewHidden() {
        if (!this.bigViewCollage)
            return;
        this.bigViewCollage.pause();
        let set = this.bigViewLastSet;
        if (!set || !this.navigator || !this.navigator.mode)
            return;
        if (this.shownSets.some(curSet => curSet.id === set.id))
            return;
        this.showPageFrom(set);
    }

    /**
     *  Activate or deactivates mediaeditor button depending on the mediaeditor option.
     *
     * @param {DOMElement} root Element that contains the buttons, default is the whole component
     * @returns {undefined}
     */
    toggleMediaEditorButtons(root = this.requestor) {
        let mediaeditorButtons = root.querySelectorAll('.swac_mediapreview_editbutton');
        if (this.options.onClickMediaEdit) {
            Msg.info('Mediapreview', 'Action for click on edit button is set. Activateing edit buttons.', this.requestor);
            for (let curMeButton of mediaeditorButtons) {
                curMeButton.classList.remove('swac_dontdisplay');
                curMeButton.addEventListener('click', this.options.onClickMediaEdit.bind(this), false);
            }
        } else {
            Msg.info('Mediapreview', 'Action for click on edit button is not set. Deactivateing edit buttons.', this.requestor);
            for (let curMeButton of mediaeditorButtons) {
                curMeButton.classList.add('swac_dontdisplay');
            }
        }
    }

    /**
     * Function for createing media code
     * 
     * @param {Object} set Set with media information
     * @returns {undefined}
     */
    createPreview(set) {
        // Find area where to insert the mediacode
        let mediaarea = this.requestor.querySelector('[swac_setid="' + set.id + '"]');
        if (mediaarea === null) {
            Msg.error('Mediapreview', 'Repeated element for set >' + set.id + '< not found.', this.requestor);
            return null;
        }

        let mediaprearea = mediaarea.querySelector('.swac_mediapreview_mediaarea');

        // Use preview mediatype if available
        let mimetype = 'mimetype';
        if (set.preview_mimetype) {
            mimetype = 'preview_mimetype';
        }

        // Use href to mediaeditor if available
        if (this.options.hrefToMediaeditor != '') {
            if (this.options.hrefToMediaeditor.indexOf('?') === -1) {
                mediaprearea.href = this.options.hrefToMediaeditor + '?id=' + set.id;
            } else {
                mediaprearea.href = this.options.hrefToMediaeditor + '&id=' + set.id;
            }
        }

        // Use mediaEditor

        let mediacode = new Mediacode(this.data, set, this.options.pathAttr, mimetype, this.options.docroot);

//        
//        let mediacode;
//        // Call type depending preview insertion methods
//        if (mimetype.indexOf('image/') !== -1) {
//            mediacode = this.createImageCode(set);
//        } else if (set.mimetype.indexOf('video/') !== -1) {
//            mediacode = this.createVideoCode(set);
//        } else if(mimetype.indexOf('text/html')) {
//        } else if (mimetype.indexOf('application/wavefront-obj') !== -1) {
//            mediacode = this.createObjCode(set);
//        } else if (mimetype.indexOf('application/wavefront-mtl') !== -1) {
//            mediacode = this.createMtlCode(set);
//            // Support for gltf binary format (glb)
//        } else if (mimetype.indexOf('model/gltf+json') !== -1) {
//            mediacode = this.showGltfSingleFile(set);
//        } else if (mimetype.indexOf('model/gltf+json') !== -1) {
//            // Support for gltf format (only in combination with bin)
//            mediacode = this.loadGlTF(set);
//        } else if (mimetype.indexOf('model/gltf+binary') !== -1) {
//            mediacode = this.loadBin(set);
//        } else {
//            Msg.error('Mediapreview',
//                    'Mimetype >' + set.mimetype + '< is not supported.');
//        }
        mediaprearea.appendChild(mediacode.getMediaElement());

        // Add informations for filter if filter active
        if (this.options.filteractive) {
            // Add as data attributes for filter and searching
            for (let curAttr in set) {
                // Do not allow filtering after preview or id (its for each set different)
                if (curAttr !== 'preview' && curAttr !== 'id'
                        && !curAttr.startsWith('swac_')
                        && typeof set[curAttr] !== 'function') {
                    let curValue = set[curAttr];
                    mediaarea.setAttribute(curAttr, curValue);
                    // Creater filter attribute
                    if (!this.filters[curAttr]) {
                        this.filters[curAttr] = new Map();
                    }
                    // Create filter value
                    let count = this.filters[curAttr].get(curValue);
                    if (!count) {
                        count = 0;
                    }
                    count++;
                    this.filters[curAttr].set(curValue, count);

                    const filterAttrElem = this.buildFilter(curAttr);
                    if (filterAttrElem)
                        this.buildFilterControl(filterAttrElem, curAttr, curValue);
                }
            }
        }
    }

    /**
     * Creates code for display obj files
     * DEVNOTE: Not completed yet
     * 
     * @param {type} data
     * @param {type} title
     * @returns {undefined}
     */
    showObj(data, title) {

        $('#mediapreview li:last div').attr('id', title);

//	var obj2gltf = require('obj2gltf');
//obj2gltf('model.obj')
//    .then(function(gltf) {
//       console.log(gltf.asset);
//    });

        this.lastObjFile = data;

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);

        var renderer = new THREE.WebGLRenderer();
        renderer.setSize(200, 200);

        var container = document.createElement('div');
        container.id = title;
        container.className = 'mediapreview';
        $('#mediapreview li:last div').append(container);
        container.appendChild(renderer.domElement);

        camera.position.z = 15;

        // Load obj file
        var loader = new THREE.OBJLoader();
        loader.load(
                data,
                function (object) {
                    scene.add(object);
                }
        );

        // Add direct light
        var dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(100, 100, 50);
        scene.add(dirLight);

        var render = function () {
            requestAnimationFrame(render);
            renderer.render(scene, camera);
        };

        render();
    }

    showObjWithMtl(objFile, mtlFile) {
        alert('Sorry no support for obj with mtl file until now.');
    }

    /**
     * Shows an glTF File in preview
     * DEV NOTE: Not up to date code
     */
    loadGlTF(data, title) {
        // Decode glTFFileContent from base64 encoding
        this.lastGlTFFileContent = data;
        this.lastGlTFFileContent = atob(this.lastGlTFFileContent.replace("data:application/octet-stream;base64,", ""));

        // Show uploaded glTF if bin data is embedded
        if (this.lastGlTFFileContent.indexOf('"uri": "data:application/octet-stream;base64,') !== -1) {
            this.showGltfSingleFile(data, title);
        } else {
            this.lastGlTFFile = glTFFile;

            // Create upload placeholder
            $('#mediapreview li:last div').attr('id', mediapreview.lastGlTFFile.name.replace('.', '_'));
            $('#mediapreview li:last div').css('font-size', '250%');
            $('#mediapreview li:last div').html('.gltf');
        }

        // Show uploaded glTF if bin is allready uploaded
        if (this.lastBinFile !== null) {
            this.showGlTFWithBin();
        }
    }

    urltoFile(url, filename, mimeType) {
        return (fetch(url)
                .then(function (res) {
                    return res.arrayBuffer();
                })
                .then(function (buf) {
                    return new File([buf], filename, {type: mimeType});
                })
                );
    }

    /**
     * Creates an preview for an glb (gltf binary format) and embedded gltf file
     * 
     * DEV NOTE: Not up to date code
     */
    showGltfSingleFile(data, title) {
        $('#mediapreview li:last div').attr('id', 'cesium_' + title.replace('.', '_') + '_Container');
        $('#mediapreview li:last div').addClass('mediapreview');

        // Create viewer instance
        var viewer = new Cesium.Viewer('cesium_' + title.replace('.', '_') + '_Container', {
            imageryProvider: Cesium.createOpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/'
            }),
            baseLayerPicker: false,
            fullscreenButton: false,
            geocoder: false,
            homeButton: false,
            infoBox: false,
            sceneModePicker: false,
            selectionIndicator: false,
            timeline: false,
            navigationHelpButton: false,
            navigationInstructionsInitiallyVisible: false,
            scene3DOnly: true
        });

        // Enable lighting otherwise some models contain dark
        viewer.scene.globe.enableLighting = true;

        var position = Cesium.Cartesian3.fromDegrees(8.904158, 52.296365, 0.0);
        var heading = Cesium.Math.toRadians(135);
        var pitch = 0;
        var roll = 0;
        var hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        var orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

        var entity = viewer.entities.add({
            name: title.replace('.', '_'),
            position: position,
            orientation: orientation,
            model: {
                uri: data,
                minimumPixelSize: 128,
                maximumScale: 20000
            }
        });
        viewer.trackedEntity = entity;

        $('.cesium-viewer-animationContainer').css('display', 'none');
    }

    /**
     * Creates an placeholder for uploaded bin file
     * DEV NOTE: Not up to date code
     */
    loadBin(binFile) {
        this.lastBinFile = binFile;
        $('#mediapreview li:last div').attr('id', mediapreview.lastBinFile.name.replace('.', '_'));
        $('#mediapreview li:last div').css('font-size', '250%');
        $('#mediapreview li:last div').html('.bin');

        // Show uploaded binFile if glTF is allready uploaded
        if (this.lastGlTFFile !== null) {
            this.showGlTFWithBin();
        }
    }

    /**
     * Show gltf with extra bin file.
     * DEV NOTE: Not up to date code
     */
    showGlTFWithBin() {
        // Remove placeholder for uploaded single files
        $('#' + this.lastGlTFFile.name.replace('.', '_')).parent().remove();
        $('#' + this.lastBinFile.name.replace('.', '_')).parent().remove();

        var htmlGrid = "<li class=\"uk-grid-margin\"><div class=\"uk-panel uk-panel-box\">";
        htmlGrid += '<div class="uk-card uk-card-default uk-card-body">';
        htmlGrid += '<div id="cesium_' + this.lastGlTFFile.name.replace('.', '_') + '_Container"></div>';
        htmlGrid += "</div>";
        htmlGrid += "</li>";
        $('#mediapreview').append(htmlGrid);

        var viewer = new Cesium.Viewer('cesium_' + mediapreview.lastGlTFFile.name.replace('.', '_') + '_Container', {
            imageryProvider: Cesium.createOpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/'
            }),
            baseLayerPicker: false,
            fullscreenButton: false,
            geocoder: false,
            homeButton: false,
            infoBox: false,
            sceneModePicker: false,
            selectionIndicator: false,
            timeline: false,
            navigationHelpButton: false,
            navigationInstructionsInitiallyVisible: false,
            scene3DOnly: true
        });

        // Enable lighting otherwise some models contain dark
        viewer.scene.globe.enableLighting = true;

        var position = Cesium.Cartesian3.fromDegrees(8.904158, 52.296365, 0.0);
        var heading = Cesium.Math.toRadians(135);
        var pitch = 0;
        var roll = 0;
        var hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        var orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

        var gltf_bloburl = window.URL.createObjectURL(this.lastGlTFFile);
        //console.log("gltf_bloburl: " + gltf_bloburl);

        var entity = viewer.entities.add({
            name: this.lastGlTFFile.name.replace('.', '_'),
            position: position,
            orientation: orientation,
            model: {
                uri: this.lastGlTFFileContent,
                minimumPixelSize: 128,
                maximumScale: 20000
            }
        });
        viewer.trackedEntity = entity;

        $('.cesium-viewer-animationContainer').css('display', 'none');

        this.lastGlTFFile = null;
        this.lastGlTFFileContent = '';
        this.lastBinFile = null;
    }

    /**
     * Builds the filter for given filter attribute
     * 
     * Checks if the filter attribute is already build and if not, builds it
     * 
     * @param {*} curFilterAttr 
     * @returns 
     */
    buildFilter(curFilterAttr) {
        let filterarea = this.requestor.querySelector('.swac_mediapreview_filterarea');
        let filterattrElem = filterarea.querySelector('.swac_mediapreview_filterattr');

        if (!this.filtersBuildHistory[curFilterAttr]) {

            let curFilterAttrElem = filterattrElem.cloneNode(true);
            curFilterAttrElem.classList.remove('swac_dontdisplay');
            curFilterAttrElem.classList.add('swac_mediapreview_filterattrname_' + curFilterAttr);
            let curFilterNameElem = curFilterAttrElem.querySelector('.swac_mediapreview_filterattrname');
            curFilterNameElem.innerHTML = curFilterAttr;
            let filterValueElem = curFilterAttrElem.querySelector('[uk-filter-control]');

            // Add filter control for elements with this attribute missing
            let misFilterValueElem = filterValueElem.cloneNode(true);
            misFilterValueElem.setAttribute('uk-filter-control', "filter: :not([" + curFilterAttr + "]); group: " + curFilterAttr);
            let filterDivUlLiA = misFilterValueElem.querySelector('a');
            filterDivUlLiA.innerHTML = SWAC.lang.dict.Mediapreview.filterwithout;
            filterValueElem.parentNode.insertBefore(misFilterValueElem, filterValueElem);

            // Remove template
            filterValueElem.parentNode.removeChild(filterValueElem);
            filterattrElem.parentNode.appendChild(curFilterAttrElem);

            this.filtersBuildHistory[curFilterAttr] = new Map();

            return curFilterAttrElem;
        }

        return filterarea.querySelector('.swac_mediapreview_filterattrname_' + curFilterAttr);

    }

    /**
     * Build the filter controls for a specific filter value
     * 
     * Checks if filter value is already build and if not, builds it
     * @param {*} filterAttrElem 
     * @param {*} curFilterAttr 
     * @param {*} curFilterValue 
     * @returns 
     */
    buildFilterControl(filterAttrElem, curFilterAttr, curFilterValue) {
        if (!this.filtersBuildHistory[curFilterAttr].get(curFilterValue)) {

            let misFilterValueElem = filterAttrElem.querySelector('[uk-filter-control]');


            if (typeof curFilterValue === 'string' && curFilterValue.indexOf('ref://') === 0) {
                if (typeof this.filterrefers[curFilterValue] === 'undefined') {
                    let refObjPromise = Model.getFromReference(curFilterValue);
                    this.filterrefers[curFilterValue] = refObjPromise;
                    refObjPromise.then(function (data) {
                        let refLink = document.querySelector('[filterval="' + data.referencedBy + '"]');
                        refLink.innerHTML = data.name;
                    });
                }
            }
            let curFilterValueElem = misFilterValueElem.cloneNode(true);
            curFilterValueElem.setAttribute('uk-filter-control', "filter: [" + curFilterAttr + "='" + curFilterValue + "']; group: " + curFilterAttr);
            let filterDivUlLiA = curFilterValueElem.querySelector('a');
            filterDivUlLiA.setAttribute('filterval', curFilterValue);
            filterDivUlLiA.innerHTML = curFilterValue;
            misFilterValueElem.parentNode.insertBefore(curFilterValueElem, misFilterValueElem);

            this.filtersBuildHistory[curFilterAttr].set(curFilterValue, true);
            return
        }
    }
}