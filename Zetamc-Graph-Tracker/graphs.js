document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.local.get(["scores"], function (result) {
    const scores = result.scores || [];
    if (scores.length === 0) {
      document.body.innerHTML = "<h2>No scores available to display graphs.</h2>";
      return;
    }

    // Sort scores in chronological order (oldest first)
    const chartScores = [...scores].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let cumulativeScores = [];
    let cumulativeAverage = [];
    let cumulativeMedian = [];
    let cumulative25 = [];
    let cumulativeMax = [];
    let cumulativeStdDev = [];
    let labels = [];

    chartScores.forEach((scoreObj) => {
      const scoreValue = Number(scoreObj.score);
      cumulativeScores.push(scoreValue);
      let sortedScores = cumulativeScores.slice().sort((a, b) => a - b);

      // Calculate cumulative average
      const avg = cumulativeScores.reduce((sum, curr) => sum + curr, 0) / cumulativeScores.length;
      cumulativeAverage.push(avg);

      // Calculate median (50th percentile)
      const n = sortedScores.length;
      let median;
      if (n % 2 === 0) {
        median = (sortedScores[n / 2 - 1] + sortedScores[n / 2]) / 2;
      } else {
        median = sortedScores[Math.floor(n / 2)];
      }
      cumulativeMedian.push(median);

      // Calculate 25th Percentile
      const idx25 = 0.25 * (n - 1);
      const lower = sortedScores[Math.floor(idx25)];
      const upper = sortedScores[Math.ceil(idx25)];
      const percentile25 = lower + (upper - lower) * (idx25 - Math.floor(idx25));
      cumulative25.push(percentile25);

      // Calculate cumulative maximum
      const currentMax = Math.max(...cumulativeScores);
      cumulativeMax.push(currentMax);

      // Calculate cumulative standard deviation
      const variance = cumulativeScores.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / cumulativeScores.length;
      const stdDev = Math.sqrt(variance);
      cumulativeStdDev.push(stdDev);

      // Use a formatted timestamp as the label
      const date = new Date(scoreObj.timestamp);
      labels.push(date.toLocaleDateString() + " " + date.toLocaleTimeString());
    });

    // ---------------------------------------------------------------------
    // Score Trend Chart: (Average, Median, 25th, and Top Score)
    const ctxScore = document.getElementById("scoreChart").getContext("2d");
    new Chart(ctxScore, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          { label: "Average Score", data: cumulativeAverage, borderColor: "red", fill: false },
          { label: "Median Score (50th Percentile)", data: cumulativeMedian, borderColor: "green", fill: false },
          { label: "25th Percentile Score", data: cumulative25, borderColor: "blue", fill: false },
          { label: "Top Score", data: cumulativeMax, borderColor: "purple", fill: false }
        ]
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: "Score Trends Over Time" } },
        scales: {
          x: { title: { display: true, text: "Game Session" } },
          y: { title: { display: true, text: "Score" } }
        }
      }
    });

    // ---------------------------------------------------------------------
    // Trend Chart for Mean & Volatility (Standard Deviation) Over Time
    const ctxTrend = document.getElementById("trendChart").getContext("2d");
    new Chart(ctxTrend, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          { label: "Mean Score", data: cumulativeAverage, borderColor: "orange", fill: false },
          { label: "Std Dev (Volatility)", data: cumulativeStdDev, borderColor: "brown", fill: false }
        ]
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: "Mean & Volatility Trends Over Time" } },
        scales: {
          x: { title: { display: true, text: "Game Session" } },
          y: { title: { display: true, text: "Value" } }
        }
      }
    });

    // ---------------------------------------------------------------------
    // Bell Curve Distribution Based on Overall Scores
    const overallAvg = cumulativeAverage[cumulativeAverage.length - 1];
    const overallStd = cumulativeStdDev[cumulativeStdDev.length - 1];
    const bellX = [];
    const bellY = [];
    const numPoints = 100;
    const startX = overallAvg - 3 * overallStd;
    const endX = overallAvg + 3 * overallStd;
    const step = (endX - startX) / numPoints;

    function gaussian(x, mean, std) {
      const exponent = -0.5 * Math.pow((x - mean) / std, 2);
      return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
    }

    for (let i = 0; i <= numPoints; i++) {
      const xVal = startX + step * i;
      bellX.push(xVal.toFixed(2));
      bellY.push(gaussian(xVal, overallAvg, overallStd));
    }

    const ctxBell = document.getElementById("bellCurveChart").getContext("2d");
    new Chart(ctxBell, {
      type: "line",
      data: {
        labels: bellX,
        datasets: [{ label: "Bell Curve Distribution", data: bellY, borderColor: "teal", fill: false }]
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: "Bell Curve of Overall Scores" } },
        scales: {
          x: { title: { display: true, text: "Score" } },
          y: { title: { display: true, text: "Density" } }
        }
      }
    });
  });
}); 