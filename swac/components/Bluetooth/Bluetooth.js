import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';

export default class Bluetooth extends View {

    constructor(options = {}) {
        super(options);
        this.name = 'Bluetooth';
        this.desc.text = 'Component for discovering and using multiple BLE devices simultaneously, specifically Sensor Pi devices.';
        this.desc.developers = 'Florian Fehring (HSBI)';
        this.desc.license = 'GNU Lesser General Public License';

        this.desc.templates[0] = {
            name: 'default',
            desc: 'Default template with connect button, status bar and dynamic device cards.'
        };

        this.desc.styles[0] = {
            selc: '.swac_bluetooth_panel',
            desc: 'Main panel style. Loaded from Bluetooth.css automatically by SWAC.'
        };

        this.desc.reqPerTpl[0] = {
            selc: '.swac_bluetooth_connect_btn',
            desc: 'Button to initiate a new BLE connection. Can be clicked multiple times to add devices.'
        };
        this.desc.reqPerTpl[1] = {
            selc: '.swac_bluetooth_device_list',
            desc: 'Container where connected device cards are rendered dynamically.'
        };

        this.desc.optPerTpl[0] = {
            selc: '.swac_bluetooth_status',
            desc: 'Element to display general connection status messages.'
        };

        // ── Option descriptions ────────────────────────────────────────────

        this.desc.opts[0] = {
            name: 'filterDevices',
            desc: 'Array of BLE filter objects (e.g. namePrefix). If empty, all devices are accepted.',
            example: [{namePrefix: 'Sensor'}]
        };
        if (!options.filterDevices)
            this.options.filterDevices = [];

        this.desc.opts[1] = {
            name: 'communicationTimeout',
            desc: 'Timeout in milliseconds to wait for a notification response from a Pi.'
        };
        if (!options.communicationTimeout)
            this.options.communicationTimeout = 5000;

        this.desc.opts[2] = {
            name: 'uartServiceUUID',
            desc: 'UUID of the Nordic UART BLE service on the Pi.'
        };
        if (!options.uartServiceUUID)
            this.options.uartServiceUUID = '12345678-1234-5678-1234-56789abcdef0';

        this.desc.opts[3] = {
            name: 'uartWriteUUID',
            desc: 'UUID of the BLE write characteristic (TX from browser perspective).'
        };
        if (!options.uartWriteUUID)
            this.options.uartWriteUUID = '12345678-1234-5678-1234-56789abcdef1';

        this.desc.opts[4] = {
            name: 'uartNotifyUUID',
            desc: 'UUID of the BLE notify characteristic (RX from browser perspective).'
        };
        if (!options.uartNotifyUUID)
            this.options.uartNotifyUUID = '12345678-1234-5678-1234-56789abcdef2';

        this.desc.opts[5] = {
            name: 'maxDevices',
            desc: 'Maximum number of simultaneously connected devices. 0 = unlimited.'
        };
        if (!options.maxDevices)
            this.options.maxDevices = 0;

        this.desc.opts[6] = {
            name: 'onConnected',
            desc: 'Callback executed after a successful BLE connection. Receives (deviceId, device).'
        };
        if (!options.onConnected)
            this.options.onConnected = function () {};

        this.desc.opts[7] = {
            name: 'onDisconnected',
            desc: 'Callback executed when a device disconnects. Receives (deviceId).'
        };
        if (!options.onDisconnected)
            this.options.onDisconnected = function () {};

        this.desc.opts[8] = {
            name: 'deviceMismatchKey',
            desc: 'localStorage key prefix for MAC validation. Full key per device: prefix + "_" + deviceId.'
        };
        if (!options.deviceMismatchKey)
            this.options.deviceMismatchKey = 'deviceMac';

        /**
         * @option sections
         * @desc Defines the command sections and buttons shown on each connected device card.
         *       Each section is rendered as a labeled group of buttons.
         *       Defaults to an empty array — no buttons are shown unless sections are
         *       explicitly provided via the project-specific configuration file (e.g. example1.js).
         *
         * Section object fields:
         *   title   {string}  - Section heading shown above the button group.
         *   type    {string}  - Optional. Set to "wlan" to render the built-in WLAN input form
         *                       instead of a button grid. All other values (or omitted) render buttons.
         *   buttons {Array}   - Array of button definition objects (ignored when type === "wlan").
         *
         * Button definition object fields:
         *   icon        {string}  - Emoji or HTML string shown left of the label.
         *   label       {string}  - Short button name.
         *   description {string}  - Small subtitle rendered below the label.
         *   action      {string}  - Name of a method on this Bluetooth instance that should be
         *                           called when the button is clicked. The method receives (deviceId)
         *                           as its only argument and must return a Promise.
         *                           Built-in actions: sendTimeStamp, getMacAddress, startMeasurement,
         *                           stopMeasurement, getLastMeasuring, measuringStatus,
         *                           smartMobileStatus, aggregationOn, aggregationOff,
         *                           aggregationStatus, synchronizeDataOn, synchronizeDataOff,
         *                           synchronizeDataStatus, stopAll, rebootPi, shutDownPi.
         *   style       {string}  - Optional CSS modifier appended as "ble-cmd-{style}".
         *                           Built-in values: "warn" (orange), "danger" (red).
         */
        this.desc.opts[9] = {
            name: 'sections',
            desc: 'Array of section config objects that define which command buttons appear on each device card. ' +
                  'Defaults to [] — define all sections in your project config file. See JSDoc above for the full schema.'
        };
        // Default is intentionally empty.
        // All button layout must come from the project-specific config (e.g. example1.js).
        if (!options.sections)
            this.options.sections = [];

        if (!options.showWhenNoData)
            this.options.showWhenNoData = true;

        // ── Public API descriptions ────────────────────────────────────────
        this.desc.funcs[0] = {name: 'connectDevice', desc: 'Opens a BLE picker and connects the chosen device.', returns: {type: 'Promise<String>'}};
        this.desc.funcs[1] = {name: 'disconnectDevice', desc: 'Disconnects a specific device.', params: [{name: 'deviceId'}]};
        this.desc.funcs[2] = {name: 'disconnectAll', desc: 'Disconnects all connected devices.'};
        this.desc.funcs[3] = {name: 'getConnectedDeviceIds', desc: 'Returns an array of all connected device IDs.', returns: {type: 'String[]'}};
        this.desc.funcs[4] = {name: 'communicateWithPi', desc: 'Sends a JSON string to a specific Pi and returns the parsed response.', params: [{name: 'deviceId'}, {name: 'jsonString'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[5] = {name: 'sendTimeStamp', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[6] = {name: 'getMacAddress', params: [{name: 'deviceId'}], returns: {type: 'Promise<String>'}};
        this.desc.funcs[7] = {name: 'startMeasurement', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[8] = {name: 'stopMeasurement', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[9] = {name: 'getLastMeasuring', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[10] = {name: 'measuringStatus', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[11] = {name: 'smartMobileStatus', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[12] = {name: 'aggregationOn', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[13] = {name: 'aggregationOff', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[14] = {name: 'aggregationStatus', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[15] = {name: 'synchronizeDataOn', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[16] = {name: 'synchronizeDataOff', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[17] = {name: 'synchronizeDataStatus', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[18] = {name: 'addWLANToPi', params: [{name: 'deviceId'}, {name: 'ssid'}, {name: 'password'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[19] = {name: 'shutDownPi', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[20] = {name: 'stopAll', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[21] = {name: 'rebootPi', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};

        this.desc.events[0] = {
            name: 'swac_REQUESTOR_ID_bluetooth_connected',
            desc: 'Fired on successful connection.',
            data: 'event.detail = { deviceId, device }'
        };
        this.desc.events[1] = {
            name: 'swac_REQUESTOR_ID_bluetooth_disconnected',
            desc: 'Fired on disconnect.',
            data: 'event.detail = { deviceId }'
        };

        if (!options.plugins)
            this.options.plugins = new Map();

        this._connectedDevices = new Map();
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────

    async init() {
        // Read the project-specific config object from the global window scope.
        // SWAC convention: the config for element id="foo" lives at window["foo_conf_options"].
        // Merging here (rather than relying on the constructor) guarantees that config values
        // always override constructor defaults, regardless of how SWAC passes options internally.
        let projectConf = window[this.requestor.id + '_conf_options'];
        if (projectConf) {
            Object.assign(this.options, projectConf);
            Msg.info('Bluetooth', 'Project config loaded from window["' + this.requestor.id + '_conf_options"].', this.requestor);
        }

        if (!navigator.bluetooth) {
            this._setStatus('Web Bluetooth is not supported by this browser.', 'error');
            Msg.error('Bluetooth', 'Web Bluetooth is not supported.', this.requestor);
            return;
        }
        Msg.info('Bluetooth', 'Web Bluetooth is supported.', this.requestor);
        this._setStatus('Ready — no device connected');

        let connectBtn = this.requestor.querySelector('.swac_bluetooth_connect_btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', this.connectDevice.bind(this));
        } else {
            Msg.warn('Bluetooth', 'No .swac_bluetooth_connect_btn found in template.', this.requestor);
        }
    }

    // ── Connection management ──────────────────────────────────────────────

    async connectDevice() {
        Msg.flow('Bluetooth', 'connectDevice()', this.requestor);

        if (this.options.maxDevices > 0 && this._connectedDevices.size >= this.options.maxDevices) {
            let msg = 'Maximum number of devices (' + this.options.maxDevices + ') already connected.';
            Msg.warn('Bluetooth', msg, this.requestor);
            this._setStatus(msg, 'error');
            return null;
        }

        try {
            let requestConf = {};
            if (this.options.filterDevices && this.options.filterDevices.length > 0) {
                requestConf.filters = this.options.filterDevices;
            } else {
                requestConf.acceptAllDevices = true;
            }
            requestConf.optionalServices = [
                'generic_access',
                'device_information',
                this.options.uartServiceUUID
            ];

            this._setStatus('Scanning for devices...');
            let device = await navigator.bluetooth.requestDevice(requestConf);

            if (this._connectedDevices.has(device.id)) {
                Msg.warn('Bluetooth', 'Device already connected: ' + device.name, this.requestor);
                this._setStatus('Device ' + device.name + ' is already connected.', 'error');
                return device.id;
            }

            this._setStatus('Connecting to ' + device.name + '...');
            device.addEventListener('gattserverdisconnected', () => this._onDisconnected(device.id));
            let server = await device.gatt.connect();

            this._connectedDevices.set(device.id, {
                device,
                server,
                name: device.name ?? device.id
            });

            Msg.info('Bluetooth', 'Connected: ' + device.name + ' | Total: ' + this._connectedDevices.size, this.requestor);
            this._setStatus(this._connectedDevices.size + ' device(s) connected', 'connected');
            this._addDeviceCard(device.id, device.name ?? device.id);

            await this._validateDeviceMac(device.id);

            this.requestor.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_bluetooth_connected', {
                detail: {deviceId: device.id, device}
            }));
            this.options.onConnected.call(this, device.id, device);

            return device.id;

        } catch (err) {
            this._setStatus('Connection failed: ' + err.message, 'error');
            Msg.error('Bluetooth', 'Connection failed: ' + err.message, this.requestor);
            throw err;
        }
    }

    disconnectDevice(deviceId) {
        Msg.flow('Bluetooth', 'disconnectDevice() id=' + deviceId, this.requestor);
        let entry = this._connectedDevices.get(deviceId);
        if (entry && entry.device.gatt && entry.device.gatt.connected) {
            entry.device.gatt.disconnect();
        } else {
            this._onDisconnected(deviceId);
        }
    }

    disconnectAll() {
        Msg.flow('Bluetooth', 'disconnectAll() - ' + this._connectedDevices.size + ' device(s)', this.requestor);
        for (let deviceId of Array.from(this._connectedDevices.keys())) {
            this.disconnectDevice(deviceId);
        }
    }

    getConnectedDeviceIds() {
        return Array.from(this._connectedDevices.keys());
    }

    getDeviceName(deviceId) {
        let entry = this._connectedDevices.get(deviceId);
        return entry ? entry.name : null;
    }

    // ── Internal disconnect handler ────────────────────────────────────────

    _onDisconnected(deviceId) {
        let entry = this._connectedDevices.get(deviceId);
        let name = entry ? entry.name : deviceId;
        Msg.info('Bluetooth', 'Disconnected: ' + name, this.requestor);

        this._connectedDevices.delete(deviceId);
        this._removeDeviceCard(deviceId);

        let count = this._connectedDevices.size;
        this._setStatus(
                count > 0 ? count + ' device(s) connected' : 'Ready - no device connected',
                count > 0 ? 'connected' : ''
                );

        this.requestor.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_bluetooth_disconnected', {
            detail: {deviceId}
        }));
        this.options.onDisconnected.call(this, deviceId);
    }

    // ── MAC validation ────────────────────────────────────────────────────

    async _validateDeviceMac(deviceId) {
        let storageKey = this.options.deviceMismatchKey + '_' + deviceId;
        let storedMac = localStorage.getItem(storageKey);
        if (!storedMac)
            return;

        Msg.flow('Bluetooth', 'Validating MAC for ' + deviceId, this.requestor);
        let connectedMac = await this.getMacAddress(deviceId);
        let formattedMac = this._formatMac(connectedMac);

        if (formattedMac !== storedMac) {
            Msg.warn('Bluetooth', 'MAC mismatch! Expected ' + storedMac + ', got ' + formattedMac, this.requestor);
            this.disconnectDevice(deviceId);
            throw new Error('deviceMismatch');
        }
        Msg.info('Bluetooth', 'MAC validated for ' + deviceId, this.requestor);
    }

    // ── Status bar ────────────────────────────────────────────────────────

    _setStatus(message, state = '') {
        let el = this.requestor.querySelector('.swac_bluetooth_status');
        if (!el)
            return;
        el.textContent = message;
        el.classList.remove('ble-status-connected', 'ble-status-error');
        if (state === 'connected')
            el.classList.add('ble-status-connected');
        if (state === 'error')
            el.classList.add('ble-status-error');
    }

    // ── Device card ───────────────────────────────────────────────────────

    _addDeviceCard(deviceId, deviceName) {
        let listElem = this.requestor.querySelector('.swac_bluetooth_device_list');
        if (!listElem)
            return;

        let shortId = deviceId.length > 20 ? deviceId.substring(0, 20) + '...' : deviceId;

        // Card shell
        let card = document.createElement('li');
        card.classList.add('ble-device-card');
        card.setAttribute('swac_bluetooth_deviceid', deviceId);

        // Card header
        let header = document.createElement('div');
        header.classList.add('ble-device-header');

        let nameRow = document.createElement('div');
        nameRow.classList.add('ble-device-name-row');

        let toggleBtn = document.createElement('button');
        toggleBtn.classList.add('ble-toggle-btn');
        toggleBtn.textContent = '▾';
        toggleBtn.title = 'Collapse commands';

        let dot = document.createElement('span');
        dot.classList.add('ble-dot');

        let nameBlock = document.createElement('div');

        let nameLine = document.createElement('div');
        nameLine.classList.add('ble-device-name');
        nameLine.textContent = deviceName;

        let idLine = document.createElement('div');
        idLine.classList.add('ble-device-id');
        idLine.textContent = 'ID: ' + shortId;

        nameBlock.appendChild(nameLine);
        nameBlock.appendChild(idLine);
        nameRow.appendChild(toggleBtn);
        nameRow.appendChild(dot);
        nameRow.appendChild(nameBlock);

        let disconnectBtn = document.createElement('button');
        disconnectBtn.classList.add('ble-disconnect-btn');
        disconnectBtn.textContent = 'Disconnect';
        disconnectBtn.addEventListener('click', () => this.disconnectDevice(deviceId));

        header.appendChild(nameRow);
        header.appendChild(disconnectBtn);
        card.appendChild(header);

        // Command area — only rendered when at least one section is configured
        let cmdArea = document.createElement('div');
        cmdArea.classList.add('ble-commands');

        if (this.options.sections && this.options.sections.length > 0) {
            // Shared response log reused by all buttons on this card
            let responseLog = document.createElement('div');
            responseLog.classList.add('ble-response');

            for (let section of this.options.sections) {
                if (section.type === 'wlan') {
                    cmdArea.appendChild(this._buildWlanSection(deviceId, responseLog, section));
                } else {
                    cmdArea.appendChild(
                            this._buildButtonSection(deviceId, section.title, section.buttons || [], responseLog)
                            );
                }
            }

            cmdArea.appendChild(responseLog);
        }

        card.appendChild(cmdArea);

        // Toggle collapse/expand — only useful when there are sections
        toggleBtn.addEventListener('click', () => {
            let collapsed = cmdArea.style.display === 'none';
            cmdArea.style.display = collapsed ? '' : 'none';
            toggleBtn.textContent = collapsed ? '▾' : '▸';
            toggleBtn.title = collapsed ? 'Collapse commands' : 'Expand commands';
        });

        // Hide the toggle button entirely when there are no sections to show
        if (!this.options.sections || this.options.sections.length === 0) {
            toggleBtn.style.display = 'none';
        }

        listElem.appendChild(card);
    }

    _buildButtonSection(deviceId, title, buttons, responseLog) {
        let section = document.createElement('div');
        section.classList.add('ble-cmd-section');

        let label = document.createElement('div');
        label.classList.add('ble-commands-label');
        label.textContent = title;
        section.appendChild(label);

        let grid = document.createElement('div');
        grid.classList.add('ble-cmd-grid');

        for (let btnDef of buttons) {
            grid.appendChild(this._buildActionButton(deviceId, btnDef, responseLog));
        }

        section.appendChild(grid);
        return section;
    }

    _buildActionButton(deviceId, btnDef, responseLog) {
        let btn = document.createElement('button');
        btn.classList.add('ble-cmd-btn');
        if (btnDef.style)
            btn.classList.add('ble-cmd-' + btnDef.style);

        btn.innerHTML =
                (btnDef.icon ? '<span class="ble-cmd-icon">' + btnDef.icon + '</span>' : '') +
                (btnDef.label ? '<span class="ble-cmd-name">' + btnDef.label + '</span>' : '') +
                (btnDef.description ? '<span class="ble-cmd-desc">' + btnDef.description + '</span>' : '');

        btn.addEventListener('click', async () => {
            let method = this[btnDef.action];
            if (typeof method !== 'function') {
                responseLog.className = 'ble-response ble-response-visible ble-response-err';
                responseLog.textContent = 'Unknown action: "' + btnDef.action + '"';
                return;
            }

            btn.disabled = true;
            btn.style.opacity = '0.6';
            responseLog.className = 'ble-response ble-response-visible';
            responseLog.textContent = 'Waiting for response...';

            try {
                let result = await method.call(this, deviceId);
                responseLog.className = 'ble-response ble-response-visible ble-response-ok';
                responseLog.textContent = btnDef.label + ': ' + JSON.stringify(result, null, 2);
            } catch (e) {
                responseLog.className = 'ble-response ble-response-visible ble-response-err';
                responseLog.textContent = e.message;
            } finally {
                btn.disabled = false;
                btn.style.opacity = '';
            }
        });

        return btn;
    }

    /**
     * Builds the WLAN configuration section.
     * Labels and placeholders can be customised via the section definition object in the config file:
     *   { title, type: 'wlan', icon, label, description, ssidPlaceholder, passwordPlaceholder }
     */
    _buildWlanSection(deviceId, responseLog, sectionDef = {}) {
        let section = document.createElement('div');
        section.classList.add('ble-cmd-section');

        let label = document.createElement('div');
        label.classList.add('ble-commands-label');
        label.textContent = sectionDef.title || 'WLAN';
        section.appendChild(label);

        let form = document.createElement('div');
        form.classList.add('ble-wlan-form');

        let ssidInput = document.createElement('input');
        ssidInput.type = 'text';
        ssidInput.placeholder = sectionDef.ssidPlaceholder || 'WLAN name (SSID)';
        ssidInput.classList.add('ble-wlan-input');

        let pwInput = document.createElement('input');
        pwInput.type = 'password';
        pwInput.placeholder = sectionDef.passwordPlaceholder || 'Password';
        pwInput.classList.add('ble-wlan-input');

        let pwToggle = document.createElement('button');
        pwToggle.classList.add('ble-wlan-toggle');
        pwToggle.textContent = '👁';
        pwToggle.title = 'Show password';
        pwToggle.addEventListener('click', () => {
            let show = pwInput.type === 'password';
            pwInput.type = show ? 'text' : 'password';
            pwToggle.textContent = show ? '⌣' : '👁';
        });

        let pwRow = document.createElement('div');
        pwRow.classList.add('ble-wlan-pw-row');
        pwRow.appendChild(pwInput);
        pwRow.appendChild(pwToggle);

        let wlanBtn = document.createElement('button');
        wlanBtn.classList.add('ble-cmd-btn');
        wlanBtn.innerHTML =
                '<span class="ble-cmd-icon">' + (sectionDef.icon || '📶') + '</span>' +
                '<span class="ble-cmd-name">' + (sectionDef.label || 'Add WLAN') + '</span>' +
                '<span class="ble-cmd-desc">' + (sectionDef.description || 'Configure WLAN on the Pi') + '</span>';

        wlanBtn.addEventListener('click', async () => {
            let ssid = ssidInput.value.trim();
            let pw = pwInput.value;

            if (!ssid) {
                responseLog.className = 'ble-response ble-response-visible ble-response-err';
                responseLog.textContent = 'Please enter a WLAN name.';
                return;
            }

            wlanBtn.disabled = true;
            wlanBtn.style.opacity = '0.6';
            responseLog.className = 'ble-response ble-response-visible';
            responseLog.textContent = 'Waiting for response...';

            try {
                let result = await this.addWLANToPi(deviceId, ssid, pw);
                responseLog.className = 'ble-response ble-response-visible ble-response-ok';
                responseLog.textContent = (sectionDef.label || 'Add WLAN') + ': ' + JSON.stringify(result, null, 2);
                ssidInput.value = '';
                pwInput.value = '';
            } catch (e) {
                responseLog.className = 'ble-response ble-response-visible ble-response-err';
                responseLog.textContent = e.message;
            } finally {
                wlanBtn.disabled = false;
                wlanBtn.style.opacity = '';
            }
        });

        form.appendChild(ssidInput);
        form.appendChild(pwRow);
        form.appendChild(wlanBtn);
        section.appendChild(form);

        return section;
    }

    _removeDeviceCard(deviceId) {
        let listElem = this.requestor.querySelector('.swac_bluetooth_device_list');
        if (!listElem)
            return;
        let card = listElem.querySelector('[swac_bluetooth_deviceid="' + deviceId + '"]');
        if (!card)
            return;
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'translateY(-6px)';
        setTimeout(() => card.remove(), 320);
    }

    // ── Core BLE communication ────────────────────────────────────────────

    async communicateWithPi(deviceId, jsonString) {
        Msg.flow('Bluetooth', 'communicateWithPi() device=' + deviceId, this.requestor);

        let entry = this._connectedDevices.get(deviceId);
        if (!entry) {
            throw new Error('No device with id >' + deviceId + '< connected. Call connectDevice() first.');
        }

        if (!entry.device.gatt.connected) {
            Msg.warn('Bluetooth', 'GATT dropped for ' + deviceId + '. Reconnecting...', this.requestor);
            try {
                entry.server = await entry.device.gatt.connect();
                this._connectedDevices.set(deviceId, entry);
                Msg.info('Bluetooth', 'Reconnected to ' + deviceId, this.requestor);
            } catch (e) {
                throw new Error('Reconnect failed for ' + deviceId + ': ' + e.message);
            }
        }

        try {
            Msg.flow('Bluetooth', 'TX -> ' + deviceId + ': ' + jsonString, this.requestor);
            const payload = new TextEncoder().encode(jsonString);

            const service = await entry.server.getPrimaryService(this.options.uartServiceUUID);
            const writeChar = await service.getCharacteristic(this.options.uartWriteUUID);
            const notifyChar = await service.getCharacteristic(this.options.uartNotifyUUID);

            const responsePromise = new Promise((resolve, reject) => {
                const handleNotification = (event) => {
                    try {
                        const text = new TextDecoder().decode(event.target.value);
                        Msg.flow('Bluetooth', 'RX <- ' + deviceId + ': ' + text, this.requestor);
                        notifyChar.removeEventListener('characteristicvaluechanged', handleNotification);
                        resolve(JSON.parse(text));
                    } catch (err) {
                        reject(new Error('Parse error for response from ' + deviceId + ': ' + err.message));
                    }
                };
                notifyChar.addEventListener('characteristicvaluechanged', handleNotification);

                setTimeout(() => {
                    notifyChar.removeEventListener('characteristicvaluechanged', handleNotification);
                    reject(new Error('Timeout: No response from ' + deviceId + ' within ' + this.options.communicationTimeout + 'ms.'));
                }, this.options.communicationTimeout);
            });

            await notifyChar.startNotifications();
            await writeChar.writeValue(payload);
            Msg.flow('Bluetooth', 'Waiting for response from ' + deviceId + '...', this.requestor);

            const responseObject = await responsePromise;
            await notifyChar.stopNotifications();
            return responseObject;

        } catch (e) {
            Msg.error('Bluetooth', 'Communication error with ' + deviceId + ': ' + e.message, this.requestor);
            throw e;
        }
    }

    // ── Built-in command methods ──────────────────────────────────────────
    // These are referenced by name in the sections[].buttons[].action field
    // of the project-specific config file (e.g. example1.js).

    async sendTimeStamp(deviceId) {
        Msg.flow('Bluetooth', 'sendTimeStamp() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: {sendTimeStamp: new Date().toLocaleString('de-DE')}, param: null}
        }));
    }

    async getMacAddress(deviceId) {
        Msg.flow('Bluetooth', 'getMacAddress() ' + deviceId, this.requestor);
        const res = await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'getMac', param: null}
        }));
        return res.content.data;
    }

    async startMeasurement(deviceId) {
        Msg.flow('Bluetooth', 'startMeasurement() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'smartMobile_on_measuring', param: null}
        }));
    }

    async stopMeasurement(deviceId) {
        Msg.flow('Bluetooth', 'stopMeasurement() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'smartMobile_off_measuring', param: null}
        }));
    }

    async getLastMeasuring(deviceId) {
        Msg.flow('Bluetooth', 'getLastMeasuring() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'last_measuring', param: 'last_' + new Date().toLocaleString('de-DE')}
        }));
    }

    async measuringStatus(deviceId) {
        Msg.flow('Bluetooth', 'measuringStatus() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'smartMobile_measuring_status', param: null}
        }));
    }

