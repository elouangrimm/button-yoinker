const MAXIMUM = 'maximum';
const CNTFL_MGMT_API_KEY = 'contentManagementApiKey';
const CNTFL_DLVR_API_KEY = 'contentDeliveryApiKey';
const CNTFL_SPACE_ID = 'spaceId';
const CNTFL_TYPE_ID = 'contentTypeId';
const CONTENTFUL = 'contentful';
const IGNORE = 'ignore';
const BUTTONS = 'buttons';
const UPLOAD = 'upload';
const OFFSCREEN_DOCUMENT_PATH = '/offscreen/offscreen.html';
let isDark = false;

// --- Badge counter ---
const setBadge = (buttons) => {
    const count = (buttons || []).filter(b => !b.hidden).length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF6B35' });
};

// Initialize badge when the service worker starts
(async () => {
    const { buttons } = await chrome.storage.local.get(BUTTONS);
    setBadge(buttons);
})();

// Keep badge in sync whenever the buttons array changes
chrome.storage.onChanged.addListener((obj) => {
    if (obj.hasOwnProperty(BUTTONS)) {
        setBadge(obj[BUTTONS].newValue);
    }
});

// --- Context menu: right-click to steal ---
const createContextMenu = () => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'steal-button',
            title: 'Steal this button',
            contexts: ['all'],
        });
    });
};
createContextMenu();

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'steal-button') return;
    // Content script only runs on http/https pages — skip anything else silently
    if (!tab || !tab.url || !tab.url.startsWith('http')) return;
    chrome.tabs.sendMessage(tab.id, { type: 'steal-right-clicked' }).catch(() => {
        // Content script not yet injected on this page — ignore
    });
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    createContextMenu();
    switch (reason) {
        case 'install':
            chrome.storage.local.set({
                buttons: [],
                upload: [],
                ignore: [],
                maximum: 200,
                contentful: {
                    contentManagementApiKey: '',
                    contentDeliveryApiKey: '',
                    spaceId: '',
                    contentTypeId: ''
                }
            });
            break;
        case 'update':
            const { buttons, upload, contentful } = await chrome.storage.local.get([BUTTONS, UPLOAD, CONTENTFUL]);
            if (buttons.length === 0) break;
            let counter = buttons.length - 1;
            buttons.map(button => { button.id = counter--; button.hidden = button.hidden ?? false; } );
            chrome.storage.local.set({ buttons: buttons });
            if (!upload) chrome.storage.local.set({ 'upload': [] });
            if (!contentful.contentDeliveryApiKey) {
                contentful.contentDeliveryApiKey = '';
                chrome.storage.local.set({ 'contentful': contentful });
            }
            break;
        default:
            break;
    }
});

chrome.storage.onChanged.addListener(async (obj) => {
    switch (true) {
        case obj.hasOwnProperty(MAXIMUM):
            const { buttons } = await chrome.storage.local.get(BUTTONS);
            const parsedMaximum = Number.parseInt(obj.maximum.newValue, 10);
            const maximum = Number.isNaN(parsedMaximum) ? 200 : Math.min(10000, Math.max(100, parsedMaximum));
            while (buttons.length > maximum) buttons.pop();
            chrome.storage.local.set({ 'buttons': buttons });
            break;
        case obj.hasOwnProperty(UPLOAD):
            uploadOffscreen();
            break;
        case obj.hasOwnProperty(CONTENTFUL):
            uploadOffscreen();
            break;
        default:
            break;
    }
});

const uploadOffscreen = async () => {
    const { upload, contentful } = await chrome.storage.local.get([UPLOAD, CONTENTFUL]);
    if (!(contentful[CNTFL_MGMT_API_KEY] && contentful[CNTFL_DLVR_API_KEY] && contentful[CNTFL_SPACE_ID] && contentful[CNTFL_TYPE_ID])) {
        if (upload.length > 0) chrome.storage.local.set({ 'upload': [] });
        return;
    }
    if (upload.length === 0) {
        chrome.runtime.sendMessage({
            type: 'full-sync',
            target: 'offscreen',
            contentful: contentful
        });
        return;
    }
    if (!(await hasDocument())) {
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: [chrome.offscreen.Reason.DOM_PARSER],
            justification: 'Parse DOM'
        });
    }
    const button = upload[upload.length - 1];
    const type = button.hasOwnProperty('code') ? 'upload-stolen-button' : 'remove-stolen-button';
    chrome.runtime.sendMessage({
        type: type,
        target: 'offscreen',
        button: button,
        contentful: contentful
    });
}

const handleMessages = async (message) => {
    if (message.target !== 'background') return;
    switch (message.type) {
        case 'stolen-button-uploaded':
            const { upload } = await chrome.storage.local.get(UPLOAD);
            upload.pop();
            chrome.runtime.sendMessage({
                type: 'full-refresh',
                target: 'stolen-buttons',
            });
            chrome.storage.local.set({ 'upload': upload });
            break;
        case 'contentful-syncronized':
            chrome.storage.local.set({ buttons: JSON.parse(message.value) });
            closeOffscreenDocument();
            break;
        case 'update-maximum':
            const parsedMaximum = Number.parseInt(message.value, 10);
            const maximum = Number.isNaN(parsedMaximum) ? 200 : Math.min(10000, Math.max(100, parsedMaximum));
            chrome.storage.local.set({ maximum });
            break;
        case 'update-contentful':
            chrome.storage.local.set({ contentful: JSON.parse(message.value) });
            break;
        case 'update-ignore':
            chrome.storage.local.set({ ignore: message.value.split(' ') });
            break;
        case 'remove-all':
            chrome.storage.local.set({ buttons: [], upload: [] })
            break;
        case 'remove-buttons':
            handleRemoveButtons(JSON.parse(message.value));
            break;
        case 'color-scheme-changed':
            if (isDark !== message.isDark) {
                isDark = message.isDark;
                chrome.action.setIcon({
                    "path": {
                        "16": `/images/icon-${isDark? "dark" : "light"}-16.png`,
                        "32": `/images/icon-${isDark? "dark" : "light"}-32.png`,
                        "48": `/images/icon-${isDark? "dark" : "light"}-48.png`,
                        "128": `/images/icon-${isDark? "dark" : "light"}-128.png`
                    }
                })
            }
            break;
        default:
            break;
    }
}

const handleRemoveButtons = async (selected) => {
    const { buttons, upload } = await chrome.storage.local.get([BUTTONS, UPLOAD]);
    selected.forEach(s => {
        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            if (button.stolenAt === s.stolenAt) {
                if (button.name === s.name) {
                    button.hidden = true;
                    break;
                }
            }
        }
    });
    chrome.storage.local.set({ buttons: buttons });
    upload.unshift(...selected);
    chrome.storage.local.set({ upload: upload });
}

chrome.runtime.onMessage.addListener(handleMessages);

const closeOffscreenDocument = async () => {
    if (!(await hasDocument())) {
        return;
    }
    await chrome.offscreen.closeDocument();
}

const hasDocument = async () => {
    const matchedClients = await clients.matchAll();
    for (const client of matchedClients) {
        if (client.url.endsWith(OFFSCREEN_DOCUMENT_PATH)) {
            return true;
        }
    }
    return false;
}
