import View from '../../View.js';

/**
 * SWAC Frontend-Mockup: Datenkonsolidierung (Gruppe 4).
 * Liest existierende Tabellen und deren reale Spaltendefinitionen aus SmartData.
 * Keine Änderungen in der Datenbank, keine Job-Ausführung.
 * Das angezeigte JSON ist ein Vorschlag für die spätere Backend-Anbindung,
 * KEIN bereits bestätigtes SmartDataLyser-API-Format.
 */
export default class DataConsolidation extends View {
    constructor(options = {}) {
        super(options);
        this.name = 'DataConsolidation';
        this.desc.text = 'SWAC mockup for configuring time-based data consolidation.';
        this.desc.developers = 'Web Engineering Gruppe 4 (HSBI)';
        this.desc.templates[0] = {
            name: 'dataconsolidation',
            style: 'dataconsolidation',
            desc: 'Zwei Tabellen und Zeit-Matching konfigurieren'
        };
        this.desc.reqPerTpl[0] = {
            selc: '.dc-app',
            desc: 'DataConsolidation view container'
        };
        if (options.showWhenNoData === undefined) {
            this.options.showWhenNoData = true;
        }
    }

    async init() {
        const root = this.requestor;
        if (!root || !root.querySelector('.dc-app')) {
            throw new Error('DataConsolidation: SWAC-Template nicht geladen.');
        }
        const $ = id => root.querySelector('#' + id);
        const sourceA = $('dcSourceA');
        const sourceB = $('dcSourceB');
        const timeA = $('dcTimeA');
        const timeB = $('dcTimeB');
        const timeHintA = $('dcTimeHintA');
        const timeHintB = $('dcTimeHintB');
        const form = $('dcForm');
        const output = $('dcOutput');
        const status = $('dcStatus');
        const tableHint = $('dcTableHint');
        const previewHint = $('dcPreviewHint');

        if (!sourceA || !sourceB || !timeA || !timeB || !timeHintA || !timeHintB || !form || !output || !status) {
            throw new Error('DataConsolidation: Erforderliche HTML-Elemente fehlen.');
        }

        function report(message, isError = false) {
            status.textContent = message;
            status.dataset.error = String(isError);
        }

        function fillSelect(select, names) {
            select.replaceChildren();
            select.add(new Option('Bitte Tabelle auswählen', ''));
            for (const name of names) {
                select.add(new Option(name, name));
            }
            select.disabled = false;
        }

        // Echte Spalten-Metadaten statt Vermutungen wie "timestamp".
        // Die API gibt z. B. {name: "...", attributes: [{name: "ts", type: "timestamp"}]} zurück.
        const columns = { a: null, b: null };
        const requests = { a: 0, b: 0 }; // Verhindert veraltete Antworten nach schnellem Tabellenwechsel.

        function isTimeCandidate(attribute) {
            const type = String(attribute.type || '').toLowerCase();
            const name = String(attribute.name || '').toLowerCase();
            return /(timestamp|timestamptz|datetime|date|time)/i.test(type) ||
                /^(ts|timestamp|time|datetime|recorded_at|measured_at|acquiretime|created_at|updated_at)$/.test(name);
        }

        async function loadColumns(side) {
            const table = side === 'a' ? sourceA.value : sourceB.value;
            const select = side === 'a' ? timeA : timeB;
            const hint = side === 'a' ? timeHintA : timeHintB;
            const request = ++requests[side];
            columns[side] = null;
            select.disabled = true;
            select.replaceChildren(new Option(table ? 'Spalten werden geladen ...' : 'Bitte zuerst Tabelle auswählen', ''));
            hint.textContent = table
                ? `Lade echte Spalten aus der Tabelle „${table}“ ...`
                : 'Bitte zuerst eine Quelltabelle auswählen.';
            if (!table) return;

            try {
                // SmartData CollectionResource: nur lesender GET auf die Tabellendefinition.
                const url = `/SmartData/smartdata/collection/${encodeURIComponent(table)}?storage=smartmonitoring`;
                const response = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (!data || !Array.isArray(data.attributes)) {
                    throw new Error('Spaltendefinition fehlt (attributes).');
                }
                const attributes = data.attributes
                    .filter(item => item && typeof item.name === 'string' && item.name.trim())
                    .map(item => ({ name: item.name, type: String(item.type || 'unbekannt') }));
                if (request !== requests[side]) return;
                columns[side] = attributes;
                select.replaceChildren();
                select.add(new Option('Bitte Zeitstempel-Spalte auswählen', ''));
                const sorted = [...attributes].sort((a, b) =>
                    Number(isTimeCandidate(b)) - Number(isTimeCandidate(a)) || a.name.localeCompare(b.name));
                for (const attribute of sorted) {
                    select.add(new Option(`${attribute.name} (${attribute.type})`, attribute.name));
                }
                if (attributes.length === 0) {
                    select.replaceChildren(new Option('Keine Spalten vorhanden', ''));
                    hint.textContent = 'Diese Tabelle besitzt keine abrufbaren Spalten.';
                    return;
                }
                select.disabled = false;
                const candidates = sorted.filter(isTimeCandidate);
                hint.textContent = `${attributes.length} echte Spalten geladen. ` +
                    (candidates.length
                        ? `Mögliche Zeitspalten: ${candidates.map(c => c.name).join(', ')}. Bitte Typ prüfen.`
                        : 'Keine eindeutige Zeitspalte erkannt. Bitte Spaltentyp und Backend-Anforderung prüfen.');
            } catch (error) {
                if (request !== requests[side]) return;
                columns[side] = null;
                select.disabled = true;
                select.replaceChildren(new Option('Spalten konnten nicht geladen werden', ''));
                hint.textContent = `SmartData-Spalten nicht verfügbar: ${error.message}`;
                console.error(`DataConsolidation: Spalten für Tabelle ${table} konnten nicht geladen werden:`, error);
            }
        }

        sourceA.addEventListener('change', () => loadColumns('a'));
        sourceB.addEventListener('change', () => loadColumns('b'));

        function getValues() {
            return {
                source_a: sourceA.value,
                source_b: sourceB.value,
                timestamp_column_a: $('dcTimeA').value.trim(),
                timestamp_column_b: $('dcTimeB').value.trim(),
                matching_mode: $('dcMode').value,
                tolerance_seconds: Number($('dcTolerance').value),
                target_table: $('dcTarget').value.trim()
            };
        }

        function validate(config) {
            if (!config.source_a || !config.source_b) {
                return 'Bitte zuerst zwei vorhandene Tabellen auswählen.';
            }
            if (config.source_a === config.source_b) {
                return 'Für diesen Mockup bitte zwei unterschiedliche Quelltabellen auswählen.';
            }
            if (!config.timestamp_column_a || !config.timestamp_column_b) {
                return 'Bitte Zeitstempel-Spalten für beide Tabellen auswählen.';
            }
            if (!columns.a || !columns.b) {
                return 'Die echten Spaltendefinitionen müssen zuerst geladen werden.';
            }
            if (!columns.a.some(item => item.name === config.timestamp_column_a) ||
                !columns.b.some(item => item.name === config.timestamp_column_b)) {
                return 'Bitte nur vorhandene Spalten aus den ausgewählten Tabellen verwenden.';
            }
            if (!Number.isInteger(config.tolerance_seconds) ||
                config.tolerance_seconds < 0 || config.tolerance_seconds > 86400) {
                return 'Bitte eine Toleranz zwischen 0 und 86400 Sekunden eingeben.';
            }
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.target_table)) {
                return 'Bitte einen einfachen Zieltabellennamen angeben (Buchstaben, Zahlen, _).';
            }
            return null;
        }

        form.addEventListener('submit', event => {
            event.preventDefault();
            const config = getValues();
            const error = validate(config);
            if (error) {
                report(error, true);
                previewHint.textContent = 'Bitte die Konfiguration korrigieren.';
                return;
            }
            output.textContent = JSON.stringify(config, null, 2);
            previewHint.textContent = 'Konfiguration bereit. Dies ist nur ein JSON-Entwurf, keine ausgeführte Konsolidierung.';
            report('Konfiguration geprüft. Es wurde kein Job gestartet und nichts gespeichert.');
        });

        // Visuell signalisieren, dass alte Ergebnisse nach einer Änderung nicht mehr aktuell sind.
        form.addEventListener('input', () => {
            previewHint.textContent = 'Einstellungen geändert – „Konfiguration prüfen“ erneut klicken.';
            output.textContent = 'Noch keine aktuelle Konfiguration erzeugt.';
        });
        form.addEventListener('change', () => {
            previewHint.textContent = 'Einstellungen geändert – „Konfiguration prüfen“ erneut klicken.';
            output.textContent = 'Noch keine aktuelle Konfiguration erzeugt.';
        });

        try {
            report('Lade echte Tabellen aus SmartData ...');
            const response = await fetch('/SmartData/smartdata/storage/getCollections?name=smartmonitoring', {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            if (!json || !Array.isArray(json.list)) {
                throw new Error('Unerwartetes JSON-Format (list fehlt).');
            }
            const tables = [...new Set(json.list
                .map(item => item && item.name)
                .filter(name => typeof name === 'string' && name.trim()))]
                .sort((a, b) => a.localeCompare(b));
            if (!tables.length) throw new Error('Keine Tabellen im Schema smartmonitoring gefunden.');

            fillSelect(sourceA, tables);
            fillSelect(sourceB, tables);
            tableHint.textContent = `${tables.length} Tabellen aus SmartData geladen (Schema smartmonitoring).`;
            report('Tabellen geladen. Wähle Tabelle A und B; die echten Spalten erscheinen danach.');
        } catch (error) {
            sourceA.replaceChildren(new Option('SmartData nicht erreichbar', ''));
            sourceB.replaceChildren(new Option('SmartData nicht erreichbar', ''));
            sourceA.disabled = true;
            sourceB.disabled = true;
            tableHint.textContent = 'Payara/SmartData prüfen, dann Seite neu laden.';
            report(`Tabellen konnten nicht geladen werden: ${error.message}`, true);
            console.error('DataConsolidation: SmartData-Tabellen konnten nicht geladen werden:', error);
        }
    }
}
