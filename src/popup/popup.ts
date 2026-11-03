import type { CaptureMode } from '../shared/messages';

document.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((b) =>
  b.addEventListener('click', async () => {
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
