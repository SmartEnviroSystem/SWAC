import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';
import Model from '../../Model.js';

// Period preset when showPeriod is active
const DEFAULT_PERIOD_DAYS = 30;

/**
 * Formats a date as value for an input of type datetime-local (local time).
 */
function toInputValue(date) {
    let pad = number => String(number).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
            + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

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
        this.desc.optPerTpl[3] = {
            selc: '.swac_dataselect_from',
            desc: 'Input (datetime-local) for the start of the period, used when showPeriod is true.'
        };
        this.desc.optPerTpl[4] = {
            selc: '.swac_dataselect_to',
            desc: 'Input (datetime-local) for the end of the period, used when showPeriod is true.'
        };
        this.desc.optPerTpl[5] = {
            selc: '.swac_dataselect_periodarea',
            desc: 'Areas around the period inputs, shown when showPeriod is true.'
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
            desc: 'Name of the URL parameter holding the id of the dataset to preselect. The parameters attribute, start and end (format 2026-11-25T00:00) preselect the attribute and the period. The URL is kept up to date with the selection, so it can be shared. null disables both.'
        };
        if (typeof options.urlParam === 'undefined')
            this.options.urlParam = 'oo_id';
        this.desc.opts[5] = {
            name: 'attributeRequired',
            desc: 'If true an attribute has to be selected and is selected automatically when there is only one. If false (default) selecting an attribute is optional.'
        };
        if (typeof options.attributeRequired === 'undefined')
            this.options.attributeRequired = false;
        this.desc.opts[6] = {
            name: 'showPeriod',
            desc: 'If true the user also selects a period (from and till, preset to the last ' + DEFAULT_PERIOD_DAYS + ' days). Both are required and from has to be before till.'
        };
        if (typeof options.showPeriod === 'undefined')
            this.options.showPeriod = false;
        this.desc.opts[7] = {
            name: 'multiple',
            desc: 'If true several datasets can be selected. Only attributes all their collections have are offered. The URL parameter holds the ids separated by commas.'
        };
        if (typeof options.multiple === 'undefined')
            this.options.multiple = false;
        this.desc.opts[8] = {
            name: 'filterAttribute',
            desc: 'Attribute of the collections holding the id of the dataset, for collections several datasets share. getSelection() delivers a matching filter (neoeq, so collections without the attribute are not filtered). null disables the filter.'
        };
        if (typeof options.filterAttribute === 'undefined')
            this.options.filterAttribute = 'oo_id';

        this.desc.funcs[0] = {
            name: 'getSelection',
            desc: 'Gets the current selection.',
            returns: {
                desc: 'Object with id, set, name, collection, filter (of the first selected dataset), sets (all selected datasets, each with id, set, name, collection, filter), attribute, timeAttr, from and to (from and to as local datetime strings like 2026-10-01T00:00, null without showPeriod) or null if no dataset is selected.',
                type: 'Object'
            }
        };
        this.desc.funcs[1] = {
            name: 'setSelection',
            desc: 'Selects a dataset and optionally an attribute.',
            params: [
                {name: 'id', desc: 'Id of the dataset to select, with option multiple also a list of ids', type: 'String|String[]'},
                {name: 'attribute', desc: 'Name of the attribute to select (optional)', type: 'String'}
            ],
            returns: {
                desc: 'Promise that resolves when the attributes are loaded.',
                type: 'Promise'
            }
        };
        this.desc.funcs[2] = {
            name: 'getAttributes',
            desc: 'Gets the attribute definitions of the selected datasets collection, including the ones not offered for selection.',
            returns: {
                desc: 'List of attribute definitions ({name, type, ...}) as delivered by the data source, empty if nothing is loaded.',
                type: 'Object[]'
            }
        };

        this.desc.events[0] = {
            name: 'swac_REQUESTOR_ID_dataselect_changed',
            desc: 'Fired when the dataset, the attribute, the time attribute or the period changed. When the dataset changed, the event is fired after its attributes are loaded.',
            data: 'Delivers the new selection (in selection, see getSelection()) and what changed (in changed: set, attribute, timeattr or period).'
        };

        // Internal attributes
        this.sets = new Map();
        this.attributes = [];
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
            if (this.options.multiple) {
                this.setSelect.multiple = true;
                // The placeholder option would be selectable in a list
                let placeholder = this.setSelect.querySelector('option[value=""]');
                if (placeholder)
                    placeholder.remove();
            }
            if (this.options.attributeRequired && this.options.showAttribute)
                this.attrSelect.required = true;

            this.setSelect.addEventListener('change', this.onSetChange.bind(this));
            this.attrSelect.addEventListener('change', this.notifyChange.bind(this, 'attribute'));
            if (this.timeSelect)
                this.timeSelect.addEventListener('change', this.notifyChange.bind(this, 'timeattr'));

            this.fromInput = this.requestor.querySelector('.swac_dataselect_from');
            this.toInput = this.requestor.querySelector('.swac_dataselect_to');
            if (this.options.showPeriod && this.fromInput && this.toInput)
                this.initPeriod();

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

    /**
     * Shows the period inputs, presets the last days and registers the checks.
     */
    initPeriod() {
        for (let curArea of this.requestor.querySelectorAll('.swac_dataselect_periodarea'))
            curArea.hidden = false;
        let to = new Date();
        let from = new Date(to.getTime() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);
        // defaultValue is what a form reset restores
        this.fromInput.defaultValue = this.fromInput.value = toInputValue(from);
        this.toInput.defaultValue = this.toInput.value = toInputValue(to);
        this.fromInput.required = true;
        this.toInput.required = true;

        for (let curInput of [this.fromInput, this.toInput]) {
            curInput.addEventListener('change', () => {
                this.checkPeriod();
                this.notifyChange('period');
            });
        }
        // A form reset restores the inputs without firing change
        let form = this.requestor.closest('form');
        if (form)
            form.addEventListener('reset', () => setTimeout(() => this.checkPeriod(), 0));
    }

    /**
     * Lets the browser block form submits while from is not before to.
     */
    checkPeriod() {
        let from = this.fromInput.value;
        let to = this.toInput.value;
        let invalid = from && to && from >= to;
        this.toInput.setCustomValidity(invalid ? this.getText('periodinvalid', 'The start must be before the end.') : '');
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
        this.attributes = [];
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
        let params = new URLSearchParams(window.location.search);
        // The period is set first, so the change event of the dataset already carries it
        if (this.options.showPeriod && this.fromInput && this.toInput) {
            for (let [input, name] of [[this.fromInput, 'start'], [this.toInput, 'end']]) {
                if (params.get(name))
                    input.value = params.get(name);
                // An invalid date leaves the input empty, then the preset stays
                if (!input.value)
                    input.value = input.defaultValue;
            }
            this.checkPeriod();
        }
        let ids = (params.get(this.options.urlParam) || '').split(',').filter(id => this.sets.has(id));
        if (!this.options.multiple)
            ids = ids.slice(0, 1);
        if (ids.length > 0 && ids.join(',') !== this.selectedSets().map(set => String(set.id)).join(','))
            this.setSelection(ids, params.get('attribute'));
    }

    /**
     * Writes the selection into the URL, so the address can be shared.
     */
    writeToUrl() {
        let selection = this.getSelection();
        let values = {
            [this.options.urlParam]: selection && selection.sets.map(set => set.id).join(','),
            attribute: selection && selection.attribute,
            start: selection && selection.from,
            end: selection && selection.to
        };
        let params = new URLSearchParams(window.location.search);
        for (let name in values) {
            if (values[name])
                params.set(name, values[name]);
            else
                params.delete(name);
        }
        history.replaceState(history.state, '', '?' + params.toString() + window.location.hash);
    }

    /**
     * Loads the attributes of the selected datasets collection.
     *
     * @returns {Promise} Resolves when the attributes are shown
     */
    onSetChange() {
        let sets = this.selectedSets();
        if (sets.length === 0) {
            this.loadingCollection = null;
            this.resetAttributes('choosesetfirst', 'Select device first');
            this.notifyChange('set');
            return Promise.resolve();
        }
        let withoutCollection = sets.find(set => !set.data_collection);
        if (withoutCollection) {
            Msg.error('Dataselect', 'Dataset >' + withoutCollection.id + '< has no attribute >data_collection<.', this.requestor);
            this.resetAttributes('structureerror', 'The data structure could not be loaded.');
            this.notifyChange('set');
            return Promise.resolve();
        }

        this.resetAttributes('loading', 'Loading ...');
        let collections = [...new Set(sets.map(set => set.data_collection))];
        let collection = collections.join(',');
        this.loadingCollection = collection;
        let thisRef = this;
        return Promise.all(collections.map(curCollection => Model.getValueDefinitions({fromName: curCollection}))).then(function (allDefinitions) {
            // Ignore the answer if another dataset was selected meanwhile
            if (thisRef.loadingCollection !== collection)
                return;
            // Only attributes every selected collection has can be used for all datasets
            let lists = allDefinitions.map(definitions => definitions || []);
            thisRef.attributes = lists[0].filter(curAttr => lists.every(list => list.some(other => other.name === curAttr.name)));
            thisRef.renderAttributes(thisRef.attributes);
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
        if (this.options.urlParam)
            this.writeToUrl();
        document.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_dataselect_changed', {
            detail: {
                requestor: this,
                changed: changed,
                selection: this.getSelection()
            },
            bubbles: true
        }));
    }

    selectedSets() {
        return [...this.setSelect.selectedOptions].map(option => this.sets.get(option.value)).filter(Boolean);
    }

    getSelection() {
        let sets = this.selectedSets();
        if (sets.length === 0)
            return null;
        let filterFor = curSet => this.options.filterAttribute ? this.options.filterAttribute + ',neoeq,' + curSet.id : null;
        let set = sets[0];
        return {
            id: set.id,
            set: set,
            name: set.name,
            collection: set.data_collection,
            filter: filterFor(set),
            sets: sets.map(curSet => ({id: curSet.id, set: curSet, name: curSet.name, collection: curSet.data_collection, filter: filterFor(curSet)})),
            attribute: this.attrSelect.value || null,
            timeAttr: (this.timeSelect && this.timeSelect.value) || null,
            from: (this.options.showPeriod && this.fromInput && this.fromInput.value) || null,
            to: (this.options.showPeriod && this.toInput && this.toInput.value) || null
        };
    }

    setSelection(id, attribute = null) {
        let ids = String(id).split(',');
        for (let option of this.setSelect.options)
            option.selected = ids.includes(option.value);
        this.pendingAttribute = attribute;
        return this.onSetChange();
    }

    getAttributes() {
        return this.attributes;
    }
}
