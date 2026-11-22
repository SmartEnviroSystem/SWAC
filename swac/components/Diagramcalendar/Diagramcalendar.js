import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';
import Diagramcalendar_de from './langs/de.js';

/**
 * Diagramcalendar: Kalender mit einem kleinen Liniendiagramm je Tag (Feature #55, HELIOS Team 2).
 *
 * Einbindung:
 *   <div id="calendar" swa="Diagramcalendar FROM {{data_collection}} OPTIONS calendar_options"></div>
 *
 * Datenfluss:
 * - FROM nennt die Tabelle. SWAC lädt darüber nur EINEN beliebigen Datensatz (fromWheres
 *   size=1, ohne Spaltennamen), damit keine Tabelle mit HTTP 400 scheitert und SWAC die
 *   Datenquelle nicht dauerhaft sperrt.
 * - Zeitspalte und Messwerte erkennt der Adapter aus collection/<tabelle> (Datentypen,
 *   allgemeine Ausschlussliste, keine tabellenbezogenen Regeln). Danach holt er den neuesten
 *   Zeitstempel (Startzeitraum).
 * - Die Messwerte eines Monats holt die Komponente mit EINEM direkten Request, dessen URL
 *   aus SWAC_config.datasources gebildet wird. Gemessen für 76 045 Datensätze:
 *   fetch 1,6 s, SWAC Model.load 2,1 s (Debugmodus aus) bzw. 6,0 s (Debugmodus an).
 * - Aufteilung nach lokalem Tag, Intervall-Mittelwerte, gemeinsame y-Skala je Einheit,
 *   SVG-Mini-Diagramme (libs/), Tagesdetail mit Chart.js aus components/Charts/libs.
 */
export default class Diagramcalendar extends View {

    constructor(options = {}) {
        super(options);
        this.name = 'Diagramcalendar';
        this.desc.text = 'Kalender, der für jeden Tag ein kleines Liniendiagramm der Messwerte eines Geräts zeigt. '
                + 'Monats- und Wochenansicht, Mehrfachauswahl von Attributen, Mittelwerte je Intervall, '
                + 'gemeinsame y-Skala, Tagesdetail mit großem Diagramm.';
        this.desc.developers = 'HELIOS Team 2 (HSBI, Web Engineering)';
        this.desc.license = 'GNU Lesser General Public License';

        let libPath = SWAC.config.swac_root + 'components/Diagramcalendar/libs/';
        let chartPath = SWAC.config.swac_root + 'components/Charts/libs/chartjs/';
        this.desc.depends[0] = {name: 'calendar-config.js', path: libPath + 'calendar-config.js',
            desc: 'Standardwerte (Ausschlüsse, Datentypen, Anzeigenamen und Einheiten bekannter Attribute).'};
        this.desc.depends[1] = {name: 'calendar-logic.js', path: libPath + 'calendar-logic.js',
            desc: 'Monatsraster, Tageszuordnung, Intervall-Mittelwerte, Skalen (ohne DOM, mit Node getestet).'};
        this.desc.depends[2] = {name: 'calendar-mini-chart.js', path: libPath + 'calendar-mini-chart.js',
            desc: 'SVG-Mini-Liniendiagramm je Tag.'};
        this.desc.depends[3] = {name: 'calendar-data.js', path: libPath + 'calendar-data.js',
            desc: 'SmartData-Adapter, URLs aus SWAC_config.datasources.'};
        // Gleiche Pfade wie in Charts.js: SWAC lädt jede Datei nur einmal
        this.desc.depends[4] = {name: 'Chart.js', path: chartPath + 'Chart.min.js',
            desc: 'Großes Tagesdiagramm in der Detailansicht.'};
        this.desc.depends[5] = {name: 'HammerJS', path: chartPath + 'hammerjs.js',
            desc: 'Gesten für das Zoom-Plugin.'};
        this.desc.depends[6] = {name: 'chartjs-plugin-zoom', path: chartPath + 'chartjs-plugin-zoom.min.js',
            desc: 'Zoomen im Tagesdiagramm.'};

        this.desc.templates[0] = {
            name: 'diagramcalendar',
            style: 'diagramcalendar',
            desc: 'Auswahl, Navigation, Kalenderraster, Tooltip und Detail-Modal.'
        };
        this.desc.reqPerTpl[0] = {selc: '.cal-grid', desc: 'Raster für die Tageszellen.'};
        this.desc.reqPerTpl[1] = {selc: '.cal-attrs', desc: 'Container für die Attribut-Auswahl.'};
        this.desc.optPerTpl[0] = {selc: '.cal-detail', desc: 'UIkit-Modal für die Tagesdetailansicht.'};
        this.desc.reqPerSet[0] = {name: '<Zeitspalte>', desc: 'Spalte vom Typ timestamp/timestamptz/date; automatisch erkannt (bevorzugt "ts"), per Option timeAttr erzwingbar.'};
        this.desc.optPerSet[0] = {name: '<beliebige Zahlenspalte>', desc: 'Messwert-Attribute, automatisch aus der Collection-Beschreibung (numerische Typen ohne IDs und Metadaten).'};

        // Optionen mit Standardwerten
        let defaults = [
            ['attributes', [], 'Vorausgewählte Attribute. Leer = erstes verfügbares Attribut.', ['inn_temp', 'co2']],
            ['view', 'month', 'Startansicht: "month" oder "week".', 'week'],
            ['showViewSwitch', true, 'Umschalter Monat/Woche anzeigen.', true],
            ['interval', 15, 'Mittelwert-Intervall der Monatsansicht in Minuten (0 = Rohdaten).', 15],
            ['weekInterval', 5, 'Mittelwert-Intervall der Wochenansicht in Minuten (feiner, da größere Diagramme).', 5],
            ['intervalChoices', [1, 5, 10, 15, 30, 60], 'Auswählbare Intervalle in Minuten.', [5, 15, 60]],
            ['lineStyle', 'line', 'Darstellung der Intervall-Mittelwerte in Kalender und Tagesdiagramm: "line" (Linie) oder "step" (Treppe, je Intervall eine waagerechte Stufe). Bei Originaldaten immer Linie.', 'step'],
            ['slowIntervalMinutes', 1,'Ab diesem (feineren) Intervall erscheint ein Hinweis auf längere Darstellungszeit.', 1],
            ['startMonth', 'latest', '"latest" (Zeitraum der neuesten Daten), "today" oder "YYYY-MM" (Woche: erste Woche des Monats).', '2026-01'],
            ['attributeMeta', {}, 'Anzeigename, Einheit, Farbe, feste Skalengrenzen je Attribut (ergänzt calendar-config.js). '
                        + 'Schlüssel "<attribut>" oder "<tabelle>.<attribut>" (gilt nur für diese Tabelle und hat Vorrang).',
                {co2: {label: 'CO₂', unit: 'ppm', color: '#E69F00', min: 0}}],
            ['excludeAttrs', null, 'Spaltennamen, die keine Messwerte sind (ersetzt die Standardliste aus calendar-config.js).', ['id', 'unixtime']],
            ['excludePrefixes', null, 'Spalten-Präfixe ohne Messwerte (ersetzt die Standardliste).', ['pos']],
            ['excludeSuffixes', null, 'Spalten-Endungen ohne Messwerte (ersetzt die Standardliste).', ['_id']],
            ['excludeIdentity', null, 'Identity-/Auto-Increment-Spalten ausschließen (Standard true).', true],
            ['maxRecords', 200000, 'Höchstzahl Datensätze je Abruf, darüber erscheint eine Warnung.', 100000],
            ['detailIntervalMinutes', 0, 'Start-Auflösung des großen Tagesdiagramms in Minuten (0 = Originaldaten, volle Auflösung).', 0],
            ['detailIntervalChoices', [0, 15, 30, 60], 'Auswählbare Auflösungen im Tagesdiagramm (0 = Originaldaten).', [0, 15, 30, 60]],
            ['timeZone', 'Europe/Berlin', 'Zeitzone für Kalendertage und Uhrzeiten (MEZ/MESZ automatisch). Intern wird mit UTC-Zeitpunkten gerechnet.', 'Europe/Berlin'],
            ['dataTimeZone', null, 'Zeitzone von Zeitstempeln OHNE Zone (null = wie timeZone; HELIOS speichert deutsche Ortszeit).', 'UTC'],
            ['gapFactor', 2.5, 'Originaldaten: Lücken größer als üblicher Messabstand × gapFactor unterbrechen die Linie. Bei Mittelwerten bleibt jedes leere Intervall leer.', 2.5],
            ['timeAttr', null, 'Zeitspalte erzwingen; null = automatisch (bevorzugt "ts", sonst erste Spalte vom Typ timestamp/date).', 'messzeit'],
            ['deviceTable', 'tbl_observedobject', 'Tabelle mit den Geräten (Spalten name, data_collection).', 'tbl_observedobject'],
            ['autoSelectFirstDevice', true, 'Ohne gültiges FROM das erste Gerät aus deviceTable verwenden.', true],
            ['syncUrl', true, 'Zeitraum, Attribute und Intervall in die URL schreiben (Links teilbar, bleibt bei oo_change erhalten).', true],
            ['chartsPageUrl', 'charts.html', 'Ziel des Links „In SWAC Charts öffnen“ (null = kein Link).', null],
            ['chartsComponentId', 'charts', 'ID der Charts-Komponente auf chartsPageUrl (Filterziel comps:<id>).', 'charts']
        ];
        // opts-Indizes ab 1000 sind bei SWAC für komponentenunabhängige Optionen reserviert
        defaults.forEach(([name, value, desc, example], index) => {
            this.desc.opts[index] = {name: name, desc: desc, example: example};
            if (typeof options[name] === 'undefined')
                this.options[name] = value;
        });
        if (typeof options.showWhenNoData === 'undefined')
            this.options.showWhenNoData = true;

        this.desc.funcs[0] = {name: 'goToMonth', desc: 'Zeigt einen Monat an.',
            params: [{name: 'year', type: 'Number'}, {name: 'month', desc: '0-basiert', type: 'Number'}]};
        this.desc.funcs[1] = {name: 'reload', desc: 'Lädt den angezeigten Zeitraum neu.'};
        this.desc.events[0] = {name: 'swac_REQUESTOR_ID_diagramcalendar_rendered',
            desc: 'Nach dem Zeichnen eines Zeitraums.', data: '{ from, to, count, ms }'};
        this.desc.events[1] = {name: 'swac_REQUESTOR_ID_diagramcalendar_dayclick',
            desc: 'Klick auf einen Tag (vor dem Öffnen der Detailansicht).', data: '{ date }'};

        this.state = {
            mode: 'month', // Ansicht: 'month' oder 'week'
            weekStart: null, // Montag der angezeigten Woche 'YYYY-MM-DD'
            intervalByMode: {month: 15, week: 5},
            year: 0, month: 0, collection: null, deviceName: '', devices: [],
            available: [], metas: {}, attrs: [], interval: 15,
            lineStyle: 'line', // 'line' oder 'step', gilt gemeinsam für Kalender und Tagesdiagramm
            latest: null, requestNo: 0, cache: null, view: null
        };
        // Tagesdiagramm: interval = gewählte Auflösung (0 = Originaldaten, null = noch nicht gesetzt),
        // extraDays = einzeln nachgeladene Tage, falls der Monatsabruf abgeschnitten war
        this.detail = {date: null, chart: null, interval: null, extraDays: {}};
    }

