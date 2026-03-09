import View from '../../View.js';
import Msg from '../../Msg.js';

export default class CommandRouter extends View {

    /**
     * Registers all SWAC component metadata and sets default option values.
     * Initialises internal state for component tracking and timer management.
     */
    constructor(options = {}) {
        super(options);
        this.name = 'CommandRouter';
        this.desc.text = 'Routes commands depending on availability of other components.';
        this.desc.developers = 'Florian Fehring (HSBI)';
        this.desc.license = 'GNU Lesser General Public License';

        this.desc.templates[0] = {
            name: 'default',
            desc: 'Default template.'
        };

        this.desc.optPerPage[0] = {
            selc: '.commandrouter_countdown_cur',
            desc: 'Element where to show current left time until next command exec.'
        };
        this.desc.optPerPage[1] = {
            selc: '.commandrouter_countdown_max',
            desc: 'Element where to show maximum time until next command execution.'
        };

        this.desc.reqPerSet[0] = {
            name: 'id',
            desc: 'The attribute id is required for the component to work properly.'
        };
        this.desc.optPerSet[0] = {
            name: 'nameOfTheAttributeOptionalInEachSet',
            desc: 'Description what is the expected effect, when this attribute is in the set.'
        };

        this.desc.opts[0] = {
            name: "components",
            desc: "List of component ids that should be reachable by the CommandRouter. If no one given, all components on pages are used.",
            example: ['component1', 'component2']
        };
        if (!options.components)
            this.options.components = null;

        this.desc.opts[1] = {
            name: "targetDatacapsule",
            desc: "",
            example: {
                fromName: 'mytablename',
                fromWheres: {
                    filter: 'id,lt,10',
                    other: 'This is another attribute to send with request'
                },
                fromHeaders: {
                    "X-Requested-By": "SWAC"
                }
            }
        };
        if (!options.targetDatacapsule)
            this.options.targetDatacapsule = {
                fromName: '/SmartWebSocket/smartwebsocket/socket/{name}'
            };

        this.desc.opts[2] = {
            name: "deviceNameSource",
            desc: "CSS Selector for an element containing the device name",
            example: '.nameelement'
        };
        if (!options.deviceNameSource)
            this.options.deviceNameSource = null;

        this.desc.opts[3] = {
            name: "commandTimer",
            desc: "defines timer command execution",
            example: [{cmd: "shutdown", interval: "30000", param: "text"}]
        };
        if (!options.commandTimer)
            this.options.commandTimer = [];

        if (!options.showWhenNoData)
            this.options.showWhenNoData = true;

        this.desc.events[0] = {
            name: 'swac_REQUESTOR_ID_commandrouter_executed',
            desc: 'Fired when a command was successfully executed.',
            data: 'Fields >comp< with component and >result< with returned result.'
        };

        this.comps = [];
        this.cmdIntervals = [];
        this.countdownInterval = null;
    }

    /**
     * Waits for all SWAC components to finish loading, then binds commands
     * and starts the configured timed command intervals.
     */
    async init() {
        document.addEventListener('swac_components_complete', this.bindCommands.bind(this));
        this.startTimedCommands();
    }

    /**
     * Attaches click handlers to all elements with a [cmd] attribute.
     * Collects all commandable SWAC components on the page for later use.
     */
    bindCommands(evt) {
        Msg.flow('CommandRouter', 'bindCommands()', this.requestor);

        let cmdElems = document.querySelectorAll('[cmd]');
        for (let curCmdElem of cmdElems) {
            curCmdElem.addEventListener('click', this.executeCommandFromEvent.bind(this));
        }

        if (this.options.components && this.options.components.length > 0) {
            for (let curCompId of this.options.components) {
                let curComp = document.querySelector('.' + curCompId);
                if (!curComp) {
                    Msg.error('CommandRouter', 'Component with id >' + curCompId + '< not found.');
                } else {
                    this.comps.push(curComp);
                }
            }
        } else {
            // Fall back to all SWAC elements on the page
            this.comps = document.querySelectorAll('[swa]');
        }
    }

    /**
     * Extracts the command name and optional parameter from a click event
     * and delegates to executeCommand().
     */
    executeCommandFromEvent(evt) {
        let cmdElem = evt.target.closest('[cmd]');
        if (!cmdElem)
            return;
        let cmd = cmdElem.getAttribute('cmd');
        let param = cmdElem.getAttribute('param');
        this.executeCommand(cmd, param);
    }

