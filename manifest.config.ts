export default {
  manifest_version: 3,
  name: 'Snapmark - Screenshot & Annotate',
  version: '1.0.0',
  description:
    'Capture the visible area, a selection, a full page or any window, then annotate with arrows, highlights, text, blur and more.',
  icons: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
  action: {
    default_title: 'Snapmark',
    default_popup: 'src/popup/popup.html',
    default_icon: { 16: 'icons/16.png', 32: 'icons/32.png' },
  },
  background: { service_worker: 'background.js', type: 'module' },
  permissions: ['activeTab', 'scripting', 'storage', 'unlimitedStorage', 'contextMenus', 'clipboardWrite'],
  commands: {
    'capture-visible': {
      suggested_key: { default: 'Alt+Shift+V' },
      description: 'Capture visible area',
    },
    'capture-region': {
      suggested_key: { default: 'Alt+Shift+S' },
      description: 'Capture a selected region',
    },
    'capture-full': {
      suggested_key: { default: 'Alt+Shift+F' },
      description: 'Capture full page',
    },
    'capture-desktop': {
      suggested_key: { default: 'Alt+Shift+D' },
      description: 'Capture a window or the desktop',
    },
  },
};
