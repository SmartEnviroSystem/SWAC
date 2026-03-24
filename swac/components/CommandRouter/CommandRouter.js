/* global UIkit */

import View from '../../View.js';
import Msg from '../../Msg.js';

export default class CommandRouter extends View {

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

        this.desc.optPerTpl[0] = {
            selc: '.swac_commandrouter_resultdisplay_modal',
            desc: 'An element to display as modal for showing results from commands.'
        };

        this.desc.optPerPage[0] = {
            selc: '.swac_commandrouter_countdown_cur',
            desc: 'Element where to show current left time until next command exec.'
        };
        this.desc.optPerPage[1] = {
            selc: '.swac_commandrouter_countdown_max',
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
            desc: "Template datacapsule for sending data. Here default data to send along can be placed.",
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

        this.desc.funcs[0] = {
            name: 'executeCommand',
            desc: 'This method executes a command on all commandable components, that acceppt the command.',
            params: [
                {
                    name: 'command',
                    desc: 'Command to execute',
                    type: 'String'
                },
                {
                    name: 'params',
                    desc: 'An object containging command parameters. Delivered to the executing component as it is.',
                    type: 'Object'
                },
                {
                    name: 'processResult',
                    desc: 'If the result should be processed.',
                    type: 'boolean'
                },
                {
                    name: 'generateView',
                    desc: 'If a generic view of the result should be generated.',
                    type: 'boolean'
                }
            ],
            returns: {
                desc: 'Result provided by the command executing component.',
                type: 'Object'
            }
        };

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
     * Initialises the component by registering the command binding listener and starting timed commands.
     */
    async init() {
        document.addEventListener('swac_components_complete', this.bindCommands.bind(this));
        this.startTimedCommands();
    }

    /**
     * Binds click listeners to all [cmd] elements and collects commandable components from the DOM.
     *
     * @param {Event} evt - The swac_components_complete event that triggers binding.
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
            this.comps = document.querySelectorAll('[swa]');
        }
    }

    /**
     * Extracts the command and param attributes from the clicked element and delegates to executeCommand.
     *
     * @param {Event} evt - The click event fired by a [cmd] element.
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
     * @param {string}  cmd     - Command name (e.g. 'last_measuring', 'POST').
     * @param {*}       params  - Optional parameter forwarded with the command.
     * @param {boolean} processResult - If false, the caller handles processResult itself (used by executeRequest).
     * @param {boolean} generateView - Whether to generate a generic response view or not.
     * @returns {Promise<*>} The result returned by the component or the datacapsule.
     */
    async executeCommand(cmd, params, processResult = true, generateView = true) {
        Msg.flow('CommandRouter', 'executeCommand()', this.requestor);
        const thisRef = this;
        let executed = false;

        // 1) Try to send the command to a commandable component (e.g. Bluetooth)
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

                // Await if the component returns a Promise
                if (res && typeof res.then === 'function') {
                    res = await res;
                }

                Msg.info('CommandRouter', 'Command >' + cmd + '< on component >' + curComp.id + '< executed.');
                if (processResult) {
                    thisRef.processResult(res, curComp, generateView);
                }
                if (generateView) {
                    this.generateView(res);
                }

                document.dispatchEvent(new CustomEvent(
                        'swac_' + this.requestor.id + '_commandrouter_executed',
                        {detail: {comp: curComp, result: res}}
                ));

                return res;

            } catch (e) {
                Msg.error('CommandRouter', 'Command >' + cmd + '< threw error: ' + e, this.requestor);
            }
        }
        Msg.info('CommandRouter', 'Did not find command >' + cmd + '< at components. Try useing datarequest.', this.requestor);
        // 2) No component handled the command – fall back to WebSocket / REST datacapsule
        if (!executed && this.options.targetDatacapsule) {
            const curCapsule = Object.assign({}, this.options.targetDatacapsule);

            let name = '';
            const nameElem = document.querySelector(this.options.deviceNameSource);
            if (nameElem) {
                name = nameElem.children[0]?.innerHTML ?? nameElem.textContent.trim();
            } else {
                Msg.info('CommandRouter', 'Device name element not found.', this.requestor);
            }

            curCapsule.fromName = curCapsule.fromName.replace('{name}', name);
            curCapsule.data = [{action: cmd, param: params}];

            try {
                const Model = window.swac.Model;
                const result = await Model.save(curCapsule, true);
                const data = result[0].data;

                if (processResult) {
                    thisRef.processResult(data, null);
                }
                if (generateView)
                    this.generateView(data);

                document.dispatchEvent(new CustomEvent(
                        'swac_' + this.requestor.id + '_commandrouter_executed',
                        {detail: {comp: this.requestor, result: data}}
                ));

                return data;

            } catch (err) {
                Msg.error('CommandRouter', 'Could not process data: ' + err, thisRef.requestor);
            }
        }

