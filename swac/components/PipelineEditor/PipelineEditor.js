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
              scriptType:'predefined', description:'Werte aufbereiten',
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
                <div class="pm-script-modes" role="group" aria-label="Art des Skripts auswählen">
                  <button type="button" class="pm-mode-btn" data-script-mode="existing" aria-pressed="true">Vorhandenes Skript</button>
                  <button type="button" class="pm-mode-btn" data-script-mode="new" aria-pressed="false">Eigenes Skript erstellen</button>
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
              select.value = pipeline.script;
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
              const isNew = nextMode === 'new';
              $('existingScriptPanel').hidden = isNew;
              $('newScriptPanel').hidden = !isNew;
              root.querySelectorAll('.pm-mode-btn').forEach(btn => {
                btn.setAttribute('aria-pressed', String(btn.dataset.scriptMode === nextMode));
              });
              $('submitSettings').textContent = isNew ? 'Eigenes Skript übernehmen' : 'Änderungen übernehmen';
              clearMessage();
            }
            function setupScriptPanel() {
              populateScriptList();
              if (pipeline.script) {
                $('fieldDescription').value = pipeline.description;
                $('fieldParameter').value = pipeline.parameter;
                const own = ownScripts.find(s => s.name === pipeline.script);
                $('ownCodePreviewWrapper').hidden = !own;
                $('ownCodePreview').textContent = own ? own.code : '';
              }
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
              pipeline = {source:'', period:'7 Tage', script:'',scriptType:'predefined', description:'', parameter:'', target:''};
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
          })();
    }
}

