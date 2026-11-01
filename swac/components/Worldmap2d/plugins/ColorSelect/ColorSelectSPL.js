import SWAC from '../../../../swac.js';
import Msg from '../../../../Msg.js';
import Plugin from '../../../../Plugin.js';

/*
 * This plugin lets the user choose the attribute that is used for coloring
 * markers and areas. The colors are taken from the datadescription component
 * configured at the map. A legend for the choosen attribute is shown.
 */
export default class ColorSelectSPL extends Plugin {
    constructor(options = {}) {
        super(options);
        this.name = 'Worldmap2d/plugins/ColorSelect';
        this.desc.text = 'Lets the user choose the attribute that is used for coloring markers and areas and shows a legend for it. Needs the datadescription option of the map.';

        this.desc.templates[0] = {
            name: 'colorselect',
            style: 'colorselect',
            desc: 'Default template for ColorSelect'
        };

        this.desc.opts[0] = {
            name: 'attributes',
            desc: 'Names of the attributes the user can choose from. If not set, all attributes with value description (ATTRIBUTENAME.values) in the datadescription are offered.',
            example: ['pm2_5', 'pm10_0']
        };
        if (!options.attributes)
            this.options.attributes = null;

        this.desc.opts[1] = {
            name: 'showLegend',
            desc: 'If true a legend for the choosen attribute is shown below the selection.',
            example: true
        };
        if (typeof options.showLegend === 'undefined')
            this.options.showLegend = true;

        this.desc.opts[2] = {
            name: 'startOpened',
            desc: 'If true the selection is opened when the page is loaded.',
            example: false
        };
        if (typeof options.startOpened === 'undefined')
            this.options.startOpened = false;

        // Attributes for internal usage
        this.map = null;
        this.datadescription = null;
        this.panel = null;
        this.select = null;
        this.info = null;
        this.legend = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            this.map = this.requestor.parent.swac_comp;
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

            this.select.addEventListener('change', () => {
                this.map.setColorAttr(this.select.value ? this.select.value : null);
            });
            document.addEventListener('swac_' + this.requestor.parent.id + '_colorattr_changed', () => {
                this.updateLegend();
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
                this.fillAttributes();
                // Update when the user edits the datadescription
                document.addEventListener('swac_Datadescription_' + ddElem.id + '_changed', () => {
                    this.fillAttributes();
                });
            }, ddElem.id);
            resolve();
        });
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
        this.select.value = this.map.userColorAttr ? this.map.userColorAttr : '';
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

        let attr = this.map.getColorAttr();
        if (!attr) {
            // Coloring from multiple attributes, legend from targetAttr if available
            let comb = this.map.options.colorCombination;
            if (comb && comb.attrs)
                this.info.textContent = this.getText('combined', 'Combined from') + ': '
                        + comb.attrs.join(', ') + ' (' + (comb.mode ? comb.mode : 'max') + ')';
            if (!comb || !comb.targetAttr)
                return;
            attr = comb.targetAttr;
        }
        let desc = this.datadescription.getAttributeDescription(attr);
        if (!desc || !desc.values) {
            this.info.textContent = this.getText('nolegend', 'There is no legend for this attribute.');
            return;
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
