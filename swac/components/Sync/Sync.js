import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';

export default class Sync extends View {

    constructor(options = {}) {
        super(options);
        this.name = 'Sync';
        this.desc.text = 'Component for syncronising data from a source to another.';
        this.desc.developers = 'Florian Fehring (HSBI)';
        this.desc.license = 'GNU Lesser General Public License';

        this.desc.templates[0] = {
            name: 'simple',
            style: 'simple',
            desc: 'Simple synchronisation dialog.'
        };
        this.desc.reqPerTpl[0] = {
            selc: '[name="swac_sync_done"]',
            desc: 'Shows the number of allready synced datasets.'
        };
        this.desc.reqPerTpl[1] = {
            selc: '[name="swac_sync_avail"]',
            desc: 'Shows the number of available datasets.'
        };
        this.desc.reqPerTpl[2] = {
            selc: '.swac_sync_chart',
            desc: 'Shows the syncronisation progress.'
        };
        this.desc.reqPerTpl[3] = {
            selc: '.swac_sync_startbtn',
            desc: 'Button to start syncronisation.'
        };
        this.desc.optPerTpl[0] = {
            selc: '.swac_sync_repeatForError',
            desc: 'Aera to repeat for every error.'
        };

        this.desc.opts[0] = {
            name: "syncTest",
            desc: "URL to get status of synctarget. Awaits a state below 400."
        };
        if (!options.syncTest)
            this.options.syncTest = null;

        this.desc.opts[1] = {
            name: "syncTarget",
            desc: "URL where to send the datasets"
        };
        if (!options.syncTarget)
            this.options.syncTarget = null;

        this.desc.opts[2] = {
            name: "transformFuncs",
            desc: "Map for attribute names (keys) with a function that transforms the data"
        };
        if (!options.transformFuncs)
            this.options.transformFuncs = new Map();

        this.desc.opts[3] = {
            name: "syncedFlagAttribute",
            desc: "Attributes name that indicates if a dataset is allready synced."
        };
        if (!options.syncedFlagAttribute)
            this.options.syncedFlagAttribute = 'synced';

        this.desc.opts[4] = {
            name: "syncModeRequestor",
            desc: "DataRequestor for getting the sync mode state. Response dataset must contain an attribute",
            example: {
                fromName: 'syncStateApi'
            }
        };
        if (!options.syncModeRequestor)
            this.options.syncModeRequestor = null;

        this.desc.opts[4] = {
            name: "syncStateAttribute",
            desc: "NAme of the attribute where to find the syncstate."
        };
        if (!options.syncStateAttribute)
            this.options.syncStateAttribute = 'active';

        this.desc.opts[4] = {
            name: "syncStateRunningValue",
            desc: "Value of the syncstate attribute that indicates a running synchronisation."
        };
        if (!options.syncStateRunningValue)
            this.options.syncStateRunningValue = true;

        this.desc.opts[5] = {
            name: "syncStartRequestor",
            desc: "DataRequestor to call for starting sync. Response must contain a status attribute. Where any state less then 400 means starting succseed.",
            example: {
                fromName: 'syncStateApi/activate'
            }
        };
        if (!options.syncStartRequestor)
            this.options.syncStartRequestor = null;

        this.desc.opts[6] = {
            name: "syncStopRequestor",
            desc: "DataRequestor to call for stopping sync. Response must contain a status attribute. Where any state less then 400 means stoping succseed.",
            example: {
                fromName: 'syncStateApi/stop'
            }
        };
        if (!options.syncStopRequestor)
            this.options.syncStopRequestor = null;


        if (!options.showWhenNoData)
            this.options.showWhenNoData = true;

        // Internal attributes
        this.availSets = 0;
        this.doneSets = 0;
    }

    init() {
        return new Promise((resolve, reject) => {

            let startBtn = this.requestor.querySelector('.swac_sync_startbtn');
            let stopBtn = this.requestor.querySelector('.swac_sync_stopbtn');

            // Check frontend or backend sync support
            if (this.options.syncModeRequestor) {
                Msg.info('Sync', 'runs in backend controlled sync mode.', this.requestor);
                // Backend sync mode
                this.updateSyncMode();
                startBtn.addEventListener('click', this.onStartBackendSync.bind(this));
                stopBtn.addEventListener('click', this.onStopBackendSync.bind(this));
            } else {
                Msg.info('Sync', 'runs in frontend controlled sync mode.', this.requestor);
                // Frontend sync mode
                if (this.options.syncTarget) {
                    startBtn.addEventListener('click', this.onClickStart.bind(this));
                } else {
                    startBtn.setAttribute('disabled', 'disabled');
                    Msg.error('Sync', 'There is no option syncTarget specified, do not know where to sync.', this.requestor);
                    resolve();
                    return;
                }

                // Test if sync-target is reachable
                fetch(this.options.syncTest, {method: 'HEAD'}).then(function (res) {
                    if (res.status >= 400)
                        startBtn.setAttribute('disabled', 'disabled');
                    startBtn.parentElement.appendChild(document.createTextNode(SWAC.lang.dict.Sync.notavail));
                }
                );
            }

            // Initial draw
            this.drawProgress();
            resolve();
        });
    }

