import View from '../../View.js';

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
    }

    /** Initialize once SWAC has loaded the template and component. */
    async init() {
        const root = this.requestor;
        if (!root || !root.querySelector('.pm-app')) {
            throw new Error('PipelineEditor: HTML template was not loaded.');
        }
        (function () {
            'use strict';

            const predefinedScripts = [
              {name:'normalize_values.py', description:'Werte aufbereiten', parameter:'threshold=0.95'},
              {name:'replace_null.py', description:'Fehlende Werte ersetzen', parameter:'ersatzwert=0'}
            ];

            const ownScripts = [];
            const example = () => ({
              source:'exampledata_timeseries_1week', period:'7 Tage', script:'normalize_values.py',
              scriptType:'predefined', jobId:null, description:'Werte aufbereiten',
              parameter:'threshold=0.95', target:'ergebnis_tabelle'
            });
            let pipeline = example();
            let currentStep = 'script';
            let newDraft = false;
            let scriptMode = 'existing';
            const $ = id => root.querySelector('#' + id);
            const labels = {source:'Quelle',filter:'Filter',script:'Skript',target:'Ziel'};

            // Tabellen werden über die bestehende SmartData REST API gelesen.
            // Die Datenbank wird niemals direkt vom Browser angesprochen.
            let availableTables = null;  // null = Anfrage läuft
            let tablesError = null;

            // Bestehende Jobs und deren Parameter werden ausschließlich lesend geladen.
            // Wichtig: Diese Oberfläche startet keine Jobs und speichert keine Änderungen.
            let availableJobs = null; // null = wird geladen
            let jobsError = null;
            let jobParams = null;
            let jobParamsError = null;
            let actionDescriptions = null;
            let actionDescriptionsError = null;

            async function fetchRecords(url, responseKey) {
              const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
              });
              if (!response.ok) throw new Error(`HTTP ${response.status} (${url})`);
              const data = await response.json();
              if (!data || !Array.isArray(data[responseKey])) {
                throw new Error(`Unerwartetes JSON: ${responseKey} fehlt (${url})`);
              }
              return data[responseKey];
            }

            function findJob(id) {
              return (availableJobs || []).find(job => String(job.id) === String(id));
            }

            function updateJobOptions() {
              const select = $('fieldJob');
              if (!select) return; // Panel ist aktuell nicht sichtbar.
              const selectedBefore = select.value ||
                (pipeline.scriptType === 'job' ? String(pipeline.jobId || '') : '');
              select.replaceChildren();
              if (jobsError) {
                select.add(new Option('Jobs konnten nicht geladen werden', ''));
                select.disabled = true;
              } else if (availableJobs === null) {
                select.add(new Option('Jobs werden geladen ...', ''));
                select.disabled = true;
              } else if (!availableJobs.length) {
                select.add(new Option('Keine Jobs gefunden', ''));
                select.disabled = true;
              } else {
                select.disabled = false;
                select.add(new Option('Bitte Job auswählen', ''));
                availableJobs.forEach(job => {
                  select.add(new Option(`${job.name || 'Job'} (ID ${job.id})`, String(job.id)));
                });
                select.value = findJob(selectedBefore) ? selectedBefore : '';
              }
              const help = $('jobHelp');
              if (help) {
                help.textContent = jobsError
                  ? 'SmartData nicht erreichbar. Payara und Browser-Konsole prüfen.'
                  : availableJobs === null
                    ? 'Bestehende Jobs werden aus SmartData geladen.'
                    : `${availableJobs.length} vorhandene Jobs aus SmartData. Auswahl führt keinen Job aus.`;
              }
              renderJobDetails();
            }

            // DOM-Elemente statt HTML-Strings: Werte aus API-Antworten nicht als HTML ausführen.
            function appendJobText(container, text, className = 'pm-field-help') {
              const element = document.createElement('p');
              element.className = className;
              element.textContent = text;
              container.appendChild(element);
              return element;
            }
            
            function appendJobField(container, label, value) {
              const wrapper = document.createElement('div');
              wrapper.className = 'pm-field';
              const title = document.createElement('label');
              title.textContent = label;
              wrapper.appendChild(title);
              const valueString = value == null ? '' : String(value);
              if (/(password|passwd|pwd|secret|token|api.?key)/i.test(label)) {
                const hidden = document.createElement('input');
                hidden.type = 'text';
                hidden.readOnly = true;
                hidden.value = '[Wert aus Sicherheitsgründen ausgeblendet]';
                wrapper.appendChild(hidden);
              } else if (valueString.length > 110 || valueString.includes('\n')) {
                const area = document.createElement('textarea');
                area.readOnly = true;
                area.rows = 5;
                area.value = valueString;
                area.style.maxHeight = '220px';
                wrapper.appendChild(area);
              } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.readOnly = true;
                input.value = valueString;
                wrapper.appendChild(input);
              }
              container.appendChild(wrapper);
            }
            
            function renderJobDetails() {
              const details = $('jobDetails');
              const selected = $('fieldJob');
              if (!details || !selected) return;
              details.replaceChildren();
              const job = findJob(selected.value);
              if (!job) return;

              appendJobField(details, 'Action / Job-Art', job.action || 'Keine Angabe');
              appendJobField(details, 'Beschreibung', job.desc || 'Keine Beschreibung vorhanden');
              appendJobText(details, `Status: ${job.active ? 'aktiv' : 'inaktiv'} · Job-ID: ${job.id}`);

              const heading = document.createElement('h3');
              heading.className = 'pm-script-subheading';
              heading.textContent = 'Gespeicherte Job-Parameter (nur lesbar)';
              details.appendChild(heading);

              if (jobParamsError) {
                appendJobText(details, 'Die Job-Parameter konnten nicht geladen werden.');
              } else if (jobParams === null) {
                appendJobText(details, 'Job-Parameter werden geladen ...');
              } else {
                const params = jobParams.filter(param => String(param.datajob_id) === String(job.id));
                if (params.length === 0) {
                  appendJobText(details, 'Für diesen Job sind keine Parameter gespeichert.');
                }
                params.forEach(param => {
                  appendJobField(details, `${param.key || 'Parameter'} (${param.type || 'unbekannter Typ'})`, param.value);
                });
              }

              const actionHeading = document.createElement('h3');
              actionHeading.className = 'pm-script-subheading';
              actionHeading.textContent = 'Action-Beschreibung (SmartDataJobs)';
              details.appendChild(actionHeading);
              if (actionDescriptionsError) {
                appendJobText(details, 'getActionsDescription konnte nicht geladen werden.');
              } else if (actionDescriptions === null) {
                appendJobText(details, 'Action-Beschreibungen werden geladen ...');
              } else {
                // In datajobs steht z. B. "CheckNet", in der Dokumentation "CheckNetAction".
                const action = actionDescriptions.find(item =>
                  String(item.name || '').replace(/Action$/i, '').toLowerCase() ===
                  String(job.action || '').replace(/Action$/i, '').toLowerCase()
                );
                if (!action) {
                  appendJobText(details, `Für "${job.action || 'unbekannt'}" liefert getActionsDescription derzeit keine Beschreibung.`);
                } else {
                  appendJobText(details, `Dokumentierte Action: ${action.name}`);
                  (Array.isArray(action.params) ? action.params : []).forEach(param => {
                    const mandatory = param.optional === false ? 'Pflichtfeld' : 'optional';
                    const dataType = param.type ? ` · Typ: ${param.type}` : '';
                    appendJobText(details,
                      `${param.name}: ${mandatory}${dataType}${param.description ? ' — ' + param.description : ''}`);
                  });
                }
              }
            }

            async function loadExistingJobs() {
              try {
                availableJobs = await fetchRecords(
                  '/SmartData/smartdata/records/datajobs?storage=smartmonitoring', 'records'
                );
                availableJobs = availableJobs.filter(job => job && job.id != null)
                  .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
                jobsError = null;
              } catch (error) {
                jobsError = error;
                availableJobs = [];
                console.error('PipelineEditor: Jobs konnten nicht geladen werden:', error);
              }
              updateJobOptions();
            }

            async function loadJobParams() {
              try {
                jobParams = await fetchRecords(
                  '/SmartData/smartdata/records/datajobs_params?storage=smartmonitoring', 'records'
                );
                jobParamsError = null;
              } catch (error) {
                jobParams = [];
                jobParamsError = error;
                console.error('PipelineEditor: Job-Parameter konnten nicht geladen werden:', error);
              }
              renderJobDetails();
            }

            async function loadActionDescriptions() {
              try {
                actionDescriptions = await fetchRecords(
                  '/SmartDataJobs/smartdatajobs/jobexecution/getActionsDescription', 'list'
                );
                actionDescriptionsError = null;
              } catch (error) {
                actionDescriptions = [];
                actionDescriptionsError = error;
                console.error('PipelineEditor: Action-Beschreibungen konnten nicht geladen werden:', error);
              }
              renderJobDetails();
            }

            function updateSourceOptions() {
              const select = $('fieldSource');
              if (!select) return; // Quelle ist derzeit nicht ausgewählt.

              select.replaceChildren();
              if (tablesError) {
                select.add(new Option('Tabellen konnten nicht geladen werden', ''));
                select.disabled = true;
              } else if (availableTables === null) {
                select.add(new Option('Tabellen werden geladen ...', ''));
                select.disabled = true;
              } else if (availableTables.length === 0) {
                select.add(new Option('Keine Tabellen gefunden', ''));
                select.disabled = true;
              } else {
                select.disabled = false;
                select.add(new Option('Bitte auswählen', ''));
                for (const name of availableTables) {
                  select.add(new Option(name, name));
                }
                select.value = availableTables.includes(pipeline.source) ? pipeline.source : '';
              }
              const help = $('sourceHelp');
              if (help) {
                help.textContent = tablesError
                  ? 'SmartData-API nicht erreichbar. Prüfe Payara und die Browser-Konsole.'
                  : availableTables === null
                    ? 'Die Tabellen werden aus SmartData geladen.'
                    : 'Echte Tabellen aus dem Schema smartmonitoring.';
              }
            }

            async function loadAvailableTables() {
              try {
                const response = await fetch('/SmartData/smartdata/storage/getCollections?name=smartmonitoring', {
                  method: 'GET',
                  headers: { 'Accept': 'application/json' }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const json = await response.json();
                if (!json || !Array.isArray(json.list)) {
                  throw new Error('Unerwartetes Antwortformat der SmartData-API');
                }
                availableTables = [...new Set(json.list
                  .map(item => item && item.name)
                  .filter(name => typeof name === 'string' && name.length > 0))]
                  .sort((a, b) => a.localeCompare(b));
                tablesError = null;
              } catch (error) {
                tablesError = error;
                availableTables = [];
                console.error('PipelineEditor: Tabellen konnten nicht geladen werden:', error);
              }
              updateSourceOptions();
            }

            function showMessage(message) {
              $('feedback').textContent = message;
              $('feedback').hidden = false;
            }
            function clearMessage() { $('feedback').hidden = true; }
            function findScript(name) {
              return [...predefinedScripts, ...ownScripts].find(s => s.name === name);
            }
            function renderFlow() {
              $('sourcePreview').textContent = pipeline.source || 'Bitte auswählen';
              $('filterPreview').textContent = 'Zeitraum: ' + pipeline.period;
              $('scriptPreview').textContent = pipeline.script
                ? pipeline.script
                : 'Bitte auswählen';
              $('targetPreview').textContent = pipeline.target || 'Bitte eingeben';
              root.querySelectorAll('.pm-node').forEach(node => {
                node.setAttribute('aria-pressed', String(node.dataset.step === currentStep));
              });
              $('pipelineLabel').textContent = newDraft ? 'Neue Pipeline · Entwurf' : 'Messdaten aufbereiten';
              $('currentStep').textContent = 'Ausgewählter Baustein: ' + labels[currentStep];
            }

            const forms = {
              source: `
                <div class="pm-field"><label for="fieldSource">Datenquelle / Tabelle auswählen</label>
                  <select id="fieldSource" name="source" disabled>
                    <option value="">Tabellen werden geladen ...</option>
                  </select>
                  <span id="sourceHelp" class="pm-field-help">Die Tabellen werden aus SmartData geladen.</span>
                </div>`,
              filter: `
                <div class="pm-field"><label for="fieldPeriod">Zeitraum auswählen</label>
                  <select id="fieldPeriod" name="period">
                    <option>24 Stunden</option><option>7 Tage</option><option>30 Tage</option><option>Alle Daten</option>
                  </select>
                  <span class="pm-field-help">Zeitbereich für die ausgewählten Messdaten festlegen.</span>
                </div>`,
              script: `
                <div class="pm-script-modes" role="group" aria-label="Skript oder Job auswählen" style="grid-template-columns:repeat(3,minmax(0,1fr))">
                  <button type="button" class="pm-mode-btn" data-script-mode="existing" aria-pressed="true">Skript</button>
                  <button type="button" class="pm-mode-btn" data-script-mode="new" aria-pressed="false">Eigenes Skript</button>
                  <button type="button" class="pm-mode-btn" data-script-mode="job" aria-pressed="false">Job</button>
                </div>
                <div id="existingJobPanel" class="pm-script-panel" hidden>
                  <div class="pm-script-subheading">Vorhandenen Job auswählen</div>
                  <div class="pm-field"><label for="fieldJob">Job</label>
                    <select id="fieldJob" name="job" disabled>
                      <option value="">Jobs werden geladen ...</option>
                    </select>
                    <span class="pm-field-help" id="jobHelp">Bestehende Jobs werden aus SmartData geladen.</span>
                  </div>
                  <div id="jobDetails" aria-live="polite"></div>
                </div>
                <div id="existingScriptPanel" class="pm-script-panel">
                  <div class="pm-script-subheading">Skript aus der Liste auswählen</div>
                  <div class="pm-field"><label for="fieldScript">Skript auswählen</label>
                    <select id="fieldScript" name="script"></select>
                    <span class="pm-field-help">Vorhandenes oder selbst erstelltes Skript auswählen.</span>
                  </div>
                  <div class="pm-field"><label for="fieldDescription">Beschreibung</label>
                    <textarea id="fieldDescription" name="description" rows="3"></textarea>
                  </div>
                  <div class="pm-field"><label for="fieldParameter">Parameter</label>
                    <input id="fieldParameter" name="parameter" type="text" placeholder="z. B. threshold=0.95">
                    <span class="pm-field-help">Parameter für das ausgewählte Skript festlegen.</span>
                  </div>
                  <div class="pm-field" id="ownCodePreviewWrapper" hidden>
                    <label>Quellcode des eigenen Skripts</label>
                    <pre class="pm-custom-code-preview" id="ownCodePreview"></pre>
                  </div>
                </div>
                <div id="newScriptPanel" class="pm-script-panel" hidden>
                  <div class="pm-script-subheading">Neuen Python-Baustein erstellen</div>
                  <div class="pm-field"><label for="newScriptName">Skriptname</label>
                    <input id="newScriptName" name="newScriptName" type="text" autocomplete="off" placeholder="z. B. meine_auswertung.py">
                  </div>
                  <div class="pm-field"><label for="newScriptDescription">Beschreibung</label>
                    <textarea id="newScriptDescription" name="newScriptDescription" rows="2" placeholder="Was macht das Skript?"></textarea>
                  </div>
                  <div class="pm-field"><label for="newScriptParameter">Parameter (optional)</label>
                    <input id="newScriptParameter" name="newScriptParameter" type="text" placeholder="z. B. faktor=2">
                  </div>
                  <div class="pm-field"><label for="newScriptCode">Python-Code</label>
                    <textarea class="pm-code-editor" id="newScriptCode" name="newScriptCode" spellcheck="false" placeholder="def process(values):\n    return [x * 2 for x in values]"></textarea>
                    <span class="pm-field-help">Python-Code eingeben oder aus einer .py-Datei übernehmen.</span>
                  </div>
                  <div class="pm-field"><label for="newScriptFile">Vorhandene .py-Datei importieren (optional)</label>
                    <input id="newScriptFile" name="newScriptFile" type="file" accept=".py,text/x-python">
                    <span class="pm-field-help">Dateigröße maximal 100 KB.</span>
                  </div>
                </div>`,
              target: `
                <div class="pm-field"><label for="fieldTarget">Zieltabelle</label>
                  <input id="fieldTarget" name="target" type="text" placeholder="z. B. ergebnis_tabelle">
                  <span class="pm-field-help">Tabelle für die Ausgabe der Verarbeitung festlegen.</span>
                </div>`
            };

            function populateScriptList() {
              const select = $('fieldScript');
              select.replaceChildren();
              const placeholder = new Option('Bitte auswählen', '');
              select.add(placeholder);
              const createGroup = (title, scripts) => {
                const group = document.createElement('optgroup');
                group.label = title;
                scripts.forEach(script => group.appendChild(new Option(
                  script.name,
                  script.name
                )));
                select.add(group);
              };
              createGroup('Vorhandene Skripte', predefinedScripts);
              if (ownScripts.length) createGroup('Eigene Skripte', ownScripts);
              select.value = pipeline.scriptType === 'job' ? '' : pipeline.script;
            }
            function showSelectedScriptMetadata() {
              const selected = findScript($('fieldScript').value);
              $('fieldDescription').value = selected ? selected.description : '';
              $('fieldParameter').value = selected ? selected.parameter : '';
              const own = ownScripts.find(s => s.name === $('fieldScript').value);
              $('ownCodePreviewWrapper').hidden = !own;
              $('ownCodePreview').textContent = own ? own.code : '';
            }
            function setScriptMode(nextMode) {
              scriptMode = nextMode;
              $('existingScriptPanel').hidden = nextMode !== 'existing';
              $('newScriptPanel').hidden = nextMode !== 'new';
              $('existingJobPanel').hidden = nextMode !== 'job';
              root.querySelectorAll('.pm-mode-btn').forEach(btn => {
                btn.setAttribute('aria-pressed', String(btn.dataset.scriptMode === nextMode));
              });
              $('submitSettings').textContent = nextMode === 'new'
                ? 'Eigenes Skript übernehmen'
                : nextMode === 'job' ? 'Job übernehmen' : 'Änderungen übernehmen';
              clearMessage();
            }
            function setupScriptPanel() {
              populateScriptList();
              if (pipeline.script && pipeline.scriptType !== 'job') {
                $('fieldDescription').value = pipeline.description;
                $('fieldParameter').value = pipeline.parameter;
                const own = ownScripts.find(s => s.name === pipeline.script);
                $('ownCodePreviewWrapper').hidden = !own;
                $('ownCodePreview').textContent = own ? own.code : '';
              }
              updateJobOptions();
              $('fieldJob').addEventListener('change', renderJobDetails);
              $('fieldScript').addEventListener('change', showSelectedScriptMetadata);
              root.querySelectorAll('.pm-mode-btn').forEach(btn => {
                btn.addEventListener('click', () => setScriptMode(btn.dataset.scriptMode));
              });
              $('newScriptFile').addEventListener('change', async event => {
                const file = event.target.files && event.target.files[0];
                if (!file) return;
                if (!file.name.toLowerCase().endsWith('.py') || file.size > 100 * 1024) {
                  showMessage('Bitte eine .py-Datei bis maximal 100 KB wählen.');
                  event.target.value = '';
                  return;
                }
                try {
                  const code = await file.text();
                  $('newScriptCode').value = code;
                  $('newScriptName').value = file.name;
                  showMessage('Python-Datei in den Editor geladen.');
                } catch (error) {
                  showMessage('Datei konnte nicht gelesen werden.');
                }
              });
              setScriptMode(scriptMode);
            }
            function renderDetails() {
              $('detailsForm').innerHTML = forms[currentStep] +
                '<button id="submitSettings" type="submit" class="pm-btn pm-btn-primary">Änderungen übernehmen</button>';
              if (currentStep === 'source') updateSourceOptions();
              if (currentStep === 'filter') $('fieldPeriod').value = pipeline.period;
              if (currentStep === 'script') setupScriptPanel();
              if (currentStep === 'target') $('fieldTarget').value = pipeline.target;
            }
            function selectStep(step) {
              currentStep = step;
              clearMessage();
              renderFlow();
              renderDetails();
            }

            root.querySelectorAll('.pm-node').forEach(node => {
              node.addEventListener('click', () => selectStep(node.dataset.step));
            });
            $('detailsForm').addEventListener('submit', event => {
              event.preventDefault();
              if (currentStep === 'source') pipeline.source = $('fieldSource').value;
              if (currentStep === 'filter') pipeline.period = $('fieldPeriod').value;
              if (currentStep === 'script') {
                if (scriptMode === 'job') {
                  const job = findJob($('fieldJob').value);
                  if (!job) {
                    showMessage('Bitte zuerst einen vorhandenen Job auswählen.');
                    return;
                  }
                  pipeline.jobId = job.id;
                  pipeline.script = job.name;
                  pipeline.scriptType = 'job';
                  pipeline.description = job.desc || '';
                  pipeline.parameter = '';
                  renderFlow();
                  showMessage(`Job „${job.name}“ ausgewählt. Eine Job-Ausführung oder Speicherung findet noch nicht statt.`);
                  return;
                }
                if (scriptMode === 'new') {
                  const name = $('newScriptName').value.trim();
                  const code = $('newScriptCode').value;
                  if (!/^[A-Za-z0-9_.-]+\.py$/i.test(name)) {
                    showMessage('Bitte einen gültigen Dateinamen wie mein_skript.py eingeben.');
                    return;
                  }
                  if (!code.trim()) {
                    showMessage('Bitte Python-Code eingeben oder eine .py-Datei importieren.');
                    return;
                  }
                  if (code.length > 100 * 1024) {
                    showMessage('Der Python-Code darf maximal 100 KB groß sein.');
                    return;
                  }
                  if (predefinedScripts.some(s => s.name === name)) {
                    showMessage('Dieser Skriptname ist bereits vergeben. Bitte einen anderen Namen wählen.');
                    return;
                  }
                  const custom = {
                    name, code,
                    description:$('newScriptDescription').value.trim(),
                    parameter:$('newScriptParameter').value.trim()
                  };
                  const existingIndex = ownScripts.findIndex(s => s.name === name);
                  if (existingIndex >= 0) ownScripts[existingIndex] = custom;
                  else ownScripts.push(custom);
                  pipeline.script = name;
                  pipeline.jobId = null;
                  pipeline.scriptType = 'custom';
                  pipeline.description = custom.description;
                  pipeline.parameter = custom.parameter;
                  scriptMode = 'existing';
                  renderFlow();
                  renderDetails();
                  showMessage('Eigenes Skript „' + name + '“ wurde zur Skriptliste hinzugefügt.');
                  return;
                }
                pipeline.script = $('fieldScript').value;
                pipeline.jobId = null;
                pipeline.scriptType = ownScripts.some(s => s.name === pipeline.script) ? 'custom' : 'predefined';
                pipeline.description = $('fieldDescription').value;
                pipeline.parameter = $('fieldParameter').value;
              }
              if (currentStep === 'target') pipeline.target = $('fieldTarget').value.trim();
              renderFlow();
              showMessage('Einstellungen übernommen.');
            });
            $('loadExample').addEventListener('click', () => {
              pipeline = example(); newDraft = false; scriptMode = 'existing';
              selectStep('script');
              showMessage('Pipeline geöffnet.');
            });
            $('newPipeline').addEventListener('click', () => {
              pipeline = {source:'', period:'7 Tage', script:'',scriptType:'predefined', jobId:null, description:'', parameter:'', target:''};
              newDraft = true; scriptMode = 'existing';
              selectStep('source');
              showMessage('Neue Pipeline erstellt.');
            });
            $('savePipeline').addEventListener('click', () => {
              showMessage('Die dauerhafte Speicherung ist noch nicht angebunden.');
            });
            renderFlow();
            renderDetails();
            loadAvailableTables();
            // Drei reine Lesezugriffe: Jobs, gespeicherte Parameter, Action-Dokumentation.
            loadExistingJobs();
            loadJobParams();
            loadActionDescriptions();
          })();
    }
}

