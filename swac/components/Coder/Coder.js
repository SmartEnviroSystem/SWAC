import SWAC from '../../swac.js';
import View from '../../View.js';
import Msg from '../../Msg.js';

export default class Coder extends View {

    constructor(options = {}) {
        super(options);
        this.name = 'Coder';
        this.desc.text = 'Component for display code';
        this.desc.developers = 'Florian Fehring (HSBI)';
        this.desc.license = 'GNU Lesser General Public License';
        this.options.showWhenNoData = true;
        this.options.showWhenNoDataMsg = false;

        this.desc.templates[0] = {
            name: 'default',
            style: 'default',
            desc: 'Default template.'
        };

        this.desc.depends[0] = {
            name: 'highlight.js',
            path: SWAC.config.swac_root + 'libs/highlight/highlight.min.js',
            desc: 'Syntax hightlighting'
        };
        this.desc.depends[1] = {
            name: 'highlight.js style',
            path: SWAC.config.swac_root + 'libs/highlight/styles/default.min.css',
            desc: 'Syntax hightlighting'
        };
    }

    init() {
        return new Promise((resolve, reject) => {

            let source = this.requestor.fromName;
            let outElem = this.requestor.querySelector('.swac_coder_code');
console.log('TEST source',source);
            // Check if source is a file
            var pathX = "[?:[a-zA-Z0-9-_\.]+(?:.json|.js|.html)"; /* File validation using extension*/
            // Check if path is pointing to a file
            if (source.match(pathX)) {
                let thisRef = this;
                // Load file
                fetch(source).then(function (cont) {
                    cont.text().then(function (txtcont) {
                        // Insert content into output field
                        outElem.innerHTML = new Option(txtcont).innerHTML;
                        if (source.includes('.json')) {
                            outElem.classList.add('language-json');
                        } else if (source.includes('.js')) {
                            outElem.classList.add('language-javascript');
                        } else if (source.includes('.html')) {
                            outElem.classList.add('language-html');
                        }
                        outElem.classList.remove('language-undefined');
                        hljs.highlightElement(thisRef.requestor.querySelector('code'));
                        outElem.classList.remove('language-undefined');
                    });
                });
            } else {
                // Check if source is an existing element
                let sourceElem = document.querySelector(source);
                if (sourceElem) {
                    outElem.classList.add('language-html');
                    let html;
                    if(sourceElem.swac_originalHTML) {
                        html = sourceElem.swac_originalHTML;
                    } else {
                        html = sourceElem.outerHTML;
                    }
                    outElem.innerHTML = this.escapeHtml(html);
                    hljs.highlightElement(outElem);
                }
            }


            // Copy-Button aktivieren
            let copyBtn = this.requestor.querySelector('.swac_coder_copy');
            if (copyBtn) {
                copyBtn.addEventListener('click', (evt) => {
                    // Prevent scrolling out of view
                    const scrollY = window.scrollY;
                    copyBtn.scrollIntoView();

                    navigator.clipboard.writeText(outElem.textContent)
                            .then(() => {
                                // Go back to old position
                                window.scrollTo({top: scrollY});

                                copyBtn.textContent = "✔️";
                                setTimeout(() => copyBtn.textContent = "📋", 1200);
                            });
                });
            }
            copyBtn.addEventListener('mousedown', e => e.preventDefault());

            resolve();
        });
    }

    afterAddSet(set, repeateds) {
        // You can do after adding actions here. At this timepoint the template
        // repeatForSet is also repeated and accessable.
        // e.g. generate a custom view for the data.

        // Call Components afterAddSet and plugins afterAddSet
        super.afterAddSet(set, repeateds);

        return;
    }

    /**
     * Escapes html code
     */
    escapeHtml(html) {
        return html
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
    }
}


