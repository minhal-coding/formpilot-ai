// Route through action.onClicked so Chrome grants activeTab before opening the panel.
chrome.action.onClicked.addListener(tab => {
  if (tab.id !== undefined) chrome.sidePanel.open({ tabId: tab.id }).catch(console.error);
});
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(console.error);