    /**
     * Sends a command to all commandable components on the page.
     * Falls back to the targetDatacapsule (WebSocket / REST) if no component handles it.
     *
     * @param {string}      cmd   - Command name (e.g. 'last_measuring', 'shutdown')
     * @param {string|null} params - Optional parameter forwarded with the command, typically an object
     */
    async executeCommand(cmd, params) {
        Msg.flow('CommandRouter', 'executeCommand()', this.requestor);
        let thisRef = this;
        let executed = false;

        for (let curComp of this.comps) {
            if (typeof curComp.swac_comp?.isCommandable !== 'function') {
                Msg.warn('CommandRouter', 'Component ' + curComp.id + ' does not support commandable.', this.requestor);
                continue;
            }
            if (!curComp.swac_comp.isCommandable()) {
                Msg.warn('CommandRouter', 'Component ' + curComp.id + ' currently does not accept commands.', this.requestor);
                continue;
            }

            try {
                let res = curComp.swac_comp.doCommand(cmd, params);
                executed = true;

                if (typeof res?.then === 'function') {
                    res.then(function (response) {
                        Msg.info('CommandRouter', 'Command >' + cmd + '< on component >' + curComp.id + '< executed.');
                        thisRef.processResult(thisRef._unwrapBLE(response), curComp);
                    }).catch(function (err) {
                        Msg.error('CommandRouter', 'Command >' + cmd + '< rejected: ' + err, thisRef.requestor);
                    });
                } else {
                    Msg.info('CommandRouter', 'Command >' + cmd + '< on component >' + curComp.id + '< executed.');
                    thisRef.processResult(thisRef._unwrapBLE(res), curComp);
                }
            } catch (e) {
                Msg.error('CommandRouter', 'Command >' + cmd + '< threw error: ' + e, this.requestor);
            }
        }

        // No component handled the command – send it via WebSocket / REST
        if (!executed && this.options.targetDatacapsule) {
            const curCapsule = Object.assign({}, this.options.targetDatacapsule);

            let name = '';
            let nameElem = document.querySelector(this.options.deviceNameSource);
            if (nameElem) {
                name = nameElem.children[0]?.innerHTML ?? nameElem.textContent.trim();
            } else {
                Msg.info('CommandRouter', 'Device name element not found.', this.requestor);
            }
            curCapsule.fromName = curCapsule.fromName.replace('{name}', name);
            curCapsule.data = [{action: cmd, params: params}];
            let Model = window.swac.Model;
            let dataPromise = Model.save(curCapsule, true);

            dataPromise.then(function (result) {
                // Unwrap the Pi transport envelope: result[0].data[0]
                let piEnvelope = result[0].data[0];
                return thisRef.processResult(piEnvelope, null);
            }).catch(function (err) {
                Msg.error('CommandRouter', 'Could not process data: ' + err, thisRef.requestor);
            });
        }
    }

    /**
     * Starts a setInterval for every entry in options.commandTimer.
     * Also drives the countdown display in the DOM using the shortest interval.
     */
    startTimedCommands() {
        let thisRef = this;
        if (this.options.commandTimer && this.options.commandTimer.length > 0) {
            let minimumTimer = Number.MAX_SAFE_INTEGER;

            for (let curCommandTimer of this.options.commandTimer) {
                (function (timerDef) {
                    let curInterval = setInterval(function () {
                        // Suppress the modal so only the dashboard cards are updated silently
                        thisRef.suppressModal = true;
                        thisRef.executeCommand(timerDef.cmd, timerDef.param);
                    }, timerDef.interval);

                    if (timerDef.interval < minimumTimer) {
                        minimumTimer = timerDef.interval;
                    }
                    thisRef.cmdIntervals.push(curInterval);
                })(curCommandTimer);
            }

            let countDownElemCur = document.querySelector('.commandrouter_countdown_cur');
            if (countDownElemCur) {
                let countDownElemMax = document.querySelector('.commandrouter_countdown_max');
                if (countDownElemMax) {
                    countDownElemMax.innerHTML = minimumTimer / 1000;
                }
                let curTimer = minimumTimer / 1000;
                this.countdownInterval = setInterval(function () {
                    if (curTimer <= 0) {
                        curTimer = minimumTimer / 1000;
                    }
                    countDownElemCur.innerHTML = curTimer--;
                }, 1000);
            }
        }
    }

