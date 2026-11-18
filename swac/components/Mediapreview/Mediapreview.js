import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';
import Mediacode from '../Mediaplayer/Mediacode.js';
import MediaNavigator from './MediaNavigator.js';

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
    }

    init() {
        return new Promise((resolve, reject) => {
            this.toggleMediaEditorButtons();
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
        // The WHERE clause from the declaration, before loading changes it
        let fromWheres = this.firstDatasource ? this.firstDatasource.fromWheres : this.requestor.fromWheres;
        fromWheres = Object.assign({}, fromWheres);
        let order = fromWheres.order ? fromWheres.order.toLowerCase() : '';
        this.descending = order.endsWith(',desc');
        let pageSize = this.options.pageSize || parseInt(fromWheres.size) || 25;
        this.navigator = new MediaNavigator(this, {
            tsAttr: this.options.tsAttr,
            orderAttr: this.options.orderAttr,
            pageSize: pageSize,
            fromWheres: fromWheres
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
                button.addEventListener('click', buttons[curName].bind(this));
        }

        try {
            await this.navigator.detect();
        } catch (e) {
            Msg.error('Mediapreview', 'Could not detect navigation mode: ' + e, this.requestor);
            this.navigator.mode = null;
            return;
        }
        nav.classList.remove('swac_dontdisplay');
        await this.firstPage();
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
        return this.showPage('first');
    }

    /**
     * Loads and shows a page of media
     *
     * @param {String} which first, prev, next or last
     * @returns {Promise} Resolves when the page is shown
     */
    async showPage(which) {
        if (!this.navigator || !this.navigator.mode || this.navLoading)
            return;
        // Forward in the display goes back in the order when media are shown descending
        let forward = which === 'first' || which === 'next';
        let direction = forward !== this.descending ? 1 : -1;
        let refSet = null;
        if (which === 'next')
            refSet = this.shownSets[this.shownSets.length - 1];
        else if (which === 'prev')
            refSet = this.shownSets[0];
        if ((which === 'next' || which === 'prev') && !refSet)
            return;

        this.navLoading = true;
        try {
            this.updateNavigation();
            let page = await this.navigator.loadPage(direction, refSet);
            if (page.sets.length > 0) {
                if (which === 'first' || which === 'last') {
                    this.hasPrev = which === 'last' && page.more;
                    this.hasNext = which === 'first' && page.more;
                } else {
                    this.hasPrev = which === 'next' || page.more;
                    this.hasNext = which === 'prev' || page.more;
                }
                let sets = this.descending ? page.sets.reverse() : page.sets;
                this.showSets(sets);
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