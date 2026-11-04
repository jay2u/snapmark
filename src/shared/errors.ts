export interface FriendlyError {
  /** What to tell the user. */
  message: string;
  /** The raw error, for bug reports. */
  detail: string;
}

/** Turn browser/extension errors into something a person can act on. */
export function describeError(e: unknown): FriendlyError {
  const detail = e instanceof Error ? e.message : String(e);
  const d = detail.toLowerCase();
  let message = detail;
  if (d.includes('cannot access contents') || d.includes('must request permission') || d.includes('cannot access a chrome') || d.includes('cannot be scripted') || d.includes('extensions gallery')) {
    message =
      "Snapmark isn't allowed to read this page. Browser pages (chrome://), the Chrome Web Store and PDFs are off-limits, and local files need \"Allow access to file URLs\" turned on in the extension's details.";
  } else if (d.includes('max_capture_visible_tab_calls')) {
    message = "Chrome limits how fast pages can be captured. Wait a few seconds and try again.";
  } else if (d.includes('timed out')) {
    message = 'The page stopped responding while it was being captured. Reload the page and try again.';
  } else if (d.includes('no active tab')) {
    message = 'No page is open to capture. Switch to the tab you want and try again.';
  }
  return { message, detail };
}
