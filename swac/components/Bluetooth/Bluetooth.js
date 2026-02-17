import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';

/**
 * Sample component for development of own components
 */
export default class Bluetooth extends View {

    /*
     * Constructs a new component object and transfers the config to the
     * object
     */
    constructor(options = {}) {
        super(options);
        this.name = 'Bluetooth';
        this.desc.text = 'Component for discovering and useing bluetooth devices.';
        this.desc.developers = 'Florian Fehring (HSBI)';
        this.desc.license = 'GNU Lesser General Public License';

        // Include an external library that does not use export
        // Include files that use export by import statement at start of the file
        this.desc.depends[0] = {
            name: 'dependency.js',
            path: SWAC.config.swac_root + 'components/Sample/libs/dependency.js',
            desc: 'Description for what the file is required.',
            loadon: this.options.loaddependency     // Only load if this evaluates to true or is complely missing
        };
//        this.desc.depends[1] = {
//            name: 'NameOfTheAlgorithmComponent',
//            algorithm: 'NameOfTheAlgorithmComponent',
//            desc: 'Description why this algorithm is needed.'
//        };
        this.desc.templates[0] = {
            name: 'default',
            desc: 'Basic default template for BLE connections.'
        };
        this.desc.styles[0] = {
            selc: 'cssSelectorForTheStyle',
            desc: 'Description of the provided style.'
        };
        this.desc.reqPerTpl[0] = {
            selc: 'cssSelectorForRequiredElement',
            desc: 'Description why the element is expected in the template'
        };
        this.desc.optPerTpl[0] = {
            selc: 'cssSelectorForOptionalElement',
            desc: 'Description what is the expected effect, when this element is in the template.'
        };
        this.desc.optPerPage[0] = {
            selc: 'cssSelectorForOptionalElement',
            desc: 'Description what the component does with the element if its there.'
        };
        this.desc.reqPerSet[0] = {
            name: 'id',
            desc: 'The attribute id is required for the component to work properly.'
        };
        this.desc.optPerSet[0] = {
            name: 'nameOfTheAttributeOptionalInEachSet',
            desc: 'Description what is the expected effect, when this attribute is in the set.'
        };
        // opts ids over 1000 are reserved for Component independend options
        this.desc.opts[0] = {
            name: "filterDevices",
            desc: "An array of names of accepted devices. If option is null, all devices are accepted."
        };
        // Setting a default value, only applying when the options parameter does not contain this option
        if (!options.filterDevices)
            this.options.filterDevices = null;

        if (!options.showWhenNoData)
            this.options.showWhenNoData = true;
        // function ids over 1000 are reserved for Component independend functions
        this.desc.funcs[0] = {
            name: 'name of the function',
            desc: 'Functions description',
            params: [
                {
                    name: 'name of the parameter',
                    desc: 'Description of the parameter'
                }
            ],
            returns: {
                desc: 'Describes the return value and the expected datatype.',
                type: 'String'
            }
        };

        //Documentation for events the component can fire
        this.desc.events[0] = {
            name: 'swac_REQUESTOR_ID_sample_click',
            desc: 'An event fired when the user clicks on the component.',
            data: 'Delivers the JS event object of the click event.'
        }

        // Definition of available plugins
        if (!options.plugins) {
            this.options.plugins = new Map();
        }

        // Internal variabled
        this.connectedDevices = new Map()
    }

    async init() {
        if (!navigator.bluetooth) {
            this.requestor.innerHTML = SWAC.lang.dict.Bluetooth.ble_not_avail;
            Msg.error('Bluetooth', "Web Bluetooth is not supported", this.requestor);
            resolve();
            return;
        } else {
            Msg.info('Bluetooth', 'Web Bluetooth is supported', this.requestor);
        }

        // Register event handler on connect button
        let connectBtn = this.requestor.querySelector('.swac_bluetooth_connect_btn');
        connectBtn.addEventListener('click', this.connectDevice.bind(this));
    }

    /**
     * Method thats called before adding a dataset
     * This overrides the method from View.js
     * 
     * @param {Object} set Object with attributes to add
     * @returns {Object} (modified) set
     */
    beforeAddSet(set) {
        // You can check or transform the dataset here
        return set;
    }

    /**
     * Method thats called after a dataset was added.
     * This overrides the method from View.js
     * 
     * @param {Object} set Object with attributes to add
     * @param {DOMElement[]} repeateds Elements that where created as representation for the set
     * @returns {undefined}
     */
    afterAddSet(set, repeateds) {
        // You can do after adding actions here. At this timepoint the template
        // repeatForSet is also repeated and accessable.
        // e.g. generate a custom view for the data.

        // Call Components afterAddSet and plugins afterAddSet
        super.afterAddSet(set, repeateds);

        return;
    }

    /**
     * Try to connect to a device
     */
    async connectDevice() {
        Msg.flow('Bluetooth', "connectDevice()", this.requestor);
        try {
            // Build request configuration
            let requestConf = {};
            if (this.options.filterDevices != null) {
                requestConf.filters = this.options.filterDevices;
            } else {
                requestConf.acceptAllDevices = true;
            }

            requestConf.optionalServices = ['generic_access', 'device_information', '6e400001-b5a3-f393-e0a9-e50e24dcca9e'];

            Msg.flow('Bluetooth', "Try to establish BLE connection.", this.requestor);
            let device = await navigator.bluetooth.requestDevice(requestConf);
            Msg.flow('Bluetooth', 'Device selected', this.requestor);
            device.addEventListener("gattserverdisconnected", this.onDisconnected);
            Msg.flow('Bluetooth', 'Connect to GATT-Server', this.requestor);
            let server = await device.gatt.connect();
            Msg.flow('Bluetooth', 'Succsessfull connected', this.requestor);

            /*
             // Sendet bei erfolgreicher BLE Verbindung die aktuelle Uhrzeit + Datum an den Sensor Pi
             console.log("Übergebe TimeStamp...")
             const response = await sendTimeStamp();
             if (response.status === 200 || response.status === "200") {
             console.log("Timestamp erfolgreich übergeben. Pi response Objekt: " + response);
             } else {
             console.log("Fehler bei Timestamp Übergabe. Pi response Objekt: " + response);
             }
             */

            this.connectedDevices.set(device.id, device);
            console.log("Device Id:" + device.id);
//            localStorage.setItem('lastDeviceId', device.id);

        } catch (err) {
            console.error("Fehler beim Verbinden:", err.message);
            throw err; // Fehler weiterwerfen, damit devicelogin.js ihn fangen kann
        }
    }

    onDisconnected(evt) {
        Msg.info('Bluetooth', 'Device disconected.', this.requestor);
        console.log('TEST disconnect evt: ', evt);
    }
}