    // ------------------------------------------------------------------ Übersetzung

    /*
     * Text aus langs/<sprache>.js (SWAC-Translator), Platzhalter %name% werden ersetzt.
     */
    t(key, vars) {
        let dict = SWAC.lang && SWAC.lang.dict ? SWAC.lang.dict.Diagramcalendar : null;
        let text = dict && typeof dict[key] !== 'undefined' ? dict[key] : Diagramcalendar_de[key];
        if (typeof text !== 'string' || !vars)
            return text;
        for (let name of Object.keys(vars))
            text = text.split('%' + name + '%').join(vars[name]);
        return text;
    }

    fmt(value, unit) {
        return this.Logic.formatValue(value, unit, this.t('locale'));
    }

    num(value) {
        return Number(value).toLocaleString(this.t('locale'));
    }

    periodLabel(year, month) {
        return this.Logic.formatMonthLabel(year, month, this.t('months'));
    }

    weekdayIndex(isoDate) {
        let p = isoDate.split('-').map(Number);
        return (new Date(p[0], p[1] - 1, p[2]).getDay() + 6) % 7; // Montag = 0
    }

    dateLabel(isoDate) {
        return this.t('weekdays')[this.weekdayIndex(isoDate)] + ', ' + this.Logic.formatGermanDate(isoDate);
    }

    // ------------------------------------------------------------------ Zeitzone
    // Alle Umrechnungen stehen in libs/calendar-logic.js; hier nur die Zonen aus den Optionen.

    zone() {
        return this.options.timeZone || this.Logic.DEFAULT_ZONE;
    }

    dataZone() {
        return this.options.dataTimeZone || this.zone();
    }

    /*
     * Kalendertag 'YYYY-MM-DD' in der Anzeige-Zone für einen Zeitpunkt
     * (Date wie new Date() für "heute", oder ein SmartData-Zeitstempel).
     */
    dayOf(value) {
        let when = this.Logic.localDayAndMinutes(value, this.zone(), this.dataZone());
        return when ? when.date : null;
    }

    /*
     * Uhrzeit mit Zonenname an Position minutes eines Tags, z. B. '14:00 MESZ'.
     */
    clock(isoDate, minutes) {
        return this.Logic.formatTimeOfDay(isoDate, minutes, this.zone()) + ' '
                + this.Logic.zoneLabel(isoDate, minutes, this.zone(), this.t('locale'));
    }

    // ------------------------------------------------------------------ Start

    /*
     * Wird von SWAC nach dem Laden des Templates und VOR dem Laden der Daten aufgerufen.
     */
    async init() {
        this.Logic = window.HeliosCalendarLogic;
        this.MiniChart = window.HeliosMiniChart;
        this.Data = window.HeliosSmartData;
        if (!this.Logic || !this.MiniChart || !this.Data) {
            Msg.error('Diagramcalendar', 'Bibliotheken aus libs/ wurden nicht geladen.', this.requestor);
            return;
        }
        this.collectElements();
        this.state.interval = this.options.interval;
        this.buildStaticTexts();
        this.bindEvents();

        // Tabelle aus FROM ({{data_collection}} ersetzt SWAC aus der URL)
        let from = this.requestor.fromName;
        let valid = typeof from === 'string' && from && from !== 'none'
                && !from.includes('{{') && !from.startsWith('[');
        if (valid) {
            this.state.collection = from;
            // SWAC lädt über FROM nur einen Datensatz statt der ganzen Tabelle. Bewusst ohne
            // order/includes: Die Zeitspalte ist erst nach collection/<tabelle> bekannt, und ein
            // falscher Spaltenname ergäbe HTTP 400 (SWAC sperrt die Datenquelle dann dauerhaft).
            this.requestor.fromWheres = {size: '1'};
        } else {
            // Kein Gerät gewählt: SWAC soll nichts laden, die Komponente wählt selbst
            this.requestor.fromName = 'none';
        }

        let st = this.state;
        let params = new URLSearchParams(window.location.search);
        let urlView = this.options.syncUrl ? params.get('view') : null;
        st.mode = ['month', 'week'].includes(urlView) ? urlView : (this.options.view === 'week' ? 'week' : 'month');
        // Jede Ansicht hat ihr eigenes Intervall (Woche feiner, da größere Diagramme)
        st.intervalByMode = {month: this.options.interval, week: this.options.weekInterval};
        let interval = Number(params.get('interval'));
        if (this.options.syncUrl && params.has('interval') && this.options.intervalChoices.includes(interval))
            st.intervalByMode[st.mode] = interval;
        st.interval = st.intervalByMode[st.mode];
        let urlStyle = this.options.syncUrl ? params.get('style') : null;
        st.lineStyle = this.validLineStyle(urlStyle) || this.validLineStyle(this.options.lineStyle) || 'line';
        this.renderIntervalOptions();
        this.el.viewSwitch.hidden = !this.options.showViewSwitch;

        // Startzeitraum: URL vor Option vor heute; "latest" wird nach dem Laden gesetzt
        this.setPeriodFromDate(new Date());
        let fixedMonth = this.parseMonth(this.options.syncUrl ? params.get('month') : null)
                || this.parseMonth(this.options.startMonth);
        if (fixedMonth) {
            st.year = fixedMonth.year;
            st.month = fixedMonth.month;
            st.weekStart = this.Logic.weekStartOf(this.Logic.toIsoDate(st.year, st.month, 1));
        }
        let weekParam = this.options.syncUrl ? params.get('week') : null;
        let fixedWeek = /^\d{4}-\d{2}-\d{2}$/.test(weekParam || '');
        if (fixedWeek) {
            st.weekStart = this.Logic.weekStartOf(weekParam);
            if (!fixedMonth)
                this.setMonthFromWeek();
        }
        this.updateModeButtons();
        this.renderTitle();
        this.renderGrid(this.currentCells(), null);
        this.setLoading(true);

        // Nicht auf das Laden warten: SWAC lädt erst nach init() den neuesten Datensatz
        this.start(params, valid, Boolean(fixedMonth || fixedWeek));
    }

    parseMonth(text) {
        let m = /^(\d{4})-(\d{2})$/.exec(text || '');
        return m ? {year: Number(m[1]), month: Number(m[2]) - 1} : null;
    }

    async start(params, fromValid, fixedMonth) {
        try {
            await this.loadDevice(params, fromValid);
        } catch (err) {
            this.state.collection = null;
            this.showMessage('danger', this.t('deviceerror'), err.message, {label: this.t('retry'), action: () => location.reload()});
        }
        if (!this.state.collection) {
            this.setLoading(false);
            this.renderGrid(this.currentCells(), false);
            this.setStatus('');
            return;
        }
        if (!fixedMonth && this.options.startMonth === 'latest' && this.state.latest)
            this.setPeriodFromDate(this.state.latest);
        this.loadAndRender();
    }

