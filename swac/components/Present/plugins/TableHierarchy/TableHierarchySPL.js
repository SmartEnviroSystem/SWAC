import Plugin from '../../../../Plugin.js';
import SWAC from '../../../../swac.js';
import {buildHierarchy, matchesFilter} from './Hierarchy.js';

/** Collapsible row groups for table_for_all_datasets and compatible templates. */
export default class TableHierarchySPL extends Plugin {
    constructor(options = {}) {
        super(options);
        this.name = 'Present/plugins/TableHierarchy';
        this.desc.text = 'Groups related table rows below an expandable root row.';
        this.desc.opts.push(
            {name: 'relations', desc: 'Array of {parentId, childId} relationships.'},
            {name: 'loadRelations', desc: 'Optional async function returning relations; receives the Present component.'},
            {name: 'linear', desc: 'If true, branching components stay flat with a warning.'}
        );
        this.entries = new Map();
        this.tables = new Set();
        this.expanded = new Set();
        this.relations = [];
        this.sequence = 0;
    }

    async init() {
        const config = this.requestor.parent.swac_comp.options.plugins.get('TableHierarchy');
        this.settings = {...config, ...this.options};
        this.labels = SWAC.lang.dict['Present_TableHierarchy'] || {
            column: 'Related rows', expand: 'Show following rows', collapse: 'Hide following rows',
            invalid: 'Some relationships are invalid or reference missing rows. Affected rows remain visible.',
            loaderror: 'Relationships could not be loaded. All rows are shown separately.'
        };
        this.message = document.createElement('p');
        this.message.className = 'uk-alert-warning';
        this.message.setAttribute('role', 'status');
        this.message.hidden = true;
        this.requestor.parent.appendChild(this.message);
        await this.reloadRelations();
        // Also support activating the plugin after the component has loaded.
        for (const row of this.requestor.parent.querySelectorAll('tr.swac_repeatedForSet')) {
            if (row.swac_dataset)
                this.afterAddSet(row.swac_dataset, [row]);
        }
    }

    /** The page owns data loading and translates domain-specific relationships. */
    async reloadRelations() {
        try {
            const relations = this.settings.loadRelations
                ? await this.settings.loadRelations(this.requestor.parent.swac_comp)
                : (this.settings.relations || []);
            this.setRelations(relations);
        } catch (error) {
            this.loadError = true;
            this.relations = [];
            console.error('TableHierarchy: could not load relationships.', error);
            this.schedule();
        }
    }

    setRelations(relations) {
        if (!Array.isArray(relations) || relations.some(relation =>
            !relation || relation.parentId == null || relation.childId == null))
            throw new TypeError('TableHierarchy: expected an array of {parentId, childId}.');
        this.relations = relations;
        this.loadError = false;
        this.schedule();
    }

    afterAddSet(set, repeateds = []) {
        for (const row of repeateds) {
            if (row.tagName !== 'TR' || this.entries.has(row)) continue;
            const table = row.closest('table');
            if (!table) continue;
            this.entries.set(row, {set, table});
            set.addObserver?.(this);
            table.swac_tableHierarchy = this;
            if (!this.tables.has(table)) {
                // Handle sorting before per-header listeners can sort individual rows.
                table.addEventListener('click', event => {
                    const header = event.target.closest('th');
                    if (!header || header.closest('table') !== table
                            || event.target.closest('input, button, select, textarea')
                            || !header.classList.contains('swac_present_sort_un'))
                        return;
                    event.stopPropagation();
                    this.sort(header);
                }, true);
                this.tables.add(table);
            }
        }
        this.schedule();
    }

    afterRemoveSet(set) {
        for (const [row, entry] of this.entries) {
            if (entry.set === set) {
                row.querySelector('.swac_tablehierarchy_cell')?.remove();
                this.entries.delete(row);
            }
        }
        set.delObserver?.(this);
        this.schedule();
    }

    notifyChangedValue() { this.schedule(); }
    notifyAddedValue() { this.schedule(); }

    schedule() {
        if (this.scheduled) return;
        this.scheduled = true;
        queueMicrotask(() => {
            this.scheduled = false;
            this.render();
        });
    }

    /** Called by TableSort, keeping each group in its dependency order. */
    sort(th) {
        const table = th.closest('table');
        const descending = th.classList.contains('swac_present_sort_up');
        for (const header of table.querySelectorAll('th'))
            header.classList.remove('swac_present_sort_up', 'swac_present_sort_dw');
        th.classList.add(descending ? 'swac_present_sort_dw' : 'swac_present_sort_up');
        this.sorting = {table, th, descending};
        this.render();
    }

    /** Called by TableFilter; render evaluates every active column filter. */
    filter() { this.render(); }

