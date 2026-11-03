import { createCapture } from '../shared/db';
import { makeThumb } from '../shared/image';

const btn = document.getElementById('go') as HTMLButtonElement;
const msg = document.getElementById('msg')!;

btn.addEventListener('click', async () => {
  msg.textContent = '';
  let stream: MediaStream | undefined;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // Give the compositor a moment so the first frame is the real content, not a blank one.
    await new Promise((r) => setTimeout(r, 400));
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext('2d')!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Empty frame'))), 'image/png'));
    const id = await createCapture(blob, {
      title: 'Window capture',
      url: '',
      width: c.width,
      height: c.height,
      thumb: await makeThumb(blob),
    });
    location.replace(chrome.runtime.getURL(`src/editor/editor.html?id=${id}`));
  } catch (e) {
    msg.textContent = e instanceof DOMException && e.name === 'NotAllowedError' ? 'Capture cancelled.' : `Capture failed: ${e}`;
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
});
