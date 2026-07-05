// Chrome's built-in behavior: the toolbar icon opens the panel, clicking it
// again closes it.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
