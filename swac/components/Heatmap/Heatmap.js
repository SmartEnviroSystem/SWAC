import Present from '../Present/Present.js';
import SWAC from '../../swac.js';

export default class Heatmap extends Present {

    constructor(options = {}) {
        let heatmapOptions = Object.assign({mode: 'numbers', categories: {}, rowLabelAttribute: 'name'}, options);
        // Present's component-specific plugins are not located in Heatmap/plugins.
        if (!heatmapOptions.plugins)
            heatmapOptions.plugins = new Map();
        super(heatmapOptions);

        this.name = 'Heatmap';

        this.desc.text = 'Displays numeric values or status categories as a heatmap.';
        this.desc.templates = [];
        this.desc.templates[0] = {
            name: 'heatmap',
            desc: 'Heatmap with coloured values.'
        };
        this.desc.depends.push({
            name: 'Colorcalculations.js',
            path: SWAC.config.swac_root + 'algorithms/Colorcalculations.js',
            desc: 'Contrast colour of the category icons'
        });
        const categoryTemplate = {name: 'categories', style: 'categories', desc: 'Device and period status grid.'};
        if (this.options.mode === 'categories')
            this.desc.templates.unshift(categoryTemplate);
        this.rowsBySet = new WeakMap();
        this.dirtyRows = new Set();
        this.categoryColumns = [];
        this.desc.opts[1] = {
            name: 'datadescription',
            desc: 'Datadescription ID without #. Required in numeric mode.',
            example: 'heatmap_legend'
        };
        this.desc.opts.push(
            {name: 'mode', desc: 'Default: numbers. Use categories for device and period statuses.'},
            {name: 'categories', desc: 'Category keys mapped to {label, color, icon?}. Null means normal (styled by the key normal, if given), an absent value means no data.'},
            {name: 'rowLabelAttribute', desc: 'Category row heading attribute. Defaults to name.'}
        );
        this.desc.events.push({name: 'heatmap_cell_clicked', desc: 'Category cell activated. Event detail contains set, attribute and value.'});
        
    }

