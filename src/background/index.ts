import { MODE_LABELS, type CaptureMode, type Message } from '../shared/messages';
import { describeError } from '../shared/errors';
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

function fail(e: unknown, what = 'Capture') {
  const err = describeError(e);
  console.error(`Snapmark ${what} failed:`, e);
  setBadge('!', '#dc2626');
  chrome.action.setTitle({ title: `Snapmark: ${err.message}` });
  // Shown in the popup next time it opens (see popup.ts).
  chrome.storage.local.set({ lastError: { ...err, what, at: Date.now() } }).catch(() => {});
  setTimeout(() => {
    setBadge('');
    chrome.action.setTitle({ title: 'Snapmark' });
  }, 30_000);
}

async function start(mode: CaptureMode, tab?: chrome.tabs.Tab) {
  if (busy) return;
  busy = true;
  chrome.storage.local.remove('lastError').catch(() => {});
  try {
    if (mode === 'desktop') {
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/desktop/desktop.html') });
      return;
    }
    tab ??= await activeTab();
    if (!tab?.id) throw new Error('No active tab');
    if (mode === 'visible') await captureVisible(tab);
    else if (mode === 'full') {
      setBadge('…');
      try {
        await captureFullPage(tab, (d, t) => setBadge(`${Math.min(99, Math.round((d / Math.max(t, 1)) * 100))}%`));
      } finally {
        setBadge('');
      }
    } else if (mode === 'region') {
      pendingRegion.set(tab.id, tab);
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['selector.js'] });
    }
  } catch (e) {
    if (tab?.id) pendingRegion.delete(tab.id);
    fail(e, MODE_LABELS[mode]);
  } finally {
    busy = false;
  }
}

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  if (msg.type === 'capture') {
    // Reply straight away so the popup can close; progress shows on the toolbar badge.
    start(msg.mode);
    sendResponse({ ok: true });
    return false;
  }
  const tabId = sender.tab?.id;
  if (msg.type === 'region-cancelled' && tabId) pendingRegion.delete(tabId);
  if (msg.type === 'region-selected' && tabId) {
    const tab = pendingRegion.get(tabId);
    pendingRegion.delete(tabId);
    if (tab) captureRegion(tab, msg.rect).catch((e) => fail(e, MODE_LABELS.region));
  }
  if (msg.type === 'desktop-captured') openEditor(msg.id).catch((e) => fail(e, MODE_LABELS.desktop));
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
