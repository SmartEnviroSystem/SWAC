export const forms = {
    source: `
                <div class="pm-field"><label for="fieldSource">Datenquelle / Tabelle auswählen</label>
                  <select id="fieldSource" name="source" disabled>
                    <option value="">Tabellen werden geladen ...</option>
                  </select>
                  <span id="sourceHelp" class="pm-field-help">Die Tabellen werden aus SmartData geladen.</span>
                </div>`,

    filter: `
                <div class="pm-script-subheading">Zeitraum</div>
                <div class="pm-field">
                  <label for="fieldPeriod">Zeitraum auswählen</label>
                  <select id="fieldPeriod" name="period">
                    <option>24 Stunden</option>
                    <option>7 Tage</option>
                    <option>30 Tage</option>
                    <option>Alle Daten</option>
                  </select>
                  <span class="pm-field-help">Zeitbereich für die ausgewählten Messdaten festlegen.</span>
                </div>
                <div class="pm-script-subheading">Filterbedingung (optional)</div>
                <div class="pm-field">
                  <label for="fieldFilterColumn">Messwert-/Spaltenname</label>
                  <input id="fieldFilterColumn" name="filterColumn" type="text" placeholder="z. B. temperature">
                  <span class="pm-field-help">Name der Spalte, auf die der Filter angewendet werden soll.</span>
                </div>
                <div class="pm-field">
                  <label for="fieldFilterOperator">Vergleichsoperator</label>
                  <select id="fieldFilterOperator" name="filterOperator">
                    <option value="gt">Größer als (&gt;)</option>
                    <option value="gte">Größer oder gleich (&gt;=)</option>
                    <option value="lt">Kleiner als (&lt;)</option>
                    <option value="lte">Kleiner oder gleich (&lt;=)</option>
                    <option value="eq">Gleich (=)</option>
                    <option value="neq">Ungleich (!=)</option>
                    <option value="contains">Enthält</option>
                  </select>
                </div>
                <div class="pm-field">
                  <label for="fieldFilterValue">Vergleichswert</label>
                  <input id="fieldFilterValue" name="filterValue" type="text" placeholder="z. B. 25">
                </div>
                <span class="pm-field-help">Die Filterbedingung wird lokal in der Pipeline-Konfiguration abgelegt. Es werden keine Daten gefiltert.</span>`,

    consolidation: `
                <p class="pm-field-help pm-con-intro">Zeitbasiertes Matching aus dem Datenkonsolidierungs-Mockup. Tabelle A wird mit dem Schritt „Quelle“ synchronisiert.</p>

                <div class="pm-field">
                  <label for="fieldConSourceA">Tabelle A (Quelle)</label>
                  <select id="fieldConSourceA" disabled required>
                    <option value="">Tabellen werden geladen ...</option>
                  </select>
                </div>

                <div class="pm-field">
                  <label for="fieldConSourceB">Tabelle B (zweite Datenquelle)</label>
                  <select id="fieldConSourceB" disabled required>
                    <option value="">Tabellen werden geladen ...</option>
                  </select>
                </div>

                <div class="pm-field">
                  <label for="fieldConTimeA">Zeitstempel-Spalte A</label>
                  <select id="fieldConTimeA" required disabled>
                    <option value="">Zuerst Tabelle A auswählen</option>
                  </select>
                  <span id="conTimeHintA" class="pm-field-help"></span>
                </div>

                <div class="pm-field">
                  <label for="fieldConTimeB">Zeitstempel-Spalte B</label>
                  <select id="fieldConTimeB" required disabled>
                    <option value="">Zuerst Tabelle B auswählen</option>
                  </select>
                  <span id="conTimeHintB" class="pm-field-help"></span>
                </div>

                <div class="pm-field">
                  <label for="fieldConMode">Matching-Modus</label>
                  <select id="fieldConMode">
                    <option value="intersection">Intersection – nur passende Zeitpunkte</option>
                    <option value="union">Union – auch nicht passende Datensätze</option>
                  </select>
                </div>

                <div class="pm-field">
                  <label for="fieldConTolerance">Zeitliche Toleranz (Sekunden)</label>
                  <input id="fieldConTolerance" type="number" min="0" max="86400" step="1" required>
                </div>

                <div class="pm-field">
                  <label for="fieldConTarget">Gewünschte Konsolidierungs-Zieltabelle</label>
                  <input id="fieldConTarget" type="text" required placeholder="consolidated_timeseries">
                </div>

                <div class="pm-con-preview">
                  <strong>JSON-Konfigurationsvorschau</strong>
                  <p id="conPreviewHint" class="pm-field-help">Noch keine Konfiguration übernommen.</p>
                  <pre id="consolidationJson" aria-live="polite">Noch keine Konfiguration erzeugt.</pre>
                  <p class="pm-field-help">Nur Frontend-Konfiguration: Es werden keine Daten zusammengeführt, keine Jobs gestartet und keine Daten gespeichert. Das JSON ist kein bestätigter Backend-Vertrag.</p>
                </div>`,

    script: `
                <div class="pm-script-modes" role="group" aria-label="Skript oder Job auswählen" style="grid-template-columns:repeat(3,minmax(0,1fr))">
                  <button type="button" class="pm-mode-btn" data-script-mode="existing" aria-pressed="true">Skript</button>
                  <button type="button" class="pm-mode-btn" data-script-mode="new" aria-pressed="false">Eigenes Skript</button>
                  <button type="button" class="pm-mode-btn" data-script-mode="job" aria-pressed="false">Job</button>
                </div>

                <div id="existingJobPanel" class="pm-script-panel" hidden>
                  <div class="pm-script-subheading">Vorhandenen Job auswählen</div>
                  <div class="pm-field">
                    <label for="fieldJob">Job</label>
                    <select id="fieldJob" name="job" disabled>
                      <option value="">Jobs werden geladen ...</option>
                    </select>
                    <span class="pm-field-help" id="jobHelp">Bestehende Jobs werden aus SmartData geladen.</span>
                  </div>
                  <div id="jobDetails" aria-live="polite"></div>
                </div>

                <div id="existingScriptPanel" class="pm-script-panel">
                  <div class="pm-script-subheading">Skript aus der Liste auswählen</div>
                  <div class="pm-field">
                    <label for="fieldScript">Skript auswählen</label>
                    <select id="fieldScript" name="script"></select>
                    <span class="pm-field-help">Vorhandenes oder selbst erstelltes Skript auswählen.</span>
                  </div>

                  <div class="pm-field">
                    <label for="fieldDescription">Beschreibung</label>
                    <textarea id="fieldDescription" name="description" rows="3"></textarea>
                  </div>

                  <div class="pm-field">
                    <label for="fieldParameter">Parameter</label>
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

                  <div class="pm-field">
                    <label for="newScriptName">Skriptname</label>
                    <input id="newScriptName" name="newScriptName" type="text" autocomplete="off" placeholder="z. B. meine_auswertung.py">
                  </div>

                  <div class="pm-field">
                    <label for="newScriptDescription">Beschreibung</label>
                    <textarea id="newScriptDescription" name="newScriptDescription" rows="2" placeholder="Was macht das Skript?"></textarea>
                  </div>

                  <div class="pm-field">
                    <label for="newScriptParameter">Parameter (optional)</label>
                    <input id="newScriptParameter" name="newScriptParameter" type="text" placeholder="z. B. faktor=2">
                  </div>

                  <div class="pm-field">
                    <label for="newScriptCode">Python-Code</label>
                    <textarea class="pm-code-editor" id="newScriptCode" name="newScriptCode" spellcheck="false" placeholder="def process(values):
    return [x * 2 for x in values]"></textarea>
                    <span class="pm-field-help">Python-Code eingeben oder aus einer .py-Datei übernehmen.</span>
                  </div>

                  <div class="pm-field">
                    <label for="newScriptFile">Vorhandene .py-Datei importieren (optional)</label>
                    <input id="newScriptFile" name="newScriptFile" type="file" accept=".py,text/x-python">
                    <span class="pm-field-help">Dateigröße maximal 100 KB.</span>
                  </div>
                </div>`,

    target: `
                <div class="pm-script-subheading">Ausgabe konfigurieren</div>
                <div class="pm-field">
                  <label for="fieldTarget">Name der Zieltabelle</label>
                  <input id="fieldTarget" name="target" type="text" placeholder="z. B. ergebnis_tabelle" required>
                  <span class="pm-field-help">Name der Tabelle, die das Ergebnis aufnehmen soll. Die Tabelle wird nicht angelegt.</span>
                </div>
                <div class="pm-field">
                  <label for="fieldTargetFormat">Ausgabeformat</label>
                  <select id="fieldTargetFormat" name="targetFormat">
                    <option value="table">SmartData-Tabelle</option>
                    <option value="csv">CSV (Konfiguration)</option>
                    <option value="json">JSON (Konfiguration)</option>
                  </select>
                </div>
                <div class="pm-field">
                  <label for="fieldTargetWriteMode">Schreibmodus</label>
                  <select id="fieldTargetWriteMode" name="targetWriteMode">
                    <option value="replace">Ersetzen</option>
                    <option value="append">Datensätze anhängen</option>
                    <option value="upsert">Aktualisieren oder einfügen</option>
                  </select>
                </div>
                <div class="pm-field">
                  <label><input id="fieldTargetTimestamp" type="checkbox" style="width:auto;margin-right:7px"> Zeitstempel in Ausgabe übernehmen</label>
                  <span class="pm-field-help">Diese Optionen werden vorerst nur lokal als Zielkonfiguration gespeichert.</span>
                </div>`
};

export default forms;