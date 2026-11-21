/**
 * Frontend-only draft API adapter.
 * This deliberately does NOT call SmartDataJobs execution endpoints and it does
 * NOT claim to implement the group's PipelineExecution backend contract.
 */
const clone = value => JSON.parse(JSON.stringify(value));

export function createPipelineDraft(tree) {
    if (!tree || !tree.data) throw new Error('Keine Pipeline ausgewählt.');
    const p = tree.data;
    const filterSteps = [
        { period: p.period || '7 Tage', filter: p.filter || {} },
        ...(p.extraFilters || [])
    ];
    const scripts = [p, ...(p.extraScripts || [])];
    let order = 0;
    const step = (type, config) => ({ order: ++order, type, config: clone(config) });
    const items = [step('source', { collection: p.source || '' })];
    const { configured = false, ...consolidationConfig } = p.consolidation || {};
    items.push(step('consolidation', { enabled: Boolean(configured), ...consolidationConfig }));
    for (const entry of filterSteps) {
        items.push(step('filter', {
            period: entry.period || '7 Tage',
            column: entry.filter?.column || '',
            operator: entry.filter?.operator || 'gt',
            value: entry.filter?.value == null ? '' : String(entry.filter.value),
            enabled: Boolean(entry.filter?.enabled)
        }));
    }
    for (const entry of scripts) {
        items.push(step('script', {
            mode: entry.scriptType || 'predefined',
            script: entry.script || '',
            job_id: entry.scriptType === 'job' ? (entry.jobId ?? null) : null,
            parameter: entry.scriptType === 'job' ? '' : (entry.parameter || '')
            // No Python source code and no job secrets in this draft payload.
        }));
    }
    items.push(step('target', {
        collection: p.target || '',
        format: p.targetConfig?.format || 'table',
        write_mode: p.targetConfig?.writeMode || 'replace',
        include_timestamp: p.targetConfig?.includeTimestamp !== false
    }));
    return {
        schema_version: 'frontend-draft-2',
        pipeline_id: tree.id,
        name: tree.name,
        steps: items
    };
}

/** Only localhost explicit mock endpoint or same origin; no automatic live API calls. */
export async function postPipelineDraft(endpoint, payload, fetchImpl = fetch) {
    if (!endpoint || typeof endpoint !== 'string') {
        throw new Error('Backend-Endpunkt fehlt.');
    }
    const here = typeof window !== 'undefined' && window.location
        ? window.location.origin : 'http://localhost:8080';
    let url;
    try { url = new URL(endpoint, here); }
    catch { throw new Error('Ungültige Backend-URL.'); }
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    const sameOrigin = url.origin === here;
    if (!['http:', 'https:'].includes(url.protocol) || (!local && !sameOrigin)) {
        throw new Error('Nur gleiche Origin oder localhost für diesen Test erlaubt.');
    }
    if (/(?:\/startOnce|\/start|\/execute)(?:\/?|\?)/i.test(url.pathname)) {
        throw new Error('Job-Ausführungsendpunkte sind für diesen Test nicht erlaubt.');
    }
    if (!payload || payload.schema_version !== 'frontend-draft-2' || !Array.isArray(payload.steps)) {
        throw new Error('Ungültige Pipeline-Konfiguration.');
    }
    const response = await fetchImpl(url.href, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: sameOrigin ? 'same-origin' : 'omit'
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { data = { message: raw.slice(0, 200) }; }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.error || data.message || 'Unbekannter Fehler'}`);
    return data;
}
