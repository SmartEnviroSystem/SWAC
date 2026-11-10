import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';
import Model from '../../Model.js';

/**
 * Selects a dataset (e.g. a device) and an attribute of the collection that
 * dataset references (e.g. a measured value).
 *
 * The selectable datasets come from the FROM clause of the requestor. When a
 * dataset is selected, the definition of its collection is loaded over the
 * Model, so the attributes always match the selected dataset.
 *
 * Datasets need the attributes id, name and data_collection. Sources using
 * other names can be mapped with the general option attributeRenames.
 */
export default class Dataselect extends View {

    constructor(options = {}) {
        super(options);
        this.name = 'Dataselect';
        this.desc.text = 'Selects a dataset (e.g. a device) and an attribute of the collection the dataset references (e.g. a measured value). The attributes are loaded from the data source whenever the selected dataset changes.';
        this.desc.developers = 'WebEng 2026/2027 Thema 3 (HSBI)';
        this.desc.license = 'GNU Lesser General Public License';

        this.desc.templates[0] = {
            name: 'dataselect',
            desc: 'Selectboxes for dataset, attribute and time attribute in one row. The visible fields share the width the page gives the component.'
        };
        this.desc.reqPerTpl[0] = {
            selc: '.swac_dataselect_set',
            desc: 'Select element offering the datasets. Needs an option with class swac_repeatForSet.'
        };
        this.desc.reqPerTpl[1] = {
            selc: '.swac_dataselect_attr',
            desc: 'Select element offering the attributes of the selected datasets collection.'
        };
        this.desc.optPerTpl[0] = {
            selc: '.swac_dataselect_attrarea',
            desc: 'Area around the attribute selection, hidden when showAttribute is false.'
        };
        this.desc.optPerTpl[1] = {
            selc: '.swac_dataselect_time',
            desc: 'Select element for the time attribute, used when the collection has no attribute named like defaultTimeAttr.'
        };
        this.desc.optPerTpl[2] = {
            selc: '.swac_dataselect_timearea',
            desc: 'Area around the time attribute selection, only shown when the collection has no attribute named like defaultTimeAttr.'
        };
        this.desc.reqPerSet[0] = {
            name: 'id',
            desc: 'Identifies the dataset.'
        };
        this.desc.reqPerSet[1] = {
            name: 'data_collection',
            desc: 'Name of the collection the dataset references. Map other attribute names with the option attributeRenames.'
        };
        this.desc.optPerSet[0] = {
            name: 'name',
            desc: 'Name shown for the dataset. Map other attribute names with the option attributeRenames.'
        };

        this.desc.opts[0] = {
            name: 'attributeTypes',
            desc: 'Types of attributes offered for selection. null (default) offers all attributes except the time attribute.',
            example: ['int2', 'int4', 'int8', 'float4', 'float8', 'numeric']
        };
        if (typeof options.attributeTypes === 'undefined')
            this.options.attributeTypes = null;
        this.desc.opts[1] = {
            name: 'excludedAttributes',
            desc: 'Attributes never offered for selection.'
        };
        if (!options.excludedAttributes)
            this.options.excludedAttributes = ['id', 'oo_id'];
        this.desc.opts[2] = {
            name: 'defaultTimeAttr',
            desc: 'Name of the time attribute. If the collection has it, it is used without asking. Otherwise the user selects the time attribute.'
        };
        if (!options.defaultTimeAttr)
            this.options.defaultTimeAttr = 'ts';
        this.desc.opts[3] = {
            name: 'showAttribute',
            desc: 'If false only the dataset is selected.'
        };
        if (typeof options.showAttribute === 'undefined')
            this.options.showAttribute = true;
        this.desc.opts[4] = {
            name: 'urlParam',
            desc: 'Name of the URL parameter holding the id of the dataset to preselect. null disables preselection.'
        };
        if (typeof options.urlParam === 'undefined')
            this.options.urlParam = 'oo_id';
        this.desc.opts[5] = {
            name: 'attributeRequired',
            desc: 'If true an attribute has to be selected and is selected automatically when there is only one. If false (default) selecting an attribute is optional.'
        };
        if (typeof options.attributeRequired === 'undefined')
            this.options.attributeRequired = false;

        this.desc.funcs[0] = {
            name: 'getSelection',
            desc: 'Gets the current selection.',
            returns: {
                desc: 'Object with id, set, name, collection, attribute and timeAttr or null if no dataset is selected.',
                type: 'Object'
            }
        };
        this.desc.funcs[1] = {
            name: 'setSelection',
            desc: 'Selects a dataset and optionally an attribute.',
            params: [
                {name: 'id', desc: 'Id of the dataset to select', type: 'String'},
                {name: 'attribute', desc: 'Name of the attribute to select (optional)', type: 'String'}
            ],
            returns: {
                desc: 'Promise that resolves when the attributes are loaded.',
                type: 'Promise'
            }
        };

        this.desc.events[0] = {
            name: 'swac_REQUESTOR_ID_dataselect_changed',
            desc: 'Fired when the dataset, the attribute or the time attribute changed. When the dataset changed, the event is fired after its attributes are loaded.',
            data: 'Delivers the new selection (in selection, see getSelection()) and what changed (in changed: set, attribute or timeattr).'
        };

        // Internal attributes
        this.sets = new Map();
        this.pendingAttribute = null;
        this.loadingCollection = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            this.setSelect = this.requestor.querySelector('.swac_dataselect_set');
            this.attrSelect = this.requestor.querySelector('.swac_dataselect_attr');
            this.timeSelect = this.requestor.querySelector('.swac_dataselect_time');
            if (!this.setSelect || !this.attrSelect) {
                Msg.error('Dataselect', 'The template needs the elements .swac_dataselect_set and .swac_dataselect_attr.', this.requestor);
                resolve();
                return;
            }

            let attrArea = this.requestor.querySelector('.swac_dataselect_attrarea');
            if (attrArea && !this.options.showAttribute)
                attrArea.hidden = true;
            this.showTimeArea(false);

            // Transfer required attribute from SWA-Statement to the dataset selection (allows browser check of required inputs)
            if (this.requestor.hasAttribute('required'))
                this.setSelect.required = true;
            if (this.options.attributeRequired && this.options.showAttribute)
                this.attrSelect.required = true;

            this.setSelect.addEventListener('change', this.onSetChange.bind(this));
            this.attrSelect.addEventListener('change', this.notifyChange.bind(this, 'attribute'));
            if (this.timeSelect)
                this.timeSelect.addEventListener('change', this.notifyChange.bind(this, 'timeattr'));

            // Preselect after the datasets are loaded
            let thisRef = this;
            window.swac.reactions.addReaction(function () {
                thisRef.preselectFromUrl();
            }, this.requestor.id);

            resolve();
        });
    }

    /**
     * Remembers the dataset for getSelection().
     *
     * @param {WatchableSet} set Set that was added
     * @param {DOMElement[]} repeateds Option elements created for the set
     */
    afterAddSet(set, repeateds) {
        this.sets.set(String(set.id), set);
        super.afterAddSet(set, repeateds);
    }

    getText(key, fallback) {
        let dict = SWAC.lang.dict.Dataselect;
        return (dict && dict[key]) || fallback;
    }

    /**
     * Creates an option element.
     *
     * @param {String} value Value of the option
     * @param {String} text Text of the option, fallback if langKey is given
     * @param {String} langKey Key of the text in the language files (optional)
     * @returns {DOMElement} Option element
     */
    createOption(value, text, langKey = null) {
        let option = document.createElement('option');
        option.value = value;
        option.textContent = langKey ? this.getText(langKey, text) : text;
        // Lets SWAC translate the text again when the language is changed
        if (langKey)
            option.setAttribute('swac_lang', 'Dataselect.' + langKey);
        return option;
    }

    showTimeArea(show) {
        let timeArea = this.requestor.querySelector('.swac_dataselect_timearea');
        if (timeArea)
            timeArea.hidden = !show;
    }

    resetAttributes(langKey, fallback) {
        this.attrSelect.innerHTML = '';
        this.attrSelect.appendChild(this.createOption('', fallback, langKey));
        this.attrSelect.disabled = true;
        if (this.timeSelect) {
            this.timeSelect.innerHTML = '';
            this.timeSelect.disabled = true;
        }
        this.showTimeArea(false);
    }

    preselectFromUrl() {
        if (!this.options.urlParam)
            return;
        let id = new URLSearchParams(window.location.search).get(this.options.urlParam);
        if (id && this.sets.has(id) && this.setSelect.value !== id)
            this.setSelection(id);
    }

    /**
     * Loads the attributes of the selected datasets collection.
     *
     * @returns {Promise} Resolves when the attributes are shown
     */
    onSetChange() {
        let set = this.sets.get(this.setSelect.value);
        if (!set) {
            this.loadingCollection = null;
            this.resetAttributes('choosesetfirst', 'Select device first');
            this.notifyChange('set');
            return Promise.resolve();
        }
        let collection = set.data_collection;
        if (!collection) {
            Msg.error('Dataselect', 'Dataset >' + set.id + '< has no attribute >data_collection<.', this.requestor);
            this.resetAttributes('structureerror', 'The data structure could not be loaded.');
            this.notifyChange('set');
            return Promise.resolve();
        }

        this.resetAttributes('loading', 'Loading ...');
        this.loadingCollection = collection;
        let thisRef = this;
        return Model.getValueDefinitions({fromName: collection}).then(function (definitions) {
            // Ignore the answer if another dataset was selected meanwhile
            if (thisRef.loadingCollection !== collection)
                return;
            thisRef.renderAttributes(definitions || []);
            thisRef.notifyChange('set');
        }).catch(function (error) {
            if (thisRef.loadingCollection !== collection)
                return;
            Msg.error('Dataselect', 'Could not load the definition of >' + collection + '<: ' + error, thisRef.requestor);
            thisRef.resetAttributes('structureerror', 'The data structure could not be loaded.');
            thisRef.notifyChange('set');
        });
    }

    /**
     * Fills the attribute and time attribute selection.
     *
     * @param {Object[]} definitions Attribute definitions of the collection
     */
    renderAttributes(definitions) {
        let timeAttr = this.options.defaultTimeAttr;
        let hasTimeAttr = definitions.some(curAttr => curAttr.name === timeAttr);
        let names = [];
        let values = [];
        for (let curAttr of definitions) {
            if (this.options.excludedAttributes.includes(curAttr.name))
                continue;
            names.push(curAttr.name);
            if (curAttr.name === timeAttr)
                continue;
            if (!this.options.attributeTypes || this.options.attributeTypes.includes(curAttr.type))
                values.push(curAttr.name);
        }
        names.sort();
        values.sort();

        this.attrSelect.innerHTML = '';
        if (values.length === 0) {
            this.attrSelect.appendChild(this.createOption('', 'No matching values', 'noattributes'));
        } else {
            if (this.options.attributeRequired)
                this.attrSelect.appendChild(this.createOption('', 'Select measured value', 'chooseattribute'));
            else
                this.attrSelect.appendChild(this.createOption('', 'No column (optional)', 'noattribute'));
            for (let curName of values)
                this.attrSelect.appendChild(this.createOption(curName, curName));
            this.attrSelect.disabled = false;
            if (this.pendingAttribute && values.includes(this.pendingAttribute))
                this.attrSelect.value = this.pendingAttribute;
            else if (this.options.attributeRequired && values.length === 1)
                this.attrSelect.value = values[0];
        }
        this.pendingAttribute = null;

        // The time attribute is used without asking if the collection has it,
        // otherwise the user decides which attribute holds the time
        if (this.timeSelect) {
            this.timeSelect.innerHTML = '';
            if (hasTimeAttr) {
                this.timeSelect.appendChild(this.createOption(timeAttr, timeAttr));
            } else {
                this.timeSelect.appendChild(this.createOption('', 'Select time attribute', 'choosetimeattr'));
                for (let curName of names)
                    this.timeSelect.appendChild(this.createOption(curName, curName));
            }
            this.timeSelect.disabled = hasTimeAttr;
        }
        this.showTimeArea(!hasTimeAttr);
    }

    notifyChange(changed) {
        document.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_dataselect_changed', {
            detail: {
                requestor: this,
                changed: changed,
                selection: this.getSelection()
            },
            bubbles: true
        }));
    }

    getSelection() {
        let set = this.sets.get(this.setSelect.value);
        if (!set)
            return null;
        return {
            id: set.id,
            set: set,
            name: set.name,
            collection: set.data_collection,
            attribute: this.attrSelect.value || null,
            timeAttr: (this.timeSelect && this.timeSelect.value) || null
        };
    }

    setSelection(id, attribute = null) {
        this.setSelect.value = String(id);
        this.pendingAttribute = attribute;
        return this.onSetChange();
    }
}