        return undefined;
    }

    /**
     * Executes a data request by mapping it to a POST, PUT or GET command.
     * Used by Question.js and other components that work with datacapsules.
     *
     * @param {Object}  dataRequest   - Datacapsule with fromName and optional data array.
     * @param {boolean} processResult - Whether to call processResult() on the response.
     * @param {boolean} generateView - Whether to generate a generic response view or not.
     * @returns {Promise<*>} The result of the executed command.
     */
    async executeRequest(dataRequest, processResult = true, generateView = false) {
        let result;
        if (dataRequest.data) {
            const hasValidId = dataRequest.data.some(obj => obj.id != null);
            if (hasValidId) {
                Msg.flow('CommandRouter', 'executeRequest with action PUT');
                result = await this.executeCommand('PUT', dataRequest, processResult, generateView);
            } else {
                Msg.flow('CommandRouter', 'executeRequest with action POST');
                result = await this.executeCommand('POST', dataRequest, processResult, generateView);
            }
        } else if (dataRequest.fromName.startsWith('action=')) {
            let action = dataRequest.fromName.replace('action=', '');
            Msg.flow('CommandRouter', 'executeRequest with action ' + action);
            result = await this.executeCommand(action, dataRequest, processResult, generateView);
        } else {
            Msg.flow('CommandRouter', 'executeRequest with action GET');
            result = await this.executeCommand('GET', dataRequest, processResult, generateView);
        }
        return result;
    }

    /**
     * Registers setInterval timers for all entries in options.commandTimer and starts the countdown display.
     */
    startTimedCommands() {
        let thisRef = this;
        if (this.options.commandTimer && this.options.commandTimer.length > 0) {
            let minimumTimer = Number.MAX_SAFE_INTEGER;

            for (let curCommandTimer of this.options.commandTimer) {
                (function (timerDef) {
                    let curInterval = setInterval(function () {
                        thisRef.executeCommand(timerDef.cmd, timerDef.param);
                    }, timerDef.interval);

                    if (timerDef.interval < minimumTimer) {
                        minimumTimer = timerDef.interval;
                    }
                    thisRef.cmdIntervals.push(curInterval);
                })(curCommandTimer);
            }

            let countDownElemCur = document.querySelector('.swac_commandrouter_countdown_cur');
            if (countDownElemCur) {
                let countDownElemMax = document.querySelector('.swac_commandrouter_countdown_max');
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
     * Clears all timed command intervals and resets the countdown display elements.
     */
    stopTimedCommands() {
        for (let curCmdInterval of this.cmdIntervals) {
            clearInterval(curCmdInterval);
        }
        clearInterval(this.countdownInterval);
        let countDownElemCur = document.querySelector('.swac_commandrouter_countdown_cur');
        if (countDownElemCur) {
            countDownElemCur.innerHTML = '';
        }
        let countDownElemMax = document.querySelector('.swac_commandrouter_countdown_max');
        if (countDownElemMax) {
            countDownElemMax.innerHTML = '';
        }
    }

    /**
     * Dispatches the commandrouter_executed event and optionally opens the result modal.
     *
     * @param {*}           result - The data returned by the executed command.
     * @param {HTMLElement} comp   - The component element that handled the command, or null for datacapsule.
     */
    processResult(result, comp) {
        Msg.flow('CommandRouter', 'processResult()', this.requestor);
        
        // TODO support processing nodes
        
        document.dispatchEvent(new CustomEvent(
                'swac_' + this.requestor.id + '_commandrouter_processed',
                {detail: {comp, result}}
        ));
    }

    /**
     * Renders the command result into the last-measuring modal table and opens it.
     *
     * @param {Object|Array} dataset - The raw result object or array to display.
     */
    generateView(dataset) {
        Msg.flow('CommandRouter', 'generateView()', this.requestor);
        if (!dataset)
            return;

        let modal = document.querySelector('.swac_commandrouter_resultdisplay_modal');
        if (!modal) {
            Msg.warn('CommandRouter', 'Modal .swac_commandrouter_resultdisplay_modal not found.', this.requestor);
            return;
        }

        let error = modal.querySelector('.swac_commandrouter_resultdisplay_error');
        let table = modal.querySelector('.swac_commandrouter_resultdisplay_table');
        let tbody = modal.querySelector('.swac_commandrouter_resultdisplay_tbody');

        document.querySelectorAll('[uk-dropdown]').forEach(function (el) {
            UIkit.dropdown(el).hide(false);
        });

        error.style.display = 'none';
        tbody.innerHTML = '';
        table.style.display = 'none';

        // Unwrap array envelope (WebSocket returns [{...}])
        if (Array.isArray(dataset))
            dataset = dataset[0];

        // Unwrap unified envelope: data lives in records[0]
        let row = dataset;
        if (Array.isArray(dataset.records) && dataset.records[0] &&
                typeof dataset.records[0] === 'object') {
            row = dataset.records[0];
        } else if (dataset.data !== null && dataset.data !== undefined &&
                typeof dataset.data === 'object' && !Array.isArray(dataset.data)) {
            // Legacy fallback
            row = dataset.data;
        }

        let statusValue = dataset.status ?? row.status ?? dataset.message ?? null;
        if (statusValue) {
            let isError = /error|fail|err/i.test(String(statusValue));
            error.textContent = statusValue;
            error.style.display = '';
            error.style.color = isError ? '#e53e3e' : '#2b6cb0';
        }

        let usedAttributes = []
        if (this.options.attributeOrder) {
            for (var curAttr of this.options.attributeOrder) {
                if (!row[curAttr]) {
                    continue;
                }

                usedAttributes.push(curAttr);
                let tr = document.createElement('tr');
                let tdKey = document.createElement('td');
                let tdVal = document.createElement('td');

                tdKey.textContent = curAttr;
                tdKey.setAttribute('swac_lang', curAttr);
                tdKey.style.fontWeight = '600';
                tdVal.textContent = row[curAttr];

                tr.appendChild(tdKey);
                tr.appendChild(tdVal);
                tbody.appendChild(tr);
            }
        }

        Object.entries(row).forEach(function ([key, value]) {
            if (!usedAttributes.includes(key)) {
                // Skip the status field — it is already shown in the info/error banner above
                if (key === 'status')
                    return;
                let tr = document.createElement('tr');
                let tdKey = document.createElement('td');
                let tdVal = document.createElement('td');

                tdKey.textContent = key;
                tdKey.style.fontWeight = '600';
                tdVal.textContent = (value !== null && value !== undefined) ? value : '—';

                tr.appendChild(tdKey);
                tr.appendChild(tdVal);
                tbody.appendChild(tr);
        }
        });

        // Translate table contents
        window.swac.lang.translateAll(tbody);

        table.style.display = '';
        UIkit.modal(modal).show();
    }
}
