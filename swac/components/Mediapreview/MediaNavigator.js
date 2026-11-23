import Model from '../../Model.js';
import Msg from '../../Msg.js';

/**
 * Navigation through the datasets of a component's data source, page by page.
 * Has no own display: the component shows the sets this class delivers.
 *
 * Pages are loaded relative to a shown set (cursor) with filters like
 * ts,gt,<time> or id,gt,<id>. The WHERE clause of the component is kept.
 * Sources that ignore filters and order (like static json files) are
 * supported, because every result is filtered, sorted and cut again on the
 * client.
 *
 * Datasets without timestamp:
 * - all sets have a timestamp: navigation by timestamp
 * - no set has a timestamp: navigation by id
 * - mixed: navigation by timestamp, the sets without timestamp can be shown
 *   separately (withoutTs = true), there navigation is by id
 */
export default class MediaNavigator {

    /**
     * Creates a navigator for the data source of a component
     *
     * @param {Component} comp Component whose data source should be navigated
     * @param {Object} options Navigation options
     * @param {String} options.tsAttr Name of the attribute with the timestamp
     * @param {String} options.orderAttr Attribute to navigate by, 'auto' detects ts or id
     * @param {Number} options.pageSize Number of sets per page
     * @param {Object} options.fromWheres WHERE clause of the component that should be kept
     */
    constructor(comp, options) {
        this.comp = comp;
        this.tsAttr = options.tsAttr;
        this.orderAttr = options.orderAttr;
        this.pageSize = options.pageSize;
        this.fromWheres = Object.assign({}, options.fromWheres);
        // 'ts' (all sets have a timestamp), 'id' (no set has one), 'mixed' or 'attr' (orderAttr is set)
        this.mode = null;
        // Only sets without timestamp are navigated (mixed mode)
        this.withoutTs = false;
        // Number of sets without timestamp, null if unknown
        this.withoutTsCount = null;
        // Number of sets that can be navigated, null if unknown
        this.total = null;
    }

    /**
     * Detects if the sets have timestamps. Must be called before loading pages.
     *
     * @returns {Promise<String>} Detected mode: ts, id, mixed or attr
     */
    async detect() {
        if (this.orderAttr !== 'auto') {
            this.mode = this.orderAttr === 'id' ? 'id' : 'attr';
            return this.mode;
        }
        let withTs = await this.request([this.tsAttr + ',nis'], 'id,asc', 1);
        // A source that delivers more than requested ignores the filters, so all sets are known
        let all = withTs.length > 1 ? withTs : null;
        let hasTs, hasNoTs;
        if (all) {
            hasTs = all.some(curSet => this.hasTs(curSet));
            this.withoutTsCount = all.filter(curSet => !this.hasTs(curSet)).length;
            hasNoTs = this.withoutTsCount > 0;
        } else {
            hasTs = withTs.some(curSet => this.hasTs(curSet));
            let withoutTs = await this.request([this.tsAttr + ',is'], 'id,asc', 1);
            hasNoTs = withoutTs.some(curSet => !this.hasTs(curSet));
        }
        if (hasTs && hasNoTs)
            this.mode = 'mixed';
        else if (hasTs)
            this.mode = 'ts';
        else
            this.mode = 'id';
        Msg.flow('MediaNavigator', 'Navigation mode >' + this.mode + '< detected.', this.comp.requestor);
        return this.mode;
    }

    /**
     * Gets the attribute that is used for ordering and navigation
     *
     * @returns {String} Attribute name
     */
    getAttr() {
        if (this.mode === 'attr')
            return this.orderAttr;
        if (this.mode === 'id' || this.withoutTs)
            return 'id';
        return this.tsAttr;
    }

