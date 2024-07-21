// background.ts
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    // First, inject the content script
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ['content.ts'], // Plasmo will compile your content.ts to content.js
      },
      () => {
        // After the content script is injected, execute the function
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            files: ['content.js']
          },
          () => {
            if (chrome.runtime.lastError) {
              console.error("Script injection failed: ", chrome.runtime.lastError.message);
              return;
            }
            console.log("Content script injected, and speaker should be executed from within it.");
          }
        );
      }
    );
  }
});