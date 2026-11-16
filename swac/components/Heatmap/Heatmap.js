import Present from '../Present/Present.js';
import SWAC from '../../swac.js';

export default class Heatmap extends Present {

    constructor(options = {}) {
        let heatmapOptions = Object.assign({}, options);
        // Present's component-specific plugins are not located in Heatmap/plugins.
        if (!heatmapOptions.plugins)
            heatmapOptions.plugins = new Map();
        super(heatmapOptions);

        this.name = 'Heatmap';
        this.desc.text = 'Displays datasets as a coloured table using a Datadescription legend.';
        this.desc.templates = [];
        this.desc.templates[0] = {
            name: 'heatmap',
            url: SWAC.config.swac_root + 'components/Present/table_for_all_datasets.html',
            desc: 'Table with coloured values.'
        };
        if (!options.datadescription)
            this.options.datadescription = '';
    }

    init() {
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
        window.swac.loadedComponents.delete(this.requestor.id);
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