    /**
     * Loads a page of sets
     *
     * @param {Number} direction 1 for sets after the reference set, -1 for sets before it
     * @param {WatchableSet} refSet Reference set, null for the first (1) or last (-1) page
     * @param {Boolean} inclusive If true, the page begins with the reference set itself
     * @returns {Promise<Object>} {sets: sets ordered ascending, more: true if there are further sets in this direction}
     */
    async loadPage(direction, refSet = null, inclusive = false) {
        let attr = this.getAttr();
        let filters = this.getModeFilters();
        if (refSet)
            filters.push(this.getCursorFilter(attr, direction, refSet, inclusive));
        // Two more sets than needed: the reference set can be delivered again
        // (filters use whole seconds) and one more shows if there are further sets
        let sets = await this.request(filters, attr + (direction > 0 ? ',asc' : ',desc'), this.pageSize + 2);

        // Check again, because sources like static files ignore filters
        sets = sets.filter(curSet => this.matchesMode(curSet));
        // A source that delivers more than requested ignores the filters, so all sets are known
        if (sets.length > this.pageSize + 2)
            this.total = sets.length;
        if (refSet)
            sets = sets.filter(curSet => direction * this.compare(curSet, refSet) > (inclusive ? -1 : 0));
        sets.sort((a, b) => this.compare(a, b));

        let more = sets.length > this.pageSize;
        sets = direction > 0 ? sets.slice(0, this.pageSize) : sets.slice(-this.pageSize);
        return {sets: sets, more: more};
    }

    /**
     * Loads the number of sets that can be navigated
     *
     * @param {Boolean} withoutTs Count the sets without timestamp (mixed mode)
     * @returns {Promise<Number>} Number of sets or null if the source can not count
     */
    async loadTotal(withoutTs = this.withoutTs) {
        let sets = await this.request(this.getModeFilters(withoutTs), 'id,asc', 1, {countonly: 'true'});
        // A source that ignores countonly delivers the sets themselves
        if (sets.length > 1)
            return sets.filter(curSet => this.matchesMode(curSet, withoutTs)).length;
        if (sets.length === 1 && typeof sets[0].count === 'number' && sets[0][this.tsAttr] === undefined)
            return sets[0].count;
        return null;
    }

    /**
     * Loads the time of the first and the last set. Only available when
     * navigating by timestamp.
     *
     * @returns {Promise<Object>} {start, end} in milliseconds or null if not available
     */
    async loadRange() {
        if (this.getAttr() !== this.tsAttr)
            return null;
        let filters = this.getModeFilters();
        let sets = await this.request(filters, this.tsAttr + ',asc', 1);
        // A source that delivers more than requested ignores the filters, so all sets are known
        if (sets.length <= 1)
            sets = sets.concat(await this.request(filters, this.tsAttr + ',desc', 1));
        let start = null;
        let end = null;
        for (let curSet of sets) {
            if (!this.matchesMode(curSet))
                continue;
            let time = this.getDate(curSet).getTime();
            if (start === null || time < start)
                start = time;
            if (end === null || time > end)
                end = time;
        }
        return start === null ? null : {start: start, end: end};
    }

    /**
     * Gets the filters that select the sets of the current mode
     *
     * @param {Boolean} withoutTs Filters for the sets without timestamp (mixed mode)
     * @returns {String[]} Filters
     */
    getModeFilters(withoutTs = this.withoutTs) {
        if (this.mode === 'mixed')
            return [this.tsAttr + (withoutTs ? ',is' : ',nis')];
        if (this.mode === 'attr' && this.orderAttr !== 'id')
            return [this.orderAttr + ',nis'];
        return [];
    }

    /**
     * Checks if a set belongs to the current mode
     *
     * @param {WatchableSet} set Set to check
     * @param {Boolean} withoutTs Check for the sets without timestamp (mixed mode)
     * @returns {Boolean} True if the set can be navigated in the current mode
     */
    matchesMode(set, withoutTs = this.withoutTs) {
        if (this.mode === 'mixed')
            return withoutTs ? !this.hasTs(set) : this.hasTs(set);
        if (this.mode === 'ts')
            return this.hasTs(set);
        if (this.mode === 'attr')
            return set[this.orderAttr] !== undefined && set[this.orderAttr] !== null;
        return true;
    }

