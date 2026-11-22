/*
 * SmartData-Adapter für den Diagramm-Kalender (Komponente Diagramcalendar).
 *
 * Geprüfte Antwortformate (localhost, SmartData):
 *   GET records/tbl_observedobject  -> { records: [{ id, name, data_collection }] }
 *   GET collection/<name>           -> { name, attributes: [{ name, type, ... }] }
 *   GET records/<name>?filter=…     -> { records: [{ id, ts: '2026-01-05T13:10:26.078+01:00', <attr>… }] }
 *
 * Die URLs werden aus einer SWAC-Datenquelle gebildet (SWAC_config.datasources in
 * configuration.js, z. B. "/SmartData/smartdata/[iface]/[fromName]?storage=smartmonitoring"
 * mit interfaces.list = ['GET', 'records'] und interfaces.defs = ['GET', 'collection']).
 *
 * Warum direkter fetch statt SWAC Model? Gemessen für einen Monat (76 045 Datensätze):
 * fetch 1,6 s, Model.load 2,1 s (Debugmodus aus) bzw. 6,0 s (Debugmodus an), siehe README.
 *
 * Zeitfilter werden als Uhrzeit OHNE Zeitzone gesendet: SmartData liest Filterwerte als
 * LocalDateTime und verwirft eine mitgeschickte Zone (DataConverter.objectToLocalDateTime).
 */
