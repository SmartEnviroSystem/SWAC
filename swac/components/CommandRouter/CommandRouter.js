import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';

export default class CommandRouter extends View {

    constructor(options = {}) {
        super(options);
        this.name = 'CommandRouter';
        this.desc.text = 'Routes commands depending on availablility of other components.';
        this.desc.developers = 'Florian Fehring (HSBI)';
        this.desc.license = 'GNU Lesser General Public License';

        this.desc.templates[0] = {
            name: 'default',
            desc: 'Default template.'
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

        if (!options.showWhenNoData)
            this.options.showWhenNoData = true;

        //Documentation for events the component can fire
        this.desc.events[0] = {
            name: 'swac_REQUESTOR_ID_commandrouter_exwecuted',
            desc: 'Fired when a command was succsessfull executed.',
            data: 'Fields >comp< with component and >result< with returend result.'
        }

        // internal attributes
        this.comps = [];
    }

    /*
     * This method will be called when the component is complete loaded
     * At this thime the template code is loaded, the data inserted into the 
     * template and even plugins are ready to use.
     */
    async init() {
        document.addEventListener('swac_components_complete', this.bindCommands.bind(this));
    }

    /**
     * Seach gui elements that activate commands and bind events
     */
    bindCommands(evt) {
        Msg.flow('CommandRouter', 'bindCommands()', this.requestor);
        let cmdElems = document.querySelectorAll('[cmd]');
        for (let curCmdElem of cmdElems) {
            curCmdElem.addEventListener('click', this.executeCommand.bind(this));
        }
        // Search components
        if (this.options.components && this.options.components.length > 0) {
            for (let curCompId of this.options.components) {
                let curComp = document.querySelector('.' + curCompId);
                if (!curComp) {
                    Msg.error('CommandRouter', 'Component with id >' + curCompId + '< not found.');
                }
                this.comps.push(curComp);
            }
        } else {
            // Use all components on page
            this.comps = document.querySelectorAll('[swa]');
        }
    }

    /**
     * Execute commands on components where possible
     */
    executeCommand(evt) {
        Msg.flow('CommandRouter', 'executeCommand()', this.requestor);

        // Get command for execution
        let cmd = evt.target.getAttribute('cmd');
        // Check on every component
        for (let curComp of this.comps) {
            // Check if component is currently able to process commands
            if (typeof curComp.swac_comp.isCommandable === 'function') {
                if (!curComp.swac_comp.isCommandable()) {
                    Msg.warn('CommandRouter', 'Component ' + curComp.id + ' currently does not accept comands.', this.response);
                    continue;
                }
                // Execute command
                try {
                    let res = curComp.swac_comp.doCommand(cmd);
                    Msg.info('CommandRouter', 'Command >' + cmd + '< on component >' + curComp.id + '< executed with result: ' + res);

                    // Dispatch command executed event
                    document.dispatchEvent(new CustomEvent('swac_' + this.requestor.id + '_commandrouter_executed', {detail: {
                            'comp': curComp,
                            'result': res
                        }}))

                } catch (e) {
                    Msg.error('CommandRouter', 'Command >' + cmd + '< on component >' + curComp.id + '< threw error: ' + e, this.requestor);
                }
            } else {
                Msg.warn('CommandRouter', 'Component ' + curComp.id + ' does not support commandable.', this.requestor);
            }
        }
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
}