    createAdapter(collection) {
        let defaults = window.HeliosCalendarConfig || {};
        let cfg = {
            datasource: this.Data.pickDatasource(SWAC.config.datasources, collection) || undefined,
            attributes: Object.assign({}, defaults.attributes, this.options.attributeMeta || {}),
            maxRecords: this.options.maxRecords,
            timeZone: this.zone(),
            dataTimeZone: this.dataZone(),
            deviceTable: this.options.deviceTable,
            chartsPageUrl: this.options.chartsPageUrl,
            chartsComponentId: this.options.chartsComponentId
        };
        // Nur gesetzte Optionen überschreiben die Standardwerte aus calendar-config.js
        for (let key of ['timeAttr', 'excludeAttrs', 'excludePrefixes', 'excludeSuffixes', 'excludeIdentity']) {
            if (this.options[key] !== null && typeof this.options[key] !== 'undefined')
                cfg[key] = this.options[key];
        }
        return this.Data.createAdapter(cfg);
    }

    /*
     * Gerät (Tabelle), Messwert-Attribute und neuester Zeitstempel.
     */
    async loadDevice(params, fromValid) {
        let st = this.state;
        this.adapter = this.createAdapter(st.collection || this.options.deviceTable);
        try {
            st.devices = await this.adapter.fetchDevices();
        } catch (err) {
            // Ohne Geräteliste geht es weiter, wenn FROM eine Tabelle nennt
            if (!fromValid)
                throw err;
            st.devices = [];
        }
        if (!fromValid) {
            if (!this.options.autoSelectFirstDevice || st.devices.length === 0) {
                this.showMessage('primary', this.t('nodevice'), this.t('nodevicetext'));
                st.collection = null;
                return;
            }
            st.collection = st.devices[0].data_collection;
            Msg.hint('Diagramcalendar', 'Kein Gerät in FROM, verwende das erste Gerät >' + st.collection + '<.', this.requestor);
        }
        this.adapter = this.createAdapter(st.collection);
        let device = st.devices.find(d => d.data_collection === st.collection);
        st.deviceName = device ? device.name : st.collection;
        this.el.device.textContent = st.deviceName;
        this.el.device.title = st.collection;

        // Zeitspalte und Messwerte aus der Collection-Beschreibung (gilt für jede Tabelle)
        let info = await this.adapter.describeCollection(st.collection);
        st.timeAttr = info.timeAttr;
        st.available = info.measurements;
        st.metas = {};
        st.available.forEach((attr, index) => {
            st.metas[attr] = this.adapter.getAttributeMeta(attr, index, st.collection);
        });
        Msg.hint('Diagramcalendar', 'Tabelle >' + st.collection + '<: Zeitspalte >' + info.timeAttr + '<, Messwerte '
                + JSON.stringify(info.measurements) + ', ausgelassen ' + JSON.stringify(info.excluded.map(e => e.name + ':' + e.reason)), this.requestor);
        if (!info.timeAttr || st.available.length === 0) {
            // Kein Fehler, sondern ein Hinweis: z. B. reine Bild- oder Stammdatentabelle
            let skipped = info.excluded.filter(e => e.reason !== 'time').map(e => e.name);
            let key = info.timeAttr ? 'nomeasurementstext' : 'notimetext';
            this.showMessage('warning', this.t(info.timeAttr ? 'nomeasurements' : 'notime'), this.t(key, {
                table: st.collection,
                columns: skipped.length ? skipped.slice(0, 12).join(', ') + (skipped.length > 12 ? ' …' : '') : '–'
            }));
            this.el.latest.hidden = true;
            st.collection = null;
            return;
        }
        st.latest = await this.adapter.fetchLatestTimestamp(st.collection).catch(() => null);
        this.el.latest.hidden = !st.latest;
        let preferred = this.options.syncUrl && params.get('attrs')
                ? params.get('attrs').split(',') : (this.options.attributes || []);
        st.attrs = this.Logic.reconcileSelection(preferred.filter(a => st.available.includes(a)), st.available);
        this.renderAttributeOptions();
    }

    // ------------------------------------------------------------------ DOM

    collectElements() {
        let q = sel => this.requestor.querySelector(sel);
        this.el = {
            device: q('.cal-device'),
            attrs: q('.cal-attrs'),
            attrHint: q('.cal-hint'),
            interval: q('.cal-interval'),
            intervalHint: q('.cal-interval-hint'),
            lineStyle: q('.cal-linestyle'),
            prev: q('.cal-prev'),
            next: q('.cal-next'),
            viewSwitch: q('.cal-viewswitch'),
            today: q('.cal-today'),
            latest: q('.cal-latest'),
            title: q('.cal-title'),
            message: q('.cal-message'),
            summary: q('.cal-summary'),
            legend: q('.cal-legend'),
            weekdays: q('.cal-weekdays'),
            grid: q('.cal-grid'),
            loading: q('.cal-loading'),
            status: q('.cal-status'),
            tooltip: q('.cal-tooltip'),
            modal: q('.cal-detail'),
            detailTitle: q('.cal-detail-title'),
            detailPrev: q('.cal-detail-prev'),
            detailNext: q('.cal-detail-next'),
            detailStats: q('.cal-detail-stats'),
            detailMessage: q('.cal-detail-message'),
            detailChart: q('.cal-detail-chart'),
            detailInfo: q('.cal-detail-info'),
            detailResolution: q('.cal-detail-resolution'),
            detailLineStyle: q('.cal-detail-linestyle'),
            detailReset: q('.cal-detail-reset'),
            detailSwac: q('.cal-detail-swac')
        };
    }

    el_(tag, className, text) {
        let elem = document.createElement(tag);
        if (className)
            elem.className = className;
        if (text !== undefined && text !== null)
            elem.textContent = text;
        return elem;
    }

    buildStaticTexts() {
        let fragment = document.createDocumentFragment();
        for (let day of this.t('weekdays'))
            fragment.appendChild(this.el_('span', null, day));
        this.el.weekdays.replaceChildren(fragment);
        this.el.prev.setAttribute('aria-label', this.t('prev'));
        this.el.next.setAttribute('aria-label', this.t('next'));
        this.el.latest.title = this.t('latesttitle');
        this.el.grid.setAttribute('aria-label', this.t('measurements'));
        if (this.el.detailPrev) {
            this.el.detailPrev.setAttribute('aria-label', this.t('prevday'));
            this.el.detailNext.setAttribute('aria-label', this.t('nextday'));
        }
    }

    bindEvents() {
        this.el.attrs.addEventListener('change', evt => this.onAttrToggle(evt));
        this.el.interval.addEventListener('change', () => {
            this.state.interval = Number(this.el.interval.value);
            this.state.intervalByMode[this.state.mode] = this.state.interval;
            this.updateIntervalHint();
            this.loadAndRender();
        });
        if (this.el.lineStyle)
            this.el.lineStyle.addEventListener('change', () => this.setLineStyle(this.el.lineStyle.value));
        for (let button of this.el.viewSwitch.querySelectorAll('.cal-view'))
            button.addEventListener('click', () => this.setMode(button.dataset.view));
        this.el.prev.addEventListener('click', () => this.changePeriod(-1));
        this.el.next.addEventListener('click', () => this.changePeriod(1));
        this.el.today.addEventListener('click', () => this.goToDate(new Date()));
        this.el.latest.addEventListener('click', () => {
            if (this.state.latest)
                this.goToDate(this.state.latest);
        });
        let grid = this.el.grid;
        grid.addEventListener('pointermove', evt => this.onPointerMove(evt));
        grid.addEventListener('pointerleave', () => this.hideTooltip());
        grid.addEventListener('focusin', evt => this.onFocusIn(evt));
        grid.addEventListener('focusout', () => this.hideTooltip());
        grid.addEventListener('click', evt => {
            let cell = evt.target.closest('.cal-day[data-has-data]');
            if (cell)
                this.openDetail(cell.dataset.date);
        });
        grid.addEventListener('keydown', evt => this.onGridKeyDown(evt));
        window.addEventListener('scroll', () => this.hideTooltip(), {passive: true});
        if (this.el.modal)
            this.bindDetailEvents();
        // Sprachwechsel über den SWAC-Translator: selbst erzeugte Texte neu aufbauen
        document.addEventListener('swac_lang_loaded', () => this.onLanguageChanged());
    }

    onLanguageChanged() {
        this.buildStaticTexts();
        this.renderIntervalOptions();
        this.renderTitle();
        if (this.state.cache && this.state.view)
            this.render(this.currentCells(), this.state.view.attrs);
        if (this.detail.date && this.el.modal && this.el.modal.classList.contains('uk-open'))
            this.renderDetail();
    }

    renderIntervalOptions() {
        let fragment = document.createDocumentFragment();
        let choices = this.options.intervalChoices.slice();
        if (!choices.includes(this.state.interval))
            choices.push(this.state.interval);
        for (let minutes of choices.sort((a, b) => a - b)) {
            let opt = this.el_('option', null, minutes + ' ' + (minutes === 1 ? this.t('minute') : this.t('minutes')));
            opt.value = minutes;
            fragment.appendChild(opt);
        }
        this.el.interval.replaceChildren(fragment);
        this.el.interval.value = this.state.interval;
        this.updateIntervalHint();
        this.updateLineStyleControls();
    }

    validLineStyle(style) {
        return style === 'line' || style === 'step' ? style : null;
    }

    /*
     * Treppe nur bei Intervall-Mittelwerten: Gilt für das gewählte Intervall (Kalender) bzw. die
     * gewählte Auflösung (Tagesdiagramm). Bei Originaldaten (0) ist die Auswahl deaktiviert.
     */
    useSteps(interval) {
        return this.state.lineStyle === 'step' && interval > 0;
    }

