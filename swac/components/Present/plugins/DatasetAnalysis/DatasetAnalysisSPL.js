import SWAC from '../../../../swac.js';
import Msg from '../../../../Msg.js';
import Plugin from '../../../../Plugin.js'

export default class DatasetAnalysisSPL extends Plugin {

    constructor(pluginconf) {
        super(pluginconf);
        this.name = 'Present/plugins/DatasetAnalysis';
        this.desc.text = 'Adds a column showing how many values in a dataset are missing or invalid.';
        this.desc.developers = 'Florian Fehring (HSBI)';
        this.desc.license = 'GNU Lesser General Public License';

        this.desc.opts = [];
        this.desc.opts.plausibilityrules = {};

        // Component sidebar
        this.desc.sidebar = [];
        this.desc.sidebar[0] = {
            name: "Present_DatasetAnalysis.missing_analysis",
            icon: "search",
            render: (view, container) => {

                let label = document.createElement('label');
                label.classList.add('uk-flex', 'uk-flex-middle', 'uk-margin-small');

                let checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.classList.add('uk-checkbox');
                checkbox.checked = this.columnEnabled;   // nur Nutzerzustand

                let text = document.createElement('span');
                let translation = window.swac.lang.getTranslationForId('Present_DatasetAnalysis.missing_analysis_show_col');
                text.textContent = translation;
                text.classList.add('uk-margin-small-left');

                label.appendChild(checkbox);
                label.appendChild(text);
                container.appendChild(label);

                checkbox.onchange = () => {

                    if (checkbox.checked) {
                        // Analyse aktivieren
                        this.columnEnabled = true;

                        // Spalte anlegen, falls noch nicht vorhanden
                        if (!this.columnAdded) {
                            this.addMissingColumn();
                            this.columnAdded = true;
                        }

                        // Für alle vorhandenen Sets Werte eintragen
                        let sets = view.data[view.requestor.fromName].sets;
                        for (let set of sets) {
                            if (!set)
                                continue;
                            let repeateds = view.requestor.querySelectorAll(
                                    `.swac_repeatedForSet[swac_setid="${set.id}"]`
                                    );

                            let missingCount = this.calculateMissingValues(set);
                            this.insertMissingValueIntoRow(repeateds, missingCount);
                        }

                        let translation = window.swac.lang.getTranslationForId('Present_DatasetAnalysis.missing_analysis_activated');
                        UIkit.notification(translation, {status: 'success'});

                    } else {
                        // Analyse deaktivieren
                        this.columnEnabled = false;
                        this.removeMissingColumn(view);
                        let translation = window.swac.lang.getTranslationForId('Present_DatasetAnalysis.missing_analysis_activated');
                        UIkit.notification(translation, {status: 'warning'});
                    }
                };

            }
        };

        this.desc.sidebar[1] = {
            name: "Present_DatasetAnalysis.plausibility_analysis",
            icon: "check",
            render: (view, container) => {

                let attrs = view.getAvailableAttributes().get(view.requestor.fromName);

                let wrapper = document.createElement('div');
                wrapper.classList.add('uk-margin-small');

                // Eingabefelder pro Attribut
                for (let attr of attrs) {
                    if (attr.startsWith('swac_'))
                        continue;
                    let row = document.createElement('div');
                    row.classList.add('uk-margin-small');
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.gap = '8px';

                    // Label
                    let label = document.createElement('span');
                    label.setAttribute('swac_lang',attr);
                    label.textContent = attr + ": ";
                    label.style.display = 'inline-block';
                    label.style.width = '140px';
                    row.appendChild(label);

                    // min
                    let minInput = document.createElement('input');
                    minInput.type = 'number';
                    minInput.placeholder = 'min';
                    minInput.classList.add('uk-input', 'uk-form-small');
                    minInput.style.width = '80px';
                    row.appendChild(minInput);

                    // max
                    let maxInput = document.createElement('input');
                    maxInput.type = 'number';
                    maxInput.placeholder = 'max';
                    maxInput.classList.add('uk-input', 'uk-form-small');
                    maxInput.style.width = '80px';
                    row.appendChild(maxInput);

                    // Admin‑Regeln laden
                    let adminRule = this.desc.opts.plausibilityrules[attr];
                    if (adminRule) {
                        if (adminRule.min !== undefined)
                            minInput.value = adminRule.min;
                        if (adminRule.max !== undefined)
                            maxInput.value = adminRule.max;
                    }

                    row.appendChild(minInput);
                    row.appendChild(maxInput);

                    wrapper.appendChild(row);

                    // Eingabefelder speichern
                    this.desc.opts.plausibilityrules[attr] = {minInput, maxInput};
                }

                // Anwenden‑Button
                let btn = document.createElement('button');
                let translation = window.swac.lang.getTranslationForId('Present_DatasetAnalysis.plausibility_analysis_apply');
                btn.textContent = translation;
                btn.classList.add('uk-button', 'uk-button-primary', 'uk-margin-small-top');

                btn.onclick = () => {
                    // Benutzerwerte zurück in die zentrale Option schreiben
                    for (let attr of attrs) {
                        let min = parseFloat(this.desc.opts.plausibilityrules[attr].minInput.value);
                        let max = parseFloat(this.desc.opts.plausibilityrules[attr].maxInput.value);

                        this.desc.opts.plausibilityrules[attr] = {
                            min: isNaN(min) ? undefined : min,
                            max: isNaN(max) ? undefined : max
                        };
                    }
                    this.applyRules(view);
                };

                wrapper.appendChild(btn);
                container.appendChild(wrapper);
            }
        };

        // internal attributes
        this.registered = false;
        this.columnAdded = false;   // Spalte im DOM?
        this.columnEnabled = false; // Analyse aktiv?
    }

