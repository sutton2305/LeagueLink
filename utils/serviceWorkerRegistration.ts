export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Service worker registration from a Blob URL is not supported for security reasons.
      // This functionality is disabled to prevent console errors. A dedicated service worker
      // file (e.g., sw.js) served over HTTPS would be required for this to work.
    });
  }
}