(function (root) {
    'use strict';

    const DEFAULTS = root.HeliosCalendarConfig
            || (typeof require === 'function' ? require('./calendar-config.js') : {});

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    /*
     * Zeitgrenze für einen SmartData-Filter: 00:00 Uhr des Kalendertags in der Anzeige-Zone
     * (cfg.timeZone, Standard Europe/Berlin), als Uhrzeit OHNE Zone in der Zone der Daten
     * (cfg.dataTimeZone, Standard wie timeZone). Die Rechnung steht zentral in
     * calendar-logic.js (filterTime). Daten in Berlin: '2026-07-16' -> '2026-07-16T00:00:00'.
     * @param {string} isoDate 'YYYY-MM-DD'
     */
    function toFilterTime(isoDate, cfg) {
        let Logic = root.HeliosCalendarLogic || (typeof require === 'function' ? require('./calendar-logic.js') : null);
        return Logic.filterTime(isoDate, cfg.timeZone, cfg.dataTimeZone);
    }

    /*
     * Wählt aus SWAC_config.datasources die erste Datenquelle, die Datensätze (list)
     * und Beschreibungen (defs) liefert und die Tabelle nicht ausschließt.
     * @returns {Object|null}
     */
    function pickDatasource(datasources, fromName) {
        for (let ds of datasources || []) {
            if (!ds || typeof ds.url !== 'string' || !ds.url.includes('[fromName]'))
                continue;
            if (ds.exclude && fromName && ds.exclude.includes(fromName))
                continue;
            if (ds.interfaces && ds.interfaces.list && ds.interfaces.defs)
                return ds;
        }
        return null;
    }

    function lower(text) {
        return String(text || '').toLowerCase();
    }

    /*
     * Zeitspalte einer Tabelle aus der Collection-Beschreibung.
     * Reihenfolge: erzwungener Name (cfg.timeAttr), dann bevorzugte Namen mit Zeit-Datentyp,
     * dann die alphabetisch erste Spalte mit Zeit-Datentyp. Sonst null.
     */
    function detectTimeAttribute(attributes, cfg) {
        let list = (attributes || []).filter(a => a && a.name);
        if (cfg.timeAttr)
            return list.some(a => a.name === cfg.timeAttr) ? cfg.timeAttr : null;
        let types = (cfg.timeTypes || []).map(lower);
        let timeCols = list.filter(a => types.includes(lower(a.type)));
        for (let candidate of cfg.timeAttrCandidates || []) {
            let hit = timeCols.find(a => lower(a.name) === lower(candidate));
            if (hit)
                return hit.name;
        }
        timeCols.sort((a, b) => a.name.localeCompare(b.name));
        return timeCols.length ? timeCols[0].name : null;
    }

    /*
     * Warum eine Spalte (k)ein Messwert ist: null = Messwert, sonst Grund
     * ('time', 'type', 'identity', 'name', 'prefix', 'suffix').
     */
    function exclusionReason(attrDef, timeAttr, cfg) {
        let name = attrDef.name;
        if (name === timeAttr)
            return 'time';
        if (!(cfg.numericTypes || []).map(lower).includes(lower(attrDef.type)))
            return 'type';
        if (cfg.excludeIdentity !== false && (attrDef.isIdentity || attrDef.isAutoIncrement))
            return 'identity';
        let n = lower(name);
        if ((cfg.excludeAttrs || []).map(lower).includes(n))
            return 'name';
        if ((cfg.excludePrefixes || []).some(p => n.startsWith(lower(p))))
            return 'prefix';
        if ((cfg.excludeSuffixes || []).some(s => n.endsWith(lower(s))))
            return 'suffix';
        return null;
    }

    /*
     * Wertet eine Collection-Beschreibung von SmartData aus ({name, attributes:[{name, type, isIdentity…}]}).
     * Rein funktional, ohne Netzwerk (testbar).
     * @returns {{timeAttr: string|null, measurements: string[], excluded: Array<{name, type, reason}>}}
     */
    function analyzeCollection(collectionJson, options) {
        let cfg = Object.assign({}, DEFAULTS, options || {});
        let attributes = (collectionJson && Array.isArray(collectionJson.attributes) ? collectionJson.attributes : [])
                .filter(a => a && a.name);
        let timeAttr = detectTimeAttribute(attributes, cfg);
        let measurements = [], excluded = [];
        for (let a of attributes) {
            let reason = exclusionReason(a, timeAttr, cfg);
            if (reason)
                excluded.push({name: a.name, type: a.type, reason: reason});
            else
                measurements.push(a.name);
        }
        return {timeAttr: timeAttr, measurements: measurements, excluded: excluded};
    }

    function defaultDatasource(cfg) {
        return {
            url: cfg.smartdataUrl + '/[iface]/[fromName]?storage=' + encodeURIComponent(cfg.storage),
            interfaces: {list: ['GET', 'records'], defs: ['GET', 'collection']}
        };
    }

    /*
     * Erzeugt einen Adapter mit eigener Konfiguration (je Komponente eine Instanz).
     * @param {Object} options überschreibt calendar-config.js; datasource = SWAC-Datenquelle
     */
    function createAdapter(options) {
        const cfg = Object.assign({}, DEFAULTS, options || {});
        const ds = cfg.datasource || defaultDatasource(cfg);
        // Zeitspalte: erzwungen per Option, sonst nach describeCollection() erkannt (Standard 'ts')
        let timeAttr = cfg.timeAttr || 'ts';

        function baseUrl(mode, name) {
            let iface = ds.interfaces && ds.interfaces[mode] ? ds.interfaces[mode][1]
                    : (mode === 'defs' ? 'collection' : 'records');
            return ds.url.replace('[iface]', iface).replace('[fromName]', encodeURIComponent(name));
        }

        function withParams(url, parts) {
            if (parts.length === 0)
                return url;
            return url + (url.includes('?') ? '&' : '?') + parts.join('&');
        }

        /*
         * URL für einen Abruf von Datensätzen.
         * @param {Object} opts { from, to ('YYYY-MM-DD', to exklusiv), includes: string[], size, order }
         */
        function buildRecordsUrl(collection, opts) {
            opts = opts || {};
            let parts = [];
            if (opts.from)
                parts.push('filter=' + timeAttr + ',ge,' + encodeURIComponent(toFilterTime(opts.from, cfg)));
            if (opts.to)
                parts.push('filter=' + timeAttr + ',lt,' + encodeURIComponent(toFilterTime(opts.to, cfg)));
            if (opts.order)
                parts.push('order=' + opts.order);
            if (opts.includes && opts.includes.length > 0)
                parts.push('includes=' + opts.includes.map(encodeURIComponent).join(','));
            if (opts.size)
                parts.push('size=' + opts.size);
            return withParams(baseUrl('list', collection), parts);
        }

        function buildCollectionUrl(collection) {
            return baseUrl('defs', collection);
        }

        async function getJson(url) {
            let response;
            try {
                response = await fetch(url, {headers: {Accept: 'application/json'}, credentials: 'same-origin'});
            } catch (err) {
                throw new Error('SmartData ist nicht erreichbar (' + err.message + ')');
            }
            if (!response.ok) {
                let detail = '';
                try {
                    detail = await response.text();
                    // SmartData liefert Fehler als { errors: ['…'] }
                    let parsed = JSON.parse(detail);
                    if (parsed && Array.isArray(parsed.errors) && parsed.errors.length > 0)
                        detail = parsed.errors[0];
                } catch (ignore) {
                    // Kein JSON: Rohtext verwenden
                }
                detail = String(detail || '').slice(0, 200);
                throw new Error('SmartData antwortet mit HTTP ' + response.status + (detail ? ': ' + detail : ''));
            }
            // Bei leeren Tabellen kann der Body leer sein
            let text = await response.text();
            if (!text)
                return {};
            try {
                return JSON.parse(text);
            } catch (err) {
                throw new Error('Antwort von SmartData ist kein JSON');
            }
        }

        /*
         * Entscheidet anhand der Collection-Beschreibung, ob eine Spalte ein Messwert ist.
         */
        function isMeasurementAttribute(attrDef) {
            if (!attrDef || !attrDef.name)
                return false;
            return exclusionReason(attrDef, timeAttr, cfg) === null;
        }

        /*
         * Sortiert Attribute: zuerst in der Reihenfolge der Konfiguration, danach alphabetisch.
         */
        function sortAttributes(names) {
            let known = Object.keys(cfg.attributes || {});
            return names.slice().sort(function (a, b) {
                let ia = known.indexOf(a), ib = known.indexOf(b);
                if (ia !== -1 || ib !== -1)
                    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
                return a.localeCompare(b);
            });
        }

        /*
         * Beschreibung eines Attributs für die Anzeige. Unbekannte Attribute bekommen
         * ihren Spaltennamen, keine Einheit und eine eigene y-Achse (axis).
         * Ein Eintrag "<tabelle>.<attribut>" ergänzt bzw. überschreibt den Eintrag "<attribut>",
         * weil gleiche Spaltennamen in verschiedenen Tabellen Verschiedenes bedeuten können.
         */
        function getAttributeMeta(name, index, collection) {
            let all = cfg.attributes || {};
            let generic = all[name];
            let specific = collection ? all[collection + '.' + name] : undefined;
            let known = generic || specific ? Object.assign({}, generic, specific) : null;
            if (known) {
                let unit = known.unit || '';
                return Object.assign({name: name, label: name, unit: unit, axis: unit || 'attr:' + name}, known, {unit: unit});
            }
            let colors = cfg.fallbackColors || ['#0072B2'];
            return {name: name, label: name, unit: '', axis: 'attr:' + name, color: colors[(index || 0) % colors.length]};
        }

        /*
         * Geräte aus tbl_observedobject, die eine Messwert-Tabelle haben, sortiert nach Name.
         */
        async function fetchDevices() {
            let json = await getJson(withParams(baseUrl('list', cfg.deviceTable), ['order=name,ASC']));
            return (json.records || [])
                    .filter(d => d && typeof d.data_collection === 'string' && d.data_collection.trim() !== '')
                    .map(d => ({id: d.id, name: d.name || d.data_collection, data_collection: d.data_collection.trim()}))
                    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
        }

        /*
         * Beschreibung einer beliebigen Tabelle: erkannte Zeitspalte, Messwert-Attribute
         * (sortiert) und ausgeschlossene Spalten mit Grund. Merkt sich die Zeitspalte für
         * alle folgenden Abrufe dieses Adapters.
         */
        async function describeCollection(collection) {
            let json = await getJson(buildCollectionUrl(collection));
            let result = analyzeCollection(json, cfg);
            if (result.timeAttr)
                timeAttr = result.timeAttr;
            result.measurements = sortAttributes(result.measurements);
            return result;
        }

        /*
         * Messwert-Attribute einer beliebigen Tabelle (Fehler, wenn es keine Zeitspalte gibt).
         */
        async function fetchAttributes(collection) {
            let result = await describeCollection(collection);
            if (!result.timeAttr)
                throw new Error('Die Tabelle „' + collection + '“ hat keine Zeitspalte und kann nicht im Kalender angezeigt werden.');
            return result.measurements;
        }

        /*
         * EIN Abruf für einen Zeitraum (Monat oder Woche) mit allen ausgewählten Attributen.
         * @param {string} from 'YYYY-MM-DD' (inklusive)
         * @param {string} to 'YYYY-MM-DD' (exklusive)
         */
        async function fetchRange(collection, attrs, from, to) {
            let size = cfg.maxRecords || 200000;
            let url = buildRecordsUrl(collection, {
                from: from,
                to: to,
                order: timeAttr + ',ASC',
                includes: [timeAttr].concat(attrs),
                size: size
            });
            let json = await getJson(url);
            let records = json.records || [];
            return {records: records, truncated: records.length >= size, url: url};
        }

        /*
         * Zeitstempel des neuesten Datensatzes, oder null.
         */
        async function fetchLatestTimestamp(collection) {
            let url = buildRecordsUrl(collection, {order: timeAttr + ',DESC', includes: [timeAttr], size: 1});
            let json = await getJson(url);
            let first = (json.records || [])[0];
            return first && first[timeAttr] ? first[timeAttr] : null;
        }

        /*
         * Link auf die bestehende SWAC-Diagrammseite, gefiltert auf einen Tag.
         *
         * SWAC (Model.load) hängt filter-Parameter aus der URL an JEDE Komponente der
         * Seite an und entfernt dabei den letzten Teil, der ein Ziel "comps:<id>" sein
         * soll. Ohne dieses Ziel bekämen Navigation, User und oo_change den Filter
         * "ts,ge" (HTTP 400). SWAC merkt sich das dauerhaft in localStorage
         * (swac_datasourceStates). Mit ",comps:charts" gilt der Filter nur für #charts.
         */
        function buildChartsPageUrl(collection, isoDate) {
            let p = isoDate.split('-').map(Number);
            let next = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1));
            let nextIso = next.getUTCFullYear() + '-' + pad(next.getUTCMonth() + 1) + '-' + pad(next.getUTCDate());
            let target = ',comps:' + (cfg.chartsComponentId || 'charts');
            return (cfg.chartsPageUrl || 'charts.html') + '?data_collection=' + encodeURIComponent(collection)
                    + '&filter=' + timeAttr + ',ge,' + toFilterTime(isoDate, cfg) + target
                    + '&filter=' + timeAttr + ',lt,' + toFilterTime(nextIso, cfg) + target;
        }

        return {
            config: cfg,
            buildRecordsUrl: buildRecordsUrl,
            buildCollectionUrl: buildCollectionUrl,
            buildChartsPageUrl: buildChartsPageUrl,
            isMeasurementAttribute: isMeasurementAttribute,
            sortAttributes: sortAttributes,
            getAttributeMeta: getAttributeMeta,
            getTimeAttr: () => timeAttr,
            fetchDevices: fetchDevices,
            describeCollection: describeCollection,
            fetchAttributes: fetchAttributes,
            fetchRange: fetchRange,
            fetchLatestTimestamp: fetchLatestTimestamp
        };
    }

    // Standard-Instanz mit calendar-config.js (für Tests und einfache Nutzung)
    let api = createAdapter();
    api.createAdapter = createAdapter;
    api.pickDatasource = pickDatasource;
    api.analyzeCollection = analyzeCollection;
    api.detectTimeAttribute = (attributes, options) => detectTimeAttribute(attributes, Object.assign({}, DEFAULTS, options || {}));

    root.HeliosSmartData = api;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
