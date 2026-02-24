
chrome.runtime.sendMessage({ type: 'TAB_REFRESHED' });

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }
  if (event.data.source === 'statejs-bridge') {
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED', data: event.data.payload  });
  }
});