    setLineStyle(style) {
        style = this.validLineStyle(style);
        if (!style || style === this.state.lineStyle)
            return;
        this.state.lineStyle = style;
        this.updateLineStyleControls();
        // Nur neu zeichnen: loadAndRender nutzt den Cache und schreibt die URL
        if (this.state.cache)
            this.loadAndRender();
        if (this.detail.date && this.el.modal && this.el.modal.classList.contains('uk-open'))
            this.renderDetail();
    }

    updateLineStyleControls() {
        let pairs = [[this.el.lineStyle, this.state.interval], [this.el.detailLineStyle, this.detail.interval]];
        for (let [select, interval] of pairs) {
            if (!select)
                continue;
            let disabled = !(interval > 0);
            select.value = disabled ? 'line' : this.state.lineStyle;
            select.disabled = disabled;
            select.title = disabled ? this.t('linestyledisabled') : '';
        }
    }

    updateIntervalHint() {
        let slow = this.state.interval > 0 && this.state.interval <= this.options.slowIntervalMinutes;
        this.el.intervalHint.hidden = !slow;
        this.el.intervalHint.textContent = slow ? this.t('slowinterval') : '';
    }

    renderAttributeOptions() {
        let fragment = document.createDocumentFragment();
        for (let attr of this.state.available) {
            let meta = this.state.metas[attr];
            let label = this.el_('label', 'cal-attr');
            let input = this.el_('input', 'uk-checkbox');
            input.type = 'checkbox';
            input.name = this.requestor.id + '_attr';
            input.value = attr;
            input.checked = this.state.attrs.includes(attr);
            let swatch = this.el_('span', 'cal-swatch');
            swatch.style.background = meta.color;
            label.title = attr;
            label.append(input, swatch, document.createTextNode(meta.unit ? meta.label + ' (' + meta.unit + ')' : meta.label));
            fragment.appendChild(label);
        }
        this.el.attrs.replaceChildren(fragment);
    }

    onAttrToggle(evt) {
        let checked = [...this.el.attrs.querySelectorAll('input[type="checkbox"]')].filter(i => i.checked).map(i => i.value);
        if (checked.length === 0) {
            evt.target.checked = true;
            this.el.attrHint.textContent = this.t('atleastonehint');
            return;
        }
        this.el.attrHint.textContent = '';
        this.state.attrs = this.state.available.filter(a => checked.includes(a));
        this.loadAndRender();
    }

    // ------------------------------------------------------------------ Zeitraum

    isWeek() {
        return this.state.mode === 'week';
    }

    // Kalendertag in der Anzeige-Zone (nicht in der Zone des Browsers)
    localIso(date) {
        return this.dayOf(date);
    }

    /*
     * Setzt Monat und Woche so, dass das Datum in beiden enthalten ist.
     * @param date Date (z. B. new Date() = jetzt) oder Zeitstempel aus SmartData
     */
    setPeriodFromDate(date) {
        let iso = this.localIso(date);
        this.state.year = Number(iso.slice(0, 4));
        this.state.month = Number(iso.slice(5, 7)) - 1;
        this.state.weekStart = this.Logic.weekStartOf(iso);
    }

    // Monat zur Woche: der Monat, in dem der Donnerstag liegt (wie bei ISO-Kalenderwochen)
    setMonthFromWeek() {
        let thursday = this.Logic.addDays(this.state.weekStart, 3);
        this.state.year = Number(thursday.slice(0, 4));
        this.state.month = Number(thursday.slice(5, 7)) - 1;
    }

    currentCells() {
        return this.isWeek() ? this.Logic.buildWeekGrid(this.state.weekStart)
                : this.Logic.buildMonthGrid(this.state.year, this.state.month);
    }

    /*
     * Zeitraum für EINEN Request: Monat bzw. Mo 00:00 bis folgender Mo 00:00.
     * Eine Woche über eine Monatsgrenze wird direkt gefiltert, nicht aus zwei Monaten geladen.
     */
    currentRange() {
        if (this.isWeek())
            return {from: this.state.weekStart, to: this.Logic.addDays(this.state.weekStart, 7)};
        let next = this.Logic.shiftMonth(this.state.year, this.state.month, 1);
        return {
            from: this.Logic.toIsoDate(this.state.year, this.state.month, 1),
            to: this.Logic.toIsoDate(next.year, next.month, 1)
        };
    }

    currentLabel() {
        return this.isWeek() ? this.Logic.formatWeekLabel(this.state.weekStart, this.t('week'))
                : this.periodLabel(this.state.year, this.state.month);
    }

    changePeriod(delta) {
        if (this.isWeek()) {
            this.state.weekStart = this.Logic.addDays(this.state.weekStart, 7 * delta);
            this.setMonthFromWeek();
            this.loadAndRender();
            return;
        }
        let shifted = this.Logic.shiftMonth(this.state.year, this.state.month, delta);
        this.goToMonth(shifted.year, shifted.month);
    }

    goToDate(date) {
        this.setPeriodFromDate(date);
        this.loadAndRender();
    }

    goToMonth(year, month) {
        this.state.year = year;
        this.state.month = month;
        this.state.weekStart = this.Logic.weekStartOf(this.Logic.toIsoDate(year, month, 1));
        this.loadAndRender();
    }

    isCurrentPeriod(date) {
        if (this.isWeek())
            return this.Logic.weekStartOf(this.localIso(date)) === this.state.weekStart;
        let iso = this.localIso(date);
        return Number(iso.slice(0, 4)) === this.state.year && Number(iso.slice(5, 7)) - 1 === this.state.month;
    }

    periodLabelForDate(date) {
        return this.isWeek() ? this.Logic.formatWeekLabel(this.Logic.weekStartOf(this.localIso(date)), this.t('week'))
                : this.periodLabel(Number(this.localIso(date).slice(0, 4)), Number(this.localIso(date).slice(5, 7)) - 1);
    }

    /*
     * Umschalten Monat/Woche. Die Woche startet im angezeigten Monat bei heute, sonst bei
     * den neuesten Daten, sonst beim ersten Tag mit Daten, sonst in der ersten Woche.
     * So liegt die Woche meist im bereits geladenen Monat (kein neuer Request).
     */
    setMode(mode) {
        let st = this.state;
        if (mode === st.mode)
            return;
        if (mode === 'week') {
            let monthPrefix = this.Logic.toIsoDate(st.year, st.month, 1).slice(0, 8);
            let candidates = [this.localIso(new Date()), st.latest ? this.localIso(st.latest) : null];
            let start = candidates.find(d => d && d.startsWith(monthPrefix)) || null;
            if (!start && st.view) {
                start = this.Logic.buildMonthGrid(st.year, st.month)
                        .map(c => c.date).find(d => d.startsWith(monthPrefix) && st.view.hasData(d)) || null;
            }
            st.weekStart = this.Logic.weekStartOf(start || this.Logic.toIsoDate(st.year, st.month, 1));
        } else {
            this.setMonthFromWeek();
        }
        st.intervalByMode[st.mode] = st.interval;
        st.mode = mode;
        st.interval = st.intervalByMode[mode];
        this.renderIntervalOptions();
        this.updateModeButtons();
        this.loadAndRender();
    }

    updateModeButtons() {
        for (let button of this.el.viewSwitch.querySelectorAll('.cal-view')) {
            let active = button.dataset.view === this.state.mode;
            button.classList.toggle('uk-button-primary', active);
            button.classList.toggle('uk-button-default', !active);
            button.setAttribute('aria-pressed', String(active));
        }
        this.el.grid.classList.toggle('cal-grid--week', this.isWeek());
        this.requestor.classList.toggle('cal--week', this.isWeek());
    }

    updateUrl() {
        if (!this.options.syncUrl)
            return;
        let url = new URL(window.location.href);
        url.searchParams.set('data_collection', this.state.collection);
        if (this.isWeek()) {
            url.searchParams.set('view', 'week');
            url.searchParams.set('week', this.state.weekStart);
            url.searchParams.delete('month');
        } else {
            url.searchParams.delete('view');
            url.searchParams.delete('week');
            url.searchParams.set('month', this.state.year + '-' + String(this.state.month + 1).padStart(2, '0'));
        }
        url.searchParams.set('attrs', this.state.attrs.join(','));
        url.searchParams.set('interval', this.state.interval);
        if (this.state.lineStyle === 'step')
            url.searchParams.set('style', 'step');
        else
            url.searchParams.delete('style');
        window.history.replaceState(window.history.state, '', url.href);
    }

    // ------------------------------------------------------------------ Laden

    reload() {
        this.state.cache = null;
        this.loadAndRender();
    }

