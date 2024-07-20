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

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

chrome.action.onClicked.addListener((tab) => {
  // Make sure the tab.id is valid before sending the message
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "play" }, (response) => {
      if (chrome.runtime.lastError) {
        // Handle any errors that might have occurred
        console.error("Error sending message:", chrome.runtime.lastError.message);
      } else {
        // Handle the response from the content script
        console.log(response.status);
      }
    });
  }
});