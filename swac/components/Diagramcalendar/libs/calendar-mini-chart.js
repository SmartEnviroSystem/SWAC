/*
 * Minimales Liniendiagramm als SVG für eine Kalenderzelle.
 * x-Achse: der ganze Tag (00:00–24:00; am Tag der Zeitumstellung 23 bzw. 25 Stunden),
 * y-Achse: gemeinsame Monatsskala.
 * Messlücken (größer als maxGapMinutes) unterbrechen die Linie.
 */
(function (root) {
    'use strict';

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const WIDTH = 100;
    const HEIGHT = 40;

    /*
     * Berechnet die Liniensegmente in SVG-Koordinaten.
     * @returns {string[]} Je Segment ein points-String für <polyline>
     */
    function buildSegments(points, scale, maxGapMinutes, dayMinutes) {
        dayMinutes = dayMinutes || 1440; // Tageslänge in Minuten (1380 / 1440 / 1500)
        let segments = [];
        let current = [];
        let range = scale.max - scale.min;
        let prev = null;
        for (let p of points) {
            if (prev && (p.value === null || p.minutes - prev.minutes > maxGapMinutes)) {
                segments.push(current);
                current = [];
            }
            prev = p.value === null ? null : p;   // value null = leeres Intervall (toStepPoints)
            if (!prev)
                continue;
            let x = p.minutes / dayMinutes * WIDTH;
            let clamped = Math.min(scale.max, Math.max(scale.min, p.value));
            let y = HEIGHT - (clamped - scale.min) / range * HEIGHT;
            current.push(x.toFixed(2) + ',' + y.toFixed(2));
        }
        if (current.length > 0)
            segments.push(current);
        return segments.map(s => s.join(' '));
    }

    function toY(value, scale) {
        let clamped = Math.min(scale.max, Math.max(scale.min, value));
        return HEIGHT - (clamped - scale.min) / (scale.max - scale.min) * HEIGHT;
    }

    /*
     * Spannweite (Min bis Max je Intervall) als Fläche, unterbrochen bei Messlücken.
     * Erwartet reduzierte Punkte mit min/max (siehe reduceByInterval).
     * @returns {string[]} Je Segment ein points-String für <polygon>
     */
    function buildBand(points, scale, maxGapMinutes, dayMinutes) {
        dayMinutes = dayMinutes || 1440;
        let segments = [];
        let current = [];
        let prev = null;
        for (let p of points) {
            if (prev && (p.value === null || p.minutes - prev.minutes > maxGapMinutes)) {
                segments.push(current);
                current = [];
            }
            prev = p.value === null ? null : p;
            if (prev)
                current.push(p);
        }
        if (current.length > 0)
            segments.push(current);
        return segments.filter(s => s.length > 1).map(function (s) {
            let upper = s.map(p => (p.minutes / dayMinutes * WIDTH).toFixed(2) + ',' + toY(p.max, scale).toFixed(2));
            let lower = s.slice().reverse().map(p => (p.minutes / dayMinutes * WIDTH).toFixed(2) + ',' + toY(p.min, scale).toFixed(2));
            return upper.concat(lower).join(' ');
        });
    }

    function createSvgElement(name, attrs) {
        let elem = document.createElementNS(SVG_NS, name);
        for (let key of Object.keys(attrs))
            elem.setAttribute(key, attrs[key]);
        return elem;
    }

    /*
     * Zeichnet eine oder mehrere Linien mit gemeinsamer y-Skala (gleiche Einheit).
     *
     * @param {Object[]} series [{ points, color, dash }] je Attribut; points sortiert nach Uhrzeit
     * @param {{min: number, max: number}} scale gemeinsame y-Skala
     * @param {Object} opts { maxGapMinutes, label, dayMinutes (Tageslänge, Standard 1440) }
     * @returns {SVGElement}
     */
    function renderMiniChart(series, scale, opts) {
        let svg = createSvgElement('svg', {
            viewBox: '0 0 ' + WIDTH + ' ' + HEIGHT,
            preserveAspectRatio: 'none',
            class: 'mini-chart',
            role: 'img',
            'aria-label': opts.label || ''
        });
        // Hilfslinie zur Tagesmitte (12:00)
        svg.appendChild(createSvgElement('line', {
            x1: WIDTH / 2, y1: 0, x2: WIDTH / 2, y2: HEIGHT, class: 'mini-chart-grid'
        }));
        // Bänder zuerst, damit sie hinter den Linien liegen
        for (let line of series) {
            if (!line.band)
                continue;
            for (let polygon of buildBand(line.points, scale, opts.maxGapMinutes || 60, opts.dayMinutes)) {
                svg.appendChild(createSvgElement('polygon', {
                    points: polygon, fill: line.color, 'fill-opacity': 0.16, stroke: 'none', class: 'mini-chart-band'
                }));
            }
        }
        for (let line of series) {
            for (let segment of buildSegments(line.points, scale, opts.maxGapMinutes || 60, opts.dayMinutes)) {
                // Einzelne Punkte wären als Linie unsichtbar und werden als Kreis gezeichnet
                if (!segment.includes(' ')) {
                    let xy = segment.split(',');
                    svg.appendChild(createSvgElement('circle', {cx: xy[0], cy: xy[1], r: 1.2, fill: line.color}));
                    continue;
                }
                let attrs = {
                    points: segment,
                    fill: 'none',
                    stroke: line.color,
                    'stroke-width': 1.5,
                    'stroke-linejoin': 'round',
                    'vector-effect': 'non-scaling-stroke'
                };
                if (line.dash)
                    attrs['stroke-dasharray'] = line.dash;
                svg.appendChild(createSvgElement('polyline', attrs));
            }
        }
        return svg;
    }

    let api = {buildSegments: buildSegments, buildBand: buildBand, renderMiniChart: renderMiniChart, WIDTH: WIDTH, HEIGHT: HEIGHT};

    root.HeliosMiniChart = api;
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
