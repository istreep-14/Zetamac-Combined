document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.local.get(["scores"], function (result) {
    const scores = result.scores || [];

    // Populate scores table (most recent first)
    const table = document.getElementById("scoresTable");
    const tableScores = [...scores].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    tableScores.forEach(scoreObj => {
      const row = table.insertRow(-1);
      const scoreCell = row.insertCell(0);
      const dateCell = row.insertCell(1);
      const timeCell = row.insertCell(2);
      const date = new Date(scoreObj.timestamp);
      scoreCell.textContent = scoreObj.score;
      dateCell.textContent = date.toLocaleDateString();
      timeCell.textContent = date.toLocaleTimeString();
    });
  });
});
