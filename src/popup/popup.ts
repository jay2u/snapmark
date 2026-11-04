import type { CaptureMode } from '../shared/messages';

document.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((b) =>
  b.addEventListener('click', async () => {
    // The background replies immediately and keeps working; progress shows on the toolbar icon.
    await chrome.runtime.sendMessage({ type: 'capture', mode: b.dataset.mode as CaptureMode });
    window.close();
  }),
);
document.getElementById('history')!.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('src/history/history.html') });
});
document.getElementById('shortcuts')!.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// Show why the last capture failed (the toolbar badge only says "!").
chrome.storage.local.get('lastError').then((stored) => {
  const lastError = stored.lastError as { what: string; message: string; detail: string; at: number } | undefined;
  if (!lastError || Date.now() - lastError.at > 10 * 60_000) return;
  document.getElementById('errWhat')!.textContent = `${lastError.what} failed`;
  document.getElementById('errMsg')!.textContent = lastError.message;
  document.getElementById('errDetail')!.textContent = lastError.detail;
  document.getElementById('error')!.hidden = false;
});

chrome.storage.local.get('lastNotice').then((stored) => {
  const n = stored.lastNotice as { message: string; at: number } | undefined;
  if (!n || Date.now() - n.at > 10 * 60_000) return;
  const el = document.getElementById('notice')!;
  el.textContent = n.message;
  el.hidden = false;
});
