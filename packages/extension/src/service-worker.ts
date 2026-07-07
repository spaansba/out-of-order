// Open the side panel from the toolbar icon. Chrome renders its own close
// control on the panel, so no custom toggle is needed.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