    /**
     * Creates the filter for the sets before or after a set
     *
     * @param {String} attr Attribute to navigate by
     * @param {Number} direction 1 for sets after, -1 for sets before
     * @param {WatchableSet} refSet Reference set
     * @param {Boolean} inclusive If true, the reference set itself is included
     * @returns {String} Filter like ts,gt,2026-01-03T10:15:00
     */
    getCursorFilter(attr, direction, refSet, inclusive = false) {
        let value = refSet[attr];
        if (attr === this.tsAttr) {
            let date = this.getDate(refSet);
            // Filters use whole seconds, so round outwards and check exactly on the client
            let seconds = Math.floor(date.getTime() / 1000) + (direction < 0 && date.getMilliseconds() > 0 ? 1 : 0);
            value = this.formatDate(new Date(seconds * 1000));
        }
        let operator = direction > 0 ? (inclusive ? 'ge' : 'gt') : (inclusive ? 'le' : 'lt');
        return attr + ',' + operator + ',' + value;
    }

    /**
     * Requests sets from the data source of the component. The WHERE clause
     * of the component is kept, except order, size and page.
     *
     * @param {String[]} filters Additional filters
     * @param {String} order Order like ts,asc
     * @param {Number} size Maximum number of sets
     * @param {Object} extraWheres Further parameters like {countonly: 'true'}
     * @returns {Promise<WatchableSet[]>} Delivered sets
     */
    async request(filters, order, size, extraWheres = {}) {
        let fromWheres = {};
        for (let curWhere in this.fromWheres) {
            if (!['filter', 'order', 'size', 'page'].includes(curWhere))
                fromWheres[curWhere] = this.fromWheres[curWhere];
        }
        let allFilters = this.fromWheres.filter ? this.fromWheres.filter.split('&filter=') : [];
        allFilters = allFilters.concat(filters);
        if (allFilters.length > 0)
            fromWheres.filter = allFilters.join('&filter=');
        fromWheres.order = order;
        fromWheres.size = size;
        Object.assign(fromWheres, extraWheres);

        let dataRequest = {
            fromName: this.comp.requestor.fromName,
            fromWheres: fromWheres
        };
        // requestId is calculated synchronous by Model.load
        let data = await Model.load(dataRequest);
        // The store can contain sets of earlier requests too
        return Array.from(data).filter(curSet => curSet && curSet.swac_dataRequest
                    && curSet.swac_dataRequest.requestId === dataRequest.requestId);
    }

    /**
     * Compares two sets by the navigation attribute
     *
     * @param {WatchableSet} a First set
     * @param {WatchableSet} b Second set
     * @returns {Number} Negative if a is before b, positive if after, 0 if equal
     */
    compare(a, b) {
        let keyA = this.getKey(a);
        let keyB = this.getKey(b);
        if (typeof keyA === 'number' && typeof keyB === 'number')
            return keyA - keyB;
        return String(keyA).localeCompare(String(keyB));
    }

    /**
     * Gets the value used for ordering a set
     *
     * @param {WatchableSet} set Set
     * @returns {Number|String} Time in milliseconds, number or text
     */
    getKey(set) {
        let attr = this.getAttr();
        if (attr === this.tsAttr) {
            let date = this.getDate(set);
            return date ? date.getTime() : NaN;
        }
        let value = set[attr];
        return value !== '' && !isNaN(value) ? Number(value) : value;
    }

    /**
     * Checks if a set has a valid timestamp
     *
     * @param {WatchableSet} set Set to check
     * @returns {Boolean} True if the timestamp can be read
     */
    hasTs(set) {
        return this.getDate(set) !== null;
    }

    /**
     * Gets the timestamp of a set
     *
     * @param {WatchableSet} set Set
     * @returns {Date} Timestamp or null if there is none
     */
    getDate(set) {
        let ts = set[this.tsAttr];
        if (!ts)
            return null;
        let date = new Date(typeof ts === 'string' ? ts.replace(' ', 'T') : ts);
        return isNaN(date.valueOf()) ? null : date;
    }

    /**
     * Formats a date for use in filters (local time without timezone like in SmartData)
     *
     * @param {Date} date Date to format
     * @returns {String} Date formatted as YYYY-MM-DDTHH:mm:ss
     */
    formatDate(date) {
        let pad = num => String(num).padStart(2, '0');
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
                + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
    }
}
