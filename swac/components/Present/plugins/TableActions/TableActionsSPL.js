import Plugin from '../../../../Plugin.js';
import SWAC from '../../../../swac.js';

/** Icon-only actions for Present's table_for_all_datasets template. */
export default class TableActionsSPL extends Plugin {

    constructor(options = {}) {
        super(options);
        this.name = 'Present/plugins/TableActions';
        this.desc.text = 'Adds configurable icon buttons to each table row.';
        this.desc.opts.push({
            name: 'actions',
            desc: 'Array of {id, icon, title, onClick}. onClick receives the dataset id.'
        });
        this.rowIds = new WeakMap();
        this.nextRowId = 0;
    }

    init() {
        // PluginHandler loads plugin options separately. Also accept configuration
        // directly in Present's plugins Map so callbacks can stay beside it.
        const config = this.requestor.parent.swac_comp.options.plugins.get('TableActions');
        this.actions = this.options.actions ?? config?.actions ?? [];
        if (!Array.isArray(this.actions)) {
            throw new TypeError('TableActions: actions must be an array.');
        }
        for (const action of this.actions) {
            if (!action || typeof action.id !== 'string' || !action.id.trim()
                    || /\s/.test(action.id) || typeof action.icon !== 'string'
                    || !action.icon.trim() || typeof action.title !== 'string'
                    || !action.title.trim() || typeof action.onClick !== 'function') {
                throw new TypeError('TableActions: each action needs id (without whitespace), icon, title and an onClick function.');
            }
        }
        return Promise.resolve();
    }

    afterAddSet(set, repeateds = []) {
        if (!this.actions?.length)
            return;
        for (const row of repeateds) {
            if (row.tagName !== 'TR' || row.querySelector('.swac_tableactions_cell'))
                continue;
            const table = row.closest('table');
            if (!table)
                continue;
            const header = Array.from(table.rows).find(candidate =>
                candidate.closest('table') === table && candidate.querySelector('th'));
            if (header && !header.querySelector('.swac_tableactions_header')) {
                const heading = document.createElement('th');
                heading.className = 'swac_tableactions_header';
                heading.scope = 'col';
                // Keep the heading empty so TableSort/TableFilter skip it.
                heading.setAttribute('aria-label', SWAC.lang.dict['Present_TableActions']?.actions || 'Actions');
                header.appendChild(heading);
            }
            if (!this.rowIds.has(row))
                this.rowIds.set(row, ++this.nextRowId);
            const datasetId = set.id ?? this.rowIds.get(row);
            const cell = document.createElement('td');
            cell.className = 'swac_tableactions_cell uk-text-nowrap';
            for (const action of this.actions) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'swac_tableactions_button uk-icon-button uk-margin-small-right';
                const baseId = action.id + '_' + datasetId;
                let id = baseId;
                let suffix = 1;
                while (document.getElementById(id))
                    id = baseId + '_' + (++suffix);
                button.id = id;
                button.title = action.title;
                button.setAttribute('aria-label', action.title);
                const icon = document.createElement('span');
                icon.setAttribute('uk-icon', 'icon: ' + action.icon);
                icon.setAttribute('aria-hidden', 'true');
                button.appendChild(icon);
                button.addEventListener('click', () => action.onClick(set.id ?? this.rowIds.get(row)));
                cell.appendChild(button);
                // Attach immediately so duplicate prefixes also get unique IDs.
                row.appendChild(cell);
            }
        }
    }
}
