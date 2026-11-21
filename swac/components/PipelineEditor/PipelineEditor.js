import View from '../../View.js';
import forms from './PipelineForms.js';
import { createPipelineDraft, postPipelineDraft } from './PipelineBackendClient.js';

/**
 * PipelineEditor for SmartMonitoring.
 * Frontend-only implementation based on the existing group 4 prototype.
 * Data retrieval, Job execution, persistence and secure Python handling
 * must be implemented through the existing SWAC/SmartData architecture.
 */

export default class PipelineEditor extends View {

    constructor(options = {}) {
        super(options);

        this.name = 'PipelineEditor';
        this.desc.text = 'Visual editor for data-processing pipelines and block configuration.';
        this.desc.developers = 'Web Engineering Gruppe 4 (HSBI)';

        this.desc.templates[0] = {
            name: 'pipelineeditor',
            style: 'pipelineeditor',
            desc: 'Pipeline-Verwaltung, Pipeline-Flow und Bausteinkonfiguration'
        };

        this.desc.reqPerTpl[0] = {
            selc: '.pm-app',
            desc: 'Container of the PipelineEditor UI'
        };

        if (options.showWhenNoData === undefined) {
            this.options.showWhenNoData = true;
        }

        this.forms = forms || {};

        // Klassenvariablen
        // Instanzvariablen: Skriptverwaltung
        this.predefinedScripts = [];
        this.ownScripts = [];

        // Instanzvariablen: Pipeline-Verwaltung
        this.blankConsolidation = null;
        this.example = null;
        this.pipelineTrees = [];

        this.activeTreeId = null;
        this.nextTreeId = null;
        this.pipeline = null;

        // Instanzvariablen: Bearbeitungszustand
        this.currentStep = null;
        this.newDraft = false;
        this.visualModel = null;
        this.scriptMode = null;

        // Instanzvariablen: Graph-Konfiguration
        this.graphSource = null;
        this.graphHeight = null;
        this.graphColumn = null;

        // Beschriftung
        this.labels = [];

        //Tabellen
        this.availableTables = null;
        this.tablesError = null;
        this.consolidationColumns = { a: null, b: null };
        this.consolidationRequestNumbers = { a: 0, b: 0 };

        // Jobs und deren Parameter
        this.availableJobs = null;
        this.jobsError = null;
        this.jobParams = null;
        this.jobParamsError = null;
        this.actionDescriptions = null;
        this.actionDescriptionsError = null;

        // PipelineEditor vergrößern und wieder verkleinern
        this.expandButton = null;
        this.expandLabel = null;
        this.editorCard = null;

        // Wiederholbare Schritte: 0 = erster, bisheriger Filter bzw. Skript.
        this.currentFilterIndex = 0;
        this.currentScriptIndex = 0;
        this.backendSubmitting = false;
    }


    async init(){

        // This code checks whether a specific HTML element is present before the PipelineEditor continues processing.
        const root = this.requestor;
        if (!root || !root.querySelector('.pm-app')) {
            throw new Error('PipelineEditor: HTML template was not loaded.');
        }

        this.root = root; // für alle Klassenmethoden root element speichern.


        this.initializeVariables();
        this.initializeUI();
        await this.loadData();

        // Initiales Rendern von Flow und Details beim Start erzwingen (behebt das Leerbleiben beim Laden)
        this.renderFlow();
        this.selectStep(this.currentStep || 'script');
    }


    initializeVariables() {
        // Vordefinierte Python-Skripte
        this.predefinedScripts = [
            {
                name: 'normalize_values.py',
                description: 'Werte aufbereiten',
                parameter: 'threshold=0.95'
            },
            {
                name: 'replace_null.py',
                description: 'Fehlende Werte ersetzen',
                parameter: 'ersatzwert=0'
            }
        ];

        // Datenkonsolidierung
        this.blankConsolidation = (source = '') => ({
            source_a: source,
            source_b: '',
            timestamp_column_a: '',
            timestamp_column_b: '',
            matching_mode: 'intersection',
            tolerance_seconds: 30,
            target_table: 'consolidated_timeseries',
            configured: false
        });

        // Beispiel-Pipeline
        this.example = () => ({
            source: 'exampledata_timeseries_1week',
            period: '7 Tage',
            filter: {
                column: '',
                operator: 'gt',
                value: '',
                enabled: false
            },
            script: 'normalize_values.py',
            scriptType: 'predefined',
            jobId: null,
            description: 'Werte aufbereiten',
            parameter: 'threshold=0.95',
            target: 'ergebnis_tabelle',
            targetConfig: {
                format: 'table',
                writeMode: 'replace',
                includeTimestamp: true
            },
            consolidation: this.blankConsolidation(
                'exampledata_timeseries_1week'
            ),
            extraFilters: [],
            extraScripts: []
        });

        // Pipeline-Baum
        this.pipelineTrees = [{
            id: 1,
            name: 'Messdaten aufbereiten',
            data: this.example(),
            isDraft: false
        }];

        // Aktive Pipeline
        this.activeTreeId = 1;
        this.nextTreeId = 2;
        this.pipeline = this.pipelineTrees[0].data;

        // Bearbeitungszustand
        this.currentStep = 'script';
        this.newDraft = false;
        this.visualModel = null;
        this.scriptMode = 'existing';
        this.currentFilterIndex = 0;
        this.currentScriptIndex = 0;

        // Graph-Konfiguration
        this.graphSource = 'PmTreeNode';
        this.graphHeight = 685;
        this.graphColumn = 375;

        // Beschriftung
        this.labels = {
            source:'Quelle',
            consolidation:'Konsolidierung',
            filter:'Filter',
            script:'Skript / Job',
            target:'Ziel'
        };

        // Feature: Vergrößern und verkleinern
        this.expandButton = this.$('vmExpand');
        this.expandLabel = this.$('vmExpandLabel');
        this.editorCard = this.root.querySelector(
            '.pm-card[aria-label="Pipeline-Editor"]'
        );

    }

    $(id) {
        return this.root.querySelector('#' + id);
    }

