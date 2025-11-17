// --- STATE MANAGEMENT using sessionStorage ---
const PRESERVED_STATE_KEY = 'livewire-preserved-elements';

function getPreservedState() {
    const stored = sessionStorage.getItem(PRESERVED_STATE_KEY);
    return stored ? new Map(Object.entries(JSON.parse(stored))) : new Map();
}

function setPreservedState(state) {
    sessionStorage.setItem(PRESERVED_STATE_KEY, JSON.stringify(Object.fromEntries(state.entries())));
}

function getElementSelector(element) {
    if (element.id) {
        return `#${CSS.escape(element.id)}`;
    }
    if (element.tagName) {
        let selector = element.tagName.toLowerCase();
        if (element.classList.length > 0) {
            selector += '.' + Array.from(element.classList).map(c => CSS.escape(c)).join('.');
        }
        return selector;
    }
    return null;
}

// --- CORE LOGIC ---
let observer = null;

function startObserver(bodyElement) {
    if (observer) observer.disconnect();

    const marker = document.getElementById('livewire-preserve-marker');
    if (!marker) return;

    observer = new MutationObserver((mutations) => {
        const currentState = getPreservedState();
        let stateChanged = false;

        for (const mutation of mutations) {

            // ---- ADDED NODES ----
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue; // elements only

                if (node.parentElement === document.body) {
                    const selector = getElementSelector(node);
                    if (selector && !currentState.has(selector)) {
                        let contentToStore = node.outerHTML;

                        // ---- IFRAME SERIALIZATION ----
                        if (node.tagName === 'IFRAME') {
                            try {
                                const iframeDocument = node.contentDocument || node.contentWindow.document;
                                if (iframeDocument) {
                                    const serializedIframe = new XMLSerializer().serializeToString(iframeDocument);
                                    const tempDiv = document.createElement('div');
                                    tempDiv.innerHTML = contentToStore;
                                    tempDiv.firstChild.setAttribute('data-preserved-content', btoa(serializedIframe));
                                    contentToStore = tempDiv.innerHTML;
                                }
                            } catch (e) {
                                console.warn(`Could not access content of iframe ("${selector}") due to same-origin policy.`);
                            }
                        }

                        currentState.set(selector, contentToStore);
                        stateChanged = true;
                    }
                } else {
                    const topLevelAncestor = node.closest('body > *');
                    if (topLevelAncestor) {
                        const selector = getElementSelector(topLevelAncestor);
                        if (selector && !currentState.has(selector)) {
                            currentState.set(selector, topLevelAncestor.outerHTML);
                            stateChanged = true;
                        }
                    }
                }
            }

            // ---- REMOVED NODES ----
            for (const node of mutation.removedNodes) {
                if (node.nodeType !== 1) continue;

                const topLevelAncestor = node.closest?.('body > *') || node;

                if (topLevelAncestor.parentElement === document.body) {
                    const selector = getElementSelector(topLevelAncestor);
                    if (selector && currentState.has(selector)) {
                        currentState.delete(selector);
                        stateChanged = true;
                    }
                }
            }
        }

        if (stateChanged) {
            setPreservedState(currentState);
        }
    });

    observer.observe(bodyElement, { childList: true, subtree: true });
}

// --- LIVEWIRE LIFECYCLE HOOKS ---

document.addEventListener('livewire:navigating', () => {
    if (observer) observer.disconnect();
});

document.addEventListener('livewire:navigated', () => {
    const preservedState = getPreservedState();
    sessionStorage.removeItem(PRESERVED_STATE_KEY);

    if (preservedState.size > 0) {
        setTimeout(() => {
            const fragment = document.createDocumentFragment();
            let restoredCount = 0;

            preservedState.forEach((html, selector) => {
                if (!document.querySelector(selector)) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;
                    const elementToRestore = tempDiv.firstChild;

                    if (elementToRestore) {

                        // ---- IFRAME RESTORE + ALWAYS RECAPTURE SCRIPTS ----
                        if (elementToRestore.tagName === 'IFRAME' && elementToRestore.hasAttribute('data-preserved-content')) {
                            const preservedContent = atob(elementToRestore.getAttribute('data-preserved-content'));
                            elementToRestore.removeAttribute('data-preserved-content');

                            fragment.appendChild(elementToRestore);
                            restoredCount++;

                            elementToRestore.addEventListener('load', () => {
                                const iframeDoc = elementToRestore.contentWindow.document;

                                const parser = new DOMParser();
                                const preservedDoc = parser.parseFromString(preservedContent, 'text/html');

                                iframeDoc.open();
                                iframeDoc.write(preservedDoc.documentElement.outerHTML);
                                iframeDoc.close();

                                // ---- ALWAYS recreate scripts (this is the fix) ----
                                const scripts = iframeDoc.getElementsByTagName('script');
                                Array.from(scripts).forEach(oldScript => {
                                    const newScript = iframeDoc.createElement('script');
                                    Array.from(oldScript.attributes).forEach(attr => {
                                        newScript.setAttribute(attr.name, attr.value);
                                    });
                                    if (oldScript.innerHTML) {
                                        newScript.appendChild(iframeDoc.createTextNode(oldScript.innerHTML));
                                    }
                                    oldScript.parentNode.replaceChild(newScript, oldScript);
                                });

                                // 🔁 Capture current iframe *again* so next navigation still works
                                try {
                                    const serializedNewContent = new XMLSerializer().serializeToString(iframeDoc);
                                    const currentState = getPreservedState();
                                    const replacementDiv = document.createElement('div');
                                    replacementDiv.innerHTML = elementToRestore.outerHTML;
                                    replacementDiv.firstChild.setAttribute('data-preserved-content', btoa(serializedNewContent));
                                    currentState.set(selector, replacementDiv.innerHTML);
                                    setPreservedState(currentState);
                                } catch (e) {
                                    console.warn('Could not re-serialize iframe after restore.', e);
                                }

                            }, { once: true });

                        } else {
                            fragment.appendChild(elementToRestore);
                            restoredCount++;
                        }
                    }
                }
            });

            if (fragment.childNodes.length > 0) {
                document.body.appendChild(fragment);
            }

            startObserver(document.body);

        }, 1000);
    } else {
        startObserver(document.body);
    }
});