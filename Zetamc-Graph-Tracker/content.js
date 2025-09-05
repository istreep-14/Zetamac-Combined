// content.js
function extractScore() {
  const scoreElement = document.querySelector("span.correct");
  if (scoreElement) {
    const score = scoreElement.textContent.split(": ")[1];
    return parseInt(score, 10);
  }
  return null;
}

function saveScore(score) {
  const timestamp = new Date().toISOString();
  chrome.runtime.sendMessage({ action: "saveScore", score, timestamp });
}

// Function to check if the game has ended
function isGameEnded() {
  const secondsLeftElement = document.querySelector("span.left");
  return (
    secondsLeftElement && secondsLeftElement.textContent === "Seconds left: 0"
  );
}

// Set up a MutationObserver to watch for changes in the game div
const gameDiv = document.getElementById("game");
const observer = new MutationObserver((mutations) => {
  if (isGameEnded()) {
    const score = extractScore();
    if (score !== null) {
      saveScore(score);
      observer.disconnect(); // Stop observing once the score is saved
    }
  }
});

// Start observing the game div for changes
observer.observe(gameDiv, { childList: true, subtree: true });