    loadAndRender() {
        let st = this.state;
        if (!st.collection)
            return;
        this.hideTooltip();
        this.updateUrl();
        this.renderTitle();
        let cells = this.currentCells();
        let range = this.currentRange();
        let attrs = st.attrs.slice();
        let key = [st.collection, range.from, range.to, attrs.join(',')].join('|');

        // Ohne neuen Abruf neu berechnen, wenn die Daten schon geladen sind: gleiches Gerät,
        // gleiche Attribute und der geladene Zeitraum enthält den angezeigten
        // (z. B. nur Intervall geändert oder Woche innerhalb des geladenen Monats)
        let c = st.cache;
        if (c && c.collection === st.collection && c.attrs === attrs.join(',')
                && c.range.from <= range.from && c.range.to >= range.to) {
            // Noch laufende Abrufe für eine frühere Auswahl ungültig machen. Sonst würde eine
            // verspätete Antwort (z. B. Folgemonat) diese Anzeige wieder überschreiben.
            st.requestNo++;
            this.setLoading(false);
            this.render(cells, attrs);
            return;
        }

        let requestNo = ++st.requestNo;
        let started = performance.now();
        this.setLoading(true);
        this.clearMessage();
        this.setStatus(this.t('loadingperiod', {period: this.currentLabel()}));

        this.adapter.fetchRange(st.collection, attrs, range.from, range.to).then(result => {
            if (requestNo !== st.requestNo)
                return;
            st.cache = {
                key: key,
                collection: st.collection,
                attrs: attrs.join(','),
                range: range,
                split: this.Logic.splitByDay(result.records, attrs, this.adapter.getTimeAttr(), this.zone(), this.dataZone()),
                count: result.records.length,
                truncated: result.truncated,
                ms: performance.now() - started
            };
            this.render(cells, attrs);
        }).catch(err => {
            if (requestNo !== st.requestNo)
                return;
            st.cache = null;
            st.view = null;
            this.renderLegend(null);
            this.el.summary.replaceChildren();
            this.renderGrid(cells, false);
            this.showMessage('danger', this.t('loaderror'), err.message, {label: this.t('retry'), action: () => this.loadAndRender()});
            this.setStatus('');
        }).finally(() => {
            if (requestNo === st.requestNo)
                this.setLoading(false);
        });
    }

