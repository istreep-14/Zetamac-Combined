// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveScore") {
    const { score, timestamp } = request;
    chrome.storage.local.get(["scores"], (result) => {
      const scores = result.scores || [];
      scores.push({ score, timestamp });
      chrome.storage.local.set({ scores }, () => {
        console.log("Score saved:", score, "at", timestamp);
      });
    });
  }
});
