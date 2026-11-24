/** Build complete, ordered groups without modifying the original datasets.
 * Invalid components stay flat so cycles and ambiguous dependencies hide no rows.
 */
export function buildHierarchy(ids, relations, linear = false) {
    const keys = ids.map(String);
    const nodes = new Set(keys);
    const children = new Map(keys.map(id => [id, new Set()]));
    const parents = new Map(keys.map(id => [id, new Set()]));
    const issues = [];
    for (const relation of relations) {
        const parent = String(relation.parentId);
        const child = String(relation.childId);
        if (!nodes.has(parent) || !nodes.has(child)) {
            issues.push({type: 'missing', ids: [parent, child]});
            continue;
        }
        children.get(parent).add(child);
        parents.get(child).add(parent);
    }
    const groups = [];
    const visited = new Set();
    for (const id of keys) {
        if (visited.has(id))
            continue;
        const component = [];
        const pending = [id];
        visited.add(id);
        for (let i = 0; i < pending.length; i++) {
            const current = pending[i];
            component.push(current);
            for (const next of [...children.get(current), ...parents.get(current)]) {
                if (!visited.has(next)) {
                    visited.add(next);
                    pending.push(next);
                }
            }
        }
        const roots = component.filter(key => parents.get(key).size === 0);
        const ambiguous = component.some(key => parents.get(key).size > 1
            || (linear && children.get(key).size > 1));
        const members = [];
        const ordered = roots.map(key => ({id: key, depth: 0}));
        const emitted = new Set();
        // Iterative traversal also handles long chains without stack overflow.
        while (ordered.length) {
            const entry = ordered.pop();
            if (emitted.has(entry.id))
                continue;
            emitted.add(entry.id);
            members.push(entry);
            const next = [...children.get(entry.id)].reverse();
            for (const child of next)
                ordered.push({id: child, depth: entry.depth + 1});
        }
        if (ambiguous || roots.length !== 1 || members.length !== component.length) {
            issues.push({type: ambiguous ? 'ambiguous' : 'cycle', ids: component});
            for (const key of component)
                groups.push({root: key, members: [{id: key, depth: 0}]});
        } else {
            groups.push({root: roots[0], members});
        }
    }
    return {groups, issues};
}

/** Same expressions as TableFilter; multiple columns are combined with AND. */
export function matchesFilter(value, expression) {
    const text = String(value ?? '');
    if (expression.startsWith('^=')) return text.startsWith(expression.slice(2));
    if (expression.startsWith('$=')) return text.endsWith(expression.slice(2));
    if (expression.startsWith('*=')) return text.includes(expression.slice(2));
    return text === (expression.startsWith('=') ? expression.slice(1) : expression);
}
