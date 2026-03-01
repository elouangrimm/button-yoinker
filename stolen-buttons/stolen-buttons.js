const DELETE_MODE = 'delete-mode';
const THEME_MODE = 'themeMode';
let fullRefresh = false;
let searchQuery = '';
let sortOrder = 'newest';

const COPY_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"><rect x="40" y="88" width="128" height="128" rx="8"/><path d="M80 88V56a8 8 0 0 1 8-8h112a8 8 0 0 1 8 8v112a8 8 0 0 1-8 8h-32"/></svg>';
const CHECK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><polyline points="40 136 96 192 216 72"/></svg>';
const THEME_ORDER = ['system', 'light', 'dark'];
const THEME_ICONS = {
    light: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><line x1="128" y1="40" x2="128" y2="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><circle cx="128" cy="128" r="56" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="64" y1="64" x2="48" y2="48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="64" y1="192" x2="48" y2="208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="192" y1="64" x2="208" y2="48" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="192" y1="192" x2="208" y2="208" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="40" y1="128" x2="16" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="128" y1="216" x2="128" y2="240" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="216" y1="128" x2="240" y2="128" fill="none" stroke="currentColor" stroke-linecap="square" stroke-width="16"/></svg>',
    dark: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M108.11,28.11A96.09,96.09,0,0,0,227.89,147.89,96,96,0,1,1,108.11,28.11Z" fill="none" stroke="currentColor" stroke-width="16"/></svg>',
    system: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M40,176V72A16,16,0,0,1,56,56H200a16,16,0,0,1,16,16V176" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><path d="M24,176H232a0,0,0,0,1,0,0v16a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V176A0,0,0,0,1,24,176Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/><line x1="144" y1="88" x2="112" y2="88" fill="none" stroke="currentColor" stroke-width="16"/></svg>'
};

const sendToBackground = (type, value) => {
    chrome.runtime.sendMessage({ type, value, target: 'background' });
}

const updateDeleteButtonState = () => {
    const selected = Array.from(document.querySelectorAll("#stolen-buttons div.stolen-button.selected")).length;
    const deleteButton = document.getElementById('delete');
    if (selected > 0) {
        deleteButton.classList.remove('disabled');
        deleteButton.innerText = `Remove (${selected})`;
    } else {
        deleteButton.classList.add('disabled');
        deleteButton.innerText = 'Remove';
    }
}

const formatSource = (source) => {
    try {
        const url = new URL(source);
        const host = url.hostname.startsWith('www.') ? url.hostname.slice(4) : url.hostname;
        return host;
    } catch {
        return source;
    }
}

const renderButton = (button, isDeleteMode) => {
    const div = document.createElement('div');
    div.classList.add('stolen-button');
    div.dataset.id = button.id;
    div.dataset.name = button.name;
    div.dataset.stolenAt = button.stolenAt;

    const preview = document.createElement('div');
    preview.classList.add('stolen-button-preview');
    preview.innerHTML = button.code;
    div.append(preview);

    if (isDeleteMode) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('stolen-button-checkbox');
        checkbox.addEventListener('click', (e) => e.stopPropagation());
        checkbox.addEventListener('change', () => {
            div.classList.toggle('selected', checkbox.checked);
            updateDeleteButtonState();
        });

        const url = document.createElement('a');
        url.classList.add('stolen-button-url');
        url.href = button.source;
        url.target = '_blank';
        url.rel = 'noreferrer';
        url.innerText = formatSource(button.source);
        url.addEventListener('click', (e) => e.stopPropagation());

        div.prepend(checkbox);
        div.append(url);

        div.addEventListener('click', () => {
            checkbox.checked = !checkbox.checked;
            div.classList.toggle('selected', checkbox.checked);
            updateDeleteButtonState();
        });
    } else {
        preview.addEventListener('click', () => {
            window.open(button.source, '_blank').focus();
        });

        // Copy HTML button
        const copyBtn = document.createElement('button');
        copyBtn.classList.add('copy-code-btn');
        copyBtn.setAttribute('aria-label', 'Copy HTML');
        copyBtn.title = 'Copy HTML';
        copyBtn.innerHTML = COPY_ICON;
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(button.code);
                copyBtn.innerHTML = CHECK_ICON;
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.innerHTML = COPY_ICON;
                    copyBtn.classList.remove('copied');
                }, 1500);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
        div.append(copyBtn);
    }

    return div;
}