    initializeUI() {

        /*
            Dieser Code gehört zur Initialisierung der Benutzeroberfläche.
            Er verbindet die drei Zoom-Schaltflächen mit den entsprechenden Funktionen.
            Dadurch kann der Benutzer die grafische Pipeline-Ansicht vergrößern,
            verkleinern oder auf die ursprüngliche Ansicht zurücksetzen.
         */
        this.$('vmZoomIn').addEventListener('click', () => this.changeZoom(0.15));
        this.$('vmZoomOut').addEventListener('click', () => this.changeZoom(-0.15));

        this.$('vmReset').addEventListener('click', () => {
            if (!this.visualModel) return;

            this.visualModel.resetZoom();
            this.$('vmZoomLabel').textContent = '100 %';
            this.$('visualViewport').scrollTop = 0;
            this.$('visualViewport').scrollLeft = 0;
        });

        // Feature: Vergrößern und verkleinern
        if (this.expandButton && this.editorCard) {
            this.expandButton.addEventListener('click', () => {
                const expanded =
                    this.editorCard.classList.contains('pm-editor-expanded');

                this.setEditorExpanded(!expanded);
            });

            // Mit Escape den vergrößerten Editor schließen.
            document.addEventListener('keydown', event => {
                if (
                    event.key === 'Escape' &&
                    this.editorCard.classList.contains('pm-editor-expanded')
                ) {
                    this.setEditorExpanded(false);
                }
            });
        }
        // Ende der Vergrößerungsfunktion

        // Dieser Code registriert Klick-Ereignisse für alle Pipeline-Bausteine mit der
        // CSS-Klasse .pm-node
        this.root.querySelectorAll('.pm-node').forEach(node => {
            node.addEventListener('click', () => {
                this.selectStep(node.dataset.step);
            });
        });

        /*
         * Registriert den Submit-Handler für das Detailformular und verarbeitet
         * die Einstellungen des aktuell ausgewählten Pipeline-Schritts.
         *
         * Liest die Formulareingaben aus, validiert sie und übernimmt die
         * Konfiguration für Datenquelle, Filter, Konsolidierung, Skript oder
         * Ausgabeziel in das Pipeline-Datenobjekt.
         *
         * Aktualisiert anschließend die Pipeline-Vorschau und zeigt
         * entsprechende Erfolgs- oder Fehlermeldungen an.
         *
         * Die Einstellungen werden zunächst lokal im Browser gespeichert.
         * Eine tatsächliche Datenverarbeitung oder Serverspeicherung erfolgt
         * durch diesen Handler nicht.
         */
        this.$('detailsForm').addEventListener('submit', event => {
            event.preventDefault();

            if (this.currentStep === 'source') {
                const sourceField = this.$('fieldSource');
                const nextSource = sourceField ? sourceField.value : '';

                if (nextSource && nextSource !== this.pipeline.source) {
                    this.pipeline.source = nextSource;
                    this.pipeline.consolidation ||= {};
                    this.pipeline.consolidation.source_a = nextSource;
                    this.pipeline.consolidation.timestamp_column_a = '';
                    this.pipeline.consolidation.configured = false;
                }
            }

            if (this.currentStep === 'filter') {
                const colField = this.$('fieldFilterColumn');
                const valField = this.$('fieldFilterValue');
                const opField = this.$('fieldFilterOperator');
                const periodField = this.$('fieldPeriod');

                const column = colField ? colField.value.trim() : '';
                const value = valField ? valField.value.trim() : '';
                const operator = opField ? opField.value : 'gt';

                if ((column && !value) || (!column && value)) {
                    this.showMessage?.('Für einen Filter bitte sowohl Spaltenname als auch Vergleichswert eingeben.');
                    return;
                }

                const nextFilter = {
                    column, operator, value, enabled: Boolean(column && value)
                };
                if (this.currentFilterIndex === 0) {
                    this.pipeline.period = periodField ? periodField.value : '7 Tage';
                    this.pipeline.filter = nextFilter;
                } else {
                    this.getActiveFilterStep().period = periodField ? periodField.value : '7 Tage';
                    this.getActiveFilterStep().filter = nextFilter;
                }
            }

            if (this.currentStep === 'consolidation') {
                const config = typeof this.readConsolidationConfiguration === 'function'
                    ? this.readConsolidationConfiguration()
                    : {};

                const error = typeof this.validateConsolidation === 'function'
                    ? this.validateConsolidation(config)
                    : null;

                if (error) {
                    this.showMessage?.(error);
                    return;
                }

                this.pipeline.consolidation = {
                    ...config,
                    configured: true
                };

                this.pipeline.source = config.source_a;

                const jsonEl = this.$('consolidationJson');
                if (jsonEl) jsonEl.textContent = JSON.stringify(config, null, 2);

                const hintEl = this.$('conPreviewHint');
                if (hintEl) hintEl.textContent = 'Konfiguration übernommen (nur im Browser).';

                this.renderFlow?.();

                this.showMessage?.(
                    'Konsolidierung konfiguriert. Noch keine Daten zusammengeführt oder gespeichert.'
                );

                return;
            }

            if (this.currentStep === 'script') {
                const activeScript = this.getActiveScriptStep();
                if (this.scriptMode === 'job') {
                    const jobField = this.$('fieldJob');
                    const jobName = jobField ? jobField.value : '';
                    const job = typeof this.findJob === 'function' ? this.findJob(jobName) : null;

                    if (!job) {
                        this.showMessage?.('Bitte zuerst einen vorhandenen Job auswählen.');
                        return;
                    }

                    activeScript.jobId = job.id;
                    activeScript.script = job.name;
                    activeScript.scriptType = 'job';
                    activeScript.description = job.desc || '';
                    activeScript.parameter = '';

                    this.renderFlow?.();

                    this.showMessage?.(
                        `Job „${job.name}“ ausgewählt. Eine Job-Ausführung oder Speicherung findet noch nicht statt.`
                    );

                    return;
                }

                if (this.scriptMode === 'new') {
                    const nameField = this.$('newScriptName');
                    const codeField = this.$('newScriptCode');
                    const descField = this.$('newScriptDescription');
                    const paramField = this.$('newScriptParameter');

                    const name = nameField ? nameField.value.trim() : '';
                    const code = codeField ? codeField.value : '';

                    if (!/^[A-Za-z0-9_.-]+\.py$/i.test(name)) {
                        this.showMessage?.('Bitte einen gültigen Dateinamen wie mein_skript.py eingeben.');
                        return;
                    }

                    if (!code.trim()) {
                        this.showMessage?.('Bitte Python-Code eingeben oder eine .py-Datei importieren.');
                        return;
                    }

                    // Syntax-Bug behoben: Code-Größenprüfung auf max. 100 KB (100 * 1024 Bytes)
                    if (code.length > 100 * 1024) {
                        this.showMessage?.('Der Python-Code darf maximal 100 KB groß sein.');
                        return;
                    }

                    const predefinedScripts = this.predefinedScripts || [];
                    if (predefinedScripts.some(script => script.name === name)) {
                        this.showMessage?.('Dieser Skriptname ist bereits vergeben. Bitte einen anderen Namen wählen.');
                        return;
                    }

                    const custom = {
                        name,
                        code,
                        description: descField ? descField.value.trim() : '',
                        parameter: paramField ? paramField.value.trim() : ''
                    };

                    this.ownScripts ||= [];
                    const existingIndex = this.ownScripts.findIndex(script => script.name === name);

                    if (existingIndex >= 0) {
                        this.ownScripts[existingIndex] = custom;
                    } else {
                        this.ownScripts.push(custom);
                    }

                    activeScript.script = name;
                    activeScript.jobId = null;
                    activeScript.scriptType = 'custom';
                    activeScript.description = custom.description;
                    activeScript.parameter = custom.parameter;

                    this.scriptMode = 'existing';

                    this.renderFlow?.();
                    this.renderDetails?.();

                    this.showMessage?.(`Eigenes Skript „${name}“ wurde zur Skriptliste hinzugefügt.`);
                    return;
                }

                const scriptField = this.$('fieldScript');
                const descField = this.$('fieldDescription');
                const paramField = this.$('fieldParameter');

                activeScript.script = scriptField ? scriptField.value : '';
                activeScript.jobId = null;

                const ownScripts = this.ownScripts || [];
                activeScript.scriptType = ownScripts.some(
                    script => script.name === activeScript.script
                ) ? 'custom' : 'predefined';

                activeScript.description = descField ? descField.value : '';
                activeScript.parameter = paramField ? paramField.value : '';
            }

            if (this.currentStep === 'target') {
                const targetField = this.$('fieldTarget');
                const formatField = this.$('fieldTargetFormat');
                const writeModeField = this.$('fieldTargetWriteMode');
                const timestampField = this.$('fieldTargetTimestamp');

                const target = targetField ? targetField.value.trim() : '';
                if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(target)) {
                    this.showMessage?.('Bitte einen gültigen Tabellennamen eingeben (Buchstaben, Zahlen und Unterstriche).');
                    return;
                }

                this.pipeline.target = target;
                this.pipeline.targetConfig = {
                    format: formatField ? formatField.value : 'table',
                    writeMode: writeModeField ? writeModeField.value : 'replace',
                    includeTimestamp: timestampField ? timestampField.checked : true
                };
            }

            this.renderFlow?.();
            this.showMessage?.('Einstellungen übernommen.');
        });

        /*
         * Registriert den Klick-Handler zum Erstellen eines neuen Pipeline-Baums.
         * Erzeugt eine neue Pipeline mit eindeutiger ID und initialisiert
         * alle Pipeline-Schritte mit ihren Standardwerten.
         * Fügt den neuen Baum der Pipeline-Liste hinzu, aktiviert ihn
         * und wechselt zum ersten Bearbeitungsschritt.
         * Der neue Pipeline-Baum wird zunächst nur lokal im Browser angelegt.
         */
        const newPipelineBtn = this.$('newPipeline');
        if (newPipelineBtn) {
            newPipelineBtn.addEventListener('click', () => {
                this.nextTreeId ??= 1;
                const id = this.nextTreeId++;

                const tree = {
                    id,
                    name: `Pipeline ${id}`,
                    data: {
                        source: '',
                        period: '7 Tage',
                        filter: { column: '', operator: 'gt', value: '', enabled: false },
                        script: '',
                        scriptType: 'predefined',
                        jobId: null,
                        description: '',
                        parameter: '',
                        target: '',
                        targetConfig: { format: 'table', writeMode: 'replace', includeTimestamp: true },
                        consolidation: typeof this.blankConsolidation === 'function'
                            ? this.blankConsolidation()
                            : {},
                        extraFilters: [],
                        extraScripts: []
                    },
                    isDraft: true
                };

                this.pipelineTrees ||= [];
                this.pipelineTrees.push(tree);

                this.activateTree?.(id, 'source');
                this.showMessage?.(`Neuer Pipeline-Baum ${id} angelegt (nur lokal im Browser).`);
            });
        }

