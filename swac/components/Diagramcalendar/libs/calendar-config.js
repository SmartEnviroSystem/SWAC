/*
 * Konfiguration des Diagramm-Kalenders (Feature #55).
 *
 * Alle anpassbaren Werte stehen hier und nicht verteilt im Code.
 * Die Tabelle "attributes" ist eine Notlösung: SmartData liefert in der
 * Collection-Beschreibung nur Name und Datentyp, aber keine Einheit und keinen
 * Anzeigenamen. Sobald es dafür eine Quelle gibt (z. B. tbl_measurement_type),
 * kann diese Tabelle ersetzt werden.
 */
(function (root) {
    'use strict';

    let config = {
        // SmartData-Zugriff (gleiche Datenquelle wie in configuration.js)
        smartdataUrl: '/SmartData/smartdata',
        storage: 'smartmonitoring',
        deviceTable: 'tbl_observedobject',
        // Zeitspalte: null = automatisch erkennen (siehe timeAttrCandidates/timeTypes),
        // ein Name erzwingt diese Spalte
        timeAttr: null,
        // Bevorzugte Namen der Zeitspalte, in dieser Reihenfolge; sonst die erste Spalte
        // (alphabetisch) mit einem Typ aus timeTypes
        timeAttrCandidates: ['ts', 'timestamp', 'time', 'datetime', 'zeitstempel'],
        timeTypes: ['timestamp', 'timestamptz', 'timestamp with time zone', 'timestamp without time zone', 'date'],
        // Anzeige-Zeitzone für Kalendertage und Uhrzeiten (MEZ/MESZ automatisch über Intl)
        timeZone: 'Europe/Berlin',
        // Zeitzone von Zeitstempeln OHNE Zone (SmartData-Typ timestamp); null = wie timeZone.
        // HELIOS speichert deutsche Ortszeit. Zeitstempel mit 'Z' oder '+01:00' sind immer eindeutig.
        dataTimeZone: null,
        // Obergrenze je Monatsabruf; wird sie erreicht, zeigt die Seite eine Warnung
        maxRecords: 200000,
        // ID der Charts-Komponente auf charts.html (Ziel des Links "In SWAC Charts öffnen")
        chartsComponentId: 'charts',

        // Datenreduktion je Tag: Mittelwert je Intervall (Minuten)
        intervalMinutes: 15,
        intervalChoices: [1, 5, 10, 15, 30, 60],
        // Ab diesem Intervall (und feiner) erscheint ein Hinweis auf längere Darstellungszeit.
        // Gemessen, Januar 2026: 1 min ≈ 0,12 s (1 Attribut) bis 0,25 s (4 Attribute), 5 min ≈ 0,06–0,12 s
        slowIntervalMinutes: 1,
        // Lücken ab diesem Vielfachen des Intervalls unterbrechen die Linie
        gapFactor: 2.5,
        // Auflösung im großen Tagesdiagramm (Minuten, 0 = Rohdaten, ca. 2 900 Punkte je Tag)
        detailIntervalMinutes: 1,

        // Spalten, die keine Messwerte sind. Allgemeine Konvention für alle Tabellen, keine
        // tabellenbezogenen Regeln. Jede Liste ist per Option der Komponente überschreibbar
        // (dann gilt nur die neue Liste).
        // IDs, Zeit als Zahl, Bild- und Datei-Metadaten:
        excludeAttrs: ['id', 'oo_id', 'synced', 'unixtime', 'epoch',
            'image_width', 'image_height', 'width', 'height', 'size', 'bytesize'],
        excludePrefixes: ['pos', 'measurement_'],
        excludeSuffixes: ['_id', '_length', '_resolution', '_bytesize'],
        // Spalten mit isIdentity/isAutoIncrement aus der Collection-Beschreibung (Primärschlüssel)
        excludeIdentity: true,
        // Nur diese Datentypen gelten als Messwert (Text, Pfade, Base64, bytea, Geometrie usw. nicht)
        numericTypes: ['float4', 'float8', 'int2', 'int4', 'int8', 'numeric', 'double', 'real',
            'integer', 'bigint', 'smallint', 'decimal'],

        // Anzeigename, Einheit, Farbe und optional feste Skalengrenzen (min/max) bekannter Attribute.
        // Ohne min/max richtet sich die y-Achse nach den Werten des Monats (besser sichtbare Verläufe).
        attributes: {
            inn_temp: {label: 'Innentemperatur', unit: '°C', color: '#D55E00'},
            temp1: {label: 'Temperatur 1', unit: '°C', color: '#0072B2'},
            temp2: {label: 'Temperatur 2', unit: '°C', color: '#009E73'},
            temp3: {label: 'Temperatur 3', unit: '°C', color: '#CC79A7'},
            inn_hum: {label: 'Luftfeuchte innen', unit: '%', color: '#56B4E9'},
            inn_pres: {label: 'Luftdruck innen', unit: 'hPa', color: '#8C564B'},
            co2: {label: 'CO₂', unit: 'ppm', color: '#E69F00'},
            pm2_5: {label: 'Feinstaub PM2,5', unit: 'µg/m³', color: '#6A3D9A', min: 0},
            pm10_0: {label: 'Feinstaub PM10', unit: 'µg/m³', color: '#B15928', min: 0}
        },
        // Farben für Attribute, die oben nicht beschrieben sind
        fallbackColors: ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#8C564B', '#6A3D9A']
    };

    root.HeliosCalendarConfig = config;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = config;
})(typeof window !== 'undefined' ? window : globalThis);
