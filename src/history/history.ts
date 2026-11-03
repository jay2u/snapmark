import { clearAll, deleteCapture, getCapture, listMeta, pruneHistory } from '../shared/db';

const grid = document.getElementById('grid')!;
const empty = document.getElementById('empty')!;
const maxInput = document.getElementById('max') as HTMLInputElement;
const urls: string[] = [];

const openUrl = (id: string) => chrome.runtime.getURL(`src/editor/editor.html?id=${id}`);

async function render() {
  urls.splice(0).forEach(URL.revokeObjectURL);
  grid.replaceChildren();
  const items = await listMeta();
  empty.hidden = items.length > 0;
  for (const m of items) {
    const card = document.createElement('div');
    card.className = 'card';
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (m.thumb) {
      const u = URL.createObjectURL(m.thumb);
      urls.push(u);
      thumb.style.backgroundImage = `url(${u})`;
    }
    thumb.onclick = () => (location.href = openUrl(m.id));

    const info = document.createElement('div');
    info.className = 'info';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = m.title;
    title.title = m.url || m.title;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${new Date(m.updatedAt).toLocaleString()} · ${m.width}×${m.height}`;
    info.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const open = button('Open / edit', 'btn primary', () => (location.href = openUrl(m.id)));
    const dl = button('Download', 'btn', async () => {
      const c = await getCapture(m.id);
      if (!c) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(c.record.blob);
      a.download = `snapmark-${m.id.slice(0, 8)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });
    const del = button('Delete', 'btn danger', async () => {
      await deleteCapture(m.id);
      render();
    });
    actions.append(open, dl, del);
    card.append(thumb, info, actions);
    grid.append(card);
  }
}

function button(label: string, cls: string, onClick: () => void) {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

document.getElementById('clear')!.onclick = async () => {
  if (confirm('Delete every saved capture? This cannot be undone.')) {
    await clearAll();
    render();
  }
};
maxInput.onchange = async () => {
  const n = Math.max(1, Math.min(1000, Math.floor(Number(maxInput.value) || 100)));
  maxInput.value = String(n);
  await chrome.storage.local.set({ maxHistory: n });
  await pruneHistory(n);
  render();
};
chrome.storage.local.get('maxHistory').then((s) => {
  if (typeof s.maxHistory === 'number') maxInput.value = String(s.maxHistory);
});
render();