    /**
     * Clears all active command intervals and resets the countdown display.
     */
    stopTimedCommands() {
        for (let curCmdInterval of this.cmdIntervals) {
            clearInterval(curCmdInterval);
        }
        clearInterval(this.countdownInterval);
        let countDownElemCur = document.querySelector('.commandrouter_countdown_cur');
        if (countDownElemCur) {
            countDownElemCur.innerHTML = '';
        }
        let countDownElemMax = document.querySelector('.commandrouter_countdown_max');
        if (countDownElemMax) {
            countDownElemMax.innerHTML = '';
        }
    }

    /**
     * Extracts the payload from a BLE SWAC response envelope.
     * Returns content.data if present, otherwise returns the input unchanged.
     *
     * @param   {*} response
     * @returns {object}
     */
    _unwrapBLE(response) {
        if (!response || typeof response !== 'object')
            return response;

        if (response.content !== undefined) {
            const inner = response.content?.data;
            if (inner !== null && typeof inner === 'object')
                return inner;
            if (inner !== undefined)
                return {value: inner, status: response.status};
            return response.content;
        }

        return response;
    }

    /**
     * Central handler called after every successful command execution.
     * Dispatches the commandrouter_executed event so index.js can update the dashboard cards.
     *
     * @param {object|null}  result
     * @param {Element|null} comp
     */
    processResult(result, comp) {
        Msg.flow('CommandRouter', 'processResult()', this.requestor);

        // Skip the modal for timer-triggered commands; reset flag afterwards
        if (!this.suppressModal) {
            this.generateView(result);
        }
        this.suppressModal = false;

        document.dispatchEvent(new CustomEvent(
                'swac_' + this.requestor.id + '_commandrouter_executed',
                {detail: {comp, result}}
        ));
    }

    /**
     * Renders the command result as a key/value table inside the last-measuring modal.
     * Detects and unwraps the Pi transport envelope before rendering.
     *
     * @param {object|null} dataset
     */
    generateView(dataset) {
        Msg.flow('CommandRouter', 'generateView()', this.requestor);
        if (!dataset)
            return;

        let modal = document.getElementById('last-measuring-modal');
        let loading = document.getElementById('last-measuring-loading');
        let error = document.getElementById('last-measuring-error');
        let table = document.getElementById('last-measuring-table');
        let tbody = document.getElementById('last-measuring-tbody');

        if (!modal) {
            Msg.warn('CommandRouter', 'Modal #last-measuring-modal not found.', this.requestor);
            return;
        }

        document.querySelectorAll('[uk-dropdown]').forEach(function (el) {
            UIkit.dropdown(el).hide(false);
        });

        // Reset modal to a clean state before rendering new data
        loading.style.display = 'none';
        error.style.display = 'none';
        tbody.innerHTML = '';
        table.style.display = 'none';

        // Unwrap Pi transport envelope if dataset.data contains the actual measurement
        let row = dataset;
        if (dataset.data !== null
                && dataset.data !== undefined
                && typeof dataset.data === 'object'
                && !Array.isArray(dataset.data)) {
            row = dataset.data;
        }

        let statusValue = dataset.status ?? dataset.message ?? dataset.msg ?? null;
        if (statusValue) {
            let isError = /error|fail|err/i.test(String(statusValue));
            error.textContent = statusValue;
            error.style.display = '';
            // Red for errors, blue for informational status
            error.style.color = isError ? '#e53e3e' : '#2b6cb0';
        }

        Object.entries(row).forEach(function ([key, value]) {
            let tr = document.createElement('tr');
            let tdKey = document.createElement('td');
            let tdVal = document.createElement('td');

            tdKey.textContent = key;
            tdKey.style.fontWeight = '600';
            tdVal.textContent = (value !== null && value !== undefined) ? value : '—';

            tr.appendChild(tdKey);
            tr.appendChild(tdVal);
            tbody.appendChild(tr);
        });

        table.style.display = '';
        UIkit.modal(modal).show();
    }
}