const getButtons = async () => {
    const { buttons } = await chrome.storage.local.get('buttons');
    const container = document.getElementById('stolen-buttons');
    const isDeleteMode = document.body.classList.contains(DELETE_MODE);
    let filtered = buttons.filter(button => !button.hidden);

    // Search filter (only in normal mode)
    if (!isDeleteMode && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(b =>
            (b.text && b.text.toLowerCase().includes(q)) ||
            (b.source && b.source.toLowerCase().includes(q))
        );
    }

    // Sort order (only in normal mode)
    if (!isDeleteMode && sortOrder === 'oldest') {
        filtered = [...filtered].reverse();
    }

    const noResults = document.getElementById('no-results');
    if (noResults) {
        noResults.classList.toggle('hidden', filtered.length > 0 || isDeleteMode);
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach((button, index) => {
        const item = renderButton(button, isDeleteMode);
        if (isDeleteMode && index < filtered.length - 1) {
            item.classList.add('has-divider');
        }
        fragment.append(item);
    });
    container.replaceChildren(fragment);

    fullRefresh = false;
    updateDeleteButtonState();
}

const deleteButtons = async () => {
    const value = Array.from(document.querySelectorAll("#stolen-buttons div.stolen-button.selected")).map(selected => {
        return {
            stolenAt: selected.dataset.stolenAt,
            name: selected.dataset.name,
        }
    });
    sendToBackground('remove-buttons', JSON.stringify(value));
}

document.addEventListener('DOMContentLoaded', () => {
    getButtons();
    initThemeMode();
});

chrome.storage.onChanged.addListener((obj) => {
    if (obj.hasOwnProperty('buttons') || obj.hasOwnProperty('maximum')) {
        getButtons();
    }
    if (obj.hasOwnProperty(THEME_MODE)) {
        applyThemeMode(obj[THEME_MODE].newValue || 'system');
    }
});

document.getElementById('delete-mode').addEventListener('click', ()=> {
    document.getElementById('title').innerText = 'Edit';
    document.body.classList.add(DELETE_MODE);
    getButtons();
});

document.getElementById('exit-mode').addEventListener('click', ()=> {
    document.getElementById('title').innerText = 'Stolen Buttons';
    document.body.classList.remove(DELETE_MODE);
    getButtons();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
});

document.getElementById('delete').addEventListener('click', ()=> {
    deleteButtons();
    document.getElementById('delete').classList.add('disabled');
});

const handleMessages = async (message) => {
    if (message.target !== 'stolen-buttons') return false;
    switch (message.type) {
        case 'full-refresh':
            fullRefresh = true;
            break;
        default:
            return false;
    }
}

chrome.runtime.onMessage.addListener(handleMessages);

const applyThemeMode = (mode) => {
    if (mode === 'dark' || mode === 'light') {
        document.documentElement.setAttribute('data-theme', mode);
    } else {
        document.documentElement.removeAttribute('data-theme');
        mode = 'system';
    }
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        const idx = THEME_ORDER.indexOf(mode);
        const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
        toggle.dataset.mode = mode;
        toggle.innerHTML = THEME_ICONS[mode] || THEME_ICONS.system;
        toggle.setAttribute('aria-label', `Theme mode: ${mode}`);
        toggle.setAttribute('title', `Switch to ${next} mode`);
    }
}

const initThemeMode = async () => {
    const stored = await chrome.storage.local.get(THEME_MODE);
    const mode = ['system', 'light', 'dark'].includes(stored[THEME_MODE]) ? stored[THEME_MODE] : 'system';
    applyThemeMode(mode);
}

document.querySelectorAll('.mode-button').forEach(button => {
    if (button.id !== 'theme-toggle') return;
    button.addEventListener('click', () => {
        const current = button.dataset.mode || 'system';
        const idx = THEME_ORDER.indexOf(current);
        const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
        chrome.storage.local.set({ [THEME_MODE]: next });
        applyThemeMode(next);
    });
});

// --- Search ---
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        getButtons();
    });
}

// --- Sort toggle ---
const sortToggle = document.getElementById('sort-toggle');
if (sortToggle) {
    sortToggle.addEventListener('click', () => {
        sortOrder = sortOrder === 'newest' ? 'oldest' : 'newest';
        sortToggle.dataset.order = sortOrder;
        sortToggle.title = `Sorted: ${sortOrder} first`;
        sortToggle.textContent = sortOrder === 'newest' ? '↓ Newest' : '↑ Oldest';
        getButtons();
    });
}

// --- Export as JSON ---
const exportBtn = document.getElementById('export-btn');
if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
        const { buttons } = await chrome.storage.local.get('buttons');
        const visible = (buttons || []).filter(b => !b.hidden);
        const json = JSON.stringify(visible, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stolen-buttons-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}
// --- Import from JSON ---
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file-input');
if (importBtn && importFileInput) {
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const incoming = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.buttons) ? parsed.buttons : []);
            if (incoming.length === 0) { alert('No buttons found in file.'); return; }
            const { buttons, maximum } = await chrome.storage.local.get(['buttons', 'maximum']);
            const existingKeys = new Set(buttons.map(b => b.stolenAt + '|' + b.name));
            let nextId = buttons.length > 0 && buttons[0].hasOwnProperty('id') ? buttons[0].id : 0;
            const toAdd = incoming
                .filter(b => b.code && !existingKeys.has(b.stolenAt + '|' + b.name))
                .map(b => ({ ...b, id: ++nextId, hidden: false }));
            const merged = [...toAdd, ...buttons];
            merged.sort((a, b) => new Date(b.stolenAt) - new Date(a.stolenAt));
            while (merged.length > maximum) merged.pop();
            chrome.storage.local.set({ buttons: merged });
        } catch (err) {
            alert('Failed to import: make sure it is a valid Button Stealer JSON export.');
        }
        importFileInput.value = '';
    });
}