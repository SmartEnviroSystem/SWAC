import SWAC from '../../../../swac.js';
import Msg from '../../../../Msg.js';
import Plugin from '../../../../Plugin.js'

export default class LinechartSPL extends Plugin {

    constructor(opts = {}) {
        super(opts);
        this.selectedTimepoint = null;
        this.timepointMarkerPlugin = {
            id: 'swacTimepointMarker',
            afterUpdate: (chart) => this.updateTimeline(chart),
            afterDestroy: () => {
                if (this.timeline)
                    this.timeline.hidden = true;
            },
            afterDatasetsDraw: (chart) => {
                const timestamp = this.selectedTimepoint;
                const xScale = chart.scales.x;
                const area = chart.chartArea;
                if (!Number.isFinite(timestamp) || !xScale || !area)
                    return;
                if (xScale.type !== 'time') {
                    const ctx = chart.ctx;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
                    ctx.clip();
                    ctx.strokeStyle = '#d32f2f';
                    ctx.lineWidth = 2;
                    for (const {timestamp: pointTime, point} of this.getTimelinePoints(chart)) {
                        if (pointTime !== timestamp || point.skip || point.hidden
                                || !Number.isFinite(point.x) || !Number.isFinite(point.y)
                                || point.x < area.left || point.x > area.right
                                || point.y < area.top || point.y > area.bottom)
                            continue;
                        ctx.beginPath();
                        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                    ctx.restore();
                    return;
                }
                if (timestamp < xScale.min || timestamp > xScale.max)
                    return;
                const x = xScale.getPixelForValue(timestamp);
                if (!Number.isFinite(x) || x < area.left || x > area.right)
                    return;

                const ctx = chart.ctx;
                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = '#d32f2f';
                ctx.lineWidth = 1;
                ctx.moveTo(x, area.top);
                ctx.lineTo(x, area.bottom);
                ctx.stroke();
                ctx.restore();
            }
        };
        this.name = 'Charts/plugins/Linechart';
        this.desc.templates[0] = {
            name: 'linechart',
            style: false,
            desc: 'Default template createing a chartjs instance for linechart'
        };
        // Set default options
        this.desc.opts[0] = {
            name: 'showdatalabels',
            desc: 'If true the values of the data points are shown in the diagram'
        };
        this.options.showdatalabels = false;
        this.desc.opts[1] = {
            name: 'scales',
            desc: 'Scales to show at the diagram. Can be configured like documented at chart.js documentation.'
        };
        if (!opts.scales)
            this.options.scales = {};
        this.desc.opts[2] = {
            name: 'legend',
            desc: 'Legend configuration as specified in chart.js documentation (https://www.chartjs.org/docs/latest/configuration/legend.html)'
        };
        if (!opts.legend)
            this.options.legend = {
                display: true,
                labels: {
                    color: 'rgb(0, 0, 0)'
                }
            };
        this.desc.opts[3] = {
            name: 'timeAttr',
            desc: 'Separate time attribute for discrete timeline selection on a non-time x axis.',
            example: 'ts'
        };
        this.options.timeAttr = opts.timeAttr || null;
    }

    /** Returns valid measurement times and their rendered points in visible series. */
    getTimelinePoints(chart) {
        const points = [];
        if (!this.options.timeAttr)
            return points;
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            if (!chart.isDatasetVisible(datasetIndex))
                return;
            const elements = chart.getDatasetMeta(datasetIndex).data;
            dataset.data.forEach((set, index) => {
                const raw = set && set[this.options.timeAttr];
                if (!(raw instanceof Date) && typeof raw !== 'number' && typeof raw !== 'string')
                    return;
                if (typeof raw === 'string' && !raw.trim())
                    return;
                const timestamp = new Date(raw).getTime();
                const point = elements[index];
                if (Number.isFinite(timestamp) && point && !point.skip && !point.hidden)
                    points.push({timestamp, point});
            });
        });
        return points;
    }

    /**
     * Sets the marker in epoch milliseconds, or clears it with null/invalid input.
     * Stored independently of the chart so DataManager rebuilds retain it.
     *
     * @param {number|null} timestampMsOrNull Selected timestamp or null
     */
    setTimepointMarker(timestampMsOrNull) {
        this.selectedTimepoint = Number.isFinite(timestampMsOrNull) ? timestampMsOrNull : null;
        if (this.chart) {
            this.updateTimeline(this.chart);
            this.chart.draw();
        }
    }

    /** Creates the timeline once, outside the canvas replaced by DataManager. */
    createTimeline(canvas) {
        if (!this.timeline) {
            this.timeline = document.createElement('div');
            this.timeline.className = 'swac_linechart_timeline uk-margin-small-top';
            this.timeline.hidden = true;
            const label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap';
            this.timelineSlider = document.createElement('input');
            this.timelineSlider.type = 'range';
            this.timelineSlider.step = 'any';
            this.timelineSlider.setAttribute('aria-label', 'Timeline');
            this.timelineSlider.style.cssText = 'flex:1;min-width:10rem';
            this.timelineValue = document.createElement('span');
            this.timelineSlider.addEventListener('input', () => {
                const value = Number(this.timelineSlider.value);
                this.setTimepointMarker(this.timelineTimes
                        ? (value === -1 ? null : this.timelineTimes[value]) : value);
            });
            label.append(this.timelineSlider, this.timelineValue);
            this.timeline.appendChild(label);
        }
        const canvasElement = canvas.canvas ?? canvas;
        canvasElement.after(this.timeline);
    }

    /** Synchronizes the controls with the current visible time scale. */
    updateTimeline(chart) {
        if (!this.timeline)
            return;
        const scale = chart.scales.x;
        const timeAxis = scale && scale.type === 'time';
        this.timelineTimes = timeAxis ? null : [...new Set(
            this.getTimelinePoints(chart).map(entry => entry.timestamp)
        )].sort((a, b) => a - b);
        const available = timeAxis
                && Number.isFinite(scale.min) && Number.isFinite(scale.max)
                && scale.min <= scale.max || (!timeAxis && this.timelineTimes.length > 0);
        this.timeline.hidden = !available;
        if (timeAxis && !available)
            return;
        const min = timeAxis ? scale.min : -1;
        const max = timeAxis ? scale.max : this.timelineTimes.length - 1;
        this.timelineSlider.step = timeAxis ? 'any' : '1';
        this.timelineSlider.min = min;
        this.timelineSlider.max = max;
        this.timelineSlider.disabled = min === max;
        // Keep the selected timestamp even if zoom/filtering moves it off screen.
        const selected = this.selectedTimepoint;
        this.timelineSlider.value = timeAxis
                ? (Number.isFinite(selected) ? Math.max(min, Math.min(max, selected)) : min)
                : this.timelineTimes.indexOf(selected);
        const date = new Date(selected);
        this.timelineValue.textContent = Number.isFinite(selected) && Number.isFinite(date.getTime())
                ? date.toLocaleString() : '';
        if (!timeAxis && this.timelineTimes.indexOf(selected) === -1) {
            this.timelineValue.textContent = Number.isFinite(selected)
                    ? this.timelineValue.textContent + ' — Gespeicherter Zeitpunkt derzeit nicht in den angezeigten Daten enthalten.'
                    : 'Keine verfügbare Auswahl';
        }
    }

    init() {
        let thisRef = this;
        return new Promise((resolve, reject) => {
            // Read optional chart settings from the host plugin configuration.
            let pluginConfig = thisRef.requestor.parent.swac_comp.options.plugins
                    .get(thisRef.requestor.pluginname)
                    || thisRef.requestor.parent.swac_comp.options.plugins.get('Linechart');
            if (pluginConfig && pluginConfig.legend)
                thisRef.options.legend = pluginConfig.legend;
            if (pluginConfig && typeof pluginConfig.timeAttr !== 'undefined')
                thisRef.options.timeAttr = pluginConfig.timeAttr;

            // Check if content area is available
            if (!thisRef.contElements || thisRef.contElements.length === 0) {
                Msg.error('LinechartSPL', 'This plugin needs a contElement to insert the chart.', this.requestor);
            }
            resolve();
        });
    }

    afterAddSet(set, repeateds) {
        if (!this.chart) {
            this.initChart(set);
            return;
        }

        // Get component where this plugin instance belongs to
        let comp = this.requestor.parent.swac_comp;

        // Check if xAxis attr exists
        if (!set[comp.options.xAxisAttrName]) {
            Msg.error('LinechartSPL', 'The attribute >' + comp.options.xAxisAttrName + '< does not exists in dataset >' + set.swac_fromName + '[' + set.id + ']<. Cannot add set to chart.', comp.requestor);
            return;
        }

        // Add x value
        if (!this.chart.config._config.data.labels.includes(set[comp.options.xAxisAttrName]))
            this.chart.config._config.data.labels.push(set[comp.options.xAxisAttrName]);

        // Calculate color for dataset useing datadescription component
        let col = 'gray';
        if (comp.datadescription)
            col = comp.datadescription.getValueColor(set);

        let rsName = comp.getReadableSourceName(set.swac_fromName);

        // Add y values to the datasets
        for (let curYAttr of comp.options.yAxisAttrNames) {
            // Check if yattr is available in dataset
            if (typeof set[curYAttr] === 'undefined') {
                Msg.warn('LinechartSPL', 'Dataset >' + set.swac_fromName + '[' + set.id + ']< does not contain the y attribute >' + curYAttr + '<. This will be missing at x >' + set[comp.options.xAxisAttrName] + '<', comp.requestor);
                continue;
            }

            let sourceFound = false;
            for (let curSets of this.chart.data.datasets) {
                // Add new dataset to the correct chart datasets
                if (rsName + '_' + curYAttr === curSets.label) {
                    curSets.data.push(set);
                    if (comp.datadescription)
                        curSets.backgroundColor.push(col);
                    sourceFound = true;
                    break;
                }
            }

            // Create new datasource in chart for data from new source
            if (!sourceFound) {
                let odesc = {
                    label: rsName + '_' + curYAttr,
                    data: [set],
                    parsing: {
                        xAxisKey: comp.options.xAxisAttrName,
                        yAxisKey: curYAttr
                    },
                    yAxisID: 'y_' + curYAttr
                };

                // Calculate color for dataset (dot) useing datadescription component
                if (comp.datadescription) {
                    odesc.backgroundColor = [comp.datadescription.getValueColor(set)];
                    odesc.borderColor = comp.datadescription.getAttributeColor(curYAttr);
                } else if (comp.options.sourceColors && comp.options.sourceColors[set.swac_fromName + '_' + curYAttr]) {
                    odesc.backgroundColor = comp.options.sourceColors[set.swac_fromName + '_' + curYAttr];
                    odesc.borderColor = comp.options.sourceColors[set.swac_fromName + '_' + curYAttr];
                } else {
                    Msg.warn('LinechartSPL', 'There is no color defined for >' + set.swac_fromName + '_' + curYAttr + '< dots will be default colored', comp.requestor);
                    odesc.backgroundColor = set.swac_fromName + '_' + curYAttr;
                    odesc.borderColor = set.swac_fromName + '_' + curYAttr;
                }
                this.chart.data.datasets.push(odesc);
            }
        }
        this.chart.update();
    }

    /**
     * Initilises the charttype based on the given set
     * 
     * @param {WatchableSet} set Representative dataset for chart data
     */
    initChart(set) {
        // Get component where this plugin instance belongs to
        let comp = this.requestor.parent.swac_comp;
        // Get draw area (only one contElement supported)
        var ctx = this.contElements[0].querySelector('canvas');

        // Auto configure xAxis
        if (!this.options.scales.x) {
            this.options.scales.x = {};
        }
        // Add title for xAxis if not configured
        if (!this.options.scales.x.title) {
            this.options.scales.x.title = {
                display: true,
                align: 'center',
                text: comp.options.xAxisAttrName
            };
        }

        // Check if xAxis attr exists
        if (!set[comp.options.xAxisAttrName]) {
            Msg.error('LinechartSPL', 'The attribute >' + comp.options.xAxisAttrName + '< does not exists in dataset >' + set.swac_fromName + '[' + set.id + ']<. Cannot add set to chart.', comp.requestor);
            return;
        }

        // Set type of xAxis
        if (!this.options.scales.x.type) {
            this.options.scales.x.type = comp.getScaleTypeForAttr(comp.options.xAxisAttrName);
        }

        // Add x value to list of labels
        let label_inst = [set[comp.options.xAxisAttrName]];

        let rsName = comp.getReadableSourceName(set.swac_fromName);

        // Create datasets array
        let datasets_inst = [];

        // Create parsing instruction (e.g. which attr should be shown on which axis?)
        let parsing_inst = {
            xAxisKey: comp.options.xAxisAttrName,
        };

        // Create scales for y axis
        for (let curYAttr of comp.options.yAxisAttrNames) {
            // Auto confgure yAxis1
            if (!this.options.scales['y_' + curYAttr]) {
                this.options.scales['y_' + curYAttr] = {};
            }
            // Add title for yAxis if not configured
            if (!this.options.scales['y_' + curYAttr].title) {
                this.options.scales['y_' + curYAttr].title = {
                    display: 'true',
                    align: 'center',
                    text: curYAttr
                }
            }
            // Set type of yAxis
            if (!this.options.scales['y_' + curYAttr].type) {
                let stype = comp.getScaleTypeForAttr(curYAttr);
                // Category type is only for x axis
                if (stype !== 'category')
                    this.options.scales['y_' + curYAttr].type = stype;
            }
            // Set assignmet of variable to axis
            parsing_inst['y_' + curYAttr] = curYAttr;

            // Create datasets description
            let ddesc = {
                label: rsName + '_' + curYAttr,
                data: [set],
                borderWidth: 1,
                yAxisID: 'y_' + curYAttr,
                parsing: {
                    xAxisKey: comp.options.xAxisAttrName,
                    yAxisKey: curYAttr
                }
            };
            // Calculate color for dataset useing datadescription component
            if (comp.datadescription) {
                ddesc.backgroundColor = [comp.datadescription.getValueColor(set)];
                ddesc.borderColor = comp.datadescription.getAttributeColor(curYAttr);
            } else if (comp.options.sourceColors && comp.options.sourceColors[set.swac_fromName + '_' + curYAttr]) {
                ddesc.backgroundColor = comp.options.sourceColors[set.swac_fromName + '_' + curYAttr];
                ddesc.borderColor = comp.options.sourceColors[set.swac_fromName + '_' + curYAttr];
            } else {
                Msg.warn('LinechartSPL', 'There is no color defined for >' + set.swac_fromName + '_' + curYAttr + '< dots will be default colored', comp.requestor);
                ddesc.backgroundColor = set.swac_fromName + '_' + curYAttr;
                ddesc.borderColor = set.swac_fromName + '_' + curYAttr;
            }
            datasets_inst.push(ddesc);
        }

        this.createTimeline(ctx);
        this.chart = new Chart(ctx, {
            type: 'line',
            plugins: [this.timepointMarkerPlugin],
            data: {
                labels: label_inst,
                datasets: datasets_inst
            },
            options: {
                parsing: parsing_inst,
                scales: this.options.scales,
                plugins: {
                    legend: this.options.legend,
                    zoom: {
                        zoom: {
                            wheel: {
                                enabled: true,
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: 'xy',
                        },
                        pan: {
                            enabled: true
                        }
                    }
                }
            }
        });

        // Add zoom plugin
        var js = document.createElement("script");
        js.type = "text/javascript";
        js.src = '/SWAC/swac/components/Charts/libs/chartjs/chartjs-plugin-zoom.min.js';
        document.body.appendChild(js);
    }

    afterRemoveSet(set) {
        // Get component where this plugin instance belongs to
        let comp = this.requestor.parent.swac_comp;
        let rsName = comp.getReadableSourceName(set.swac_fromName);
        // Look at each source (datasets array entry in chart.js)
        for (let curSets of this.chart.data.datasets) {
            for (let curYAttr of comp.options.yAxisAttrNames) {
                if (rsName + '_' + curYAttr === curSets.label) {
                    // Look at each set
                    for (let i in curSets.data) {
                        if (curSets.data[i].id === set.id) {
                            curSets.data.splice(i, 1);
                            break;
                        }
                    }
                }
            }
        }

        // Remove labels from x axis
        for (let i in  this.chart.data.labels) {
            if (this.chart.data.labels[i] === set[comp.options.xAxisAttrName]) {
                this.chart.data.labels.splice(i, 1);
            }
        }

        this.chart.update();
    }
}
