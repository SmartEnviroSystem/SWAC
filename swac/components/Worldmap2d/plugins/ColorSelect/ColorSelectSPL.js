import SWAC from '../../../../swac.js';
import Msg from '../../../../Msg.js';
import Plugin from '../../../../Plugin.js';

/*
 * This plugin bundles everything about coloring markers and areas of the map:
 * - which attribute determines the color (set by the administrator)
 * - the selection of another attribute by the user
 * - the legend for the attribute currently used
 * The colors themselves are always taken from the datadescription component
 * configured at the map. Combined colors are described there too (ATTRIBUTENAME.combine).
 *
 * All options can be given directly in the plugins entry of the map:
 * plugins: new Map([['ColorSelect', {id: 'ColorSelect', active: true, colorAttr: 'irradiance'}]])
 */
export default class ColorSelectSPL extends Plugin {
    constructor(options = {}) {
        super(options);
        this.name = 'Worldmap2d/plugins/ColorSelect';
        this.desc.text = 'Bundles the coloring of markers and areas: the attribute set by the administrator, the selection by the user and the legend. The colors are taken from the datadescription. Needs the datadescription option of the map. Options can be given in the plugins entry of the map.';

        this.desc.templates[0] = {
            name: 'colorselect',
            style: 'colorselect',
            desc: 'Default template for ColorSelect'
        };

        this.desc.opts[0] = {
            name: 'colorAttr',
            desc: 'Name of the attribute whose value determines the color of markers and areas (set by the administrator). If not set, the visuAttribute of the datadescription component is used. For combined colors use an attribute with combine description in the datadescription.',
            example: 'irradiance'
        };
        if (typeof options.colorAttr === 'undefined')
            this.options.colorAttr = null;

        this.desc.opts[1] = {
            name: 'areaColorAttr',
            desc: 'Name of the attribute whose value determines the fill color of the areas around locations (option areaShape of the map). Can be overwritten per dataset with the attribute map_areacolorattr. If not set, the areas are colored like the markers.',
            example: 'cloudcover'
        };
        if (typeof options.areaColorAttr === 'undefined')
            this.options.areaColorAttr = null;

        this.desc.opts[2] = {
            name: 'userSelect',
            desc: 'If true the user can choose the attribute used for coloring. If false only the legend is shown.',
            example: true
        };
        if (typeof options.userSelect === 'undefined')
            this.options.userSelect = true;

        this.desc.opts[3] = {
            name: 'attributes',
            desc: 'Names of the attributes the user can choose from. If not set, all attributes with value description (ATTRIBUTENAME.values) in the datadescription are offered.',
            example: ['pm2_5', 'pm10_0']
        };
        if (!options.attributes)
            this.options.attributes = null;

        this.desc.opts[4] = {
            name: 'showLegend',
            desc: 'If true a legend for the attribute used for coloring is shown. The legend of the datadescription component is hidden then.',
            example: true
        };
        if (typeof options.showLegend === 'undefined')
            this.options.showLegend = true;

        this.desc.opts[5] = {
            name: 'startOpened',
            desc: 'If true the panel is opened when the page is loaded.',
            example: false
        };
        if (typeof options.startOpened === 'undefined')
            this.options.startOpened = false;

        this.desc.funcs[0] = {
            name: 'setUserAttr',
            desc: 'Sets the attribute used for coloring (like a selection of the user) and recolors all markers and areas. Use null to return to the configured coloring.',
            params: [
                {
                    name: 'attr',
                    desc: 'Name of the attribute or null',
                    type: 'String'
                }
            ]
        };
        this.desc.funcs[1] = {
            name: 'getActiveAttr',
            desc: 'Gets the attribute that is currently used for coloring the markers.'
        };

        this.desc.events[0] = {
            name: 'swac_REQUESTOR_ID_colorattr_changed',
            desc: 'Event is fired on the document, when the attribute used for coloring was changed with setUserAttr(). REQUESTOR_ID is the id of the map.',
            data: 'Delivers the name of the new attribute in e.detail.attr (null when the configured coloring is used again).'
        };

        // Attributes for internal usage
        this.map = null;
        this.datadescription = null;
        this.userAttr = null;
        this.panel = null;
        this.select = null;
        this.info = null;
        this.legend = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            this.map = this.requestor.parent.swac_comp;
            this.takeOptionsFromMap();
            // Register at the map, so the map uses this plugin for coloring
            this.map.colorSelect = this;

            let cont = this.requestor.parent.querySelector('.colorselect');
            this.panel = cont.querySelector('.colorselect-panel');
            this.select = cont.querySelector('.colorselect-attr');
            this.info = cont.querySelector('.colorselect-info');
            this.legend = cont.querySelector('.colorselect-legend');

            // Do not move or zoom the map when using the plugin
            L.DomEvent.disableClickPropagation(cont);
            L.DomEvent.disableScrollPropagation(cont);

            cont.querySelector('.colorselect-button').addEventListener('click', () => {
                // Attributes may not be available on first try, when datadescription was loading
                if (this.select.options.length <= 1)
                    this.fillAttributes();
                this.panel.classList.toggle('swac_dontdisplay');
            });
            if (this.options.startOpened)
                this.panel.classList.remove('swac_dontdisplay');
            if (!this.options.userSelect) {
                this.select.classList.add('swac_dontdisplay');
                cont.querySelector('.colorselect-label').classList.add('swac_dontdisplay');
            }

            this.select.addEventListener('change', () => {
                this.setUserAttr(this.select.value ? this.select.value : null);
            });

            // Get datadescription component
            if (!this.map.options.datadescription) {
                Msg.error('ColorSelectSPL', 'The ColorSelect plugin needs the >datadescription< option of the map.', this.requestor);
                cont.classList.add('swac_dontdisplay');
                resolve();
                return;
            }
            let ddElem = document.querySelector(this.map.options.datadescription);
            if (!ddElem) {
                Msg.error('ColorSelectSPL', 'Datadescription component >' + this.map.options.datadescription + '< not found.', this.requestor);
                cont.classList.add('swac_dontdisplay');
                resolve();
                return;
            }
            window.swac.reactions.addReaction(() => {
                this.datadescription = ddElem.swac_comp;
                // Only one legend: the legend of this plugin replaces the one of the datadescription
                if (this.options.showLegend) {
                    this.datadescription.options.showLegend = false;
                    ddElem.classList.add('swac_dontdisplay');
                }
                this.fillAttributes();
                // Markers and areas may be drawn before this plugin was loaded
                this.map.rerenderColors();
                // Update when the user edits the datadescription
                document.addEventListener('swac_Datadescription_' + ddElem.id + '_changed', () => {
                    this.fillAttributes();
                });
            }, ddElem.id);
            resolve();
        });
    }

    /**
     * Takes the options given in the plugins entry of the map
     * (plugins: new Map([['ColorSelect', {id: 'ColorSelect', active: true, colorAttr: ...}]]))
     * so all coloring settings can be made at one place.
     */
    takeOptionsFromMap() {
        let entry = this.map.options.plugins?.get('ColorSelect');
        if (!entry)
            return;
        const ignore = ['id', 'active', 'title', 'pluginname'];
        for (let curOpt in entry) {
            if (!ignore.includes(curOpt))
                this.options[curOpt] = entry[curOpt];
        }
    }

    /**
     * Gets the attribute choosen by the user.
     *
     * @returns {String} Name of the attribute or null
     */
    getUserAttr() {
        return this.userAttr;
    }

    /**
     * Gets the attribute configured by the administrator.
     *
     * @param {Boolean} forArea true to get the attribute for the areas around locations
     * @returns {String} Name of the attribute or null
     */
    getConfiguredAttr(forArea = false) {
        if (forArea && this.options.areaColorAttr)
            return this.options.areaColorAttr;
        return this.options.colorAttr;
    }

    /**
     * Gets the attribute that is currently used for coloring the markers.
     *
     * @returns {String} Name of the attribute
     */
    getActiveAttr() {
        if (this.userAttr)
            return this.userAttr;
        if (this.options.colorAttr)
            return this.options.colorAttr;
        return this.datadescription ? this.datadescription.options.visuAttribute : null;
    }

    /**
     * Sets the attribute used for coloring and recolors all markers and areas.
     *
     * @param {String} attr Name of the attribute, null to use the configured coloring
     */
    setUserAttr(attr = null) {
        this.userAttr = attr ? attr : null;
        if (this.select)
            this.select.value = this.userAttr ? this.userAttr : '';
        this.map.rerenderColors();
        this.updateLegend();
        document.dispatchEvent(new CustomEvent('swac_' + this.requestor.parent.id + '_colorattr_changed', {detail: {attr: this.userAttr}}));
    }

    /**
     * Fills the selection with the attributes that can be used for coloring.
     */
    fillAttributes() {
        if (!this.datadescription)
            return;
        let attrs = this.options.attributes ? this.options.attributes : this.datadescription.getDescribedAttributes();

        // Remove old entries, first entry is the configured coloring
        while (this.select.options.length > 1) {
            this.select.remove(1);
        }
        for (let curAttr of attrs) {
            let desc = this.datadescription.getAttributeDescription(curAttr);
            if (!desc) {
                Msg.warn('ColorSelectSPL', 'There is no description for attribute >' + curAttr + '< in the datadescription.', this.requestor);
                continue;
            }
            let optElem = document.createElement('option');
            optElem.value = curAttr;
            optElem.textContent = desc.txt_title ? desc.txt_title : curAttr;
            this.select.appendChild(optElem);
        }
        this.select.value = this.userAttr ? this.userAttr : '';
        this.updateLegend();
    }

    /**
     * Shows the legend for the attribute that is currently used for coloring.
     */
    updateLegend() {
        this.info.textContent = '';
        this.legend.innerHTML = '';
        if (!this.datadescription || !this.options.showLegend)
            return;

        let attr = this.getActiveAttr();
        let desc = this.datadescription.getAttributeDescription(attr);
        if (!desc || !desc.values) {
            this.info.textContent = this.getText('nolegend', 'There is no legend for this attribute.');
            return;
        }
        // Combined attribute: show from which attributes it is calculated
        if (desc.combine && Array.isArray(desc.combine.attrs)) {
            this.info.textContent = this.getText('combined', 'Combined from') + ': '
                    + desc.combine.attrs.join(', ') + ' (' + (desc.combine.mode ? desc.combine.mode : 'max') + ')';
        }

        if (desc.calcmode === 'gradient') {
            let keys = Object.keys(desc.values).sort((a, b) => Number(a) - Number(b));
            let min = Number(keys[0]);
            let max = Number(keys[keys.length - 1]);
            let stops = keys.map(k => desc.values[k].col + ' ' + (max === min ? 0 : (Number(k) - min) / (max - min) * 100) + '%');
            let liElem = document.createElement('li');
            liElem.classList.add('colorselect-gradiententry');
            let gradElem = document.createElement('div');
            gradElem.classList.add('colorselect-gradient');
            gradElem.style.background = 'linear-gradient(to right, ' + stops.join(', ') + ')';
            liElem.appendChild(gradElem);
            let labelsElem = document.createElement('div');
            labelsElem.classList.add('colorselect-gradient-labels');
            labelsElem.innerHTML = '<span></span><span></span>';
            labelsElem.children[0].textContent = min;
            labelsElem.children[1].textContent = max;
            liElem.appendChild(labelsElem);
            this.legend.appendChild(liElem);
            return;
        }

        for (let curValue in desc.values) {
            let curDef = desc.values[curValue];
            let liElem = document.createElement('li');
            let swatchElem = document.createElement('span');
            swatchElem.classList.add('colorselect-swatch');
            swatchElem.style.background = curDef.col;
            liElem.appendChild(swatchElem);
            let txtElem = document.createElement('span');
            let prefix = desc.calcmode === '<' ? '< ' : '';
            txtElem.textContent = curDef.txt ? curDef.txt : prefix + curValue;
            liElem.appendChild(txtElem);
            this.legend.appendChild(liElem);
        }
    }

    /**
     * Gets a translated text of this plugin.
     *
     * @param {String} key Key of the text
     * @param {String} fallback Text to use if there is no translation
     * @returns {String} Translated text
     */
    getText(key, fallback) {
        return SWAC.lang.dict.Worldmap2d_ColorSelect?.[key] || fallback;
    }
}
