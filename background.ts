export {}
// let contentScriptReady = false;

// chrome.runtime.onMessage.addListener((message, sender) => {
//   if (message.action === "contentScriptReady") {
//     contentScriptReady = true;
//   }
// });

// chrome.commands.onCommand.addListener((command, tab) => {
//   executeAction(tab.id, command);
// });


// function executeAction(tabId, action) {
//   if (!contentScriptReady) {
//     console.log("Content script not ready. Retrying in 1 second...");
//     setTimeout(() => executeAction(tabId, action), 1000);
//     return;
//   }
//   chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
//     if (chrome.runtime.lastError) {
//       console.log("Content script not ready. Retrying in 1 second...");
//       setTimeout(() => executeAction(tabId, action), 1000);
//       return;
//     }

//     if (response && response.status === "ready") {
//       chrome.tabs.sendMessage(tabId, { action: "checkSelection" }, (response) => {
//         if (chrome.runtime.lastError) {
//           console.error("Error checking selection:", chrome.runtime.lastError);
//           return;
//         }
    
//         if (response && response.hasSelection) {
//           chrome.tabs.sendMessage(tabId, { action, selection: response.selection });
//         } else {
//           console.log("No text selected. Ignoring command.");
//         }
//       });
//     }
//   });
// }

// background.ts
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    // First, inject the content script
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ['content.js'], // Plasmo will compile your content.ts to content.js
      },
      () => {
        // After the content script is injected, execute the function
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            world: "MAIN",
            func: () => {
              // @ts-ignore
              speaker()
            }
          },
          () => {
            console.log("Function executed");
          }
        );
      }
    );
  }
});