    init() {
        return Promise.resolve();
    }

    /**
     * Called whenever Present adds a new dataset row.
     */
    afterAddSet(set, repeateds) {

        // Nur arbeiten, wenn Analyse aktiv ist
        if (!this.columnEnabled)
            return;

        // Spalte anlegen, falls noch nicht vorhanden
        if (!this.columnAdded) {
            this.addMissingColumn();
            this.columnAdded = true;
        }

        let missingCount = this.calculateMissingValues(set);
        this.insertMissingValueIntoRow(repeateds, missingCount);
    }

    addMissingColumn() {
        // Falls der Requestor selbst die Tabelle ist
        let table = this.requestor.parent.querySelector('table');

        if (!table) {
            Msg.warn('DatasetAnalysisSPL', 'No table found for Present component.');
            return;
        }

        // 1. Versuche zuerst thead > tr
        let headerRow = table.querySelector('thead tr');

// 2. Falls kein thead existiert → nimm die erste tr im table
        if (!headerRow) {
            headerRow = table.querySelector('tr');
        }

// 3. Falls immer noch nichts gefunden → Tabelle ist ungültig
        if (!headerRow) {
            Msg.warn('DatasetAnalysisSPL', 'No header row found.');
            return;
        }

        // Prüfen, ob Spalte schon existiert
        if (headerRow.querySelector('.swac_present_missing_header'))
            return;

        let th = document.createElement('th');
        th.textContent = 'Missing';
        th.classList.add('swac_present_missing_header');
        headerRow.appendChild(th);
    }

    calculateMissingValues(set) {

        // Falls der Datensatz null ist → alles fehlt
        if (!set) {
            return 0; // oder: return availableAttributes.length;
        }

        let missing = 0;

        // Alle Attribute, die dargestellt werden sollen
        let attrs = this.requestor.parent.swac_comp.getAvailableAttributes().get(set.swac_fromName);

        if (!attrs) {
            return 0;
        }

        for (let attr of attrs) {

            // SWAC-interne Attribute ignorieren
            if (attr.startsWith('swac_'))
                continue;
            let val = set[attr];

            // Fehlende Werte
            if (val === null ||
                    val === undefined ||
                    val === '' ||
                    Number.isNaN(val)) {

                missing++;
                continue;
            }

            // Ungültige Zahlen
            if (typeof val === 'number' && !isFinite(val)) {
                missing++;
                continue;
            }
        }

        return missing;
    }

    insertMissingValueIntoRow(repeateds, missingCount) {
        if (!repeateds || repeateds.length === 0)
            return;

        // repeateds[0] IST die Tabellenzeile
        let row = repeateds[0];
        if (!row)
            return;

        let td = document.createElement('td');
        td.textContent = missingCount;
        td.classList.add('swac_present_missing_value');

        row.appendChild(td);
    }

    removeMissingColumn(view) {
        let th = view.requestor.querySelector('.swac_present_missing_header');
        if (th)
            th.remove();

        let tds = view.requestor.querySelectorAll('.swac_present_missing_value');
        for (let td of tds)
            td.remove();
        this.columnAdded = false;
    }

    checkValue(attr, value) {
        let rule = this.desc.opts.plausibilityrules[attr];

        if (!rule)
            return "";

        let min = rule.min;
        let max = rule.max;

        if (min === undefined && max === undefined)
            return "";

        if (value === null || value === undefined || value === '')
            return "⚠";

        let num = (typeof value === 'number') ? value : parseFloat(value);

        if (Number.isNaN(num))
            return "⚠";

        if (min !== undefined && num < min)
            return "⬇";

        if (max !== undefined && num > max)
            return "⬆";

        return "✔";
    }

    insertPlausibilityValueIntoRow(repeateds, set) {

        if (!repeateds || repeateds.length === 0)
            return;

        let row = repeateds[0].querySelector('tr') || repeateds[0];
        if (!row)
            return;

        let td = document.createElement('td');
        td.classList.add('swac_present_plausible_value');

        let attrs = this.requestor.parent.swac_comp.getAvailableAttributes().get(set.swac_fromName);
        let results = [];

        for (let attr of attrs) {

            // Nur Attribute prüfen, für die es Regeln gibt
            if (attr.startsWith('swac_'))
                continue;
            if (!this.desc.opts.plausibilityrules[attr])
                continue;

            let val = set[attr];
            let res = this.checkValue(attr, val);
            if (res != '')
                results.push('<span uk-tooltip="' + attr + '">' + res + '</span>');
        }

        td.innerHTML = results.join(' ');
        row.appendChild(td);
    }

    applyRules(view) {

        this.addPlausibilityColumn();

        let sets = view.data[view.requestor.fromName].sets;

        for (let set of sets) {
            if (!set)
                continue;
            let repeateds = view.requestor.querySelectorAll(
                    `.swac_repeatedForSet[swac_setid="${set.id}"]`
                    );

            this.insertPlausibilityValueIntoRow(repeateds, set);
        }

        UIkit.notification("Plausibilitäts‑Analyse angewendet", {status: 'success'});
    }

    addPlausibilityColumn() {

        let table = this.requestor.parent.querySelector('table');
        if (!table) {
            Msg.warn('DatasetAnalysisSPL', 'No table found for Present component.');
            return;
        }

        let headerRow = table.querySelector('thead tr') || table.querySelector('tr');
        if (!headerRow) {
            Msg.warn('DatasetAnalysisSPL', 'No header row found.');
            return;
        }

        // Spalte existiert schon?
        if (headerRow.querySelector('.swac_present_plausible_header'))
            return;

        let th = document.createElement('th');
        th.textContent = 'Plausibel';
        th.classList.add('swac_present_plausible_header');
        headerRow.appendChild(th);
    }

}

