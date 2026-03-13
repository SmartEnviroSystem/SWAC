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

        this.desc.templates[1] = {
            name: 'minimal',
            desc: 'Minimal template with connect button'
        };

        this.desc.reqPerTpl[0] = {
            selc: '.swac_bluetooth_connect_btn',
            desc: 'Button to initiate a new BLE connection. Can be clicked multiple times to add devices.'
        };

        this.desc.optPerTpl[0] = {
            selc: '.swac_bluetooth_status',
            desc: 'Element to display general connection status messages.'
        };

        this.desc.optPerTpl[1] = {
            selc: '.swac_bluetooth_device_list',
            desc: 'Container where connected device cards are rendered dynamically.'
        };

        this.desc.optPerTpl[2] = {
            selc: '.swac_bluetooth_connect_minimal_btn',
            desc: 'Minimal ble connect button'
        };

        this.desc.optPerTpl[3] = {
            selc: '.swac_bluetooth_panel',
            desc: 'Main panel style. Loaded from Bluetooth.css automatically by SWAC.'
        };

        this.desc.optPerTpl[4] = {
            selc: '.ble-header',
            desc: 'BLE header styling for panel'
        };

        this.desc.optPerTpl[5] = {
            selc: '.ble-header-icon',
            desc: 'Bluetooth icon'
        };

        this.desc.optPerTpl[6] = {
            selc: '',
            desc: ''
        };

        this.desc.opts[0] = {name: 'filterDevices', desc: 'Array of BLE filter objects (e.g. namePrefix). If empty, all devices are accepted.', example: [{namePrefix: 'Sensor'}]};
        if (!options.filterDevices)
            this.options.filterDevices = [];

        this.desc.opts[1] = {name: 'communicationTimeout', desc: 'Timeout in milliseconds to wait for a notification response from a Pi.'};
        if (!options.communicationTimeout)
            this.options.communicationTimeout = 5000;

        this.desc.opts[2] = {name: 'uartServiceUUID', desc: 'UUID of the Nordic UART BLE service on the Pi.'};
        if (!options.uartServiceUUID)
            this.options.uartServiceUUID = '12345678-1234-5678-1234-56789abcdef0';

        this.desc.opts[3] = {name: 'uartWriteUUID', desc: 'UUID of the BLE write characteristic (TX from browser perspective).'};
        if (!options.uartWriteUUID)
            this.options.uartWriteUUID = '12345678-1234-5678-1234-56789abcdef1';

        this.desc.opts[4] = {name: 'uartNotifyUUID', desc: 'UUID of the BLE notify characteristic (RX from browser perspective).'};
        if (!options.uartNotifyUUID)
            this.options.uartNotifyUUID = '12345678-1234-5678-1234-56789abcdef2';

        this.desc.opts[5] = {name: 'maxDevices', desc: 'Maximum number of simultaneously connected devices. 0 = unlimited.'};
        if (!options.maxDevices)
            this.options.maxDevices = 0;

        this.desc.opts[6] = {name: 'onConnected', desc: 'Callback executed after a successful BLE connection. Receives (deviceId, device).'};
        if (!options.onConnected)
            this.options.onConnected = function () {};

        this.desc.opts[7] = {name: 'onDisconnected', desc: 'Callback executed when a device disconnects. Receives (deviceId).'};
        if (!options.onDisconnected)
            this.options.onDisconnected = function () {};

        this.desc.opts[8] = {name: 'deviceMismatchKey', desc: 'localStorage key prefix for MAC validation. Full key per device: prefix + "_" + deviceId.'};
        if (!options.deviceMismatchKey)
            this.options.deviceMismatchKey = 'deviceMac';

        this.desc.opts[9] = {name: 'sections', type: 'array', desc: 'Array of section config objects defining command buttons on each device card.'};
        if (!options.sections)
            this.options.sections = [];

        this.desc.opts[10] = {
            name: "deviceNameSource",
            desc: "CSS Selector for an element containing the device name",
            example: '.nameelement'
        };
        if (!options.deviceNameSource)
            this.options.deviceNameSource = null;

        if (!options.showWhenNoData)
            this.options.showWhenNoData = true;

        this.desc.funcs[0] = {name: 'connectDevice', desc: 'Opens a BLE picker and connects the chosen device.', returns: {type: 'Promise<String>'}};
        this.desc.funcs[1] = {name: 'disconnectDevice', desc: 'Disconnects a specific device.', params: [{name: 'deviceId'}]};
        this.desc.funcs[2] = {name: 'disconnectAll', desc: 'Disconnects all connected devices.'};
        this.desc.funcs[3] = {name: 'getConnectedDeviceIds', desc: 'Returns an array of all connected device IDs.', returns: {type: 'String[]'}};
        this.desc.funcs[4] = {name: 'communicateWithPi', desc: 'Sends a JSON string to a specific Pi and returns the parsed response.', params: [{name: 'deviceId'}, {name: 'jsonString'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[5] = {name: 'sendCommand', desc: 'Sends a Pi command string via BLE. All standard buttons use this.', params: [{name: 'deviceId'}, {name: 'action'}, {name: 'param'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[6] = {name: 'sendTimeStamp', params: [{name: 'deviceId'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[7] = {name: 'getMacAddress', params: [{name: 'deviceId'}], returns: {type: 'Promise<String>'}};
        this.desc.funcs[8] = {name: 'addWLANToPi', params: [{name: 'deviceId'}, {name: 'ssid'}, {name: 'password'}], returns: {type: 'Promise<Object>'}};
        this.desc.funcs[9] = {name: 'getDeviceId', desc: 'Returns the deviceId of the first connected device, or the first matching a name filter.', params: [{name: 'nameFilter', desc: 'Optional name substring to match (case-insensitive).'}], returns: {type: 'String|null'}};

        this.desc.events[0] = {name: 'swac_REQUESTOR_ID_bluetooth_connected', desc: 'Fired on successful connection.', data: 'event.detail = { deviceId, device }'};
        this.desc.events[1] = {name: 'swac_REQUESTOR_ID_bluetooth_disconnected', desc: 'Fired on disconnect.', data: 'event.detail = { deviceId }'};

        if (!options.plugins)
            this.options.plugins = new Map();

        this._connectedDevices = new Map();
        this._queues = new Map();
    }

    /**
     * Initialises the component, checks for Web Bluetooth support and binds the connect button.
     */
    async init() {
        let projectConf = window[this.requestor.id + '_conf_options'];
        if (projectConf) {
            Object.assign(this.options, projectConf);
            Msg.info('Bluetooth', 'Project config loaded from window["' + this.requestor.id + '_conf_options"].', this.requestor);
        }

        let minimal_Btn = this.requestor.querySelector('.swac_bluetooth_connect_minimal_btn');

        if (!navigator.bluetooth) {
            if (minimal_Btn) {
                minimal_Btn.innerText = 'No Bluetooth support';
                minimal_Btn.classList.remove("uk-button-primary");
                minimal_Btn.classList.add("uk-button-danger");
            }
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

    /**
     * Opens the browser BLE device picker, connects the selected device and registers it in the internal map.
     *
     * @returns {Promise<string|null>} The connected device ID, or null if the limit was already reached.
     */
    async connectDevice() {
        Msg.flow('Bluetooth', 'connectDevice()', this.requestor);

        let minimal_Btn = this.requestor.querySelector('.swac_bluetooth_connect_minimal_btn');

        // Minimal template always limits to one device
        if (minimal_Btn) {
            this.options.maxDevices = 1;
        }

        if (this.options.maxDevices > 0 && this._connectedDevices.size >= this.options.maxDevices) {
            let msg = 'Maximum number of devices (' + this.options.maxDevices + ') already connected.';
            Msg.warn('Bluetooth', msg, this.requestor);
            this._setStatus(msg, 'error');
            return null;
        }

        try {
            let requestConf = {};

            if (this.options.deviceNameSource) {
                let nameElem = document.querySelector(this.options.deviceNameSource);
                if (nameElem) {
                    let name = nameElem.children[0]?.innerHTML ?? nameElem.textContent.trim();
                    this.options.filterDevices = [{namePrefix: name}];
                } else {
                    Msg.error('CommandRouter', 'Device name element not found.', this.requestor);
                }
            }

            if (this.options.filterDevices && this.options.filterDevices.length > 0) {
                requestConf.filters = this.options.filterDevices;
            } else {
                requestConf.acceptAllDevices = true;
            }
            requestConf.optionalServices = ['generic_access', 'device_information', this.options.uartServiceUUID];

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

            this._connectedDevices.set(device.id, {device, server, name: device.name ?? device.id});
            // Start with an already-resolved promise as the initial empty queue
            this._queues.set(device.id, Promise.resolve());

            Msg.info('Bluetooth', 'Connected: ' + device.name + ' | Total: ' + this._connectedDevices.size, this.requestor);

            if (!minimal_Btn) {
                this._setStatus(this._connectedDevices.size + ' device(s) connected', 'connected');
                this._addDeviceCard(device.id, device.name ?? device.id);
            }

            await this._validateDeviceMac(device.id);

            document.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_connected', {
                detail: {deviceId: device.id, device}
            }));
            this.options.onConnected.call(this, device.id, device);

            if (minimal_Btn) {
                minimal_Btn.innerText = "verbunden";
                minimal_Btn.classList.remove("uk-button-primary");
                minimal_Btn.classList.remove("uk-button-danger");
                minimal_Btn.classList.add("uk-label-success");
            }

            return device.id;

        } catch (err) {
            if (minimal_Btn) {
                minimal_Btn.innerText = 'Fehler';
                minimal_Btn.classList.remove("uk-button-primary");
                minimal_Btn.classList.remove("uk-label-success");
                minimal_Btn.classList.add("uk-button-danger");
            }
            this._setStatus('Connection failed: ' + err.message, 'error');
            Msg.error('Bluetooth', 'Connection failed: ' + err.message, this.requestor);
            throw err;
        }
    }

    /**
     * Disconnects a single device by ID and triggers the internal handler if GATT is already down.
     *
     * @param {string} deviceId - The ID of the device to disconnect.
     */
    disconnectDevice(deviceId) {
        Msg.flow('Bluetooth', 'disconnectDevice() id=' + deviceId, this.requestor);
        let entry = this._connectedDevices.get(deviceId);
        if (entry && entry.device.gatt && entry.device.gatt.connected) {
            entry.device.gatt.disconnect();
        } else {
            this._onDisconnected(deviceId);
        }
    }

    /**
     * Disconnects all currently connected devices.
     */
    disconnectAll() {
        Msg.flow('Bluetooth', 'disconnectAll() - ' + this._connectedDevices.size + ' device(s)', this.requestor);
        for (let deviceId of Array.from(this._connectedDevices.keys())) {
            this.disconnectDevice(deviceId);
        }
    }

    /**
     * Returns an array of all currently connected device IDs.
     *
     * @returns {string[]} Array of device ID strings.
     */
    getConnectedDeviceIds() {
        return Array.from(this._connectedDevices.keys());
    }

    /**
     * Returns the display name of a connected device.
     *
     * @param {string} deviceId - The ID of the device to look up.
     * @returns {string|null} The device name, or null if not found.
     */
    getDeviceName(deviceId) {
        let entry = this._connectedDevices.get(deviceId);
        return entry ? entry.name : null;
    }

    /**
     * Returns the ID of the first connected device, or the first whose name matches the optional filter.
     *
     * @param {string|null} nameFilter - Optional case-insensitive substring to match against device names.
     * @returns {string|null} The matching device ID, or null if no device is connected or found.
     */
    getDeviceId(nameFilter = null) {
        if (this._connectedDevices.size === 0) {
            Msg.warn('Bluetooth', 'getDeviceId() called but no devices are connected.', this.requestor);
            return null;
        }

        if (!nameFilter) {
            return this._connectedDevices.keys().next().value;
        }

        const filter = nameFilter.toLowerCase();
        for (let [id, entry] of this._connectedDevices) {
            if (entry.name && entry.name.toLowerCase().includes(filter)) {
                return id;
            }
        }

        Msg.warn('Bluetooth', 'getDeviceId() no device found matching "' + nameFilter + '".', this.requestor);
        return null;
    }

    /**
     * Cleans up internal state after a device disconnects and fires the disconnect event.
     *
     * @param {string} deviceId - The ID of the device that disconnected.
     */
    _onDisconnected(deviceId) {
        let minimal_Btn = this.requestor.querySelector('.swac_bluetooth_connect_minimal_btn');
        if (minimal_Btn) {
            minimal_Btn.innerText = 'Getrennt';
            minimal_Btn.classList.remove("uk-button-danger");
            minimal_Btn.classList.remove("uk-label-success");
            minimal_Btn.classList.add("uk-button-primary");
        }

        let entry = this._connectedDevices.get(deviceId);
        let name = entry ? entry.name : deviceId;
        Msg.info('Bluetooth', 'Disconnected: ' + name, this.requestor);

        this._connectedDevices.delete(deviceId);
        this._queues.delete(deviceId);
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

    /**
     * Reads the stored MAC for a device and disconnects it if the live MAC does not match.
     *
     * @param {string} deviceId - The ID of the device to validate.
     * @returns {Promise<void>}
     */
    async _validateDeviceMac(deviceId) {
        let storageKey = this.options.deviceMismatchKey + '_' + deviceId;
        let storedMac = localStorage.getItem(storageKey);
        if (!storedMac)
            return;

        Msg.flow('Bluetooth', 'Validating MAC for ' + deviceId, this.requestor);
        const res = await this.getMacAddress(deviceId);
        let formattedMac = this._formatMac(res.records[0].mac);

        if (formattedMac !== storedMac) {
            Msg.warn('Bluetooth', 'MAC mismatch! Expected ' + storedMac + ', got ' + formattedMac, this.requestor);
            this.disconnectDevice(deviceId);
            throw new Error('deviceMismatch');
        }
        Msg.info('Bluetooth', 'MAC validated for ' + deviceId, this.requestor);
    }

    /**
     * Updates the status bar text and applies the matching CSS state class.
     *
     * @param {string} message - The text to display in the status bar.
     * @param {string} [state] - Optional state modifier: 'connected' or 'error'.
     */
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

    /**
     * Creates and appends a device card with all configured command sections to the device list.
     *
     * @param {string} deviceId   - The BLE device ID.
     * @param {string} deviceName - The display name shown in the card header.
     */
    _addDeviceCard(deviceId, deviceName) {
        let listElem = this.requestor.querySelector('.swac_bluetooth_device_list');
        if (!listElem)
            return;

        let shortId = deviceId.length > 20 ? deviceId.substring(0, 20) + '...' : deviceId;

        let card = document.createElement('li');
        card.classList.add('ble-device-card');
        card.setAttribute('swac_bluetooth_deviceid', deviceId);

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

        let cmdArea = document.createElement('div');
        cmdArea.classList.add('ble-commands');

        if (this.options.sections && this.options.sections.length > 0) {
            let responseLog = document.createElement('div');
            responseLog.classList.add('ble-response');

            for (let section of this.options.sections) {
                if (section.type === 'wlan') {
                    cmdArea.appendChild(this._buildWlanSection(deviceId, responseLog, section));
                } else {
                    cmdArea.appendChild(this._buildButtonSection(deviceId, section.title, section.buttons || [], responseLog));
                }
            }

            cmdArea.appendChild(responseLog);
        }

        card.appendChild(cmdArea);

        toggleBtn.addEventListener('click', () => {
            let collapsed = cmdArea.style.display === 'none';
            cmdArea.style.display = collapsed ? '' : 'none';
            toggleBtn.textContent = collapsed ? '▾' : '▸';
            toggleBtn.title = collapsed ? 'Collapse commands' : 'Expand commands';
        });

        // Hide the toggle arrow when there are no sections to collapse
        if (!this.options.sections || this.options.sections.length === 0) {
            toggleBtn.style.display = 'none';
        }

        listElem.appendChild(card);
    }

    /**
     * Builds a labelled group of command buttons for a single section config object.
     *
     * @param {string}      deviceId    - The target device ID.
     * @param {string}      title       - The section heading text.
     * @param {Object[]}    buttons     - Array of button definition objects.
     * @param {HTMLElement} responseLog - The shared response log element for this card.
     * @returns {HTMLElement} The section div containing the label and button grid.
     */
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

    /**
     * Creates a single command button that either invokes a named method or sends a BLE action on click.
     *
     * @param {string}      deviceId    - The target device ID.
     * @param {Object}      btnDef      - Button definition with icon, label, description, action and param.
     * @param {HTMLElement} responseLog - The shared response log element updated after each click.
     * @returns {HTMLElement} The configured button element.
     */
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
            btn.disabled = true;
            btn.style.opacity = '0.6';
            responseLog.className = 'ble-response ble-response-visible';
            responseLog.textContent = 'Waiting for response...';

            try {
                let result;
                // param '__method__' means call a named Bluetooth method instead of sendCommand
                if (btnDef.param === '__method__' && typeof this[btnDef.action] === 'function') {
                    result = await this[btnDef.action](deviceId);
                } else {
                    result = await this.sendCommand(deviceId, btnDef.action, btnDef.param ?? null);
                }
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
     * Builds a WLAN section containing a single button that opens the WLAN modal dialog on click.
     *
     * @param {string}      deviceId    - The target device ID.
     * @param {HTMLElement} responseLog - The shared response log element updated after each attempt.
     * @param {Object}      [sectionDef={}] - Optional section config with title, icon, label and description.
     * @returns {HTMLElement} The section div containing the WLAN button.
     */
    _buildWlanSection(deviceId, responseLog, sectionDef = {}) {
        let section = document.createElement('div');
        section.classList.add('ble-cmd-section');

        let label = document.createElement('div');
        label.classList.add('ble-commands-label');
        label.textContent = sectionDef.title || 'WLAN';
        section.appendChild(label);

        let wlanBtn = document.createElement('button');
        wlanBtn.classList.add('ble-cmd-btn');
        wlanBtn.innerHTML =
            '<span class="ble-cmd-icon">' + (sectionDef.icon || '📶') + '</span>' +
            '<span class="ble-cmd-name">' + (sectionDef.label || 'Add WLAN') + '</span>' +
            '<span class="ble-cmd-desc">' + (sectionDef.description || 'Configure WLAN on the Pi') + '</span>';

        wlanBtn.addEventListener('click', async () => {
            try {
                let {ssid, password} = await this._showWlanModal();

                wlanBtn.disabled = true;
                wlanBtn.style.opacity = '0.6';
                responseLog.className = 'ble-response ble-response-visible';
                responseLog.textContent = 'Waiting for response...';

                let result = await this.addWLANToPi(deviceId, ssid, password);
                responseLog.className = 'ble-response ble-response-visible ble-response-ok';
                responseLog.textContent = (sectionDef.label || 'Add WLAN') + ': ' + JSON.stringify(result, null, 2);
            } catch (e) {
                // Modal was cancelled — no error shown to the user
                if (e.message.includes('cancelled'))
                    return;
                responseLog.className = 'ble-response ble-response-visible ble-response-err';
                responseLog.textContent = e.message;
            } finally {
                wlanBtn.disabled = false;
                wlanBtn.style.opacity = '';
            }
        });

        section.appendChild(wlanBtn);
        return section;
    }

    /**
     * Fades out and removes the device card for the given device ID from the DOM.
     *
     * @param {string} deviceId - The ID of the device whose card should be removed.
     */
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

    /**
     * Public BLE communication entry point — queues the request so concurrent calls for the same device are serialised.
     *
     * @param {string} deviceId   - The ID of the target device.
     * @param {string} jsonString - The JSON payload to send.
     * @returns {Promise<Object>} The parsed response object from the Pi.
     */
    async communicateWithPi(deviceId, jsonString) {
        Msg.flow('Bluetooth', 'communicateWithPi() queuing for device=' + deviceId, this.requestor);

        let entry = this._connectedDevices.get(deviceId);
        if (!entry) {
            throw new Error('No device with id >' + deviceId + '< connected. Call connectDevice() first.');
        }

        // Append to the tail of the queue; run even if the previous request failed
        const result = this._queues.get(deviceId).then(
            () => this._doCommunicateWithPi(deviceId, jsonString),
            () => this._doCommunicateWithPi(deviceId, jsonString)
        );

        // Advance the queue pointer and swallow errors so the chain stays alive
        this._queues.set(deviceId, result.catch(() => {}));

        return result;
    }

    /**
     * Performs the actual BLE write and waits for the notify response, accumulating chunks until valid JSON arrives.
     *
     * @param {string} deviceId   - The ID of the target device.
     * @param {string} jsonString - The JSON payload to send.
     * @returns {Promise<Object>} The parsed response object from the Pi.
     */
    async _doCommunicateWithPi(deviceId, jsonString) {
        Msg.flow('Bluetooth', '_doCommunicateWithPi() device=' + deviceId, this.requestor);

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
                let accumulated = '';

                const handleNotification = (event) => {
                    const chunk = new TextDecoder().decode(event.target.value);
                    accumulated += chunk;
                    Msg.flow('Bluetooth', 'RX chunk <- ' + deviceId + ' (' + accumulated.length + ' bytes so far)', this.requestor);

                    try {
                        const parsed = JSON.parse(accumulated);
                        Msg.flow('Bluetooth', 'RX complete <- ' + deviceId + ': ' + accumulated, this.requestor);
                        notifyChar.removeEventListener('characteristicvaluechanged', handleNotification);
                        resolve(parsed);
                    } catch (err) {
                        // JSON is not yet complete — wait for the next chunk
                    }
                };

                notifyChar.addEventListener('characteristicvaluechanged', handleNotification);

                setTimeout(() => {
                    notifyChar.removeEventListener('characteristicvaluechanged', handleNotification);
                    if (accumulated.length > 0) {
                        reject(new Error('Timeout: Incomplete response from ' + deviceId +
                            ' after ' + this.options.communicationTimeout + 'ms (' +
                            accumulated.length + ' bytes received).'));
                    } else {
                        reject(new Error('Timeout: No response from ' + deviceId +
                            ' within ' + this.options.communicationTimeout + 'ms.'));
                    }
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

            // Parse errors and incomplete timeouts do not indicate a lost connection
            const isParseError = e.message && e.message.startsWith('Parse error');
            const isIncomplete = e.message && e.message.startsWith('Timeout: Incomplete');

            if (!isParseError && !isIncomplete) {
                let minimal_Btn = this.requestor.querySelector('.swac_bluetooth_connect_minimal_btn');
                if (minimal_Btn) {
                    minimal_Btn.innerText = 'Getrennt';
                    minimal_Btn.classList.remove("uk-button-danger");
                    minimal_Btn.classList.remove("uk-label-success");
                    minimal_Btn.classList.add("uk-button-primary");
                }
            }
            throw e;
        }
    }

    /**
     * Serialises a command and optional parameter into the Pi JSON protocol and sends it via BLE.
     *
     * @param {string} deviceId - The ID of the target device.
     * @param {string|Object} action - The Pi command string or object (e.g. {sendTimeStamp: '...'}).
     * @param {*} [param=null] - Optional parameter forwarded as content.param.
     * @returns {Promise<Object>} The parsed response object from the Pi.
     */
    async sendCommand(deviceId, action, param = null) {
        Msg.flow('Bluetooth', 'sendCommand() ' + deviceId + ' action=' + JSON.stringify(action), this.requestor);
        return await this.communicateWithPi(deviceId, JSON.stringify({
            type: 'request', status: null,
            content: {description: null, data: action, param: param}
        }));
    }

    /**
     * Builds a local-time timestamp string in YYYY-MM-DDTHH:MM:SS format from the current system clock.
     *
     * @returns {string} Local ISO-like timestamp string.
     */
    _buildLocalIsoTimestamp() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        // toISOString() is not used because it returns UTC rather than the local wall-clock time
        return now.getFullYear() + '-' +
            pad(now.getMonth() + 1) + '-' +
            pad(now.getDate()) + 'T' +
            pad(now.getHours()) + ':' +
            pad(now.getMinutes()) + ':' +
            pad(now.getSeconds());
    }

    /**
     * Sends the current local wall-clock time to the Pi so it can synchronise its system clock.
     *
     * @param {string} deviceId - The ID of the target device.
     * @returns {Promise<Object>} The parsed response object from the Pi.
     */
    async sendTimeStamp(deviceId) {
        const ts = this._buildLocalIsoTimestamp();
        Msg.flow('Bluetooth', 'sendTimeStamp() ts=' + ts, this.requestor);
        return await this.sendCommand(deviceId, {sendTimeStamp: ts});
    }

    /**
     * Requests the MAC address of the given device from the Pi.
     *
     * @param {string} deviceId - The ID of the target device.
     * @returns {Promise<Object>} The raw response object containing the MAC address.
     */
    async getMacAddress(deviceId) {
        const res = await this.sendCommand(deviceId, 'getMac');
        return res;
    }

    /**
     * Sends SSID and password to the Pi to configure a new WLAN connection.
     *
     * @param {string} deviceId  - The ID of the target device.
     * @param {string} ssid      - The WLAN network name.
     * @param {string} password  - The WLAN password.
     * @returns {Promise<Object>} The parsed response object from the Pi.
     */
    async addWLANToPi(deviceId, ssid, password) {
        return await this.sendCommand(deviceId, 'addWlan', {ssid, password});
    }

    /**
     * Normalises a MAC address string to the XX-XX-XX-XX-XX-XX uppercase format.
     *
     * @param {string} input - Raw MAC string with any separator style.
     * @returns {string} Formatted MAC address string.
     */
    _formatMac(input) {
        const clean = input.replace(/[-\s:]/g, '').toUpperCase();
        return clean.match(/.{1,2}/g)?.join('-') || '';
    }

    /**
     * Shows a modal dialog that collects SSID and password from the user.
     *
     * @returns {Promise<{ssid: string, password: string}>} Resolves with the entered credentials, or rejects if cancelled.
     */
    _showWlanModal() {
        return new Promise((resolve, reject) => {
            let overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 9999;
                background: rgba(0,0,0,0.5);
                display: flex; align-items: center; justify-content: center;
            `;

            let modal = document.createElement('div');
            modal.style.cssText = `
                background: #fff; border-radius: 12px; padding: 28px 32px;
                min-width: 320px; max-width: 420px; width: 90%;
                box-shadow: 0 8px 32px rgba(0,0,0,0.18);
                font-family: inherit;
            `;

            let title = document.createElement('h3');
            title.textContent = '📶 Add WLAN';
            title.style.cssText = 'margin: 0 0 20px 0; font-size: 1.1rem; color: #1a1a2e;';

            let ssidLabel = document.createElement('label');
            ssidLabel.textContent = 'WLAN Name (SSID)';
            ssidLabel.style.cssText = 'display: block; font-size: 0.85rem; color: #555; margin-bottom: 4px;';

            let ssidInput = document.createElement('input');
            ssidInput.type = 'text';
            ssidInput.placeholder = 'e.g. MyNetwork';
            ssidInput.style.cssText = `
                width: 100%; box-sizing: border-box; padding: 9px 12px;
                border: 1px solid #ccc; border-radius: 7px; font-size: 0.95rem;
                margin-bottom: 16px; outline: none;
            `;
            ssidInput.addEventListener('focus', () => ssidInput.style.borderColor = '#4a90e2');
            ssidInput.addEventListener('blur', () => ssidInput.style.borderColor = '#ccc');

            let pwLabel = document.createElement('label');
            pwLabel.textContent = 'Password';
            pwLabel.style.cssText = 'display: block; font-size: 0.85rem; color: #555; margin-bottom: 4px;';

            let pwRow = document.createElement('div');
            pwRow.style.cssText = 'display: flex; gap: 6px; margin-bottom: 24px;';

            let pwInput = document.createElement('input');
            pwInput.type = 'password';
            pwInput.placeholder = 'Enter password';
            pwInput.style.cssText = `
                flex: 1; padding: 9px 12px;
                border: 1px solid #ccc; border-radius: 7px; font-size: 0.95rem;
                outline: none;
            `;
            pwInput.addEventListener('focus', () => pwInput.style.borderColor = '#4a90e2');
            pwInput.addEventListener('blur', () => pwInput.style.borderColor = '#ccc');

            let pwToggle = document.createElement('button');
            pwToggle.textContent = '👁';
            pwToggle.title = 'Show password';
            pwToggle.style.cssText = `
                padding: 0 12px; border: 1px solid #ccc; border-radius: 7px;
                background: #f5f5f5; cursor: pointer; font-size: 1rem;
            `;
            pwToggle.addEventListener('click', () => {
                let show = pwInput.type === 'password';
                pwInput.type = show ? 'text' : 'password';
                pwToggle.textContent = show ? '🙈' : '👁';
            });

            pwRow.appendChild(pwInput);
            pwRow.appendChild(pwToggle);

            let errorMsg = document.createElement('div');
            errorMsg.style.cssText = `
                color: #e53e3e; font-size: 0.82rem;
                margin-bottom: 12px; display: none;
            `;

            let btnRow = document.createElement('div');
            btnRow.style.cssText = 'display: flex; gap: 10px; justify-content: flex-end;';

            let cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.cssText = `
                padding: 9px 20px; border: 1px solid #ccc; border-radius: 7px;
                background: #f5f5f5; cursor: pointer; font-size: 0.9rem;
            `;

            let confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Connect';
            confirmBtn.style.cssText = `
                padding: 9px 20px; border: none; border-radius: 7px;
                background: #4a90e2; color: #fff; cursor: pointer;
                font-size: 0.9rem; font-weight: 600;
            `;

            const close = () => document.body.removeChild(overlay);

            cancelBtn.addEventListener('click', () => {
                close();
                reject(new Error('doCommand() cancelled: WLAN modal dismissed.'));
            });

            // Clicking outside the modal box also cancels
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    close();
                    reject(new Error('doCommand() cancelled: WLAN modal dismissed.'));
                }
            });

            const confirm = () => {
                let ssid = ssidInput.value.trim();
                if (!ssid) {
                    errorMsg.textContent = 'Please enter a WLAN name.';
                    errorMsg.style.display = 'block';
                    ssidInput.focus();
                    return;
                }
                close();
                resolve({ssid, password: pwInput.value});
            };

            confirmBtn.addEventListener('click', confirm);
            // Enter in the SSID field moves focus to the password field
            ssidInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') pwInput.focus();
            });
            pwInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') confirm();
            });

            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(confirmBtn);

            modal.appendChild(title);
            modal.appendChild(ssidLabel);
            modal.appendChild(ssidInput);
            modal.appendChild(pwLabel);
            modal.appendChild(pwRow);
            modal.appendChild(errorMsg);
            modal.appendChild(btnRow);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            setTimeout(() => ssidInput.focus(), 50);
        });
    }

    /**
     * Returns true if at least one device is connected and ready to receive commands.
     *
     * @returns {boolean}
     */
    isCommandable() {
        if (this._connectedDevices.size === 0) {
            Msg.warn('Bluetooth', 'isCommandable() = false: no devices connected.', this.requestor);
            return false;
        }
        return true;
    }

    /**
     * Executes a command on a connected device, prompting the user to choose one if multiple devices are connected.
     *
     * @param {string} cmd       - The command name to execute (e.g. 'addWlan', 'getMac').
     * @param {*}      [params]  - Optional parameter forwarded with the command.
     * @returns {Promise<Object>} The parsed response object from the Pi.
     */
    doCommand(cmd, params = null) {
        Msg.flow('Bluetooth', 'doCommand() cmd=' + cmd, this.requestor);

        if (cmd === 'addWlan') {
            if (this._connectedDevices.size === 0) {
                return Promise.reject(new Error('No device connected.'));
            }
            const deviceId = this._connectedDevices.keys().next().value;
            return this._showWlanModal().then(({ssid, password}) => {
                Msg.info('Bluetooth', 'doCommand() -> sendCommand deviceId=' + deviceId + ' action=' + cmd, this.requestor);
                return this.sendCommand(deviceId, cmd, {ssid, password});
            });
        }

        // Try to match the command to a section button to inherit its preset param
        let matchedBtn = null;
        for (let section of this.options.sections) {
            if (section.buttons) {
                matchedBtn = section.buttons.find(b => b.action === cmd) ?? matchedBtn;
            }
        }
        if (!matchedBtn) {
            matchedBtn = {action: cmd, param: params};
        }

        let deviceId;
        if (this._connectedDevices.size === 1) {
            deviceId = this._connectedDevices.keys().next().value;
        } else {
            // Prompt the user to pick a device when more than one is connected
            let deviceOptions = [];
            let i = 1;
            for (let [id, entry] of this._connectedDevices) {
                deviceOptions.push(i + ': ' + entry.name + ' (' + id.substring(0, 10) + '...)');
                i++;
            }
            let choice = window.prompt(
                'Multiple devices connected. Choose a device:\n\n' + deviceOptions.join('\n'), '1'
            );
            if (!choice) {
                return Promise.reject(new Error('doCommand() cancelled: no device selected.'));
            }
            let idx = parseInt(choice) - 1;
            let ids = Array.from(this._connectedDevices.keys());
            if (idx < 0 || idx >= ids.length) {
                return Promise.reject(new Error('doCommand(): invalid device selection "' + choice + '"'));
            }
            deviceId = ids[idx];
        }

        let param = matchedBtn.param ?? null;
        Msg.info('Bluetooth', 'doCommand() -> sendCommand deviceId=' + deviceId + ' action=' + cmd, this.requestor);
        return this.sendCommand(deviceId, cmd, param);
    }
}