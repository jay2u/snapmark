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
