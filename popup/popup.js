const MAXIMUM = 'maximum';
const CNTFL_MGMT_API_KEY = 'contentManagementApiKey';
const CNTFL_DLVR_API_KEY = 'contentDeliveryApiKey';
const CNTFL_SPACE_ID = 'spaceId';
const CNTFL_TYPE_ID = 'contentTypeId';
const CONTENTFUL = 'contentful';
const BUTTONS = 'buttons';
const IGNORE = 'ignore';
const { t, apply } = window.ButtonStealerI18n;
const maximumInput = document.getElementById(MAXIMUM);
const maximumValue = document.getElementById('maximumValue');
const ignoreInput = document.getElementById(IGNORE);
const mgmtApiKeyInput = document.getElementById(CNTFL_MGMT_API_KEY);
const dlvrApiKeyInput = document.getElementById(CNTFL_DLVR_API_KEY);
const spaceIdInput = document.getElementById(CNTFL_SPACE_ID);
const typeIdInput = document.getElementById(CNTFL_TYPE_ID);
const contentfulForm = document.getElementById(`${CONTENTFUL}-form`);
let topHeader = '';
let pendingMaximum = null;
let savedMaximum = null;
const MAXIMUM_MIN = 100;
const MAXIMUM_MAX = 10000;

const normalizeMaximum = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return 200;
    return Math.min(MAXIMUM_MAX, Math.max(MAXIMUM_MIN, parsed));
}

const saveContentful = () => {
    if (!contentfulForm) return;
    const formData = new FormData(contentfulForm);
    sendToBackground(`update-${CONTENTFUL}`, JSON.stringify({
        contentManagementApiKey: formData.get(CNTFL_MGMT_API_KEY),
        contentDeliveryApiKey: formData.get(CNTFL_DLVR_API_KEY),
        spaceId: formData.get(CNTFL_SPACE_ID),
        contentTypeId: formData.get(CNTFL_TYPE_ID),
    }));
}

const updateContentful = (contentful) => {
    if (!mgmtApiKeyInput || !dlvrApiKeyInput || !spaceIdInput || !typeIdInput || !contentful) return;
    mgmtApiKeyInput.value = contentful.contentManagementApiKey;
    dlvrApiKeyInput.value = contentful.contentDeliveryApiKey;
    spaceIdInput.value = contentful.spaceId;
    typeIdInput.value = contentful.contentTypeId;
}

const saveMaximum = () => {
    if (!maximumInput) return;
    const normalized = normalizeMaximum(maximumInput.value);
    maximumInput.value = String(normalized);
    sendToBackground(`update-${MAXIMUM}`, normalized);
}

const updateMaximum = (maximum) => {
    if (!maximumInput || !maximumValue) return;
    const normalized = normalizeMaximum(maximum);
    maximumInput.value = String(normalized);
    maximumValue.innerText = String(normalized);
    savedMaximum = String(normalized);
    pendingMaximum = String(normalized);
}

const saveIgnore = () => {
    if (!ignoreInput) return;
    sendToBackground(`update-${IGNORE}`, ignoreInput.value);
}

const updateIgnore = (ignore) => {
    if (!ignoreInput || !Array.isArray(ignore)) return;
    ignoreInput.value = ignore.join(' ');
}

const updateButtons = (buttons) => {
    const list = Array.isArray(buttons) ? buttons : [];
    let stat;
    let length = 0;
    list.map(button => button.hidden ? length : length++);
    switch (true) {
        case length === 1:
            stat = t('popupButtonsStolenOne');
            break;
        case length > 1:
            stat = t('popupButtonsStolenMany', [String(length)]);
            break;
        default:
            stat = t('popupButtonsStolenZero');
            break;
    }
    document.getElementById('stat').innerText = stat;
    document.getElementById('buttons').innerHTML = '';
    for (let i = 0; i < Math.min(50, list.length); i++) {
        const button = list[i];
        if (button.hidden) continue;
        const div = document.createElement('div');
        div.classList.add('button-wrapper');
        div.innerHTML = button.code;
        document.getElementById('buttons').append(div);
    }
}

const getData = async () => {
    const { maximum, contentful, ignore, buttons } = await chrome.storage.local.get([MAXIMUM, CONTENTFUL, IGNORE, BUTTONS]);
    updateMaximum(maximum);
    updateContentful(contentful);
    updateIgnore(ignore);
    updateButtons(buttons)
}

const sendToBackground = (type, value) => {
    chrome.runtime.sendMessage({
        type,
        value,
        target: 'background'
    });
}
let contentfulDelay = -1;
let ignoreDelay = -1;

if (maximumInput && maximumValue) {
    maximumInput.addEventListener('input', () => {
        const normalized = normalizeMaximum(maximumInput.value);
        maximumValue.innerText = String(normalized);
        pendingMaximum = String(normalized);
    });
}

[mgmtApiKeyInput, dlvrApiKeyInput, spaceIdInput, typeIdInput].filter(Boolean).forEach(input => {
    input.addEventListener('input', () => {
        clearTimeout(contentfulDelay);
        contentfulDelay = setTimeout(saveContentful, 500);
    });
})

document.getElementById('remove-all').addEventListener('click', () => {
    if (window.confirm(t('popupRemoveButtonsConfirm')) == true) {
        chrome.runtime.sendMessage({
            type: 'remove-all',
            target: 'background'
        });
    }
});

if (ignoreInput) {
    ignoreInput.addEventListener('input', ()=> {
        clearTimeout(ignoreDelay);
        ignoreDelay = setTimeout(saveIgnore, 500);
    });
}

const closeSlider = () => {
    document.body.classList.remove('crypto-address');
    document.body.classList.remove('slide-container');
}

const setHeader = (html) => {
    topHeader = document.getElementById('slider-header').innerHTML;
    document.getElementById('slider-header').innerHTML = html;
}

const openSlider = (title, contentId) => {
    setHeader(title);
    document.body.classList.add('slide-container');
    [...document.getElementById('slider-container').children].forEach(view => {
        if (view.id === contentId) {
            view.classList.remove('hidden');
        } else {
            view.classList.add('hidden');
        }
    })
}

document.getElementById('switch').addEventListener('click', ()=> {
    if (document.body.classList.contains('slide-container')) {
        closeSlider();
    } else {
        openSlider(t('popupSettingsTitle'), 'settings');
    }
});

apply();
getData();
const versionEl = document.getElementById('version-label');
if (versionEl) {
    versionEl.innerText = t('popupVersionPrefix') + chrome.runtime.getManifest().version;
}

const flushMaximum = () => {
    if (pendingMaximum === null) return;
    if (pendingMaximum === savedMaximum) return;
    savedMaximum = pendingMaximum;
    saveMaximum();
}

if (maximumInput) {
    maximumInput.addEventListener('change', flushMaximum);
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        flushMaximum();
    }
});

window.addEventListener('pagehide', flushMaximum);