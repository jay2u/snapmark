import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCapture, deleteCapture, getCapture, listMeta, pruneHistory, saveState } from '../src/shared/db';

const info = { title: 't', url: 'u', width: 1, height: 1 };

describe('capture history', () => {
  it('round-trips a capture and its saved annotations', async () => {
    const id = await createCapture(new Blob(['x']), info);
    await saveState(id, { crop: { x: 1, y: 2, w: 3, h: 4 }, nodes: ['{"a":1}'] });
    const got = await getCapture(id);
    expect(got?.record.saved?.nodes).toEqual(['{"a":1}']);
    expect(got?.record.saved?.crop).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    await deleteCapture(id);
    expect(await getCapture(id)).toBeUndefined();
  });

  it('keeps only the newest N captures', async () => {
    for (let i = 0; i < 5; i++) {
      await createCapture(new Blob([String(i)]), { ...info, title: `c${i}` });
      await new Promise((r) => setTimeout(r, 3));
    }
    await pruneHistory(2);
    const left = await listMeta();
    expect(left.length).toBe(2);
    expect(left[0].title).toBe('c4');
  });
});