    async smartMobileStatus(deviceId) {
        Msg.flow('Bluetooth', 'smartMobileStatus() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'smartMobile_status', param: null}
        }));
    }

    async aggregationOn(deviceId) {
        Msg.flow('Bluetooth', 'aggregationOn() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'smartMobile_on_aggregation', param: null}
        }));
    }

    async aggregationOff(deviceId) {
        Msg.flow('Bluetooth', 'aggregationOff() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'smartMobile_off_aggregation', param: null}
        }));
    }

    async aggregationStatus(deviceId) {
        Msg.flow('Bluetooth', 'aggregationStatus() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'smartMobile_aggregation_status', param: null}
        }));
    }

    async synchronizeDataOn(deviceId) {
        Msg.flow('Bluetooth', 'synchronizeDataOn() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'smartMobile_on_synchronisation', param: null}
        }));
    }

    async synchronizeDataOff(deviceId) {
        Msg.flow('Bluetooth', 'synchronizeDataOff() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'smartMobile_off_synchronisation', param: null}
        }));
    }

    async synchronizeDataStatus(deviceId) {
        Msg.flow('Bluetooth', 'synchronizeDataStatus() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'smartMobile_synchronisation_status', param: null}
        }));
    }

    async stopAll(deviceId) {
        Msg.flow('Bluetooth', 'stopAll() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'smartMobile_stop_all', param: null}
        }));
    }

    async rebootPi(deviceId) {
        Msg.flow('Bluetooth', 'rebootPi() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'reboot', param: null}
        }));
    }

    async addWLANToPi(deviceId, ssid, password) {
        Msg.flow('Bluetooth', 'addWLANToPi() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'addWlan', param: {ssid, password}}
        }));
    }

    async shutDownPi(deviceId) {
        Msg.flow('Bluetooth', 'shutDownPi() ' + deviceId, this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: 'shutdown', param: null}
        }));
    }

    // ── Utilities ─────────────────────────────────────────────────────────

    _formatMac(input) {
        const clean = input.replace(/[-\s:]/g, '').toUpperCase();
        return clean.match(/.{1,2}/g)?.join('-') || '';
    }
}