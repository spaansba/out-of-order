// openPanelOnActionClick is explicitly reset: it persists in the profile from
// older builds and consumes the click before onClicked fires.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    void chrome.sidePanel.open({ tabId: tab.id });
  }
});