    render(cells, attrs) {
        let st = this.state;
        let cache = st.cache;
        // Nur die angezeigten Tage: Skala und Übersicht gelten für den angezeigten Zeitraum
        let shownDates = new Set(cells.filter(c => c.inMonth).map(c => c.date));
        let shownSplit = {};
        for (let attr of attrs)
            shownSplit[attr] = new Map([...cache.split[attr]].filter(([date]) => shownDates.has(date)));
        let reduced = this.Logic.reduceDayMaps(shownSplit, st.interval);
        let view = this.buildView(attrs, reduced);
        st.view = view;

        this.renderLegend(view);
        this.renderSummary(view);
        this.renderGrid(cells, view);

        let periodCells = cells.filter(c => c.inMonth);
        let daysWithData = periodCells.filter(c => view.hasData(c.date)).length;
        // Aus einem größeren geladenen Zeitraum gezeichnet (z. B. Woche aus Monat): nur angezeigte Tage zählen
        let range = this.currentRange();
        let sameRange = cache.range.from === range.from && cache.range.to === range.to;
        let shownCount = sameRange ? cache.count : periodCells.reduce((n, c) =>
            n + Math.max(0, ...attrs.map(a => (cache.split[a].get(c.date) || []).length)), 0);
        this.clearMessage();
        if (daysWithData === 0)
            this.showNoDataMessage();
        else if (cache.truncated)
            this.showMessage('warning', this.t('truncated'), this.t('truncatedtext', {max: this.num(this.options.maxRecords)}));

        this.setStatus(this.t('status', {
            device: st.deviceName,
            count: this.num(shownCount),
            days: daysWithData,
            total: periodCells.length,
            resolution: st.interval > 0 ? this.t('resolutionmean', {n: st.interval}) : this.t('resolutionraw'),
            seconds: (cache.ms / 1000).toLocaleString(this.t('locale'), {maximumFractionDigits: 1})
        }));
        document.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_diagramcalendar_rendered', {
            detail: {view: st.mode, from: range.from, to: range.to, count: shownCount, ms: cache.ms}
        }));
    }

    showNoDataMessage() {
        let text = this.t('nodatarange', {period: this.currentLabel()});
        let action = null;
        if (this.state.latest) {
            let latest = this.state.latest;
            text += ' ' + this.t('newestfrom', {date: this.Logic.formatGermanDate(this.localIso(latest))});
            if (!this.isCurrentPeriod(latest)) {
                action = {
                    label: this.t('goto', {period: this.periodLabelForDate(latest)}),
                    action: () => this.goToDate(latest)
                };
            }
        }
        this.showMessage('primary', this.t('nodata'), text, action);
    }

    /*
     * Tageswerte je Attribut, Gruppen je Einheit mit eigener Skala, Linienstil, Tageskennzahlen.
     */
    buildView(attrs, dayMaps) {
        const DASH_PATTERNS = [null, '5 3', '1.5 2.5'];
        let metas = this.state.metas;
        let styles = {};
        let groups = this.Logic.groupAttributesByUnit(attrs, metas);
        for (let group of groups) {
            group.scale = this.Logic.computeScale(group.attrs.map(a => dayMaps[a]), group.attrs.map(a => metas[a]));
            group.attrs.forEach((attr, index) => {
                styles[attr] = {color: metas[attr].color, dash: DASH_PATTERNS[index % DASH_PATTERNS.length]};
            });
        }
        let stats = {};
        for (let attr of attrs) {
            stats[attr] = new Map();
            for (let [date, points] of dayMaps[attr])
                stats[attr].set(date, this.Logic.summarize(points));
        }
        return {
            attrs: attrs, dayMaps: dayMaps, groups: groups, styles: styles, stats: stats,
            hasData: date => attrs.some(a => dayMaps[a].has(date))
        };
    }

    // ------------------------------------------------------------------ Darstellung

    renderTitle() {
        this.el.title.textContent = this.currentLabel();
        this.el.today.disabled = this.isCurrentPeriod(new Date());
    }

    createLineSample(style) {
        const SVG_NS = 'http://www.w3.org/2000/svg';
        let svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 8');
        svg.setAttribute('class', 'cal-legend-line');
        svg.setAttribute('aria-hidden', 'true');
        let line = document.createElementNS(SVG_NS, 'line');
        for (let [k, v] of [['x1', 0], ['y1', 4], ['x2', 24], ['y2', 4], ['stroke', style.color], ['stroke-width', 2]])
            line.setAttribute(k, v);
        if (style.dash)
            line.setAttribute('stroke-dasharray', style.dash);
        svg.appendChild(line);
        return svg;
    }

    renderLegend(view) {
        if (!view) {
            this.el.legend.replaceChildren();
            return;
        }
        let fragment = document.createDocumentFragment();
        for (let group of view.groups) {
            let groupElem = this.el_('div', 'cal-legend-group');
            for (let attr of group.attrs) {
                let item = this.el_('span', 'cal-legend-item');
                item.append(this.createLineSample(view.styles[attr]), document.createTextNode(this.state.metas[attr].label));
                groupElem.appendChild(item);
            }
            groupElem.appendChild(this.el_('span', 'cal-legend-range', group.scale
                    ? this.t('yaxis', {min: this.fmt(group.scale.min, group.unit), max: this.fmt(group.scale.max, group.unit)})
                    : this.t('nodatamonth', {unit: group.unit || this.t('nounit')})));
            fragment.appendChild(groupElem);
        }
        let single = view.groups.every(g => g.attrs.length === 1);
        fragment.appendChild(this.el_('div', 'cal-legend-axis',
                (view.groups.length > 1 ? this.t('legendperunit') : '') + this.t('legendaxis') + (single ? this.t('legendband') : '')));
        this.el.legend.replaceChildren(fragment);
    }

    renderSummary(view) {
        let fragment = document.createDocumentFragment();
        for (let attr of view.attrs) {
            let meta = this.state.metas[attr];
            // Je Attribut eigene Kennzahlen (nie über Attribute/Einheiten hinweg gemittelt)
            let s = this.Logic.summarizePeriod(view.stats[attr]);
            if (!s)
                continue;
            let card = this.el_('div', 'cal-summary-item');
            card.style.setProperty('--attr-color', meta.color);
            let name = this.el_('div', 'cal-summary-name', meta.label);
            // Konstante Spalten (z. B. Koordinaten, Flags) bleiben auswählbar, werden aber gekennzeichnet
            if (s.min.value === s.max.value) {
                name.appendChild(this.el_('span', 'cal-summary-constant', ' · ' + this.t('constant')));
                name.title = this.t('constanthint');
            }
            // Abruf beim Limit maxRecords abgeschnitten: Kennzahlen nicht als vollständig ausgeben
            if (this.state.cache.truncated)
                name.appendChild(this.el_('span', 'cal-summary-incomplete', ' · ' + this.t('truncated')));
            card.appendChild(name);
            let values = this.el_('div', 'cal-summary-values');
            values.append(
                    this.statValue(this.t('mean'), this.fmt(s.mean, meta.unit)),
                    this.statValue(this.t('min'), this.fmt(s.min.value, meta.unit), this.t('summaryat', {date: this.Logic.formatGermanDate(s.min.date).slice(0, 6)})),
                    this.statValue(this.t('max'), this.fmt(s.max.value, meta.unit), this.t('summaryat', {date: this.Logic.formatGermanDate(s.max.date).slice(0, 6)})),
                    this.statValue(this.t('count'), this.num(s.count)));
            card.appendChild(values);
            fragment.appendChild(card);
        }
        this.el.summary.replaceChildren(fragment);
    }

    statValue(label, value, hint) {
        let elem = this.el_('span', 'cal-summary-value');
        elem.append(this.el_('span', 'cal-summary-label', label), this.el_('strong', null, value));
        if (hint)
            elem.appendChild(this.el_('span', 'cal-summary-date', hint));
        return elem;
    }

    todayIso() {
        return this.localIso(new Date());
    }

    renderGrid(cells, view) {
        let today = this.todayIso();
        let fragment = document.createDocumentFragment();
        for (let cell of cells)
            fragment.appendChild(this.renderCell(cell, view, today));
        this.el.grid.replaceChildren(fragment);
    }

    /*
     * @param view Daten des Zeitraums; null = lädt (Platzhalter), false = Fehler (leere Zelle)
     */
    renderCell(cell, view, today) {
        let elem = this.el_('div', 'cal-day');
        elem.setAttribute('role', 'gridcell');
        elem.dataset.date = cell.date;
        let weekday = this.weekdayIndex(cell.date);
        if (weekday >= 5)
            elem.classList.add('cal-day--weekend');
        if (!cell.inMonth)
            elem.classList.add('cal-day--outside');
        let isToday = cell.date === today;
        if (isToday)
            elem.classList.add('cal-day--today');
        if (cell.date > today)
            elem.classList.add('cal-day--future');

        let head = this.el_('div', 'cal-day-head');
        // Woche: Datum mit Monat, da die Woche über eine Monatsgrenze gehen kann
        head.appendChild(this.el_('span', 'cal-day-number',
                this.isWeek() ? this.Logic.formatGermanDate(cell.date).slice(0, 6) : cell.day));
        if (isToday)
            head.appendChild(this.el_('span', 'cal-today-badge', this.t('today')));
        elem.appendChild(head);

        if (!cell.inMonth) {
            elem.setAttribute('aria-hidden', 'true');
            return elem;
        }
        let label = this.dateLabel(cell.date);
        if (!view) {
            if (view === null)
                elem.appendChild(this.el_('div', 'cal-skeleton'));
            return elem;
        }
        if (!view.hasData(cell.date)) {
            elem.classList.add('cal-day--empty');
            elem.appendChild(this.el_('div', 'cal-no-data', this.t('nodata')));
            elem.setAttribute('aria-label', label + ': ' + this.t('nodata'));
            return elem;
        }

        elem.dataset.hasData = '';
        elem.tabIndex = 0;
        elem.setAttribute('aria-label', label + '. ' + view.attrs.map(a => this.describeAttr(view, a, cell.date)).join('. ')
                + '. ' + this.t('cellhint'));
        if (view.attrs.length === 1) {
            let s = view.stats[view.attrs[0]].get(cell.date);
            head.appendChild(this.el_('span', 'cal-day-peak', this.t('mean') + ' ' + this.fmt(s.mean, this.state.metas[view.attrs[0]].unit)));
        }

        let charts = this.el_('div', 'cal-day-charts');
        let interval = this.state.interval;
        let steps = this.useSteps(interval);
        let dayMinutes = this.Logic.dayLengthMinutes(cell.date, this.zone());
        // Mittelwerte: fehlt ein Intervall, bleibt es leer (Abstand > 1 Intervall). Rohdaten (0) wie bisher.
        let maxGap = interval > 0 ? interval : Math.max(5, interval * this.options.gapFactor);
        // Treppe: Mittelwerte als Stufen über das ganze Intervall (view.dayMaps bleibt für den Tooltip unverändert)
        let drawGap = steps ? this.Logic.stepMaxGap(maxGap, interval) : maxGap;
        for (let group of view.groups) {
            let unitElem = this.el_('div', 'cal-unit-chart');
            if (view.groups.length > 1 && group.unit)
                unitElem.appendChild(this.el_('span', 'cal-unit-label', group.unit));
            let withData = group.attrs.filter(a => view.dayMaps[a].has(cell.date));
            if (withData.length === 0) {
                unitElem.classList.add('cal-unit-chart--empty');
                unitElem.appendChild(this.el_('span', 'cal-unit-nodata', this.t('nodata')));
            } else {
                let series = withData.map(a => ({
                    points: steps ? this.Logic.toStepPoints(view.dayMaps[a].get(cell.date), interval, dayMinutes)
                            : view.dayMaps[a].get(cell.date),
                    color: view.styles[a].color,
                    dash: view.styles[a].dash,
                    band: group.attrs.length === 1
                }));
                let svg = this.MiniChart.renderMiniChart(series, group.scale, {maxGapMinutes: drawGap, label: '',
                    dayMinutes: dayMinutes});
                svg.setAttribute('aria-hidden', 'true');
                unitElem.appendChild(svg);
                // Woche: Wertebereich der y-Achse an der Zelle (größere Diagramme)
                if (this.isWeek()) {
                    unitElem.appendChild(this.el_('span', 'cal-axis-y cal-axis-y--max', this.fmt(group.scale.max, group.unit)));
                    unitElem.appendChild(this.el_('span', 'cal-axis-y cal-axis-y--min', this.fmt(group.scale.min, group.unit)));
                }
            }
            charts.appendChild(unitElem);
        }
        let crosshair = this.el_('div', 'cal-crosshair');
        crosshair.hidden = true;
        charts.appendChild(crosshair);
        elem.appendChild(charts);
        // Woche: Uhrzeit-Achse unter dem Diagramm
        if (this.isWeek()) {
            let axis = this.el_('div', 'cal-axis-x');
            axis.setAttribute('aria-hidden', 'true');
            for (let h of ['00', '06', '12', '18', '24'])
                axis.appendChild(this.el_('span', null, h));
            elem.appendChild(axis);
        }
        return elem;
    }

    describeAttr(view, attr, date) {
        let meta = this.state.metas[attr];
        let s = view.stats[attr].get(date);
        if (!s)
            return meta.label + ': ' + this.t('nodata');
        return meta.label + ': ' + this.t('min') + ' ' + this.fmt(s.min, meta.unit)
                + ', ' + this.t('max') + ' ' + this.fmt(s.max, meta.unit)
                + ', ' + this.t('mean') + ' ' + this.fmt(s.mean, meta.unit);
    }

    // ------------------------------------------------------------------ Tooltip

    onPointerMove(evt) {
        if (evt.pointerType === 'touch')
            return;
        let cell = evt.target.closest('.cal-day[data-has-data]');
        if (!cell || !this.state.view) {
            this.hideTooltip();
            return;
        }
        let charts = cell.querySelector('.cal-day-charts');
        let rect = charts.getBoundingClientRect();
        let ratio = Math.min(1, Math.max(0, (evt.clientX - rect.left) / rect.width));
        this.markActiveCell(cell);
        let crosshair = charts.querySelector('.cal-crosshair');
        crosshair.style.left = (ratio * 100) + '%';
        crosshair.hidden = false;
        this.showTooltip(cell.dataset.date, ratio * this.Logic.dayLengthMinutes(cell.dataset.date, this.zone()), evt.clientX, evt.clientY);
    }

    onFocusIn(evt) {
        let cell = evt.target.closest('.cal-day[data-has-data]');
        if (!cell)
            return;
        this.markActiveCell(cell);
        let rect = cell.getBoundingClientRect();
        this.showTooltip(cell.dataset.date, null, rect.left + rect.width / 2, rect.bottom);
    }

    markActiveCell(cell) {
        let active = this.el.grid.querySelector('.cal-day--hover');
        if (active && active !== cell) {
            active.classList.remove('cal-day--hover');
            let ch = active.querySelector('.cal-crosshair');
            if (ch)
                ch.hidden = true;
        }
        cell.classList.add('cal-day--hover');
    }

    showTooltip(date, minutes, x, y) {
        let view = this.state.view;
        let tip = this.el.tooltip;
        let fragment = document.createDocumentFragment();
        let head = this.el_('div', 'cal-tooltip-head');
        head.appendChild(this.el_('strong', null, this.dateLabel(date)));
        if (minutes !== null)
            head.appendChild(this.el_('span', 'cal-tooltip-time', this.clock(date, minutes)));
        fragment.appendChild(head);

        let table = this.el_('table', 'cal-tooltip-table');
        let headRow = this.el_('tr');
        for (let text of ['', minutes !== null ? this.t('value') : null, this.t('min'), this.t('max'), this.t('mean')].filter(x => x !== null))
            headRow.appendChild(this.el_('th', null, text));
        table.appendChild(headRow);
        for (let attr of view.attrs) {
            let meta = this.state.metas[attr];
            let s = view.stats[attr].get(date);
            let row = this.el_('tr');
            let name = this.el_('td', 'cal-tooltip-name');
            let swatch = this.el_('span', 'cal-swatch');
            swatch.style.background = meta.color;
            name.append(swatch, document.createTextNode(meta.label));
            row.appendChild(name);
            if (!s) {
                let empty = this.el_('td', 'cal-tooltip-empty', this.t('nodata'));
                empty.colSpan = minutes !== null ? 4 : 3;
                row.appendChild(empty);
                table.appendChild(row);
                continue;
            }
            if (minutes !== null) {
                let point = this.Logic.nearestPoint(view.dayMaps[attr].get(date), minutes, Math.max(this.state.interval, 5));
                row.appendChild(this.el_('td', 'cal-tooltip-now', point ? this.fmt(point.value, meta.unit) : '–'));
            }
            row.append(this.el_('td', null, this.fmt(s.min, meta.unit)),
                    this.el_('td', null, this.fmt(s.max, meta.unit)),
                    this.el_('td', null, this.fmt(s.mean, meta.unit)));
            table.appendChild(row);
        }
        fragment.appendChild(table);
        let count = Math.max(...view.attrs.map(a => (view.stats[a].get(date) || {count: 0}).count));
        fragment.appendChild(this.el_('div', 'cal-tooltip-foot', this.t('tooltipfoot', {count: this.num(count)})
                + (minutes !== null && this.state.interval > 0 ? this.t('tooltipmean', {n: this.state.interval}) : '')
                + this.t('tooltipclick')));
        tip.replaceChildren(fragment);
        tip.hidden = false;

        let margin = 14;
        let w = tip.offsetWidth, h = tip.offsetHeight;
        let left = x + margin, top = y + margin;
        if (left + w > window.innerWidth - 8)
            left = Math.max(8, x - w - margin);
        if (top + h > window.innerHeight - 8)
            top = Math.max(8, y - h - margin);
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
    }

    hideTooltip() {
        if (!this.el)
            return;
        this.el.tooltip.hidden = true;
        let active = this.el.grid.querySelector('.cal-day--hover');
        if (active) {
            active.classList.remove('cal-day--hover');
            let ch = active.querySelector('.cal-crosshair');
            if (ch)
                ch.hidden = true;
        }
    }

    onGridKeyDown(evt) {
        let cell = evt.target.closest('.cal-day');
        if (!cell)
            return;
        if ((evt.key === 'Enter' || evt.key === ' ') && cell.hasAttribute('data-has-data')) {
            evt.preventDefault();
            this.openDetail(cell.dataset.date);
            return;
        }
        let moves = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7};
        if (!(evt.key in moves))
            return;
        let cells = [...this.el.grid.children];
        let index = cells.indexOf(cell) + moves[evt.key];
        while (index >= 0 && index < cells.length && !cells[index].hasAttribute('data-has-data'))
            index += Math.sign(moves[evt.key]);
        if (index >= 0 && index < cells.length) {
            evt.preventDefault();
            cells[index].focus();
        }
    }

    // ------------------------------------------------------------------ Detailansicht

    /*
     * Tagesdaten für die Detailansicht aus dem bereits geladenen Zeitraum (kein weiterer Request).
     */
    getDayContext(date) {
        let cache = this.state.cache, view = this.state.view;
        if (!cache || !view)
            return null;
        // Rohwerte des Tages: aus dem Monatsabruf, oder aus einem einzeln nachgeladenen Tag
        let extra = this.detail.extraDays[cache.key + '|' + date];
        if (typeof extra !== 'object')
            extra = null; // noch nicht nachgeladen (oder gerade 'loading')
        let raw = {};
        for (let attr of view.attrs)
            raw[attr] = (extra ? extra[attr].get(date) : cache.split[attr].get(date)) || [];
        let withData = [...this.el.grid.querySelectorAll('.cal-day[data-has-data]')].map(c => c.dataset.date);
        return {
            date: date,
            raw: raw,
            // Kennzahlen: bei nachgeladenem Tag direkt aus dessen Rohwerten
            stats: Object.fromEntries(view.attrs.map(a => [a, extra
                    ? this.Logic.summarize(raw[a])
                    : (view.stats[a].get(date) || null)])),
            // Monat abgeschnitten und dieser Tag (noch) nicht vollständig nachgeladen
            incomplete: cache.truncated && !extra,
            prevDate: withData.filter(d => d < date).pop() || null,
            nextDate: withData.find(d => d > date) || null
        };
    }

    bindDetailEvents() {
        this.el.detailPrev.addEventListener('click', () => this.navigateDetail('prevDate'));
        this.el.detailNext.addEventListener('click', () => this.navigateDetail('nextDate'));
        this.el.detailReset.addEventListener('click', () => {
            if (this.detail.chart && this.detail.chart.resetZoom)
                this.detail.chart.resetZoom();
        });
        // Auflösung im Tagesdiagramm gewechselt: nur das Diagramm neu zeichnen, kein neuer Abruf
        this.el.detailResolution.addEventListener('change', () => {
            this.detail.interval = Number(this.el.detailResolution.value);
            this.renderDetail();
        });
        if (this.el.detailLineStyle)
            this.el.detailLineStyle.addEventListener('change', () => this.setLineStyle(this.el.detailLineStyle.value));
        this.el.modal.addEventListener('keydown', evt => {
            if (evt.key === 'ArrowLeft')
                this.navigateDetail('prevDate');
            else if (evt.key === 'ArrowRight')
                this.navigateDetail('nextDate');
        });
        UIkit.util.on(this.el.modal, 'hidden', evt => {
            if (evt.target === this.el.modal)
                this.destroyDetailChart();
        });
    }

    openDetail(date) {
        this.hideTooltip();
        document.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_diagramcalendar_dayclick', {detail: {date: date}}));
        if (!this.el.modal)
            return;
        this.detail.date = date;
        UIkit.modal(this.el.modal).show();
        this.renderDetail();
    }

    navigateDetail(which) {
        let ctx = this.getDayContext(this.detail.date);
        if (ctx && ctx[which]) {
            this.detail.date = ctx[which];
            this.renderDetail();
        }
    }

    renderDetail() {
        let ctx = this.getDayContext(this.detail.date);
        if (!ctx)
            return;
        if (this.detail.interval === null)
            this.detail.interval = this.options.detailIntervalMinutes;
        this.renderDetailResolutionOptions();
        this.loadMissingDay(ctx.date);
        let view = this.state.view;
        this.el.detailTitle.textContent = this.dateLabel(ctx.date) + ' · ' + this.state.deviceName;
        this.el.detailPrev.disabled = !ctx.prevDate;
        this.el.detailNext.disabled = !ctx.nextDate;
        if (this.options.chartsPageUrl) {
            this.el.detailSwac.hidden = false;
            this.el.detailSwac.href = this.adapter.buildChartsPageUrl(this.state.collection, ctx.date);
        } else {
            this.el.detailSwac.hidden = true;
        }

        // Kennzahlen je Attribut mit Uhrzeit von Minimum und Maximum
        let fragment = document.createDocumentFragment();
        for (let attr of view.attrs) {
            let meta = this.state.metas[attr];
            let s = ctx.stats[attr];
            let card = this.el_('div', 'cal-summary-item');
            card.style.setProperty('--attr-color', meta.color);
            let name = this.el_('div', 'cal-summary-name', meta.label);
            if (ctx.incomplete)
                name.appendChild(this.el_('span', 'cal-summary-incomplete', ' · ' + this.t('truncated')));
            card.appendChild(name);
            let values = this.el_('div', 'cal-summary-values');
            if (!s) {
                values.appendChild(this.el_('span', 'cal-summary-label', this.t('nodataday')));
            } else {
                values.append(
                        this.statValue(this.t('mean'), this.fmt(s.mean, meta.unit)),
                        this.statValue(this.t('min'), this.fmt(s.min, meta.unit), this.extremeTime(ctx.date, ctx.raw[attr], 'min')),
                        this.statValue(this.t('max'), this.fmt(s.max, meta.unit), this.extremeTime(ctx.date, ctx.raw[attr], 'max')),
                        this.statValue(this.t('count'), this.num(s.count)));
            }
            card.appendChild(values);
            fragment.appendChild(card);
        }
        this.el.detailStats.replaceChildren(fragment);
        this.renderDetailChart(ctx);
    }

    /*
     * Auswahlliste „Auflösung“ im Tagesdiagramm: Originaldaten (0) und Mittelwerte (z. B. 15, 30, 60 min).
     */
    renderDetailResolutionOptions() {
        let fragment = document.createDocumentFragment();
        for (let minutes of this.options.detailIntervalChoices) {
            let text = minutes > 0 ? this.t('resolutionmean', {n: minutes}) : this.t('resolutionfull');
            let opt = this.el_('option', null, text);
            opt.value = minutes;
            fragment.appendChild(opt);
        }
        this.el.detailResolution.replaceChildren(fragment);
        this.el.detailResolution.value = this.detail.interval;
        this.updateLineStyleControls();
    }

    /*
     * Nur nötig, wenn der Monatsabruf beim Limit maxRecords abgeschnitten wurde:
     * Dann fehlen evtl. Rohwerte dieses Tages. Wir laden genau diesen einen Tag nach
     * und zeichnen danach neu. Sonst liegen alle Rohwerte schon im Cache.
     */
    loadMissingDay(date) {
        let st = this.state, cache = st.cache;
        let key = cache.key + '|' + date;
        if (!cache.truncated || this.detail.extraDays[key])
            return;
        let attrs = cache.attrs.split(',');
        this.detail.extraDays[key] = 'loading';
        this.adapter.fetchRange(st.collection, attrs, date, this.Logic.addDays(date, 1)).then(result => {
            this.detail.extraDays[key] = this.Logic.splitByDay(result.records, attrs, this.adapter.getTimeAttr(), this.zone(), this.dataZone());
            if (this.detail.date === date)
                this.renderDetail();
        }).catch(() => {
            delete this.detail.extraDays[key];
        });
    }

    extremeTime(date, points, which) {
        if (!points || points.length === 0)
            return null;
        let best = points[0];
        for (let p of points) {
            if (which === 'min' ? p.value < best.value : p.value > best.value)
                best = p;
        }
        return this.t('at', {time: this.clock(date, best.minutes)});
    }

    destroyDetailChart() {
        if (this.detail.chart) {
            this.detail.chart.destroy();
            this.detail.chart = null;
        }
    }

    showDetailMessage(type, text) {
        let box = this.el_('div', 'uk-alert uk-alert-' + type + ' cal-alert');
        box.appendChild(this.el_('p', null, text));
        this.el.detailMessage.replaceChildren(box);
    }

    withAlpha(hex, alpha) {
        let n = parseInt(String(hex).slice(1), 16);
        return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + alpha + ')';
    }

    /*
     * Chart.js-Konfiguration: je Attribut eine Linie, bis drei Attribute zusätzlich
     * Min–Max-Fläche, je Einheit eine y-Achse. EIN Update statt eines je Datensatz.
     */
    buildDetailChartConfig(ctx) {
        let L = this.Logic, metas = this.state.metas, view = this.state.view;
        // Gewählte Auflösung: 0 = Originaldaten (keine Mittelwerte), sonst Minuten je Mittelwert
        let interval = this.detail.interval;
        let original = !(interval > 0);
        // Treppe: jeder Mittelwert als waagerechte Stufe über sein Intervall (nur bei Mittelwerten)
        let steps = this.useSteps(interval);
        // Min–Max-Fläche nur bei Mittelwerten (bei Originaldaten ist Min = Max = Wert)
        let showBand = !original && view.attrs.length <= 3;
        // x-Achse = vergangene Minuten seit 00:00 Uhr (aus UTC): 23 h am 29.03., 25 h am 25.10.
        // Die Beschriftung zeigt die deutsche Uhrzeit, z. B. 00 01 03 04 … bzw. 00 01 02 02 03 …
        let zone = this.zone();
        let dayMinutes = L.dayLengthMinutes(ctx.date, zone);
        let zoneStart = L.zoneLabel(ctx.date, 0, zone, this.t('locale'));
        let zoneEnd = L.zoneLabel(ctx.date, dayMinutes - 1, zone, this.t('locale'));
        let datasets = [];
        let scales = {
            x: {
                type: 'linear', min: 0, max: dayMinutes,
                title: {display: true, text: this.t('time') + ' (' + (zoneStart === zoneEnd ? zoneStart : zoneStart + ' → ' + zoneEnd) + ')'},
                ticks: {stepSize: 60, maxRotation: 0, autoSkipPadding: 12, callback: v => L.formatTimeOfDay(ctx.date, v, zone)},
                grid: {color: '#eceef5'}
            }
        };
        view.groups.forEach((group, groupIndex) => {
            let axisId = 'y' + groupIndex;
            scales[axisId] = {
                type: 'linear',
                position: groupIndex % 2 === 0 ? 'left' : 'right',
                grace: '5%',
                title: {display: true, text: group.unit || metas[group.attrs[0]].label},
                grid: {drawOnChartArea: groupIndex === 0, color: '#eceef5'},
                ticks: {callback: v => this.num(v)}
            };
            for (let attr of group.attrs) {
                let raw = ctx.raw[attr] || [];
                // Bei interval 0 liefert reduceByInterval ALLE Rohwerte (als Kopie, Original bleibt unverändert)
                let points = L.reduceByInterval(raw, interval);
                if (points.length === 0)
                    continue;
                // Ab welchem Abstand die Linie unterbrochen wird (Messlücke):
                // bei Mittelwerten jedes leere Intervall (Abstand > 1 Intervall), bei Originaldaten nach dem üblichen Messtakt
                let maxGap = original ? Math.max(2, (L.typicalSpacing(raw) || 1) * this.options.gapFactor) : interval;
                if (steps) {
                    points = L.toStepPoints(points, interval, dayMinutes);
                    maxGap = L.stepMaxGap(maxGap, interval);
                }
                let meta = metas[attr];
                let style = view.styles[attr];
                if (showBand) {
                    datasets.push({label: meta.label + ' max', isBand: true, yAxisID: axisId,
                        data: L.toChartPoints(points, maxGap, 'max'), borderWidth: 0, pointRadius: 0, fill: false, spanGaps: false});
                    datasets.push({label: meta.label + ' min', isBand: true, yAxisID: axisId,
                        data: L.toChartPoints(points, maxGap, 'min'), borderWidth: 0, pointRadius: 0, spanGaps: false,
                        backgroundColor: this.withAlpha(meta.color, 0.15), fill: '-1'});
                }
                datasets.push({
                    label: meta.unit ? meta.label + ' (' + meta.unit + ')' : meta.label,
                    attr: attr, yAxisID: axisId,
                    data: L.toChartPoints(points, maxGap, 'value'),
                    borderColor: meta.color, backgroundColor: meta.color,
                    borderDash: style && style.dash ? style.dash.split(' ').map(Number) : [],
                    // Originaldaten: gerade Linien (tension 0), damit zwischen zwei Messwerten keine
                    // erfundenen Kurvenwerte entstehen; bei wenigen Punkten jeden Messwert als Punkt zeigen
                    borderWidth: 2, pointRadius: original && points.length <= 300 ? 2 : 0, pointHoverRadius: 4,
                    // Treppe ebenfalls ohne Glättung, sonst würden die Stufenkanten verrundet
                    tension: original || steps ? 0 : 0.15, spanGaps: false, fill: false
                });
            }
        });
        let hasZoom = window.Chart && Chart.registry && Chart.registry.plugins.get('zoom');
        return {
            type: 'line',
            data: {datasets: datasets},
            options: {
                animation: false, parsing: false, normalized: true, maintainAspectRatio: false,
                interaction: {mode: 'nearest', axis: 'x', intersect: false},
                scales: scales,
                plugins: {
                    legend: {labels: {color: '#1A1A1D', usePointStyle: true, pointStyle: 'line',
                            filter: item => !datasets[item.datasetIndex].isBand}},
                    tooltip: {
                        filter: item => !item.dataset.isBand && item.parsed.y !== null,
                        callbacks: {
                            title: items => items.length ? this.clock(ctx.date, items[0].parsed.x) : '',
                            label: item => ' ' + metas[item.dataset.attr].label + ': ' + this.fmt(item.parsed.y, metas[item.dataset.attr].unit)
                        }
                    },
                    zoom: hasZoom ? {
                        limits: {x: {min: 0, max: dayMinutes, minRange: 30}},
                        pan: {enabled: true, mode: 'x', modifierKey: 'shift'},
                        zoom: {wheel: {enabled: true}, pinch: {enabled: true}, mode: 'x',
                            drag: {enabled: true, backgroundColor: 'rgba(55,84,250,0.12)'}}
                    } : undefined
                }
            }
        };
    }

    renderDetailChart(ctx) {
        this.destroyDetailChart();
        this.el.detailMessage.replaceChildren();
        if (!window.Chart) {
            this.el.detailChart.replaceChildren();
            this.showDetailMessage('danger', this.t('nochartjs'));
            return;
        }
        if (!this.state.view.attrs.some(a => ctx.raw[a] && ctx.raw[a].length > 0)) {
            this.el.detailChart.replaceChildren();
            this.showDetailMessage('primary', this.t('nodataday'));
            return;
        }
        let canvas = this.el_('canvas');
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', this.dateLabel(ctx.date) + ': ' + this.state.view.attrs.map(a => this.state.metas[a].label).join(', '));
        this.el.detailChart.replaceChildren(canvas);
        let started = performance.now();
        try {
            this.detail.chart = new Chart(canvas, this.buildDetailChartConfig(ctx));
        } catch (err) {
            this.showDetailMessage('danger', this.t('charterror', {err: err.message}));
            return;
        }
        let interval = this.detail.interval;
        // Anzahl der gezeichneten Punkte (bei Originaldaten = Anzahl der Messwerte)
        let pointCount = this.state.view.attrs.reduce((n, a) =>
            n + this.Logic.reduceByInterval(ctx.raw[a] || [], interval).length, 0);
        this.el.detailInfo.textContent = this.t('detailinfo', {
            resolution: (interval > 0 ? this.t('resolutionmean', {n: interval}) : this.t('resolutionfull'))
                    + ' · ' + this.t('pointsshown', {n: this.num(pointCount)}),
            band: interval > 0 && this.state.view.attrs.length <= 3 ? this.t('detailband') : ''
        });
        this.el.detailChart.dataset.points = pointCount;
        this.el.detailChart.dataset.renderMs = Math.round(performance.now() - started);
    }

    // ------------------------------------------------------------------ Zustände

    setLoading(loading) {
        this.el.loading.hidden = !loading;
        this.el.grid.setAttribute('aria-busy', String(Boolean(loading)));
    }

    showMessage(type, title, text, action) {
        let box = this.el_('div', 'uk-alert uk-alert-' + type + ' cal-alert');
        let body = this.el_('p');
        body.append(this.el_('strong', null, title + ': '), document.createTextNode(text));
        box.appendChild(body);
        if (action) {
            let button = this.el_('button', 'uk-button uk-button-default uk-button-small', action.label);
            button.type = 'button';
            button.addEventListener('click', action.action);
            box.appendChild(button);
        }
        this.el.message.replaceChildren(box);
    }

    clearMessage() {
        this.el.message.replaceChildren();
    }

    setStatus(text) {
        this.el.status.textContent = text;
    }
}