        // Ausdrücklich nur der Konfigurationstest; KEINE Job-Ausführung oder Datenbank-Speicherung.
        const savePipelineBtn = this.$('savePipeline');
        if (savePipelineBtn) {
            savePipelineBtn.addEventListener('click', () => this.sendPipelineConfiguration());
        }
    }

    async loadData() {
        await this.loadAvailableTables();
        await this.loadExistingJobs();
        await this.loadJobParams();
        await this.loadActionDescriptions();
        await this.initializeVisualModel();
    }

    /**
     * Die Funktion <code>findJob(id)</code> sucht einen bestimmten Job in der Liste <code>availableJobs</code>
     * und gibt den passenden Job zurück.
     * @param id Die ID des Jobs, nach dem gesucht werden soll.
     * @returns {*} Gibt den gefundenen Job zurück.
     */
    findJob(id) {
        return (this.availableJobs || []).find(
            job => String(job.id) === String(id)
        );
    }

    /**
     * Die Methode <code>updateJobOptions()</code> aktualisiert ein Dropdown-Menü in PipelineEditor.
     * In diesem Dropdown werden die verfügbaren Jobs aus SmartData angezeigt.
     * Sie prüft außerdem, ob die Jobs geladen wurden, ob Fehler aufgetreten sind und ob bereits ein Job ausgewählt war.
     */
    updateJobOptions() {
        // Hier wird das HTML-Element mit der ID fieldJob gesucht. Mit der Hilfsmethode $(id).
        const select = this.$('fieldJob');
        if (!select) return; // existiert der Dropdown nicht, wird die Methode sofort beendet.

        // Bisherige Auswahl speichern
        const selectedBefore = select.value ||
            (this.getActiveScriptStep()?.scriptType === 'job' ? String(this.getActiveScriptStep().jobId || '') : '');

        // Alte Dropdown Einträge entfernen.
        select.replaceChildren();

        // Prüfen, in welchem Zustand sich die Jobs befinden.
        let message = '';
        let isDisabled = true;

        // 2. Zustand ermitteln (Guard Clauses / Variablen-Zuweisung)
        if (this.jobsError) {
            message = 'Jobs konnten nicht geladen werden';
        } else if (this.availableJobs === null) {
            message = 'Jobs werden geladen ...';
        } else if (!this.availableJobs.length) {
            message = 'Keine Jobs gefunden';
        } else {
            isDisabled = false;
            message = 'Bitte Job auswählen';
        }

        // 3. Dropdown-Status und Standard-Option setzen
        select.disabled = isDisabled;
        select.add(new Option(message, ''));

        // 4. Nur wenn Jobs da sind, diese hinzufügen und den Wert setzen
        if (!isDisabled) {
            for (const job of this.availableJobs) {
                select.add(new Option(
                    `${job.name || 'Job'} (ID ${job.id})`,
                    String(job.id)
                ));
            }

            select.value = this.findJob(selectedBefore) ? selectedBefore : '';
        }

        // Hilfetext aktualisieren
        const help = this.$('jobHelp');

        if (help) {
            help.textContent = this.jobsError
                ? 'SmartData nicht erreichbar. Payara und Browser-Konsole prüfen.'
                : this.availableJobs === null
                    ? 'Bestehende Jobs werden aus SmartData geladen.'
                    : `${this.availableJobs.length} vorhandene Jobs aus SmartData. Auswahl führt keinen Job aus.`;
        }

        // Job Details anzeigen
        this.renderJobDetails();
    }

    /**
     * Die Funktion <code>appendJobText()</code> erstellt ein HTML-Element und fügt es einem anderen Element hinzu.
     * Dabei wird bewusst <code>textContent</code> statt innerHTML verwendet.
     * Das ist besonders wichtig, wenn der Text aus einer API wie SmartData kommt.
     *
     * @param container Das HTML-Element, in das der neue Absatz eingefügt werden soll.
     * @param text Der Text, der angezeigt werden soll.
     * @param className Die CSS-Klasse des neuen Absatzes. Standardmäßig wird <code>pm-field-help</code> verwendet. (Optional)
     * @returns {HTMLParagraphElement} Diese Funktion gibt das neu erstellte HTML-Element zurück.
     */
    appendJobText(container, text, className = 'pm-field-help') {
        const element = document.createElement('p');
        element.className = className;
        element.textContent = text;
        container.appendChild(element);
        return element;
    }

    /**
     * Die Funktion <code>appendJobField()</code> erstellt ein Feld zur Anzeige von Job-Informationen.
     * Sie fügt dabei ein Label und einen dazugehörigen Wert in einen Container ein.
     * Besonders interessant ist, dass die Funktion selbst entscheidet, wie der Wert dargestellt wird:
     * als normales Textfeld, als mehrzeiliges Textfeld oder ausgeblendet, wenn es sich um sensible Daten handelt.
     * @param container Das HTML-Element, in das das neue Feld eingefügt wird.
     * @param label Die Bezeichnung des Feldes, zum Beispiel "Job-ID" oder "Beschreibung".
     * @param value Der dazugehörige Wert, zum Beispiel "123" oder "Daten verarbeiten".
     */
    appendJobField(container, label, value) {
        const wrapper = document.createElement('div');
        wrapper.className = 'pm-field';

        const title = document.createElement('label');
        title.textContent = label;
        wrapper.appendChild(title);

        const isSensitive = /(password|passwd|pwd|secret|token|api.?key)/i.test(label);
        const valueString = value == null ? '' : String(value);
        const isMultiline = !isSensitive && (valueString.length > 110 || valueString.includes('\n'));

        // Element einmalig erstellen (Entweder textarea oder input)
        const field = document.createElement(isMultiline ? 'textarea' : 'input');
        field.readOnly = true;
        field.value = isSensitive ? '[Wert aus Sicherheitsgründen ausgeblendet]' : valueString;

        // Spezifische Eigenschaften je nach Typ setzen
        if (isMultiline) {
            field.rows = 5;
            field.style.maxHeight = '220px';
        } else if (!isSensitive) {
            field.type = 'text';
        }

        wrapper.appendChild(field);
        container.appendChild(wrapper);
    }


    /**
     * Die Methode <code>updateSourceOptions()</code> aktualisiert das Quelltabellen-Dropdown in PipelineEditor.
     * Sie prüft, ob Tabellen geladen wurden, ob ein Fehler aufgetreten ist und ob Tabellen zur Auswahl stehen.
     * Anschließend aktualisiert sie den Hilfetext.
     */
    updateSourceOptions() {
        const select = this.$('fieldSource');
        if (!select) return;

        select.replaceChildren();

        let message = '';
        let isDisabled = true;

        // 1. Zustand ermitteln
        if (this.tablesError) {
            message = 'Tabellen konnten nicht geladen werden';
        } else if (this.availableTables === null) {
            message = 'Tabellen werden geladen ...';
        } else if (!this.availableTables.length) {
            message = 'Keine Tabellen gefunden';
        } else {
            isDisabled = false;
            message = 'Bitte auswählen';
        }

        // 2. Dropdown-Zustand und Standard-Option setzen
        select.disabled = isDisabled;
        select.add(new Option(message, ''));

        // 3. Wenn Tabellen vorhanden sind, diese hinzufügen
        if (!isDisabled) {
            for (const name of this.availableTables) {
                select.add(new Option(name, name));
            }
            select.value = this.availableTables.includes(this.pipeline?.source) ? this.pipeline?.source : '';
        }

        // 4. Hilfetext aktualisieren
        const help = this.$('sourceHelp');
        if (help) {
            help.textContent = this.tablesError
                ? 'SmartData-API nicht erreichbar. Prüfe Payara und die Browser-Konsole.'
                : this.availableTables === null
                    ? 'Die Tabellen werden aus SmartData geladen.'
                    : 'Echte Tabellen aus dem Schema smartmonitoring.';
        }
    }

    /**
     * Die Methode <code>renderJobDetails()</code> ist dafür zuständig,
     * die Detailinformationen eines ausgewählten Jobs auf der Benutzeroberfläche anzuzeigen.
     */
    renderJobDetails() {
        const details = this.$('jobDetails');
        const selected = this.$('fieldJob');
        if (!details || !selected) return;

        details.replaceChildren(); // Alte Inhalte entfernen

        const job = this.findJob(selected.value);
        if (!job) return;

        // Lokaler Helfer für Überschriften
        const addHeading = text => {
            const h = document.createElement('h3');
            h.className = 'pm-script-subheading';
            h.textContent = text;
            details.appendChild(h);
        };

        // 1. Grundlegende Job-Infos
        this.appendJobField(details, 'Action / Job-Art', job.action || 'Keine Angabe');
        this.appendJobField(details, 'Beschreibung', job.desc || 'Keine Beschreibung vorhanden');
        this.appendJobText(details, `Status: ${job.active ? 'aktiv' : 'inaktiv'} · Job-ID: ${job.id}`);

        // 2. Job-Parameter Sektion
        addHeading('Gespeicherte Job-Parameter (nur lesbar)');
        if (this.jobParamsError) {
            this.appendJobText(details, 'Die Job-Parameter konnten nicht geladen werden.');
        } else if (this.jobParams === null) {
            this.appendJobText(details, 'Job-Parameter werden geladen ...');
        } else {
            const params = this.jobParams.filter(p => String(p.datajob_id) === String(job.id));
            if (!params.length) this.appendJobText(details, 'Für diesen Job sind keine Parameter gespeichert.');

            params.forEach(p => this.appendJobField(
                details,
                `${p.key || 'Parameter'} (${p.type || 'unbekannter Typ'})`,
                p.value
            ));
        }

        // 3. Action-Beschreibung Sektion
        addHeading('Action-Beschreibung (SmartDataJobs)');
        if (this.actionDescriptionsError) {
            this.appendJobText(details, 'getActionsDescription konnte nicht geladen werden.');
        } else if (this.actionDescriptions === null) {
            this.appendJobText(details, 'Action-Beschreibungen werden geladen ...');
        } else {
            const cleanName = str => String(str || '').replace(/Action$/i, '').toLowerCase();
            const action = this.actionDescriptions.find(item => cleanName(item.name) === cleanName(job.action));

            if (!action) {
                this.appendJobText(details, `Für "${job.action || 'unbekannt'}" liefert getActionsDescription derzeit keine Beschreibung.`);
            } else {
                this.appendJobText(details, `Dokumentierte Action: ${action.name}`);

                (action.params || []).forEach(p => {
                    const mandatory = p.optional === false ? 'Pflichtfeld' : 'optional';
                    const dataType = p.type ? ` · Typ: ${p.type}` : '';
                    this.appendJobText(details, `${p.name}: ${mandatory}${dataType}${p.description ? ' — ' + p.description : ''}`);
                });
            }
        }
    }


    /**
     * Die Methode <code>loadAvailableTables()</code> lädt die verfügbaren Tabellen aus der SmartData-API.
     * Anschließend bereitet sie die Tabellennamen auf, entfernt doppelte und ungültige Einträge
     * und aktualisiert zwei Dropdown-Menüs in PipelineEditor.
     */
    async loadAvailableTables() {
        try {
            const response = await fetch(
                '/SmartData/smartdata/storage/getCollections?name=smartmonitoring',
                { headers: { 'Accept': 'application/json' } }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const json = await response.json();
            if (!Array.isArray(json?.list)) {
                throw new Error('Unerwartetes Antwortformat der SmartData-API');
            }

            this.availableTables = [...new Set(
                json.list
                    .map(item => item?.name)
                    .filter(name => typeof name === 'string' && name.length > 0)
            )].sort((a, b) => a.localeCompare(b));

            this.tablesError = null;
        } catch (error) {
            this.tablesError = error;
            this.availableTables = [];
            console.error('PipelineEditor: Tabellen konnten nicht geladen werden:', error);
        } finally {
            // Wird garantiert ausgeführt – egal ob Erfolg oder Fehler
            this.updateSourceOptions();
            this.updateConsolidationTableOptions();
        }
    }

    // Der erste Schritt bleibt mit der bisherigen Datenstruktur kompatibel.
    getActiveFilterStep() {
        const p = this.pipeline;
        if (!p) return null;
        if (this.currentFilterIndex === 0) return { period: p.period, filter: p.filter };
        p.extraFilters ||= [];
        return p.extraFilters[this.currentFilterIndex - 1] || null;
    }

    getActiveScriptStep() {
        const p = this.pipeline;
        if (!p) return null;
        if (this.currentScriptIndex === 0) return p;
        p.extraScripts ||= [];
        return p.extraScripts[this.currentScriptIndex - 1] || null;
    }

    getFilterSteps(p) {
        return [{ period: p.period || '7 Tage', filter: p.filter || {} }, ...(p.extraFilters || [])];
    }

    getScriptSteps(p) {
        return [p, ...(p.extraScripts || [])];
    }

    addRepeatedStep(type) {
        const p = this.pipeline;
        if (!p || !['filter', 'script'].includes(type)) return;
        if (type === 'filter') {
            p.extraFilters ||= [];
            if (p.extraFilters.length >= 19) return this.showMessage('Maximal 20 Filter erlaubt.');
            p.extraFilters.push({ period: '7 Tage', filter: { column: '', operator: 'gt', value: '', enabled: false } });
            this.selectStep('filter', p.extraFilters.length);
        } else {
            p.extraScripts ||= [];
            if (p.extraScripts.length >= 19) return this.showMessage('Maximal 20 Skript-/Job-Schritte erlaubt.');
            p.extraScripts.push({ script: '', scriptType: 'predefined', jobId: null, description: '', parameter: '' });
            this.selectStep('script', p.extraScripts.length);
        }
        this.showMessage('Neuer Schritt angelegt. Bitte konfigurieren und übernehmen.');
    }

    deleteRepeatedStep(type) {
        const field = type === 'filter' ? 'extraFilters' : 'extraScripts';
        const index = type === 'filter' ? this.currentFilterIndex : this.currentScriptIndex;
        if (!index) return this.showMessage('Der erste Schritt bleibt erhalten.');
        this.pipeline[field].splice(index - 1, 1);
        this.selectStep(type, Math.max(0, index - 1));
    }

    moveRepeatedStep(type, delta) {
        const isFilter = type === 'filter';
        const index = isFilter ? this.currentFilterIndex : this.currentScriptIndex;
        const data = this.pipeline;
        const list = isFilter ? this.getFilterSteps(data) : this.getScriptSteps(data).map(step => ({
            script: step.script || '', scriptType: step.scriptType || 'predefined',
            jobId: step.jobId ?? null, description: step.description || '', parameter: step.parameter || ''
        }));
        const next = index + delta;
        if (next < 0 || next >= list.length) return;
        [list[index], list[next]] = [list[next], list[index]];
        if (isFilter) {
            data.period = list[0].period;
            data.filter = list[0].filter;
            data.extraFilters = list.slice(1);
        } else {
            Object.assign(data, list[0]);
            data.extraScripts = list.slice(1);
        }
        this.selectStep(type, next);
    }

    setupRepeatedControls(type) {
        const form = this.$('detailsForm');
        if (!form) return;
        const isFilter = type === 'filter';
        const current = isFilter ? this.currentFilterIndex : this.currentScriptIndex;
        const count = 1 + ((isFilter ? this.pipeline.extraFilters : this.pipeline.extraScripts) || []).length;
        const wrapper = document.createElement('div');
        wrapper.className = 'pm-repeat-controls';
        const title = document.createElement('label');
        title.textContent = `${isFilter ? 'Filter' : 'Skript / Job'} auswählen (${count})`;
        const select = document.createElement('select');
        select.setAttribute('aria-label', `${type} Schritt auswählen`);
        for (let i = 0; i < count; i++) select.add(new Option(`${isFilter ? 'Filter' : 'Skript / Job'} ${i + 1}`, String(i)));
        select.value = String(Math.min(current, count - 1));
        select.addEventListener('change', () => this.selectStep(type, Number(select.value)));
        wrapper.append(title, select);
        const toolbar = document.createElement('div');
        toolbar.className = 'pm-repeat-actions';
        for (const [text, action, disabled] of [
            [`+ ${isFilter ? 'Filter' : 'Skript / Job'}`, () => this.addRepeatedStep(type), false],
            ['↑', () => this.moveRepeatedStep(type, -1), current === 0],
            ['↓', () => this.moveRepeatedStep(type, 1), current >= count - 1],
            ['Entfernen', () => this.deleteRepeatedStep(type), current === 0]
        ]) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'pm-repeat-btn';
            button.textContent = text; button.disabled = disabled;
            button.addEventListener('click', action); toolbar.appendChild(button);
        }
        wrapper.appendChild(toolbar);
        const note = document.createElement('small');
        note.className = 'pm-field-help';
        note.textContent = 'Änderungen am aktuellen Schritt zuerst mit „Änderungen übernehmen“ bestätigen.';
        wrapper.appendChild(note);
        form.prepend(wrapper);
    }

    async sendPipelineConfiguration() {
        if (this.backendSubmitting) return;
        const endpoint = this.$('pipelineBackendEndpoint')?.value?.trim() || '';
        if (!endpoint) return this.showMessage('Bitte zuerst einen Backend-Testendpunkt angeben.');
        const tree = (this.pipelineTrees || []).find(t => t.id === this.activeTreeId);
        if (!tree) return this.showMessage('Keine Pipeline ausgewählt.');
        const payload = createPipelineDraft(tree);
        const button = this.$('savePipeline');
        this.backendSubmitting = true;
        if (button) button.disabled = true;
        try {
            const response = await postPipelineDraft(endpoint, payload);
            const hint = response?.message || 'Backend hat die Konfiguration empfangen.';
            this.showMessage(`Backend-Antwort: ${hint} (keine Pipeline ausgeführt).`);
        } catch (error) {
            this.showMessage(`Backend-Test fehlgeschlagen: ${error.message}`);
        } finally {
            this.backendSubmitting = false;
            if (button) button.disabled = false;
        }
    }

    /**
     * Aktualisiert die Vorschau aller Pipeline-Schritte und markiert den
     * aktuell ausgewählten Baustein.
     * Zeigt die Metadaten des aktiven Pipeline-Baums an und zeichnet
     * anschließend die visuelle Baumansicht.
     * Behandelt mögliche Fehler beim Zeichnen der Baumansicht.
     */
    renderFlow() {
        const p = this.pipeline || {};

        // 1. Vorschauen für die einzelnen Schritte aktualisieren
        this.$('sourcePreview').textContent = p.source || 'Bitte auswählen';

        const filter = this.getActiveFilterStep() || {};
        const filterState = filter.filter || { column: '', operator: 'gt', value: '', enabled: false };
        const filterCount = 1 + (p.extraFilters || []).length;
        this.$('filterPreview').textContent = filterState.enabled
            ? `${filterCount} Filter · ${filter.period} · ${filterState.column} ${filterState.operator} ${filterState.value}`
            : `${filterCount} Filter · Zeitraum: ${filter.period || ''}`;

        const cons = p.consolidation || {};
        this.$('consolidationPreview').textContent = cons.configured
            ? `${cons.source_a} + ${cons.source_b} · ${cons.matching_mode}`
            : 'Noch nicht konfiguriert';

        const activeScript = this.getActiveScriptStep() || {};
        const scriptCount = 1 + (p.extraScripts || []).length;
        this.$('scriptPreview').textContent = `${scriptCount} Schritt(e) · ${activeScript.script || 'Bitte auswählen'}`;

        const targetConfig = p.targetConfig || { format: 'table', writeMode: 'replace' };
        this.$('targetPreview').textContent = p.target
            ? `${p.target} · ${targetConfig.format || 'table'} · ${targetConfig.writeMode || 'replace'}`
            : 'Bitte eingeben';

        // 2. Aktive Nodes / UI-Zustand markieren
        this.root.querySelectorAll('.pm-node').forEach(node => {
            node.setAttribute('aria-pressed', String(node.dataset.step === this.currentStep));
        });

        // 3. Baum-Metadaten sicher anzeigen
        const trees = this.pipelineTrees || [];
        const tree = trees.find(item => item.id === this.activeTreeId);

        if (tree) {
            this.$('pipelineLabel').textContent =
                `${tree.name}${tree.isDraft ? ' · Entwurf' : ''} · ${trees.length} ${trees.length === 1 ? 'Baum' : 'Bäume'}`;
        }

        this.$('currentStep').textContent =
            'Ausgewählter Baustein: ' + (this.labels?.[this.currentStep] || '');

        this.renderTreeList();

        // 4. Visuellen Baum mit Fallback/Fehlerbehandlung rendern
        try {
            this.renderVisualTree();
        } catch (error) {
            console.error('PipelineEditor: Fehler beim Zeichnen des Pipeline-Baums:', error);

            const message = this.$('visualModelMessage');
            if (message) {
                message.textContent = `Baumansicht konnte nicht gezeichnet werden: ${error.message}. Details siehe F12 → Console.`;
                message.hidden = false;
            }
        }
    }

    /**
     * Erstellt die Liste aller vorhandenen Pipeline-Bäume in der Seitenleiste.
     * Zeigt für jeden Baum den Namen, den Entwurfsstatus und die Baum-ID an.
     * Markiert den aktiven Baum und ermöglicht durch Klick den Wechsel
     * zu einem anderen Pipeline-Baum.
     */
    renderTreeList() {
        const container = this.$('pipelineTreeList');
        if (!container) return;

        container.replaceChildren();

        const trees = this.pipelineTrees || [];

        for (const tree of trees) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'pm-sidebar-btn pm-tree-entry';
            button.setAttribute('aria-current', String(tree.id === this.activeTreeId));

            const title = document.createElement('strong');
            title.textContent = tree.name;

            const status = document.createElement('span');
            status.className = 'pm-tree-status';
            status.textContent = `${tree.isDraft ? 'Entwurf · ' : ''}${5 + (tree.data?.extraFilters?.length || 0) + (tree.data?.extraScripts?.length || 0)} Schritte · Baum ${tree.id}`;

            button.append(title, status);
            button.addEventListener('click', () => this.activateTree(tree.id));

            container.appendChild(button);
        }
    }

    /**
     * Aktiviert einen Pipeline-Baum anhand seiner ID.
     * Übernimmt dessen Daten und Entwurfsstatus, bestimmt den Skriptmodus
     * und wählt den gewünschten oder standardmäßigen Bearbeitungsschritt aus.
     * Scrollt anschließend zur Position des ausgewählten Baums in der visuellen Ansicht.
     *
     * @param {number} id - ID des zu aktivierenden Pipeline-Baums.
     * @param {string} [step] - Optionaler Bearbeitungsschritt.
     */
    activateTree(id, step, stepIndex = null) {
        const trees = this.pipelineTrees || [];
        const tree = trees.find(item => item.id === id);
        if (!tree) return;

        this.activeTreeId = tree.id;
        this.pipeline = tree.data;
        this.newDraft = tree.isDraft;
        this.currentFilterIndex = 0;
        this.currentScriptIndex = 0;
        this.scriptMode = this.pipeline?.scriptType === 'job' ? 'job' : 'existing';

        // Klassenkontext: this.selectStep aufrufen
        if (typeof this.selectStep === 'function') {
            this.selectStep(step || (tree.isDraft ? 'source' : 'script'), stepIndex);
        }

        // Viewport-Scrollen korrigieren und absichern
        const index = trees.findIndex(item => item.id === id);
        const viewport = this.$('visualViewport');

        if (viewport && index >= 0) {
            // Multiplikation mit der Spaltenbreite (Fallback auf 85px, falls graphColumn nicht existiert)
            const columnWidth = this.graphColumn || 85;
            viewport.scrollLeft = Math.max(0, index * columnWidth);
        }
    }

    /**
     * Zeichnet alle vorhandenen Pipeline-Bäume mit Konva in der VisualModel-Ansicht.
     * Erstellt die Pipeline-Bausteine, Verbindungspfeile und Überschriften.
     * Hebt den aktiven Pipeline-Baum und den ausgewählten Bearbeitungsschritt hervor.
     * Ermöglicht die Auswahl von Pipeline-Schritten durch Klick auf die Bausteine.
     * Aktualisiert anschließend die grafische Darstellung.
     */
    renderVisualTree() {
        if (!this.visualModel?.stage || !this.visualModel?.layer || !window.Konva) return;
        const vm = this.visualModel;
        const K = window.Konva;
        const trees = this.pipelineTrees || [];
        const columnWidth = this.graphColumn || 375;
        const nodeWidth = 170;
        const nodeHeight = 65;
        const interval = 112;
        const baseY = 80;
        const colors = {
            source: '#138b70', consolidation: '#8057c4',
            filter: '#2c7cbe', script: '#bc852d', target: '#c65e80'
        };
        const longest = Math.max(5, ...trees.map(tree =>
            5 + (tree.data?.extraFilters?.length || 0) + (tree.data?.extraScripts?.length || 0)
        ));
        const height = Math.max(685, baseY + interval * (longest - 1) + nodeHeight + 40);
        const canvasWidth = Math.max(760, trees.length * columnWidth + 70);
        vm.requestor.style.width = `${canvasWidth}px`;
        vm.requestor.style.height = `${height}px`;
        vm.stage.width(canvasWidth);
        vm.stage.height(height);
        vm.layer.destroyChildren();

        const arrow = (ax, ay, bx, by) => vm.layer.add(new K.Arrow({
            points: [ax, ay, bx, by], stroke: '#91a4b9', fill: '#91a4b9',
            strokeWidth: 2, pointerLength: 8, pointerWidth: 8, listening: false
        }));
        const node = (tree, x, y, step, index, title, subtitle) => {
            const selectedIndex = step === 'filter' ? this.currentFilterIndex
                : step === 'script' ? this.currentScriptIndex : 0;
            const selected = tree.id === this.activeTreeId && this.currentStep === step && selectedIndex === index;
            const group = new K.Group({ x, y, listening: true });
            group.add(new K.Rect({
                x: 0, y: 0, width: nodeWidth, height: nodeHeight,
                fill: selected ? '#e6f3ff' : '#ffffff',
                stroke: selected ? '#1769aa' : colors[step],
                strokeWidth: selected ? 2.8 : 1.5, cornerRadius: 9,
                shadowColor: '#304960', shadowBlur: 3, shadowOpacity: 0.09
            }));
            group.add(new K.Text({
                x: 10, y: 11, width: nodeWidth - 20, height: 20,
                text: title, fontSize: 13, fontStyle: 'bold',
                fill: '#203854', listening: false
            }));
            group.add(new K.Text({
                x: 10, y: 35, width: nodeWidth - 20, height: 24,
                text: String(subtitle || ''), fontSize: 10.5,
                fill: '#697d91', wrap: 'none', ellipsis: true, listening: false
            }));
            group.on('mouseenter', () => {
                vm.stage.draggable(false);
                vm.stage.container().style.cursor = 'pointer';
            });
            group.on('mouseleave', () => {
                vm.stage.draggable(true);
                vm.stage.container().style.cursor = 'grab';
            });
            group.on('click tap', event => {
                event.cancelBubble = true;
                this.activateTree(tree.id, step, index);
            });
            vm.layer.add(group);
        };

        trees.forEach((tree, treeIndex) => {
            const p = tree.data || {};
            const base = treeIndex * columnWidth + 34;
            const centralX = base + 91;
            const leftX = base;
            const rightX = base + 183;
            const center = x => x + nodeWidth / 2;
            const con = p.consolidation || {};
            const hasB = Boolean(con.source_b);
            const filterSteps = this.getFilterSteps(p);
            const scriptSteps = this.getScriptSteps(p);
            const consY = baseY + interval;

            vm.layer.add(new K.Text({
                x: base, y: 28, width: nodeWidth * 2 + 12,
                text: `${tree.name}${tree.isDraft ? ' · Entwurf' : ''}`,
                fill: tree.id === this.activeTreeId ? '#1769aa' : '#465d75',
                fontStyle: 'bold', fontSize: 16, listening: false
            }));
            node(tree, hasB ? leftX : centralX, baseY, 'source', 0,
                hasB ? 'Quelle A' : 'Quelle', p.source || 'Keine Tabelle gewählt');
            arrow(center(hasB ? leftX : centralX), baseY + nodeHeight, center(centralX), consY);
            if (hasB) {
                node(tree, rightX, baseY, 'consolidation', 0, 'Quelle B', con.source_b);
                arrow(center(rightX), baseY + nodeHeight, center(centralX), consY);
            }
            node(tree, centralX, consY, 'consolidation', 0, 'Konsolidierung',
                con.configured ? `${con.matching_mode} · ${con.tolerance_seconds}s` : 'Noch nicht konfiguriert');

            let priorY = consY;
            let position = 2;
            filterSteps.forEach((item, i) => {
                const y = baseY + interval * position++;
                arrow(center(centralX), priorY + nodeHeight, center(centralX), y);
                const detail = item.filter?.enabled
                    ? `${item.period} · ${item.filter.column} ${item.filter.operator} ${item.filter.value}`
                    : `Zeitraum: ${item.period || '7 Tage'}`;
                node(tree, centralX, y, 'filter', i, `Filter ${i + 1}`, detail);
                priorY = y;
            });
            scriptSteps.forEach((item, i) => {
                const y = baseY + interval * position++;
                arrow(center(centralX), priorY + nodeHeight, center(centralX), y);
                node(tree, centralX, y, 'script', i, `Skript / Job ${i + 1}`,
                    item.scriptType === 'job' ? `Job: ${item.script || 'Bitte wählen'}`
                        : item.script ? 'Skript konfiguriert' : 'Bitte auswählen');
                priorY = y;
            });
            const targetY = baseY + interval * position;
            arrow(center(centralX), priorY + nodeHeight, center(centralX), targetY);
            node(tree, centralX, targetY, 'target', 0, 'Ziel', p.target || 'Kein Ziel gewählt');
        });
        vm.stage.draggable(true);
        vm.layer.batchDraw();
    }

    /**
     * Rendert das Eingabeformular für den aktuell ausgewählten Pipeline-Schritt.
     * Fügt das passende HTML-Formular in den Detailbereich ein und stellt
     * die gespeicherten Pipeline-Einstellungen wieder her.
     * Initialisiert abhängig vom ausgewählten Schritt die zugehörigen
     * Formulare, Dropdowns und Ereignis-Listener.
     */
    renderDetails() {
        const detailsForm = this.$('detailsForm');
        if (!detailsForm) return;

        const step = this.currentStep;
        const forms = this.forms || {};
        const formHtml = forms[step] || '';

        detailsForm.innerHTML =
            formHtml +
            '<button id="submitSettings" type="submit" class="pm-btn pm-btn-primary">Änderungen übernehmen</button>';
        if (step === 'filter' || step === 'script') this.setupRepeatedControls(step);

        const p = this.pipeline || {};

        if (step === 'source') {
            this.updateSourceOptions?.();
        }

        if (step === 'filter') {
            const selectedFilter = this.getActiveFilterStep() || {};
            const filter = selectedFilter.filter || { column: '', operator: 'gt', value: '', enabled: false };

            const periodField = this.$('fieldPeriod');
            if (periodField) periodField.value = selectedFilter.period || '7 Tage';

            const colField = this.$('fieldFilterColumn');
            if (colField) colField.value = filter.column || '';

            const opField = this.$('fieldFilterOperator');
            if (opField) opField.value = filter.operator || 'gt';

            const valField = this.$('fieldFilterValue');
            if (valField) valField.value = filter.value == null ? '' : String(filter.value);
        }

        if (step === 'consolidation') {
            const submitBtn = this.$('submitSettings');
            if (submitBtn) {
                submitBtn.textContent = 'Konsolidierung übernehmen';
            }

            this.setupConsolidationPanel?.();
        }

        if (step === 'script') {
            this.setupScriptPanel?.();
        }

        if (step === 'target') {
            const targetConfig = p.targetConfig || {
                format: 'table',
                writeMode: 'replace',
                includeTimestamp: true
            };

            const targetField = this.$('fieldTarget');
            if (targetField) targetField.value = p.target || '';

            const formatField = this.$('fieldTargetFormat');
            if (formatField) formatField.value = targetConfig.format || 'table';

            const writeModeField = this.$('fieldTargetWriteMode');
            if (writeModeField) writeModeField.value = targetConfig.writeMode || 'replace';

            const timestampField = this.$('fieldTargetTimestamp');
            if (timestampField) timestampField.checked = targetConfig.includeTimestamp !== false;
        }
    }

    /**
     * Vergrößert oder verkleinert den Pipeline-Editor.
     * Passt die CSS-Klassen und die Beschriftungen der Erweiterungsschaltfläche
     * entsprechend dem aktuellen Zustand an.
     * Aktualisiert die Accessibility-Attribute für Screenreader.
     * Zeichnet die VisualModel-Ansicht nach der Größenänderung neu.
     *
     * @param {boolean} expanded - Gibt an, ob der Editor vergrößert dargestellt werden soll.
     */
    setEditorExpanded(expanded) {
        if (!this.editorCard || !this.expandButton) return;

        this.editorCard.classList.toggle('pm-editor-expanded', expanded);
        document.body.classList.toggle('pm-editor-open', expanded);

        this.expandButton.setAttribute(
            'aria-pressed',
            String(expanded)
        );

        this.expandButton.setAttribute(
            'aria-label',
            expanded ? 'Editor verkleinern' : 'Editor vergrößern'
        );

        this.expandButton.title = expanded
            ? 'Editor verkleinern'
            : 'Editor vergrößern';

        if (this.expandLabel) {
            this.expandLabel.textContent = expanded
                ? '⛶ Verkleinern'
                : '⛶ Vergrößern';
        }

        // VisualModel nach Größenänderung neu zeichnen.
        requestAnimationFrame(() => {
            if (this.visualModel) {
                this.renderVisualTree();
            }
        });
    }

    /**
     * Aktualisiert die Dropdown-Menüs für die beiden Datenquellen
     * der Datenkonsolidierung.
     * Berücksichtigt Ladezustände und Fehler beim Abrufen der Tabellen,
     * stellt gültige vorherige Auswahlen wieder her und lädt anschließend
     * die zugehörigen Zeitstempel-Spalten für beide Tabellen.
     */
    updateConsolidationTableOptions() {
        const sourceA = this.$('fieldConSourceA');
        const sourceB = this.$('fieldConSourceB');
        if (!sourceA || !sourceB) return;

        const p = this.pipeline || {};
        const con = p.consolidation || {};

        const previousA = sourceA.value || con.source_a || p.source;
        const previousB = sourceB.value || con.source_b;

        const tables = this.availableTables;
        let message = '';
        let isDisabled = true;

        // 1. Status einmalig für beide Dropdowns ermitteln
        if (this.tablesError) {
            message = 'SmartData nicht erreichbar';
        } else if (tables === null) {
            message = 'Tabellen werden geladen ...';
        } else if (!tables.length) {
            message = 'Keine Tabellen vorhanden';
        } else {
            isDisabled = false;
            message = 'Bitte Tabelle auswählen';
        }

        // 2. Beide Select-Elemente in einer Schleife befüllen
        for (const select of [sourceA, sourceB]) {
            select.replaceChildren();
            select.disabled = isDisabled;
            select.add(new Option(message, ''));

            if (!isDisabled) {
                for (const name of tables) {
                    select.add(new Option(name, name));
                }
            }
        }

        // 3. Ausgewählte Werte setzen und Spalten laden, falls Tabellen existieren
        if (tables?.length) {
            sourceA.value = tables.includes(previousA) ? previousA : '';
            sourceB.value = tables.includes(previousB) ? previousB : '';

            this.loadConsolidationColumns('a', con.timestamp_column_a);
            this.loadConsolidationColumns('b', con.timestamp_column_b);
        }
    }

    /**
     * Liest die aktuellen Einstellungen des Konsolidierungsformulars aus.
     * Erfasst die beiden Quelltabellen, deren Zeitstempel-Spalten,
     * den Matching-Modus, die zeitliche Toleranz und die Zieltabelle.
     * Wandelt die Toleranz in einen numerischen Wert um und entfernt
     * überflüssige Leerzeichen aus dem Namen der Zieltabelle.
     *
     * @returns {Object} Die aktuelle Konsolidierungskonfiguration.
     */
    readConsolidationConfiguration() {
        const modeEl = this.$('fieldConMode');
        let rawMode = modeEl ? modeEl.value.trim().toLowerCase() : '';

        // Fallback: Falls der Text statt des Value-Attributes ausgelesen wird
        let matchingMode = 'intersection';
        if (rawMode.includes('union') || rawMode.includes('nicht passende')) {
            matchingMode = 'union';
        } else if (rawMode.includes('intersection') || rawMode.includes('passende')) {
            matchingMode = 'intersection';
        } else if (rawMode === 'union' || rawMode === 'intersection') {
            matchingMode = rawMode;
        }

        return {
            source_a: this.$('fieldConSourceA')?.value || '',
            source_b: this.$('fieldConSourceB')?.value || '',
            timestamp_column_a: this.$('fieldConTimeA')?.value || '',
            timestamp_column_b: this.$('fieldConTimeB')?.value || '',
            matching_mode: matchingMode,
            tolerance_seconds: Number(this.$('fieldConTolerance')?.value || 0),
            target_table: (this.$('fieldConTarget')?.value || '').trim()
        };
    }

    /**
     * Überprüft die Konsolidierungskonfiguration auf Vollständigkeit und Gültigkeit.
     * Kontrolliert die Quelltabellen, die ausgewählten Zeitstempel-Spalten,
     * deren Datentypen, den Matching-Modus, die zeitliche Toleranz
     * und den Namen der Zieltabelle.
     *
     * Gibt beim ersten gefundenen Fehler eine entsprechende Fehlermeldung zurück.
     *
     * @param {Object} config - Die zu überprüfende Konsolidierungskonfiguration.
     * @returns {string|null} Fehlermeldung bei ungültiger Konfiguration,
     *                        andernfalls null.
     */
    validateConsolidation(config) {
        const tables = this.availableTables || [];
        const cols = this.consolidationColumns || {};

        if (!config?.source_a || !config?.source_b) {
            return 'Bitte zwei Tabellen auswählen.';
        }

        if (config.source_a === config.source_b) {
            return 'Bitte zwei unterschiedliche Tabellen auswählen.';
        }

        if (!tables.includes(config.source_a) || !tables.includes(config.source_b)) {
            return 'Bitte nur vorhandene SmartData-Tabellen verwenden.';
        }

        for (const side of ['a', 'b']) {
            const columnName = config[`timestamp_column_${side}`];
            const column = (cols[side] || []).find(item => item.name === columnName);

            if (!column) {
                return `Bitte eine vorhandene Zeitspalte für Tabelle ${side.toUpperCase()} auswählen.`;
            }

            if (!this.isTimestampType?.(column)) {
                return `Spalte „${column.name}“ in Tabelle ${side.toUpperCase()} hat keinen geeigneten Zeit-Datentyp.`;
            }
        }

        // Sicherer Vergleich nach Normalisierung
        const mode = String(config.matching_mode || '').toLowerCase().trim();
        if (!['intersection', 'union'].includes(mode)) {
            return `Ungültiger Matching-Modus (Erhalten: "${config.matching_mode}").`;
        }

        if (
            !Number.isInteger(config.tolerance_seconds) ||
            config.tolerance_seconds < 0 ||
            config.tolerance_seconds > 86400
        ) {
            return 'Die Toleranz muss zwischen 0 und 86400 Sekunden liegen.';
        }

        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.target_table)) {
            return 'Bitte einen gültigen Namen für die Zieltabelle eingeben.';
        }

        return null;
    }

    /**
     * Initialisiert das Konsolidierungsformular und übernimmt vorhandene Einstellungen.
     * Befüllt die Formularfelder mit den gespeicherten Konfigurationswerten,
     * registriert Ereignis-Listener für Änderungen und aktualisiert die
     * Dropdown-Menüs der beiden Quelltabellen.
     * Zeigt eine bereits übernommene Konsolidierungskonfiguration
     * als formatierte JSON-Vorschau an.
     */
    setupConsolidationPanel() {
        const p = this.pipeline || {};
        const c = p.consolidation || {};

        const modeEl = this.$('fieldConMode');
        const toleranceEl = this.$('fieldConTolerance');
        const targetEl = this.$('fieldConTarget');
        const jsonEl = this.$('consolidationJson');
        const hintEl = this.$('conPreviewHint');

        if (modeEl) modeEl.value = c.matching_mode || '';
        if (toleranceEl) toleranceEl.value = c.tolerance_seconds ?? '';
        if (targetEl) targetEl.value = c.target_table || '';

        const updatePreview = () => {
            if (jsonEl) jsonEl.textContent = 'Einstellungen verändert – bitte Konsolidierung übernehmen.';
            if (hintEl) hintEl.textContent = 'Noch nicht übernommen. Es werden keine Daten verarbeitet.';
        };

        // Event-Listener sicher anbinden, falls root existiert
        if (this.root) {
            this.root.querySelectorAll('#detailsForm input, #detailsForm select').forEach(field => {
                field.addEventListener('input', updatePreview);
            });
        }

        const sourceA = this.$('fieldConSourceA');
        if (sourceA) {
            sourceA.addEventListener('change', () => this.loadConsolidationColumns('a'));
        }

        const sourceB = this.$('fieldConSourceB');
        if (sourceB) {
            sourceB.addEventListener('change', () => this.loadConsolidationColumns('b'));
        }

        // Tabellen-Optionen über die Instanz aktualisieren
        this.updateConsolidationTableOptions();

        // Vorhandene Konfiguration anzeigen, falls konfiguriert
        if (c.configured && jsonEl && hintEl) {
            const { configured, ...config } = c;
            jsonEl.textContent = JSON.stringify(config, null, 2);
            hintEl.textContent = 'Zuletzt übernommene Konfiguration (nur lokal im Browser).';
        }
    }

    /**
     * Befüllt das Skript-Dropdown mit den verfügbaren Skripten.
     * Erstellt getrennte Gruppen für vordefinierte und eigene Skripte,
     * berücksichtigt fehlende oder ungültige Einträge und stellt
     * anschließend die bisherige Skriptauswahl aus der Pipeline wieder her.
     * Bei ausgewähltem Job wird die Skriptauswahl geleert.
     */
    populateScriptList() {
        const select = this.$('fieldScript');
        if (!select) return;

        select.replaceChildren();
        select.add(new Option('Bitte auswählen', ''));

        const createGroup = (title, scripts) => {
            if (!Array.isArray(scripts) || !scripts.length) return;

            const group = document.createElement('optgroup');
            group.label = title;

            for (const script of scripts) {
                if (script?.name) {
                    group.appendChild(new Option(script.name, script.name));
                }
            }

            select.add(group);
        };

        const predefined = this.predefinedScripts || [];
        const own = this.ownScripts || [];

        createGroup('Vorhandene Skripte', predefined);
        createGroup('Eigene Skripte', own);

        const p = this.getActiveScriptStep() || {};
        select.value = p.scriptType === 'job' ? '' : (p.script || '');
    }

    /**
     * Zeigt die Metadaten des aktuell ausgewählten Skripts an.
     * Übernimmt Beschreibung und Parameter in die entsprechenden Formularfelder.
     * Prüft, ob es sich um ein eigenes Skript handelt, und zeigt gegebenenfalls
     * dessen Quellcode in der Vorschau an.
     * Blendet die Codevorschau bei vordefinierten Skripten aus.
     */
    showSelectedScriptMetadata() {
        const scriptSelect = this.$('fieldScript');
        if (!scriptSelect) return;

        const scriptName = scriptSelect.value;
        const selected = typeof this.findScript === 'function' ? this.findScript(scriptName) : null;

        const descField = this.$('fieldDescription');
        if (descField) {
            descField.value = selected?.description || '';
        }

        const paramField = this.$('fieldParameter');
        if (paramField) {
            paramField.value = selected?.parameter || '';
        }

        const ownScripts = this.ownScripts || [];
        const own = ownScripts.find(script => script.name === scriptName);

        const previewWrapper = this.$('ownCodePreviewWrapper');
        if (previewWrapper) {
            previewWrapper.hidden = !own;
        }

        const previewCode = this.$('ownCodePreview');
        if (previewCode) {
            previewCode.textContent = own?.code || '';
        }
    }

    /**
     * Wechselt zwischen den verfügbaren Skript- und Job-Modi.
     * Zeigt abhängig vom gewählten Modus das passende Formularpanel an
     * und blendet die übrigen Bereiche aus.
     * Aktualisiert die aktive Modus-Schaltfläche sowie die Beschriftung
     * der Übernehmen-Schaltfläche und entfernt vorhandene Meldungen.
     *
     * @param {'existing'|'new'|'job'} nextMode - Der gewünschte Skriptmodus.
     */
    setScriptMode(nextMode) {
        this.scriptMode = nextMode;

        const existingScriptPanel = this.$('existingScriptPanel');
        if (existingScriptPanel) {
            existingScriptPanel.hidden = nextMode !== 'existing';
        }

        const newScriptPanel = this.$('newScriptPanel');
        if (newScriptPanel) {
            newScriptPanel.hidden = nextMode !== 'new';
        }

        const existingJobPanel = this.$('existingJobPanel');
        if (existingJobPanel) {
            existingJobPanel.hidden = nextMode !== 'job';
        }

        if (this.root) {
            this.root.querySelectorAll('.pm-mode-btn').forEach(btn => {
                btn.setAttribute(
                    'aria-pressed',
                    String(btn.dataset.scriptMode === nextMode)
                );
            });
        }

        const submitBtn = this.$('submitSettings');
        if (submitBtn) {
            submitBtn.textContent = nextMode === 'new'
                ? 'Eigenes Skript übernehmen'
                : nextMode === 'job'
                    ? 'Job übernehmen'
                    : 'Änderungen übernehmen';
        }

        if (typeof this.clearMessage === 'function') {
            this.clearMessage();
        }
    }

    /**
     * Initialisiert den Skriptbereich des Pipeline-Editors.
     * Befüllt die Skript- und Job-Dropdowns und stellt gespeicherte
     * Skriptinformationen sowie eigene Skriptvorschauen wieder her.
     * Registriert Ereignis-Listener für die Skript- und Job-Auswahl,
     * die Modus-Schaltflächen und den Import von Python-Dateien.
     * Aktiviert abschließend den aktuell ausgewählten Skriptmodus.
     */
    setupScriptPanel() {
        this.populateScriptList();

        const p = this.getActiveScriptStep() || {};
        if (p.script && p.scriptType !== 'job') {
            const descField = this.$('fieldDescription');
            if (descField) {
                descField.value = p.description || '';
            }

            const paramField = this.$('fieldParameter');
            if (paramField) {
                paramField.value = p.parameter || '';
            }

            const ownScripts = this.ownScripts || [];
            const own = ownScripts.find(script => script.name === p.script);

            const previewWrapper = this.$('ownCodePreviewWrapper');
            if (previewWrapper) {
                previewWrapper.hidden = !own;
            }

            const previewCode = this.$('ownCodePreview');
            if (previewCode) {
                previewCode.textContent = own?.code || '';
            }
        }

        this.updateJobOptions();

        const jobField = this.$('fieldJob');
        if (jobField) {
            jobField.addEventListener('change', () => this.renderJobDetails());
        }

        const scriptField = this.$('fieldScript');
        if (scriptField) {
            scriptField.addEventListener('change', () => this.showSelectedScriptMetadata());
        }

        if (this.root) {
            this.root.querySelectorAll('.pm-mode-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.setScriptMode(btn.dataset.scriptMode);
                });
            });
        }

        const fileInput = this.$('newScriptFile');
        if (fileInput) {
            fileInput.addEventListener('change', async event => {
                const file = event.target.files?.[0];
                if (!file) return;

                // Syntax-Bug behoben: Dateigrößen-Prüfung auf 100 KB (100 * 1024 Bytes)
                if (!file.name.toLowerCase().endsWith('.py') || file.size > 100 * 1024) {
                    this.showMessage?.('Bitte eine .py-Datei bis maximal 100 KB wählen.');
                    event.target.value = '';
                    return;
                }

                try {
                    const code = await file.text();

                    const codeField = this.$('newScriptCode');
                    if (codeField) codeField.value = code;

                    const nameField = this.$('newScriptName');
                    if (nameField) nameField.value = file.name;

                    this.showMessage?.('Python-Datei in den Editor geladen.');
                } catch (error) {
                    this.showMessage?.('Datei konnte nicht gelesen werden.');
                }
            });
        }

        this.setScriptMode(this.scriptMode || 'existing');
    }

    /**
     * Wechselt zum angegebenen Pipeline-Schritt.
     * Speichert den neuen Schritt als aktuellen Bearbeitungsschritt,
     * entfernt vorhandene Meldungen und aktualisiert anschließend
     * das Detailformular sowie die Pipeline-Übersicht.
     *
     * @param {string} step - Der auszuwählende Pipeline-Schritt.
     */
    selectStep(step, index = null) {
        if (!step) return;
        if (step === 'filter') {
            const count = this.getFilterSteps(this.pipeline || {}).length;
            if (index !== null) this.currentFilterIndex = Math.min(count - 1, Math.max(0, Number(index) || 0));
            else this.currentFilterIndex = Math.min(count - 1, this.currentFilterIndex || 0);
        }
        if (step === 'script') {
            const count = this.getScriptSteps(this.pipeline || {}).length;
            if (index !== null) this.currentScriptIndex = Math.min(count - 1, Math.max(0, Number(index) || 0));
            else this.currentScriptIndex = Math.min(count - 1, this.currentScriptIndex || 0);
            this.scriptMode = this.getActiveScriptStep()?.scriptType === 'job' ? 'job' : 'existing';
        }

        this.currentStep = step;

        if (typeof this.clearMessage === 'function') {
            this.clearMessage();
        }

        // Details und Flow im neuen Schritt aktualisieren
        this.renderDetails?.();
        this.renderFlow?.();
    }

    /**
     * Lädt die Konva-Bibliothek dynamisch, falls sie noch nicht verfügbar ist.
     * Verwendet einen gemeinsamen Ladeprozess, um parallele Ladevorgänge zu vermeiden.
     * Behandelt erfolgreiche Ladevorgänge und mögliche Ladefehler.
     *
     * @returns {Promise<Object>} Die geladene Konva-Bibliothek.
     * @throws {Error} Wenn Konva nicht geladen werden kann oder nicht verfügbar ist.
     */
    async loadKonva() {
        if (window.Konva) return window.Konva;

        return window.__konvaLoading ||= new Promise((resolve, reject) => {
            const konvaUrl = '/SWAC/swac/components/Visualmodel/libs/konva.min.js';
            const script = document.createElement('script');

            script.src = konvaUrl;
            script.async = true;

            script.onload = () => {
                if (window.Konva) {
                    console.log('Konva erfolgreich geladen:', window.Konva.version);
                    resolve(window.Konva);
                } else {
                    window.__konvaLoading = null;
                    reject(new Error('Konva geladen, aber window.Konva fehlt.'));
                }
            };

            script.onerror = () => {
                window.__konvaLoading = null;
                reject(new Error('Konva konnte nicht geladen werden: ' + konvaUrl));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Lädt die VisualModel-Klasse dynamisch über einen Modulimport.
     * Unterstützt Default- und benannte Exporte und speichert die
     * geladene Klasse für spätere Aufrufe im globalen Cache.
     *
     * @returns {Promise<Function>} Die geladene VisualModel-Klasse.
     * @throws {Error} Wenn das Modul nicht geladen werden kann oder
     * keinen gültigen Klassenexport enthält.
     */
    async loadVisualModelClass() {
        // Bereits geladene Klasse direkt zurückgeben (Caching)
        if (window.__visualModelClass) return window.__visualModelClass;

        const url = '/SWAC/swac/components/Visualmodel/Visualmodel.js';
        console.log('Lade VisualModel:', url);

        try {
            const module = await import(url);
            const VisualModelClass = module.default || module.VisualModel;

            if (typeof VisualModelClass !== 'function') {
                throw new Error('VisualModel enthält keinen gültigen Klassenexport.');
            }

            console.log('VisualModel erfolgreich geladen.');
            // Klasse im globalen Cache speichern und zurückgeben
            return (window.__visualModelClass = VisualModelClass);
        } catch (error) {
            console.error('Fehler beim Laden von VisualModel:', error);
            throw error;
        }
    }

    /**
     * Initialisiert die VisualModel-Komponente für die grafische Darstellung
     * der Pipeline.
     * Lädt zunächst Konva und die VisualModel-Klasse, erzeugt und konfiguriert
     * eine VisualModel-Instanz und bindet die Klickereignisse der Pipeline-Knoten.
     * Speichert die initialisierte Instanz und zeichnet anschließend den Pipeline-Baum.
     * Behandelt mögliche Initialisierungsfehler und zeigt diese in der Oberfläche an.
     *
     * @returns {Promise<void>}
     */
    async initializeVisualModel() {
        const messageEl = this.$('visualModelMessage');

        try {
            await this.loadKonva();
            const Visualmodel = await this.loadVisualModelClass();

            const instance = new Visualmodel({
                showMenue: false,
                showScenegraph: false,
                plugins: new Map(),
                allowZoom: false,
                stageWidth: 760,
                stageHeight: this.graphHeight || 400, // Fallback, falls graphHeight nicht definiert
                autosave: false
            });

            instance.requestor = this.$('visualModelHost');

            const general = instance.options.attributeDefaults.get('VisualmodelGeneral');

            instance.options.attributeDefaults.set(this.graphSource, {
                ...general,
                dragmode: 'none',
                onClick: event => {
                    const set = event.target?.attrs?.swac_set;
                    if (set?.pmTreeId && set?.pmStep) {
                        this.activateTree(set.pmTreeId, set.pmStep);
                    }
                }
            });

            await instance.init();

            this.visualModel = instance;
            if (messageEl) messageEl.hidden = true;

            this.renderVisualTree();
        } catch (error) {
            console.error('PipelineEditor: VisualModel-Initialisierung fehlgeschlagen:', error);

            if (messageEl) {
                messageEl.textContent = `VisualModel konnte nicht geladen werden: ${error.message}. Die Bausteine unten bleiben bedienbar. Prüfe F12 → Console.`;
                messageEl.hidden = false;
            }
        }
    }

    /**
     * Die Methode <code>loadExistingJobs()</code> ist dafür zuständig,
     * bereits vorhandene Jobs aus SmartData abzurufen, aufzubereiten und anschließend im Dropdown-Menü anzuzeigen.
     */
    async loadExistingJobs() {
        try {
            this.availableJobs = await this.fetchRecords(
                '/SmartData/smartdata/records/datajobs?storage=smartmonitoring',
                'records'
            );

            this.availableJobs = this.availableJobs
                .filter(job => job && job.id != null)
                .sort((a, b) =>
                    String(a.name || '').localeCompare(String(b.name || ''))
                );

            this.jobsError = null;
        } catch (error) {
            this.jobsError = error;
            this.availableJobs = [];
            console.error(
                'PipelineEditor: Jobs konnten nicht geladen werden:',
                error
            );
        }

        this.updateJobOptions();
    }

    /**
     * Die Methode <code>loadJobParams()</code> ist dafür zuständig, die gespeicherten Parameter der vorhandenen
     * Jobs aus SmartData abzurufen und anschließend die Job-Detailansicht zu aktualisieren.
     */
    async loadJobParams() {
        try {
            this.jobParams = await this.fetchRecords(
                '/SmartData/smartdata/records/datajobs_params?storage=smartmonitoring',
                'records'
            );
            this.jobParamsError = null;
        } catch (error) {
            this.jobParams = [];
            this.jobParamsError = error;
            console.error(
                'PipelineEditor: Job-Parameter konnten nicht geladen werden:',
                error
            );
        }

        this.renderJobDetails();
    }

    /**
     * Die Methode <code>loadActionDescriptions()</code> lädt die Beschreibungen der verfügbaren Actions aus SmartDataJobs,
     * speichert sie und aktualisiert anschließend die Anzeige der Job-Details.
     */
    async loadActionDescriptions() {
        try {
            this.actionDescriptions = await this.fetchRecords(
                '/SmartDataJobs/smartdatajobs/jobexecution/getActionsDescription',
                'list'
            );
            this.actionDescriptionsError = null;
        } catch (error) {
            this.actionDescriptions = [];
            this.actionDescriptionsError = error;
            console.error(
                'PipelineEditor: Action-Beschreibungen konnten nicht geladen werden:',
                error
            );
        }

        this.renderJobDetails();
    }

    /**
     * Lädt die Spalten einer ausgewählten Quelltabelle aus der SmartData-API.
     * Bereinigt und sortiert die Spalten anhand möglicher Zeitstempel-Datentypen
     * und befüllt das zugehörige Dropdown für die Zeitstempel-Auswahl.
     * Stellt eine gültige vorherige Spaltenauswahl wieder her und zeigt
     * erkannte Zeitspalten oder mögliche Ladefehler an.
     * Verhindert durch Request-Zähler, dass veraltete Anfragen die aktuelle
     * Benutzeroberfläche überschreiben.
     *
     * @param {string} side - Kennzeichnet die Datenquelle ('a' oder 'b').
     * @param {string} [preferredColumn=''] - Bevorzugte Zeitstempel-Spalte.
     * @returns {Promise<void>}
     */
    async loadConsolidationColumns(side, preferredColumn = '') {
        const sideKey = side.toUpperCase();
        const tableSelect = this.$('fieldConSource' + sideKey);
        const timeSelect = this.$('fieldConTime' + sideKey);
        const hint = this.$('conTimeHint' + sideKey);

        if (!tableSelect || !timeSelect || !hint) return;

        // Instanzvariablen absichern und Request-Zähler erhöhen
        this.consolidationRequestNumbers ||= {};
        this.consolidationRequestNumbers[side] = (this.consolidationRequestNumbers[side] || 0) + 1;
        const requestNumber = this.consolidationRequestNumbers[side];

        const table = tableSelect.value;
        this.consolidationColumns ||= {};
        this.consolidationColumns[side] = null;
        timeSelect.disabled = true;

        timeSelect.replaceChildren(
            new Option(table ? 'Spalten werden geladen ...' : 'Zuerst Tabelle auswählen', '')
        );

        hint.textContent = table
            ? `Lade Spalten für ${table} ...`
            : 'Bitte zuerst eine Quelltabelle auswählen.';

        if (!table) return;

        try {
            const url = `/SmartData/smartdata/collection/${encodeURIComponent(table)}?storage=smartmonitoring`;
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (!Array.isArray(data?.attributes)) {
                throw new Error('Spaltendefinition fehlt');
            }

            // Race-Condition-Guard (Prüfung, ob der Request noch aktuell ist und das Element existiert)
            if (
                requestNumber !== this.consolidationRequestNumbers[side] ||
                (this.root && !this.root.contains(timeSelect))
            ) {
                return;
            }

            const attributes = data.attributes
                .filter(item => item && typeof item.name === 'string' && item.name.trim())
                .map(item => ({
                    name: item.name,
                    type: String(item.type || 'unbekannt')
                }));

            this.consolidationColumns[side] = attributes;

            // Sortierung mit sicherem Aufruf der Klassenmethoden
            const sorted = [...attributes].sort((a, b) =>
                Number(this.isTimestampCandidate?.(b) || false) -
                Number(this.isTimestampCandidate?.(a) || false) ||
                a.name.localeCompare(b.name)
            );

            timeSelect.replaceChildren(new Option('Zeitstempel-Spalte auswählen', ''));

            sorted.forEach(item => {
                timeSelect.add(new Option(`${item.name} (${item.type})`, item.name));
            });

            timeSelect.disabled = !sorted.length;
            timeSelect.value = sorted.some(item => item.name === preferredColumn) ? preferredColumn : '';

            const candidates = sorted
                .filter(item => this.isTimestampType?.(item) ?? false)
                .map(item => item.name);

            hint.textContent = candidates.length
                ? `Mögliche Zeitspalten: ${candidates.join(', ')}. Datentyp prüfen.`
                : 'Keine Timestamp-Spalte erkannt. Für dieses zeitbasierte Matching ist eine echte Zeitspalte nötig.';
        } catch (error) {
            if (
                requestNumber !== this.consolidationRequestNumbers[side] ||
                (this.root && !this.root.contains(timeSelect))
            ) {
                return;
            }

            timeSelect.replaceChildren(new Option('Spalten nicht verfügbar', ''));
            hint.textContent = `SmartData-Spalten konnten nicht geladen werden: ${error.message}`;

            console.error('PipelineEditor: Konsolidierungs-Spalten konnten nicht geladen werden:', error);
        }
    }

    /**
     * Die Methode <code>fetchRecords()</code> lädt Daten von einer URL (z.B. von einer API), überprüft,
     * ob die Antwort gültig ist und gibt anschließend die gewünschte Daten zurück.
     * @param url Die Adresse, von der die Daten geladen werden sollen.
     * @param responseKey Der Name der Eigenschaft im JSON-Objekt, die es zurückbekommt.
     * @returns {Promise<*>} Die gewünschte Daten zurückgeben.
     */
    async fetchRecords(url, responseKey) {
        // Daten von Server laden
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        // Überprüfen, ob die Anfrage erfolgreich war
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} (${url})`);
        }

        // JSON-Daten auslesen
        const data = await response.json();

        // Daten überprüfen, ob die es vorhanden sind.
        if (!data || !Array.isArray(data[responseKey])) {
            throw new Error(`Unerwartetes JSON: ${responseKey} fehlt (${url})`);
        }

        // Gewünschte Daten zurückgeben.
        return data[responseKey];
    }


    //Hilfsfunktionen
    /**
     * Zeigt eine Nachricht im Feedback-Bereich an.
     *
     * @param {string} message - Der anzuzeigende Nachrichtentext.
     */
    showMessage(message) {
        this.$('feedback').textContent = message;
        this.$('feedback').hidden = false;
    }

    /**
     * Diese Methode blendet den Feedback-Bereich wieder aus.
     */
    clearMessage() {
        this.$('feedback').hidden = true;
    }

    /**
     * Sucht ein Skript anhand seines Namens in den vordefinierten
     * und eigenen Skripten.
     *
     * @param {string} name - Name des gesuchten Skripts.
     * @returns {Object|undefined} Das gefundene Skript oder undefined,
     * wenn kein passendes Skript existiert.
     */
    findScript(name) {
        return [...this.predefinedScripts, ...this.ownScripts].find(
            script => script.name === name
        );
    }

    /**
     * Verändert die Zoomstufe der grafischen Pipeline-Ansicht.
     * Begrenzt den Zoom auf einen Bereich von 50 % bis 160 %
     * und aktualisiert anschließend die Zoomanzeige.
     *
     * @param {number} delta - Veränderung des Zoomfaktors.
     *                         Positive Werte vergrößern, negative verkleinern.
     */
    changeZoom(delta) {
        if (!this.visualModel) return;

        const next = Math.max(
            0.5,
            Math.min(
                1.6,
                Math.round((this.visualModel.stage.scaleX() + delta) * 100) / 100
            )
        );

        this.visualModel.zoom(next);

        const label = this.$('vmZoomLabel');
        if (label) {
            label.textContent = `${Math.round(next * 100)} %`;
        }
    }

    /**
     * Prüft, ob ein Datenbankattribut anhand seines Datentyps oder
     * Spaltennamens als mögliche Zeitstempel-Spalte erkannt werden kann.
     * Berücksichtigt typische Datentypen und bekannte Bezeichnungen
     * für Zeitstempel- und Datumsfelder.
     *
     * @param {Object} attribute - Datenbankattribut mit Name und Datentyp.
     * @returns {boolean} true, wenn das Attribut als Zeitstempel-Kandidat erkannt wird, sonst false.
     */
    isTimestampCandidate(attribute) {
        const type = String(attribute.type || '').toLowerCase();
        const name = String(attribute.name || '').toLowerCase();

        return /(timestamp|timestamptz|datetime|date|time)/i.test(type) ||
            /^(ts|timestamp|time|datetime|recorded_at|measured_at|acquiretime|created_at|updated_at)$/.test(name);
    }

    /**
     * Prüft, ob der Datentyp eines Datenbankattributs einem Datums-
     * oder Zeitformat entspricht.
     * Berücksichtigt typische Typbezeichnungen wie TIMESTAMP,
     * TIMESTAMPTZ, DATETIME, DATE und TIME.
     *
     * @param {Object} attribute - Datenbankattribut mit Datentyp.
     * @returns {boolean} true, wenn der Datentyp ein Zeitformat erkennen lässt, sonst false.
     */
    isTimestampType(attribute) {
        return /(timestamp|timestamptz|datetime|date|time)/i.test(
            String(attribute.type || '')
        );
    }
}