    afterAddSet(set, repeateds) {
        this.availSets++;
        // Update avail counter
        let availOut = this.requestor.querySelector('[name="swac_sync_avail"]');
        availOut.innerHTML = this.availSets;
        // If set is allready synced
        if (set[this.options.syncedFlagAttribute]) {
            this.doneSets++;
            // Update done counter
            let doneOut = this.requestor.querySelector('[name="swac_sync_done"]');
            doneOut.innerHTML = this.doneSets;
        }
        this.drawProgress();

        return;
    }

    /**
     * Executed when user clicks on the sync start button
     * 
     * @param {DOMEvent} evt Click event
     */
    onClickStart(evt) {
        evt.preventDefault();

        let el = this.requestor.querySelector('.swac_sync_chart');
        let doneOut = this.requestor.querySelector('[name="swac_sync_done"]');
        let repForErr = this.requestor.querySelector('.swac_sync_repeatForError');
        let startBtn = this.requestor.querySelector('.swac_sync_startbtn');
        startBtn.setAttribute('disabled', 'disabled');

        let thisRef = this;
        let sendProms = [];
        for (let source in this.data) {
            for (let set of this.data[source].getSets()) {
                if (!set)
                    continue;
                let syncSet = {};
                for (let attr in set) {
                    if (attr.startsWith('swac_'))
                        continue;
                    // Transform if configured
                    if (this.options.transformFuncs.has(attr)) {
                        let transfunc = this.options.transformFuncs.get(attr);
                        syncSet[attr] = transfunc(set);
                    } else {
                        syncSet[attr] = set[attr];
                    }
                }

                let sendProm = fetch(this.options.syncTarget, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(syncSet),
                });
                sendProm.then(function (res) {
                    // Delegate error responses to catch
                    if (!res.ok)
                        throw res;
                    // Update progress bar
                    thisRef.doneSets++;
                    doneOut.innerHTML = thisRef.doneSets;
                    let percent = thisRef.doneSets / thisRef.availSets * 100;
                    el.setAttribute('data-percent', percent.toFixed(2));
                    thisRef.drawProgress();
                    // Update local dataset
                    syncSet.synced = true;
                    SWAC.Model.save({
                        data: [syncSet],
                        fromName: set.swac_fromName
                    }, true).catch(function (err) {
                        Msg.error('Sync', 'Error marking dataset as synced.', thisRef.requestor);
                    });
                }).catch(function (err) {
                    if (!repForErr) {
                        Msg.error('Sync', 'Error syncronising data.', thisRef.requestor);
                        return;
                    }
                    let error = true;
                    let repeated = repForErr.cloneNode(true);
                    repeated.classList.remove('swac_sync_repeatForError');
                    repeated.classList.add('swac_sync_repeatedForError');
                    repeated.querySelector('.uk-accordion-title').innerHTML = SWAC.lang.dict.Sync.error_title + ' ' + syncSet.id;
                    if (err.status === 404)
                        repeated.querySelector('.uk-accordion-content').innerHTML = SWAC.lang.dict.Sync.error_404;
                    else if (err.status === 409) {
                        // Mark set as allready synced
                        syncSet.synced = true;
                        SWAC.Model.save({
                            data: [syncSet],
                            fromName: set.swac_fromName
                        }, true).then(function () {
                            // Update progress bar
                            thisRef.doneSets++;
                            doneOut.innerHTML = thisRef.doneSets;
                            let percent = thisRef.doneSets / thisRef.availSets * 100;
                            el.setAttribute('data-percent', percent.toFixed(2));
                            thisRef.drawProgress();
                        }).catch(function (err) {
                            Msg.error('Sync', 'Error marking dataset as synced.', thisRef.requestor);
                            err.text().then(text => {
                                repeated.querySelector('.uk-accordion-content').innerHTML = SWAC.lang.dict.Sync.error_409 + ' ' + text;
                            });
                        });
                        error = false;
                    } else if (err.status === 500)
                        repeated.querySelector('.uk-accordion-content').innerHTML = SWAC.lang.dict.Sync.error_500;
                    else {
                        repeated.querySelector('.uk-accordion-content').innerHTML = SWAC.lang.dict.Sync.error_unknown;
                        console.log(err);
                    }
                    if (error)
                        repForErr.parentNode.appendChild(repeated);
                });
                sendProms.push(sendProm);
            }
        }
        Promise.all(sendProms).then(function () {
            startBtn.removeAttribute('disabled');
        });
    }

    drawProgress() {
        var el = this.requestor.querySelector('.swac_sync_chart'); // get canvas
        let percent = 0;
        if (this.doneSets) {
            percent = (this.doneSets / this.availSets) * 100;
        }
        var options = {
            percent: percent.toFixed(2) || 0,
            size: el.getAttribute('data-size') || 220,
            lineWidth: el.getAttribute('data-line') || 15,
            rotate: el.getAttribute('data-rotate') || 0
        }

        // Create text element
        let txt = el.querySelector('.percTxt');
        if (!txt) {
            txt = document.createElement('span');
            txt.classList.add('percTxt');
            el.appendChild(txt);
        }
        txt.textContent = options.percent + '%';

        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        canvas.width = canvas.height = options.size;


        el.appendChild(canvas);

        ctx.translate(options.size / 2, options.size / 2); // change center
        ctx.rotate((-1 / 2 + options.rotate / 180) * Math.PI); // rotate -90 deg

        var radius = (options.size - options.lineWidth) / 2;

        var drawCircle = function (color, lineWidth, percent) {
            percent = Math.min(Math.max(0, percent), 1);
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2 * percent, false);
            ctx.strokeStyle = color;
            ctx.lineCap = 'round'; // butt, round or square
            ctx.lineWidth = lineWidth
            ctx.stroke();
        };

        drawCircle('#efefef', options.lineWidth, 100 / 100);
        drawCircle('#555555', options.lineWidth, options.percent / 100);
    }

    updateSyncMode() {
        const thisRef = this;
        // Get the model
        let Model = window.swac.Model;
        // Request data
        let dataPromise = Model.request(this.options.syncModeRequestor);
        // Wait for data to be loaded
        dataPromise.then(function (data) {
            // Get status dataset
            for (let curSet of data) {
                if (!curSet)
                    continue;
                if (curSet[thisRef.options.syncStateAttribute] && curSet[thisRef.options.syncStateAttribute] == thisRef.options.syncStateRunningValue) {
                    // update state button
                    let stateBtn = thisRef.requestor.querySelector('.swac_sync_startbtn');
                    stateBtn.classList.add('swac_dontdisplay');
                    let stopBtn = thisRef.requestor.querySelector('.swac_sync_stopbtn');
                    stopBtn.classList.remove('swac_dontdisplay');
                } else {
                    Msg.info('Sync', 'Awaited that attribute >' + thisRef.options.syncStateAttribute + '< has value >' + thisRef.options.syncStateRunningValue + '< to indicate a running synchronisation. But got >' + curSet[thisRef.options.syncStateAttribute] + '<', thisRef.requestor);
                    // update state button
                    let stateBtn = thisRef.requestor.querySelector('.swac_sync_startbtn');
                    stateBtn.classList.remove('swac_dontdisplay');
                    let stopBtn = thisRef.requestor.querySelector('.swac_sync_stopbtn');
                    stopBtn.classList.add('swac_dontdisplay');
                }
            }
        }).catch(function (err) {
            // Handle load error
            Msg.error('Sync', 'Error fetching backend sync state: ' + err, thisRef.requestor);
        });
    }

    onStartBackendSync(evt) {
        Msg.flow('Sync', 'onStartBackendSync()', this.requestor);
        const thisRef = this;
        // Get the model
        let Model = window.swac.Model;
        // Request data
        let dataPromise = Model.request(this.options.syncStartRequestor);
        // Wait for data to be loaded
        dataPromise.then(function (data) {
            let startBtn = thisRef.requestor.querySelector('.swac_sync_startbtn');
            // Response should be in dataset 1
            let set = data[0] ? null : data.records[0];
            if (set.updated >= 1) {
                // update state button
                startBtn.classList.add('swac_dontdisplay');
                let stopBtn = thisRef.requestor.querySelector('.swac_sync_stopbtn');
                stopBtn.classList.remove('swac_dontdisplay');
                // Start auto reload intrval
//                thisRef.options.reloadInterval = 1;
//                thisRef.startReloadInterval();
            } else {
                startBtn.classList.add('uk-label-danger');
                UIkit.modal.alert(SWAC.lang.dict.Sync.backend_start_fail);
            }
        }).catch(function (err) {
            Msg.error('Sync', 'Error starting backend synchronisation: ' + err, thisRef.requestor);
        });
    }

    onStopBackendSync(evt) {
        Msg.flow('Sync', 'onStopBackendSync()', this.requestor);
        const thisRef = this;
        // Get the model
        let Model = window.swac.Model;
        // Request data
        let dataPromise = Model.request(this.options.syncStopRequestor);
        // Wait for data to be loaded
        dataPromise.then(function (data) {
            let stopBtn = thisRef.requestor.querySelector('.swac_sync_stopbtn');
            // Response should be in dataset 1
            let set = data[0] ? null : data.records[0];
            if (set.updated >= 1) {
                // update state button
                stopBtn.classList.add('swac_dontdisplay');
                let startBtn = thisRef.requestor.querySelector('.swac_sync_startbtn');
                startBtn.classList.remove('swac_dontdisplay');
            } else {
                stopBtn.classList.add('uk-label-danger');
                UIkit.modal.alert(SWAC.lang.dict.Sync.backend_stop_fail);
            }
        }).catch(function (err) {
            Msg.error('Sync', 'Error stopping backend synchronisation: ' + err, thisRef.requestor);
        });
    }
}


