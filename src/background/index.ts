import { MODE_LABELS, type CaptureMode, type Message } from '../shared/messages';
import { captureFullPage, captureRegion, captureVisible, openEditor } from './capture';

let busy = false;
// tabId -> pending region capture waiting for the content script's answer
const pendingRegion = new Map<number, chrome.tabs.Tab>();

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

function setBadge(text: string, color = '#2563eb') {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
}

function fail(e: unknown) {
  console.error('Snapmark capture failed:', e);
  setBadge('!', '#dc2626');
  setTimeout(() => setBadge(''), 4000);
}

async function start(mode: CaptureMode, tab?: chrome.tabs.Tab) {
  if (busy) return;
  busy = true;
  try {
    if (mode === 'desktop') {
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/desktop/desktop.html') });
      return;
    }
    tab ??= await activeTab();
    if (!tab?.id) throw new Error('No active tab');
    if (mode === 'visible') await captureVisible(tab);
    else if (mode === 'full') {
      await captureFullPage(tab, (d, t) => setBadge(`${Math.round(((d + 1) / t) * 100)}%`));
      setBadge('');
    } else if (mode === 'region') {
      pendingRegion.set(tab.id, tab);
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['selector.js'] });
    }
  } catch (e) {
    if (tab?.id) pendingRegion.delete(tab.id);
    fail(`${MODE_LABELS[mode]}: ${e}`);
  } finally {
    busy = false;
  }
}

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  if (msg.type === 'capture') {
    start(msg.mode).then(() => sendResponse({ ok: true }));
    return true;
  }
  const tabId = sender.tab?.id;
  if (msg.type === 'region-cancelled' && tabId) pendingRegion.delete(tabId);
  if (msg.type === 'region-selected' && tabId) {
    const tab = pendingRegion.get(tabId);
    pendingRegion.delete(tabId);
    if (tab) captureRegion(tab, msg.rect).catch(fail);
  }
  if (msg.type === 'desktop-captured') openEditor(msg.id).catch(fail);
});

chrome.commands.onCommand.addListener((command) => {
  const mode = command.replace('capture-', '') as CaptureMode;
  if (mode in MODE_LABELS) start(mode);
});

const MENU: [string, CaptureMode][] = [
  ['Capture visible area', 'visible'],
  ['Capture selected region', 'region'],
  ['Capture full page', 'full'],
  ['Capture window / desktop', 'desktop'],
];
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'snapmark', title: 'Snapmark', contexts: ['page', 'action'] });
    for (const [title, mode] of MENU)
      chrome.contextMenus.create({ id: `snapmark-${mode}`, parentId: 'snapmark', title, contexts: ['page', 'action'] });
  });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const mode = String(info.menuItemId).replace('snapmark-', '') as CaptureMode;
  if (mode in MODE_LABELS) start(mode, tab);
});
