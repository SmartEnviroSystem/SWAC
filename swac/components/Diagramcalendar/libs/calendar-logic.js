/*
 * Reine Hilfsfunktionen für den Diagramm-Kalender (ohne DOM-Zugriff).
 * Dadurch lassen sie sich auch mit Node.js testen.
 */
(function (root) {
    'use strict';

    const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function toIsoDate(year, monthIndex, day) {
        let d = new Date(Date.UTC(year, monthIndex, day));
        return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }

    function formatGermanDate(isoDate) {
        let p = isoDate.split('-');
        return p[2] + '.' + p[1] + '.' + p[0];
    }

    /*
     * @param {string[]} [monthNames] übersetzte Monatsnamen (Standard: Deutsch)
     */
    function formatMonthLabel(year, monthIndex, monthNames) {
        return (monthNames || MONTH_NAMES)[monthIndex] + ' ' + year;
    }

    /*
     * Verschiebt einen Monat um delta Monate.
     * @returns {{year: number, month: number}} month ist 0-basiert
     */
    function shiftMonth(year, monthIndex, delta) {
        let d = new Date(Date.UTC(year, monthIndex + delta, 1));
        return {year: d.getUTCFullYear(), month: d.getUTCMonth()};
    }

    /*
     * Erzeugt die Zellen eines Monatskalenders (Wochenbeginn Montag).
     * Tage des Vor- und Folgemonats füllen die erste und letzte Woche auf.
     *
     * @returns {Object[]} Zellen { date: 'YYYY-MM-DD', day, inMonth }
     */
    function buildMonthGrid(year, monthIndex) {
        let first = new Date(Date.UTC(year, monthIndex, 1));
        let daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
        let leading = (first.getUTCDay() + 6) % 7; // Montag = 0
        let total = Math.ceil((leading + daysInMonth) / 7) * 7;
        let cells = [];
        for (let i = 0; i < total; i++) {
            let d = new Date(Date.UTC(year, monthIndex, 1 - leading + i));
            cells.push({
                date: toIsoDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
                day: d.getUTCDate(),
                inMonth: d.getUTCMonth() === monthIndex
            });
        }
        return cells;
    }

    // ------------------------------------------------------------ Woche

    /*
     * Verschiebt ein Datum 'YYYY-MM-DD' um n Tage (rein kalendarisch, ohne Zeitzone).
     */
    function addDays(isoDate, n) {
        let p = isoDate.split('-').map(Number);
        return toIsoDate(p[0], p[1] - 1, p[2] + n);
    }

    /*
     * Montag der Woche, in der das Datum liegt.
     */
    function weekStartOf(isoDate) {
        let p = isoDate.split('-').map(Number);
        let weekday = (new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() + 6) % 7; // Montag = 0
        return addDays(isoDate, -weekday);
    }

    /*
     * Die 7 Zellen einer Woche (Mo–So), auch über Monats- und Jahresgrenzen.
     * @returns {Object[]} { date, day, inMonth: true } wie buildMonthGrid
     */
    function buildWeekGrid(mondayIso) {
        let cells = [];
        for (let i = 0; i < 7; i++) {
            let date = addDays(mondayIso, i);
            cells.push({date: date, day: Number(date.slice(8, 10)), inMonth: true});
        }
        return cells;
    }

    /*
     * Kalenderwoche nach ISO 8601 (Woche mit dem ersten Donnerstag ist KW 1).
     * @returns {{week: number, year: number}}
     */
    function isoWeek(isoDate) {
        let thursday = addDays(weekStartOf(isoDate), 3);
        let year = Number(thursday.slice(0, 4));
        let firstThursday = addDays(weekStartOf(year + '-01-04'), 3);
        let diffDays = Math.round((Date.parse(thursday) - Date.parse(firstThursday)) / 86400000);
        return {week: diffDays / 7 + 1, year: year};
    }

    /*
     * Überschrift einer Woche, z. B. "KW 3 · 12.–18.01.2026" oder über Monatsgrenzen
     * "KW 1 · 29.12.2025 – 04.01.2026".
     */
    function formatWeekLabel(mondayIso, weekWord) {
        let sunday = addDays(mondayIso, 6);
        let kw = isoWeek(mondayIso).week;
        let a = formatGermanDate(mondayIso), b = formatGermanDate(sunday);
        let range;
        if (mondayIso.slice(0, 7) === sunday.slice(0, 7))
            range = a.slice(0, 3) + '–' + b;
        else if (mondayIso.slice(0, 4) === sunday.slice(0, 4))
            range = a.slice(0, 6) + '–' + b;
        else
            range = a + ' – ' + b;
        return (weekWord || 'KW') + ' ' + kw + ' · ' + range;
    }

    // ------------------------------------------------------------------ Zeitzone
    //
    // Intern ist jeder Zeitpunkt eine UTC-Zahl (Millisekunden seit 1970, wie Date.getTime()).
    // Nur für Kalendertag und Uhrzeit wird in die Anzeige-Zone umgerechnet, Standard
    // Europe/Berlin: MEZ (UTC+1) im Winter, MESZ (UTC+2) im Sommer. Wann gewechselt wird,
    // weiß Intl.DateTimeFormat des Browsers; hier ist KEIN fester Versatz eingebaut.
    // Die Zeitzone des Browsers spielt dabei keine Rolle.

    const DEFAULT_ZONE = 'Europe/Berlin';
    const partsFormatters = {};
    const dayStartCache = new Map();
    const dayOfCache = new Map();
    const wallOffsetCache = new Map();

    /*
     * Datum und Uhrzeit eines UTC-Zeitpunkts in einer Zeitzone.
     * Beispiel: zoneParts(Date.parse('2026-07-15T12:00:00Z'), 'Europe/Berlin') -> 15.07.2026 14:00:00
     */
    function zoneParts(ms, zone) {
        zone = zone || DEFAULT_ZONE;
        if (!partsFormatters[zone]) {
            partsFormatters[zone] = new Intl.DateTimeFormat('en-US', {timeZone: zone, hourCycle: 'h23',
                year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'});
        }
        let p = {};
        for (let part of partsFormatters[zone].formatToParts(new Date(ms)))
            p[part.type] = Number(part.value);
        return {year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second};
    }

    /*
     * Abstand der Zone zu UTC in Minuten zu einem Zeitpunkt (Berlin: 60 = MEZ, 120 = MESZ).
     * Ergibt sich aus Intl, nicht aus einer Tabelle.
     */
    function zoneOffset(ms, zone) {
        let p = zoneParts(ms, zone);
        let wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
        return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
    }

    /*
     * Uhrzeit in einer Zone (Wanduhr) -> UTC-Zeitpunkt.
     * Ausprobiert werden der Versatz vom Vortag und der vom Folgetag:
     *  - normal: beide gleich
     *  - 25.10., 02:30 gibt es zweimal: beide passen, genommen wird die erste (MESZ)
     *  - 29.03., 02:30 gibt es nicht: keiner passt, Versatz vom Vortag -> 03:30 MESZ (wie Date)
     */
    function wallTimeToUtc(year, month, day, hour, minute, second, zone) {
        const DAY = 86400000;
        let wall = Date.UTC(year, month - 1, day, hour, minute, second || 0);
        let before = wall - zoneOffset(wall - DAY, zone) * 60000;
        let after = wall - zoneOffset(wall + DAY, zone) * 60000;
        let p = zoneParts(after, zone);
        let afterFits = p.day === day && p.hour === hour && p.minute === minute;
        p = zoneParts(before, zone);
        let beforeFits = p.day === day && p.hour === hour && p.minute === minute;
        return beforeFits || !afterFits ? before : after;
    }

    // Zeitstempel ohne Zeitzone, z. B. '2026-07-15T14:00:00', '2026-07-15 14:00:00.123' oder '2026-07-15'
    const NAIVE_TS = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?)?$/;

    /*
     * Zeitstempel -> UTC-Zeitpunkt in Millisekunden (oder null).
     *  - mit Zone ('…Z', '…+02:00'): schon eindeutig, wird nur gelesen (keine doppelte Umrechnung)
     *  - ohne Zone (SmartData-Typ timestamp): Uhrzeit in dataZone; bei HELIOS ist das deutsche
     *    Ortszeit (geprüft über unixtime und den Sonnenstand, siehe README)
     */
    function parseTimestamp(ts, dataZone) {
        if (ts instanceof Date || typeof ts === 'number') {
            let ms = ts instanceof Date ? ts.getTime() : ts;
            return Number.isFinite(ms) ? ms : null;
        }
        if (typeof ts !== 'string' || ts.trim() === '')
            return null;
        let m = ts.trim().match(NAIVE_TS);
        if (m) {
            let zone = dataZone || DEFAULT_ZONE;
            let y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]), h = Number(m[4] || 0);
            let wall = Date.UTC(y, mo - 1, d, h, Number(m[5] || 0), Number(m[6] || 0));
            // Versatz je Stunde merken (schneller; Zeitumstellungen gibt es nur zu vollen Stunden)
            let key = zone + '|' + m[1] + m[2] + m[3] + h;
            let offset = wallOffsetCache.get(key);
            if (offset === undefined) {
                offset = Date.UTC(y, mo - 1, d, h) - wallTimeToUtc(y, mo, d, h, 0, 0, zone);
                if (wallOffsetCache.size > 200000)
                    wallOffsetCache.clear();
                wallOffsetCache.set(key, offset);
            }
            return wall - offset + (m[7] ? Math.round(Number(m[7]) * 1000) : 0);
        }
        let ms = Date.parse(ts);
        return Number.isFinite(ms) ? ms : null;
    }

    /*
     * UTC-Zeitpunkt von 00:00 Uhr eines Kalendertags in der Zone.
     * Beispiel Berlin: '2026-07-16' -> 2026-07-15T22:00:00Z, '2026-01-16' -> 2026-01-15T23:00:00Z
     */
    function dayStartUtc(isoDate, zone) {
        zone = zone || DEFAULT_ZONE;
        let key = zone + '|' + isoDate;
        if (!dayStartCache.has(key)) {
            let p = isoDate.split('-').map(Number);
            dayStartCache.set(key, wallTimeToUtc(p[0], p[1], p[2], 0, 0, 0, zone));
        }
        return dayStartCache.get(key);
    }

    /*
     * Länge eines Kalendertags in Minuten: normal 1440 (24 h),
     * Berlin 29.03.2026: 1380 (23 h), 25.10.2026: 1500 (25 h).
     */
    function dayLengthMinutes(isoDate, zone) {
        return (dayStartUtc(addDays(isoDate, 1), zone) - dayStartUtc(isoDate, zone)) / 60000;
    }

    /*
     * Ordnet einen Zeitstempel dem Kalendertag der Anzeige-Zone zu (Standard Europe/Berlin).
     * minutes = tatsächlich vergangene Minuten seit 00:00 Uhr dieses Tags (aus UTC gerechnet).
     * Dadurch bekommen 02:30 MESZ (150) und 02:30 MEZ (210) am 25.10. verschiedene Positionen,
     * und am 29.03. folgt auf 01:59 direkt 03:00 (ohne Loch).
     *
     * @param ts Zeitstempel (String mit/ohne Zone, Date oder ms)
     * @param zone Anzeige-Zone, dataZone Zone für Zeitstempel ohne Zone (Standard: zone)
     * @returns {{date: string, minutes: number}|null}
     */
    function localDayAndMinutes(ts, zone, dataZone) {
        zone = zone || DEFAULT_ZONE;
        let ms = parseTimestamp(ts, dataZone || zone);
        if (ms === null)
            return null;
        // Kalendertag je Viertelstunde merken (alle Zonen wechseln nur zu vollen Viertelstunden)
        let key = zone + '|' + Math.floor(ms / 900000);
        let date = dayOfCache.get(key);
        if (!date) {
            let p = zoneParts(ms, zone);
            date = p.year + '-' + pad(p.month) + '-' + pad(p.day);
            if (dayOfCache.size > 200000)
                dayOfCache.clear();
            dayOfCache.set(key, date);
        }
        return {date: date, minutes: (ms - dayStartUtc(date, zone)) / 60000};
    }

    /*
     * Uhrzeit 'HH:mm' an Position minutes eines Tags, in der Anzeige-Zone.
     * Beispiel 25.10.2026: 150 -> '02:30' (MESZ), 210 -> '02:30' (MEZ), 240 -> '03:00'.
     */
    function formatTimeOfDay(isoDate, minutes, zone) {
        let p = zoneParts(dayStartUtc(isoDate, zone) + Math.round(minutes * 60) * 1000, zone);
        return pad(p.hour) + ':' + pad(p.minute);
    }

    const zoneNameFormatters = {};

    /*
     * Kurzname der Zeitzone an Position minutes eines Tags: 'MEZ' / 'MESZ' (de), 'CET' / 'CEST' (en).
     */
    function zoneLabel(isoDate, minutes, zone, locale) {
        zone = zone || DEFAULT_ZONE;
        let key = (locale || 'de-DE') + '|' + zone;
        if (!zoneNameFormatters[key])
            zoneNameFormatters[key] = new Intl.DateTimeFormat(locale || 'de-DE', {timeZone: zone, timeZoneName: 'short'});
        let part = zoneNameFormatters[key].formatToParts(new Date(dayStartUtc(isoDate, zone) + minutes * 60000))
                .find(x => x.type === 'timeZoneName');
        return part ? part.value : '';
    }

    /*
     * Zeitgrenze für einen SmartData-Filter: 00:00 Uhr des Tags in der Anzeige-Zone, als Uhrzeit
     * ohne Zone in der Zone der Daten. SmartData liest Filterwerte als LocalDateTime und
     * verwirft ein 'Z' oder '+02:00' (DataConverter.objectToLocalDateTime), daher keine Zone anhängen.
     * Beispiel: '2026-07-16', Daten in Berlin -> '2026-07-16T00:00:00'; Daten in UTC -> '2026-07-15T22:00:00'
     */
    function filterTime(isoDate, zone, dataZone) {
        let p = zoneParts(dayStartUtc(isoDate, zone), dataZone || zone);
        return p.year + '-' + pad(p.month) + '-' + pad(p.day) + 'T' + pad(p.hour) + ':' + pad(p.minute) + ':' + pad(p.second);
    }

    function toNumber(raw) {
        if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean')
            return null;
        let value = Number(raw);
        return Number.isFinite(value) ? value : null;
    }

    /*
     * Teilt Datensätze nach lokalem Tag auf, für mehrere Attribute in einem Durchlauf
     * (der Zeitstempel wird je Datensatz nur einmal ausgewertet).
     * Ungültige Werte (null, leer, NaN) werden je Attribut ignoriert.
     * Kalendertag und minutes in der Anzeige-Zone (siehe localDayAndMinutes).
     *
     * @returns {Object<string, Map<string, {minutes: number, value: number}[]>>} je Attribut
     */
    function splitByDay(records, attrs, timeAttr, zone, dataZone) {
        timeAttr = timeAttr || 'ts';
        let result = {};
        for (let attr of attrs)
            result[attr] = new Map();
        for (let rec of records) {
            let when = localDayAndMinutes(rec[timeAttr], zone, dataZone);
            if (!when)
                continue;
            for (let attr of attrs) {
                let value = toNumber(rec[attr]);
                if (value === null)
                    continue;
                let days = result[attr];
                let points = days.get(when.date);
                if (!points) {
                    points = [];
                    days.set(when.date, points);
                }
                points.push({minutes: when.minutes, value: value});
            }
        }
        for (let attr of attrs) {
            for (let points of result[attr].values())
                points.sort((a, b) => a.minutes - b.minutes);
        }
        return result;
    }

    /*
     * Gruppiert Messwerte eines Attributs nach lokalem Tag.
     * @returns {Map<string, {minutes: number, value: number}[]>}
     */
    function groupByDay(records, attr, timeAttr) {
        return splitByDay(records, [attr], timeAttr)[attr];
    }

    /*
     * Reduziert die Messwerte eines Tages auf einen Mittelwert je Intervall.
     * Jeder Ergebnispunkt liegt in der Mitte seines Intervalls und behält
     * Minimum, Maximum und Anzahl der Rohwerte (für Tooltip und Statistik).
     * Intervalle ohne Messwert entfallen, damit Lücken sichtbar bleiben.
     *
     * @param {{minutes: number, value: number}[]} points sortiert nach Uhrzeit
     * @param {number} intervalMinutes 0 oder kleiner = keine Reduktion
     * @returns {{minutes, value, min, max, count}[]}
     */
    function reduceByInterval(points, intervalMinutes) {
        if (!(intervalMinutes > 0))
            return points.map(p => ({minutes: p.minutes, value: p.value, min: p.value, max: p.value, count: 1}));
        let buckets = new Map();
        for (let p of points) {
            let index = Math.floor(p.minutes / intervalMinutes);
            let b = buckets.get(index);
            if (!b) {
                b = {index: index, sum: 0, min: Infinity, max: -Infinity, count: 0};
                buckets.set(index, b);
            }
            b.sum += p.value;
            b.min = Math.min(b.min, p.value);
            b.max = Math.max(b.max, p.value);
            b.count++;
        }
        return [...buckets.values()]
                .sort((a, b) => a.index - b.index)
                .map(b => ({
                    minutes: (b.index + 0.5) * intervalMinutes,
                    value: b.sum / b.count,
                    min: b.min,
                    max: b.max,
                    count: b.count
                }));
    }

    /*
     * Treppen-Darstellung: Jeder Intervall-Mittelwert (Ergebnis von reduceByInterval,
     * Punkt in der Intervallmitte) wird zu zwei Punkten am Anfang und am Ende seines
     * Intervalls mit gleichem value/min/max. Als gerade Linie gezeichnet entsteht so je
     * Intervall eine waagerechte Stufe; dasselbe gilt für die Min–Max-Fläche.
     * Das letzte Intervall endet spätestens am Tagesende (23 bzw. 25 Stunden).
     * Fehlt zwischen zwei Stufen ein Intervall, steht dort ein Punkt mit value = null:
     * Das Diagramm bleibt im leeren Intervall leer (keine Stufe, keine Verbindung).
     *
     * @param {{minutes, value, min, max, count}[]} points reduzierte Punkte
     * @param {number} intervalMinutes 0 oder kleiner = Originaldaten, Punkte bleiben unverändert
     * @param {number} [dayMinutes] Tageslänge in Minuten (Standard 1440)
     * @returns {{minutes, value, min, max, count}[]} neue Punkte, Eingabe bleibt unverändert
     */
    function toStepPoints(points, intervalMinutes, dayMinutes) {
        if (!(intervalMinutes > 0))
            return points.slice();
        dayMinutes = dayMinutes || 1440;
        let result = [];
        for (let p of points) {
            let start = Math.floor(p.minutes / intervalMinutes) * intervalMinutes;
            let end = Math.min(start + intervalMinutes, dayMinutes);
            let prev = result[result.length - 1];
            if (prev && start > prev.minutes)
                result.push({minutes: prev.minutes, value: null, min: null, max: null, count: 0});
            result.push({minutes: start, value: p.value, min: p.min, max: p.max, count: p.count});
            result.push({minutes: end, value: p.value, min: p.min, max: p.max, count: p.count});
        }
        return result;
    }

    /*
     * Lückengrenze für Treppenpunkte. Zwischen Ende und Anfang zweier Stufen liegt ein
     * Intervall weniger als zwischen ihren Mittelpunkten. Mit maxGap − Intervall wird
     * die Linie deshalb an genau denselben Stellen unterbrochen wie in der Liniendarstellung.
     * Nie kleiner als ein Intervall, damit eine einzelne Stufe nicht zerfällt.
     */
    function stepMaxGap(maxGapMinutes, intervalMinutes) {
        if (!(intervalMinutes > 0))
            return maxGapMinutes;
        return Math.max(intervalMinutes, maxGapMinutes - intervalMinutes);
    }

    /*
     * Reduziert alle Tage aller Attribute (Ergebnis von splitByDay).
     */
    function reduceDayMaps(dayMapsByAttr, intervalMinutes) {
        let result = {};
        for (let attr of Object.keys(dayMapsByAttr)) {
            let reduced = new Map();
            for (let [date, points] of dayMapsByAttr[attr])
                reduced.set(date, reduceByInterval(points, intervalMinutes));
            result[attr] = reduced;
        }
        return result;
    }

    /*
     * Kennzahlen eines Tages. Bei reduzierten Punkten zählen die Rohwerte:
     * Min/Max aus den Intervallen, Mittelwert gewichtet mit der Anzahl.
     *   Mittelwert = Summe aller Rohwerte / Anzahl Rohwerte
     *   (Intervallmittel × Anzahl im Intervall = Summe des Intervalls)
     * Ohne Messwerte: null (keine erfundenen 0-Werte, kein Infinity/NaN).
     */
    function summarize(points) {
        let min = Infinity, max = -Infinity, sum = 0, count = 0;
        for (let p of points) {
            let n = typeof p.count === 'number' ? p.count : 1;
            min = Math.min(min, typeof p.min === 'number' ? p.min : p.value);
            max = Math.max(max, typeof p.max === 'number' ? p.max : p.value);
            sum += p.value * n;
            count += n;
        }
        if (count === 0)
            return null;
        return {min: min, max: max, mean: sum / count, count: count};
    }

    /*
     * Kennzahlen eines ganzen Zeitraums (Monat oder Woche) für EIN Attribut
     * aus den Tageskennzahlen (Map Datum -> Ergebnis von summarize).
     *   Minimum = kleinstes Tagesminimum, Maximum = größtes Tagesmaximum (mit Datum)
     *   Mittelwert = Summe(Tagesmittel × Tagesanzahl) / Summe(Tagesanzahl)
     * Tage mit vielen Messwerten zählen also stärker als Tage mit wenigen.
     * @returns {{min: {value, date}, max: {value, date}, mean: number, count: number}|null}
     */
    function summarizePeriod(statsByDay) {
        let min = null, max = null, sum = 0, count = 0;
        for (let [date, s] of statsByDay) {
            if (!s)
                continue;
            if (!min || s.min < min.value)
                min = {value: s.min, date: date};
            if (!max || s.max > max.value)
                max = {value: s.max, date: date};
            sum += s.mean * s.count;
            count += s.count;
        }
        if (count === 0)
            return null;
        return {min: min, max: max, mean: sum / count, count: count};
    }

    /*
     * Punkt, der einer Uhrzeit am nächsten liegt (für den Tooltip), höchstens maxDistance entfernt.
     */
    function nearestPoint(points, minutes, maxDistance) {
        let best = null, bestDistance = Infinity;
        for (let p of points) {
            let distance = Math.abs(p.minutes - minutes);
            if (distance < bestDistance) {
                best = p;
                bestDistance = distance;
            }
        }
        return best && bestDistance <= maxDistance ? best : null;
    }

    /*
     * Punkte für ein Chart.js-Liniendiagramm ({x: Minuten, y: Wert}). Bei Lücken
     * größer maxGapMinutes wird ein Punkt mit y = null eingefügt, damit die Linie
     * dort unterbrochen wird. key wählt den Wert ('value', 'min' oder 'max').
     */
    function toChartPoints(points, maxGapMinutes, key) {
        key = key || 'value';
        let result = [];
        let prev = null;
        for (let p of points) {
            // value null (leeres Intervall aus toStepPoints) unterbricht schon selbst
            if (prev && prev.value !== null && p.value !== null && p.minutes - prev.minutes > maxGapMinutes)
                result.push({x: (prev.minutes + p.minutes) / 2, y: null});
            result.push({x: p.minutes, y: p[key]});
            prev = p;
        }
        return result;
    }

    /*
     * Üblicher Abstand zwischen zwei Messwerten in Minuten (Median der Abstände).
     * Wird für die Originaldaten gebraucht: Dort gibt es kein festes Intervall, also
     * richtet sich die Lückenerkennung nach dem tatsächlichen Messtakt des Geräts
     * (z. B. 1 min beim Pi-Sensor, 15 min beim Suntracker).
     *
     * @returns {number|null} null bei weniger als zwei Messwerten
     */
    function typicalSpacing(points) {
        let gaps = [];
        for (let i = 1; i < points.length; i++)
            gaps.push(points[i].minutes - points[i - 1].minutes);
        if (gaps.length === 0)
            return null;
        gaps.sort((a, b) => a - b);
        return gaps[Math.floor(gaps.length / 2)];
    }

    function formatTime(minutes) {
        let m = Math.floor(minutes);
        return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
    }

    /*
     * Gemeinsame y-Skala für alle Tage eines Monats und alle Attribute einer
     * Einheit, damit die kleinen Diagramme untereinander vergleichbar sind.
     * Feste Grenzen aus den Attributbeschreibungen (z. B. min 0 für Einstrahlung)
     * gelten nur, wenn alle beteiligten Attribute sie festlegen.
     *
     * @param {Map[]} dayMaps je Attribut das Ergebnis von groupByDay()
     * @param {Object[]} metas zugehörige Attributbeschreibungen
     * @returns {{min: number, max: number}|null} null, wenn keine Daten vorhanden sind
     */
    function computeScale(dayMaps, metas) {
        let min = Infinity, max = -Infinity;
        for (let dayMap of dayMaps) {
            for (let points of dayMap.values()) {
                for (let p of points) {
                    // Reduzierte Punkte: Spannweite min/max einbeziehen, damit das Band passt
                    min = Math.min(min, typeof p.min === 'number' ? p.min : p.value);
                    max = Math.max(max, typeof p.max === 'number' ? p.max : p.value);
                }
            }
        }
        if (min === Infinity)
            return null;
        if (metas.length > 0 && metas.every(m => typeof m.min === 'number'))
            min = Math.min(...metas.map(m => m.min));
        if (metas.length > 0 && metas.every(m => typeof m.max === 'number'))
            max = Math.max(...metas.map(m => m.max));
        if (max === min) {
            max += 1;
            min -= 1;
        }
        return {min: min, max: max};
    }

    /*
     * Fasst Attribute nach Einheit zusammen. Reihenfolge der Gruppen und der
     * Attribute folgt der Reihenfolge in attrs.
     *
     * @returns {{unit: string, attrs: string[]}[]}
     */
    function groupAttributesByUnit(attrs, attributeMetas) {
        let groups = [];
        let keys = [];
        for (let attr of attrs) {
            let meta = attributeMetas[attr];
            // axis trennt Attribute ohne bekannte Einheit, damit sie keine Achse teilen
            let key = meta.axis || meta.unit;
            let index = keys.indexOf(key);
            if (index === -1) {
                keys.push(key);
                groups.push({unit: meta.unit, attrs: []});
                index = groups.length - 1;
            }
            groups[index].attrs.push(attr);
        }
        return groups;
    }

    /*
     * Übernimmt von der bisherigen Auswahl alle Attribute, die das neue Gerät
     * misst (in der Reihenfolge des Geräts). Bleibt nichts übrig, wird das erste
     * verfügbare Attribut gewählt, damit immer mindestens eines aktiv ist.
     */
    function reconcileSelection(previous, available) {
        let kept = available.filter(a => previous.includes(a));
        if (kept.length === 0 && available.length > 0)
            kept = [available[0]];
        return kept;
    }

    /*
     * @param {string} [locale] Zahlenformat (Standard 'de-DE')
     */
    function formatValue(value, unit, locale) {
        let digits = Number.isInteger(value) || Math.abs(value) >= 100 ? 0 : 1;
        let text = value.toLocaleString(locale || 'de-DE', {minimumFractionDigits: digits, maximumFractionDigits: digits});
        return unit ? text + ' ' + unit : text;
    }

    let api = {
        toIsoDate: toIsoDate,
        formatGermanDate: formatGermanDate,
        formatMonthLabel: formatMonthLabel,
        shiftMonth: shiftMonth,
        buildMonthGrid: buildMonthGrid,
        addDays: addDays,
        weekStartOf: weekStartOf,
        buildWeekGrid: buildWeekGrid,
        isoWeek: isoWeek,
        formatWeekLabel: formatWeekLabel,
        localDayAndMinutes: localDayAndMinutes,
        DEFAULT_ZONE: DEFAULT_ZONE,
        zoneParts: zoneParts,
        parseTimestamp: parseTimestamp,
        dayStartUtc: dayStartUtc,
        dayLengthMinutes: dayLengthMinutes,
        formatTimeOfDay: formatTimeOfDay,
        zoneLabel: zoneLabel,
        filterTime: filterTime,
        splitByDay: splitByDay,
        groupByDay: groupByDay,
        reduceByInterval: reduceByInterval,
        reduceDayMaps: reduceDayMaps,
        toStepPoints: toStepPoints,
        stepMaxGap: stepMaxGap,
        summarize: summarize,
        summarizePeriod: summarizePeriod,
        nearestPoint: nearestPoint,
        toChartPoints: toChartPoints,
        typicalSpacing: typicalSpacing,
        formatTime: formatTime,
        computeScale: computeScale,
        groupAttributesByUnit: groupAttributesByUnit,
        reconcileSelection: reconcileSelection,
        formatValue: formatValue
    };

    root.HeliosCalendarLogic = api;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