    render() {
        const focused = document.activeElement;
        let invalid = false;
        for (const table of this.tables) {
            const entries = [...this.entries].filter(([row, entry]) =>
                entry.table === table && this.requestor.parent.contains(row));
            if (!entries.length) continue;
            const header = [...table.querySelectorAll('tr')].find(row =>
                row.closest('table') === table && row.querySelector('th'));
            if (!header) continue;
            if (!header.querySelector('.swac_tablehierarchy_header')) {
                const th = document.createElement('th');
                th.className = 'swac_tablehierarchy_header';
                th.scope = 'col';
                th.setAttribute('aria-label', this.labels.column);
                header.insertBefore(th, header.firstChild);
            }
            const byId = new Map(entries.map(([row, entry]) => [String(entry.set.id), row]));
            const {groups, issues} = buildHierarchy([...byId.keys()], this.relations, this.settings.linear);
            invalid ||= issues.length > 0;
            // Ambiguous duplicate IDs cannot be grouped safely, but remain visible.
            if (byId.size !== entries.length) {
                invalid = true;
                for (const [row] of entries) {
                    row.hidden = false;
                    row.querySelector('.swac_tablehierarchy_cell')?.replaceChildren();
                }
                continue;
            }
            for (const [row] of entries) {
                if (!row.id) {
                    let id;
                    do { id = this.requestor.parent.id + '_hierarchy_' + (++this.sequence); }
                    while (document.getElementById(id));
                    row.id = id;
                }
                if (!row.querySelector('.swac_tablehierarchy_cell')) {
                    const cell = document.createElement('td');
                    cell.className = 'swac_tablehierarchy_cell uk-text-nowrap';
                    row.insertBefore(cell, row.firstChild);
                }
            }
            const filters = [...header.querySelectorAll('input[swac_table_filter_attrname]')]
                .filter(input => input.value !== '');
            const matches = row => filters.every(input => {
                const attr = input.getAttribute('swac_table_filter_attrname');
                const field = [...row.querySelectorAll('[attrname]')].find(elem =>
                    elem.getAttribute('attrname') === attr);
                return matchesFilter(field?.textContent, input.value);
            });
            if (this.sorting?.table === table) {
                const {th, descending} = this.sorting;
                const index = [...th.parentElement.children].indexOf(th);
                const value = group => byId.get(group.root).children[index]?.textContent.trim() || '';
                const numeric = groups.every(group => value(group) !== '' && Number.isFinite(Number(value(group))));
                groups.sort((a, b) => (descending ? -1 : 1) * (numeric
                    ? Number(value(a)) - Number(value(b))
                    : value(a).localeCompare(value(b))));
            }
            for (const group of groups) {
                const root = byId.get(group.root);
                const hasChildren = group.members.length > 1;
                const filtered = filters.length > 0;
                const visible = !filtered || group.members.some(member => matches(byId.get(member.id)));
                const expanded = filtered || this.expanded.has(root);
                for (const member of group.members) {
                    const row = byId.get(member.id);
                    const cell = row.querySelector('.swac_tablehierarchy_cell');
                    cell.style.paddingLeft = (0.75 + Math.min(member.depth, 8) * 0.8) + 'rem';
                    if (member.depth === 0 && hasChildren) {
                        let button = cell.querySelector('button');
                        if (!button) {
                            button = document.createElement('button');
                            button.type = 'button';
                            button.className = 'uk-button uk-button-text';
                            button.addEventListener('click', () => {
                                if (this.expanded.has(root)) this.expanded.delete(root);
                                else this.expanded.add(root);
                                this.render();
                            });
                            cell.replaceChildren(button);
                        }
                        button.textContent = expanded ? '▼' : '▷';
                        button.title = expanded ? this.labels.collapse : this.labels.expand;
                        button.setAttribute('aria-label', button.title);
                        button.setAttribute('aria-expanded', String(expanded));
                        button.setAttribute('aria-controls', group.members.slice(1).map(child => byId.get(child.id).id).join(' '));
                        button.disabled = filtered;
                    } else {
                        cell.textContent = member.depth ? '↳' : '';
                    }
                    row.hidden = !visible || (member.depth > 0 && !expanded);
                    // Reorder original rows; callbacks and WatchableSet bindings stay intact.
                    row.parentElement.appendChild(row);
                }
            }
        }
        this.message.textContent = this.loadError ? this.labels.loaderror : (invalid ? this.labels.invalid : '');
        this.message.hidden = !this.message.textContent;
        // Moving rows can blur a keyboard-focused toggle in native browsers.
        if (focused && focused !== document.activeElement
                && this.requestor.parent.contains(focused) && !focused.closest('tr')?.hidden)
            focused.focus({preventScroll: true});
    }
}
