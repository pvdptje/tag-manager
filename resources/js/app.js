// --- STATE MANAGEMENT using sessionStorage ---
const PRESERVED_STATE_KEY = 'livewire-preserved-elements';

/**
 * Retrieves the preserved state map from sessionStorage.
 * @returns {Map<string, string>} A Map of CSS Selectors to HTML content.
 */
function getPreservedState() {
    const stored = sessionStorage.getItem(PRESERVED_STATE_KEY);
    // Parse the JSON string and convert the resulting object back into a Map.
    return stored ? new Map(Object.entries(JSON.parse(stored))) : new Map();
}

/**
 * Stores the current state map into sessionStorage.
 * @param {Map<string, string>} state The Map of CSS Selectors to HTML content.
 */
function setPreservedState(state) {
    // Convert the Map to a plain object before stringifying.
    sessionStorage.setItem(PRESERVED_STATE_KEY, JSON.stringify(Object.fromEntries(state.entries())));
}

/**
 * Generates a CSS selector for an element (prefers ID).
 * @param {Element} element The DOM element.
 * @returns {string | null} The CSS selector string.
 */
function getElementSelector(element) {
    if (element.id) {
        return `#${CSS.escape(element.id)}`;
    }
    if (element.tagName) {
        let selector = element.tagName.toLowerCase();
        // Only use classes if no ID is present.
        if (element.classList.length > 0) {
            selector += '.' + Array.from(element.classList).map(c => CSS.escape(c)).join('.');
        }
        return selector;
    }
    return null;
}

// --- CORE LOGIC ---
let observer = null;

/**
 * Starts the MutationObserver to track elements added/removed from the body.
 * @param {Element} bodyElement The document body element.
 */
function startObserver(bodyElement) {
    if (observer) observer.disconnect();

    const marker = document.getElementById('livewire-preserve-marker');
    if (!marker) return;

    // Observe changes to the DOM and update the preserved state.
    observer = new MutationObserver((mutations) => {
        const currentState = getPreservedState();
        let stateChanged = false;

        for (const mutation of mutations) {

            // ---- ADDED NODES ----
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue; // elements only

                // FIX: Only preserve elements directly added to the <body>.
                // If a node is added deeper down, it means an existing element is being modified,
                // and we only care about the top-level element replacement on navigation.
                if (node.parentElement === document.body) {
                    const selector = getElementSelector(node);
                    if (selector && !currentState.has(selector)) {
                        let contentToStore = node.outerHTML;

                        // ---- IFRAME SERIALIZATION ----
                        if (node.tagName === 'IFRAME') {
                            try {
                                const iframeDocument = node.contentDocument || node.contentWindow.document;
                                if (iframeDocument) {
                                    // Serialize the *full* iframe document content.
                                    const serializedIframe = new XMLSerializer().serializeToString(iframeDocument);
                                    
                                    // Inject the serialized content as a Base64 attribute into the outer HTML copy.
                                    const tempDiv = document.createElement('div');
                                    tempDiv.innerHTML = contentToStore;
                                    tempDiv.firstChild.setAttribute('data-preserved-content', btoa(serializedIframe));
                                    contentToStore = tempDiv.innerHTML;
                                }
                            } catch (e) {
                                // Same-origin policy prevents access to third-party iframe content.
                                console.warn(`Could not access content of iframe ("${selector}") due to same-origin policy.`, e);
                            }
                        }

                        currentState.set(selector, contentToStore);
                        stateChanged = true;
                    }
                }
            }

            // ---- REMOVED NODES ----
            for (const node of mutation.removedNodes) {
                if (node.nodeType !== 1) continue; // elements only

                // FIX: Only delete the state if the node *itself* was a direct child of the body.
                // The mutation.target is the parent of the removed nodes.
                if (mutation.target === document.body) {
                    const selector = getElementSelector(node);
                    if (selector && currentState.has(selector)) {
                        // Deleting the state only when the top-level element is removed.
                        // This prevents internal DOM manipulation (like a chatbot removing an internal div)
                        // from causing the whole element's state to be lost.
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

    // We observe all top-level additions/removals, and any changes in the subtree
    // only to catch removals/additions of nodes that *aren't* direct body children.
    observer.observe(bodyElement, { childList: true, subtree: true });
}

// --- LIVEWIRE LIFECYCLE HOOKS ---

// Disconnect the observer immediately before navigation to prevent capturing state
// while Livewire is cleaning up the DOM of the old page.
document.addEventListener('livewire:navigating', () => {
    if (observer) observer.disconnect();
});

// Restore preserved elements after the new page has been fully loaded.
document.addEventListener('livewire:navigated', () => {
    const preservedState = getPreservedState();
    sessionStorage.removeItem(PRESERVED_STATE_KEY); // Clear immediately to prevent accidental re-use

    if (preservedState.size > 0) {
        // FIX: Reduced delay from 1000ms to 50ms. A small delay ensures the Livewire DOM swap is complete
        // and the browser's paint cycle is finished before we inject our preserved elements.
        setTimeout(() => {
            const fragment = document.createDocumentFragment();
            let restoredCount = 0;

            preservedState.forEach((html, selector) => {
                // Only restore if the element does not already exist on the new page.
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

                            // Attach a 'load' listener, which fires when the iframe's *empty* document is ready.
                            elementToRestore.addEventListener('load', () => {
                                const iframeDoc = elementToRestore.contentWindow.document;

                                // Parse the preserved content string back into a DOM structure.
                                const parser = new DOMParser();
                                const preservedDoc = parser.parseFromString(preservedContent, 'text/html');

                                // Write the preserved document content into the iframe.
                                iframeDoc.open();
                                iframeDoc.write(preservedDoc.documentElement.outerHTML);
                                iframeDoc.close();

                                // ---- CRITICAL FIX: Re-running scripts in iframes ----
                                // After writing the HTML, scripts are inert. We must find them, clone them, and replace them
                                // to force the browser to execute them again. This is vital for external widgets/chatbots.
                                const scripts = iframeDoc.getElementsByTagName('script');
                                Array.from(scripts).forEach(oldScript => {
                                    const newScript = iframeDoc.createElement('script');
                                    // Copy all attributes (src, async, defer, etc.)
                                    Array.from(oldScript.attributes).forEach(attr => {
                                        newScript.setAttribute(attr.name, attr.value);
                                    });
                                    // Copy script content
                                    if (oldScript.innerHTML) {
                                        newScript.appendChild(iframeDoc.createTextNode(oldScript.innerHTML));
                                    }
                                    // Replace the old, inert script tag with the new, executing one.
                                    oldScript.parentNode.replaceChild(newScript, oldScript);
                                });

                                // 🔁 Capture current iframe *again* so the state for the next navigation is up-to-date.
                                // This is necessary because the script re-execution might have changed the iframe's content.
                                try {
                                    const serializedNewContent = new XMLSerializer().serializeToString(iframeDoc);
                                    const currentState = getPreservedState(); // Get state map again
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
                            // Non-iframe element: simply append.
                            fragment.appendChild(elementToRestore);
                            restoredCount++;
                        }
                    }
                }
            });

            if (fragment.childNodes.length > 0) {
                document.body.appendChild(fragment);
            }

            // Restart the observer on the new DOM when done.
            startObserver(document.body);

        }, 50); // Minimal delay for DOM stability
    } else {
        // If nothing was preserved, simply start the observer on the new DOM.
        startObserver(document.body);
    }
});