    init() {
        if (this.options.mode === 'categories') {
            return super.init().then(() => {
                this.renderCategoryLegend();
                this.categoryClick = event => {
                    const button = event.target.closest('.heatmap-tile');
                    if (!button || !this.requestor.contains(button))
                        return;
                    const set = button.closest('tr').swac_dataset;
                    const attribute = button.dataset.period;
                    this.requestor.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_heatmap_cell_clicked', {
                        bubbles: true, detail: {set, attribute, value: set[attribute]}
                    }));
                };
                this.requestor.addEventListener('click', this.categoryClick);
            });
        }
        if (!this.options.datadescription) {
            return Promise.reject(new Error('Heatmap requires options.datadescription: the ID of a Datadescription component.'));
        }
        let thisRef = this;
        return super.init().then(function () {
            let legend = document.getElementById(thisRef.options.datadescription);
            thisRef.legendChangeHandler = function (event) {
                if (event.target.matches('.swac_datadescription_datacheck')
                        || event.target.closest('.swac_datadescription_empty_legend'))
                    thisRef.renderColors();
            };
            legend.addEventListener('change', thisRef.legendChangeHandler);
            window.swac.reactions.addReaction(function () {
                thisRef.renderColors();
            }, thisRef.requestor.id, thisRef.options.datadescription);
        });
    }

    createRepeatedForValue(attribute, set, template) {
        super.createRepeatedForValue(attribute, set, template);
        if (set && template.hasAttribute('data-heatmap-number')) {
            const cell = template.parentElement.lastElementChild;
            cell.hidden = false;
            cell.textContent = set[attribute] ?? '';
            cell.title = attribute;
        }
    }

    afterAddSet(set, repeateds) {
        this.rowsBySet.set(set, repeateds || []);
        if (this.options.mode === 'categories')
            this.scheduleCategoryRows(set);
        super.afterAddSet(set, repeateds);
    }

    notifyChangedValue(set, attribute) {
        if (this.options.mode === 'categories') {
            this.scheduleCategoryRows(set);
            return;
        }
        for (const row of this.rowsBySet.get(set) || []) {
            for (const cell of row.querySelectorAll('.swac_repeatedForValue[data-heatmap-number]')) {
                const name = cell.getAttribute('swac_attrname');
                if (attribute === undefined || name === attribute)
                    cell.textContent = set[name] ?? '';
            }
        }
    }

    notifyAddedValue(set, attribute) {
        this.notifyChangedValue(set, attribute);
    }

    notifyCommit(set) {
        this.notifyChangedValue(set);
    }

    notifyDelSet(set) {
        super.notifyDelSet(set);
        this.rowsBySet.delete(set);
        if (this.options.mode === 'categories')
            this.scheduleCategoryRows(set);
    }

    scheduleCategoryRows(set) {
        for (const row of this.rowsBySet.get(set) || [])
            this.dirtyRows.add(row);
        if (this.categoryPending)
            return;
        this.categoryPending = true;
        queueMicrotask(() => {
            this.categoryPending = false;
            if (!this.deleted)
                this.renderCategoryRows();
            this.dirtyRows.clear();
        });
    }

    renderCategoryRows() {
        const table = this.requestor.querySelector('.heatmap-categories');
        if (!table)
            return;
        const rows = table.querySelectorAll('.swac_repeatedForSet');
        const label = this.options.rowLabelAttribute;
        const keys = new Set();
        for (const row of rows) {
            for (const key of Object.keys(row.swac_dataset)) {
                if (key !== 'id' && key !== label && !key.startsWith('swac_'))
                    keys.add(key);
            }
        }
        const columns = this.options.attributeOrder.filter(key => keys.delete(key)).concat([...keys].sort());
        const changed = columns.length !== this.categoryColumns.length ||
            columns.some((key, index) => key !== this.categoryColumns[index]);
        if (changed) {
            const header = table.tHead.rows[0];
            header.replaceChildren(header.cells[0]);
            for (const key of columns) {
                const th = document.createElement('th');
                th.scope = 'col';
                th.textContent = key;
                header.append(th);
            }
            this.categoryColumns = columns;
        }
        for (const row of changed ? rows : this.dirtyRows) {
            const set = row.swac_dataset;
            const heading = row.cells[0];
            heading.textContent = set[label] ?? set.id;
            if (changed)
                row.replaceChildren(heading);
            columns.forEach((key, index) => {
                let button = row.cells[index + 1]?.firstElementChild;
                if (!button) {
                    button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'heatmap-tile';
                    button.dataset.period = key;
                    row.insertCell().append(button);
                }
                const status = this.categoryStatus(set[key]);
                button.style.backgroundColor = status.color;
                const title = [heading.textContent, key, status.label].join(' · ');
                button.title = title;
                button.setAttribute('aria-label', title);
                const mark = document.createElement('span');
                mark.className = 'heatmap-status';
                // The tile is filled with the category colour, the icon gets its contrast colour
                mark.style.color = Colorcalculations.calculateContrastColor(status.color);
                if (status.icon)
                    mark.setAttribute('uk-icon', status.icon);
                else if (set[key] !== null)
                    mark.textContent = status.label;
                button.replaceChildren(mark);
            });
        }
    }

    categoryStatus(value) {
        const lang = SWAC.lang.dict.Heatmap;
        if (value === null)
            return this.options.categories.normal || {label: lang.normal, color: '#eeeeee', icon: 'check'};
        if (value === undefined)
            return {label: lang.noData, color: '#ffffff', icon: 'question'};
        if (Object.hasOwn(this.options.categories, value))
            return this.options.categories[value];
        return {label: lang.unknown + ' (' + value + ')', color: '#eeeeee'};
    }

    renderCategoryLegend() {
        const legend = this.requestor.querySelector('.heatmap-category-legend');
        this.requestor.querySelector('.heatmap-categories thead th').textContent = this.options.rowLabelAttribute;
        legend.replaceChildren();
        for (const value of [...Object.keys(this.options.categories).filter(key => key !== 'normal'), null, undefined]) {
            const status = this.categoryStatus(value);
            const entry = document.createElement('span');
            const swatch = document.createElement('span');
            swatch.className = 'heatmap-swatch';
            swatch.style.backgroundColor = status.color;
            entry.append(swatch);
            if (status.icon) {
                const icon = document.createElement('span');
                icon.setAttribute('uk-icon', status.icon);
                icon.setAttribute('aria-hidden', 'true');
                entry.append(icon);
            }
            entry.append(document.createTextNode(status.label));
            legend.append(entry);
        }
    }

    renderColors() {
        let element = document.getElementById(this.options.datadescription);
        if (!element || !element.swac_comp)
            return;
        let legend = element.swac_comp;
        legend.options.backgroundColor = true;
        if (this.options.autoLegend)
            this.updateLegend(legend);
        let source = legend.data[legend.options.activeSource];
        if (!source)
            return;
        legend.formatDataElementBackground(this.requestor);
    }

    getMedian(list) {
        if (list.length === 0)
            return null;
        let sorted = list.slice().sort(function (first, second) {
            return first - second;
        });
        let middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    updateLegend(legend) {
        let definitions = {id: 1};
        let previousSource = legend.data[legend.options.activeSource];
        let previous = previousSource ? previousSource.getSet(legend.options.activeSet) : {};
        let emptyLegend = legend.requestor.querySelector('.swac_datadescription_empty_legend');
        let defaultCheck = emptyLegend && emptyLegend.querySelector('.swac_datadescription_datacheck');
        for (let column of this.requestor.querySelectorAll('.swac_repeatedForAttribute[swac_attrname]')) {
            let attribute = column.getAttribute('swac_attrname');
            let values = [];
            for (let source in this.data) {
                for (let set of this.data[source].getSets()) {
                    if (set && Number.isFinite(set[attribute]))
                        values.push(set[attribute]);
                }
            }
            if (values.length === 0)
                continue;
            let oldDefinition = previous[attribute];
            if (oldDefinition && oldDefinition.autoCalculate === false) {
                definitions[attribute] = oldDefinition;
                continue;
            }
            let automatic = oldDefinition ? oldDefinition.autoCalculate !== false : !defaultCheck || defaultCheck.checked;
            if (!automatic) {
                let manual = {txt_title: attribute, txt_desc: '', visualise: true,
                    autoCalculate: false, calcmode: '<', includeMax: true, values: {}};
                let valid = true;
                for (let field of legend.requestor.querySelectorAll('[data-statistic]')) {
                    let input = field.parentNode.querySelector('.swac_datadescription_value_value');
                    if (!input || input.value.trim() === '' || !Number.isFinite(Number(input.value))) {
                        valid = false;
                        break;
                    }
                    manual.values[Number(input.value).toExponential()] = {
                        col: field.value || field.getAttribute('data-color'),
                        txt: field.getAttribute('data-label')
                    };
                }
                if (valid && Object.keys(manual.values).length > 0)
                    definitions[attribute] = manual;
                continue;
            }
            if (values.length > 0) {
                let min = Math.min(...values);
                let median = this.getMedian(values);
                let max = Math.max(...values);
                let limits = {
                    minValue: (min + median) / 2,
                    medianValue: (max + median) / 2,
                    maxValue: max
                };
                let definition = {
                    txt_title: attribute,
                    txt_desc: min + ' - ' + max,
                    visualise: true,
                    autoCalculate: true,
                    minValue: min,
                    medianValue: median,
                    maxValue: max,
                    calcmode: '<',
                    includeMax: true,
                    values: {}
                };
                for (let field of legend.requestor.querySelectorAll('[data-statistic]')) {
                    let statistic = field.getAttribute('data-statistic');
                    if (min === max && statistic !== 'minValue')
                        continue;
                    let value = limits[statistic];
                    let key = value.toExponential();
                    if (!definition.values[key]) {
                        definition.values[key] = {
                            col: field.value || field.getAttribute('data-color'),
                            txt: field.getAttribute('data-label')
                        };
                    }
                }
                definitions[attribute] = definition;
            }
        }
        legend.removeAllData();
        legend.options.activeSource = null;
        legend.options.activeSet = null;
        if (Object.keys(definitions).length > 1)
            legend.addData(this.requestor.id + '_legend', [definitions]);
        for (let element of legend.requestor.querySelectorAll('.swac_repeatedForLegend:not(.swac_datadescription_empty_legend)'))
            element.remove();
        let template = legend.requestor.querySelector('.swac_repeatForLegend');
        for (let attribute in definitions) {
            if (attribute !== 'id')
                legend.addNewAttributeElementToLegend(template, definitions, attribute);
        }
        if (Object.keys(definitions).length === 1 && legend.options.showWhenNoData)
            legend.getLegend();
    }

    delete() {
        this.deleted = true;
        window.swac.loadedComponents.delete(this.requestor.id);
        if (this.options.mode === 'categories') {
            this.requestor.removeEventListener('click', this.categoryClick);
            super.delete();
            return;
        }
        let element = document.getElementById(this.options.datadescription);
        if (element && this.legendChangeHandler)
            element.removeEventListener('change', this.legendChangeHandler);
        if (element && element.swac_comp) {
            let thisRef = this;
            element.swac_comp.formatedDataElements = element.swac_comp.formatedDataElements.filter(function (curElement) {
                return curElement !== thisRef.requestor;
            });
        }
        super.delete();
    }
}
