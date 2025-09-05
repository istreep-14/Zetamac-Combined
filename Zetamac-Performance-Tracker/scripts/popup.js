// scripts/popup.js - Statistics and badges for Math Practice Extension

document.addEventListener('DOMContentLoaded', function() {
  // Load all data
  chrome.storage.local.get({ 
    results: [], 
    records: [],
    badges: {},
    dailyBests: {}
  }, function(data) {
    const results = data.results;
    const records = data.records || [];
    const badges = data.badges || {};
    const dailyBests = data.dailyBests || {};
    
    // Show header with count and default mode reminder
    const headerDiv = document.querySelector('h1');
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'font-size: 11px; color: #666; font-weight: normal; margin-top: 5px;';
    infoDiv.innerHTML = results.length + ' problems tracked<br><span style="color: #f57c00;">Only default mode (2 min, full range) counts</span>';
    headerDiv.appendChild(infoDiv);
    
    // Check for new badges
    checkAndAwardBadges(results, badges);
    
    // Update daily best if in a game session
    updateDailyBest(results, dailyBests);

    if (results.length < 10) {
      document.getElementById('main-stats').innerHTML = 
        '<div style="text-align: center; padding: 20px; color: #999;">Need at least 10 problems in default mode to show statistics</div>';
    } else {
      // === MAIN STATISTICS ===
      showMainStatistics(results);
    }
    
    // === PERSONAL RECORDS BOARD ===
    showRecordsBoard(records);
    
    // === MULTIPLICATION GRID ===
    if (results.length >= 20) {
      showMultiplicationGrid(results);
    } else {
      document.getElementById('mult-grid').innerHTML = 
        '<div style="text-align: center; padding: 10px; color: #999; font-size: 12px;">Need 20+ problems for multiplication analysis</div>';
    }
    
    // === WEEKLY CALENDAR ===
    showWeeklyCalendar(dailyBests, 0);
    
    // === BADGES ===
    showBadges(badges);
    
    // === CLEAR BUTTON ===
    setupClearButton(records);
  });
});

// Main statistics display
function showMainStatistics(results) {
  let statsHTML = '';
  
  // Operation breakdown
  const operatorStats = analyzeByOperatorDetailed(results);
  statsHTML += '<div class="stat-section"><h3>Operations</h3><div class="op-stats">';
  
  const ops = ['+', '-', '*', '/'];
  ops.forEach(function(op) {
    if (operatorStats[op] && operatorStats[op].count > 0) {
      const stat = operatorStats[op];
      const isSloweast = stat.avg === Math.max(...ops.map(o => operatorStats[o] ? operatorStats[o].avg : 0));
      statsHTML += '<div class="op-row ' + (isSloweast ? 'slowest' : '') + '">';
      statsHTML += '<span>' + getOperationName(op) + ':</span>';
      statsHTML += '<span>' + Math.round(stat.avg) + 'ms (' + stat.count + ')</span>';
      statsHTML += '</div>';
    }
  });
  statsHTML += '</div></div>';
  
  // Improvement trend
  if (results.length >= 20) {
    const oldResults = results.slice(0, Math.floor(results.length / 2));
    const newResults = results.slice(Math.floor(results.length / 2));
    const oldAvg = oldResults.reduce((sum, r) => sum + r.time, 0) / oldResults.length;
    const newAvg = newResults.reduce((sum, r) => sum + r.time, 0) / newResults.length;
    const improvement = ((oldAvg - newAvg) / oldAvg * 100).toFixed(1);
    
    statsHTML += '<div class="stat-section"><h3>Progress</h3>';
    if (improvement > 0) {
      statsHTML += '<div class="progress-good">▲ ' + improvement + '% faster than earlier</div>';
    } else {
      statsHTML += '<div class="progress-bad">▼ ' + Math.abs(improvement) + '% slower than earlier</div>';
    }
    statsHTML += '<div class="progress-detail">Now: ' + Math.round(newAvg) + 'ms | Before: ' + Math.round(oldAvg) + 'ms</div>';
    statsHTML += '</div>';
  }
  
  // Speed distribution
  const speedDist = getSpeedDistribution(results);
  statsHTML += '<div class="stat-section"><h3>Speed Distribution</h3>';
  statsHTML += '<div class="speed-bars">';
  statsHTML += '<div class="speed-bar"><div class="bar" style="width:' + speedDist.lightning + '%; background:#4caf50;"></div><span>&lt;1s: ' + speedDist.lightning + '%</span></div>';
  statsHTML += '<div class="speed-bar"><div class="bar" style="width:' + speedDist.fast + '%; background:#8bc34a;"></div><span>1-2s: ' + speedDist.fast + '%</span></div>';
  statsHTML += '<div class="speed-bar"><div class="bar" style="width:' + speedDist.medium + '%; background:#ff9800;"></div><span>2-3s: ' + speedDist.medium + '%</span></div>';
  statsHTML += '<div class="speed-bar"><div class="bar" style="width:' + speedDist.slow + '%; background:#f44336;"></div><span>&gt;3s: ' + speedDist.slow + '%</span></div>';
  statsHTML += '</div></div>';
  
  document.getElementById('main-stats').innerHTML = statsHTML;
}

// Personal records board
function showRecordsBoard(records) {
  const recordsDiv = document.getElementById('records-board');
  
  if (records.length === 0) {
    recordsDiv.innerHTML = '<div class="no-records">No records yet. Complete a full 2-minute session!</div>';
    return;
  }
  
  // Sort records by score (problems solved) and show top 3
  const topRecords = records.sort((a, b) => b.score - a.score).slice(0, 3);
  
  let recordsHTML = '<div class="records-list">';
  const medals = ['🥇', '🥈', '🥉'];
  
  topRecords.forEach(function(record, index) {
    const date = new Date(record.timestamp);
    const dateStr = (date.getMonth() + 1) + '/' + date.getDate();
    recordsHTML += '<div class="record-item">';
    recordsHTML += '<span class="medal">' + medals[index] + '</span>';
    recordsHTML += '<span class="score">' + record.score + ' problems</span>';
    recordsHTML += '<span class="date">' + dateStr + '</span>';
    recordsHTML += '</div>';
  });
  recordsHTML += '</div>';
  
  recordsDiv.innerHTML = recordsHTML;
}

// Multiplication difficulty grid
function showMultiplicationGrid(results) {
  const multStats = {};
  
  // Initialize stats for numbers 2-12
  for (let i = 2; i <= 12; i++) {
    multStats[i] = { count: 0, total: 0, avg: 0 };
  }
  
  // Analyze multiplication problems
  results.forEach(function(result) {
    const match = result.problem.match(/(\d+)\s*(\S)\s*(\d+)/);
    if (!match) return;
    
    const op = normalizeOperator(match[2]);
    if (op !== '*') return;
    
    const n1 = parseInt(match[1], 10);
    const n2 = parseInt(match[3], 10);
    
    // Count if either number is in 2-12 range
    [n1, n2].forEach(function(num) {
      if (num >= 2 && num <= 12) {
        multStats[num].count++;
        multStats[num].total += result.time;
      }
    });
  });
  
  // Calculate averages and sort
  const sortedNums = [];
  Object.keys(multStats).forEach(function(num) {
    if (multStats[num].count > 0) {
      multStats[num].avg = multStats[num].total / multStats[num].count;
      sortedNums.push({
        num: parseInt(num),
        avg: multStats[num].avg,
        count: multStats[num].count
      });
    }
  });
  
  sortedNums.sort((a, b) => b.avg - a.avg);
  
  // Create visual grid
  let gridHTML = '<div class="mult-grid-container">';
  gridHTML += '<div class="grid-title">Multiplication Difficulty (2-12)</div>';
  gridHTML += '<div class="mult-bars">';
  
  sortedNums.forEach(function(item, index) {
    const maxTime = sortedNums[0].avg;
    const barWidth = (item.avg / maxTime * 100);
    const color = index < 3 ? '#f44336' : index < 6 ? '#ff9800' : '#4caf50';
    
    gridHTML += '<div class="mult-bar-row">';
    gridHTML += '<span class="mult-num">×' + item.num + '</span>';
    gridHTML += '<div class="mult-bar-bg">';
    gridHTML += '<div class="mult-bar" style="width:' + barWidth + '%; background:' + color + ';"></div>';
    gridHTML += '</div>';
    gridHTML += '<span class="mult-time">' + Math.round(item.avg) + 'ms</span>';
    gridHTML += '</div>';
  });
  
  gridHTML += '</div></div>';
  document.getElementById('mult-grid').innerHTML = gridHTML;
}

// Weekly calendar view
function showWeeklyCalendar(dailyBests, weekOffset) {
  const calendarDiv = document.getElementById('calendar');
  const today = new Date();
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - today.getDay() - (weekOffset * 7));
  
  let calendarHTML = '<div class="calendar-header">';
  calendarHTML += '<button id="prev-week" class="week-nav">←</button>';
  calendarHTML += '<span class="week-label">Week of ' + (currentWeekStart.getMonth() + 1) + '/' + currentWeekStart.getDate() + '</span>';
  calendarHTML += '<button id="next-week" class="week-nav" ' + (weekOffset === 0 ? 'disabled' : '') + '>→</button>';
  calendarHTML += '</div>';
  
  calendarHTML += '<div class="calendar-grid">';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentWeekStart);
    date.setDate(currentWeekStart.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    const dayScore = dailyBests[dateKey];
    const isToday = date.toDateString() === today.toDateString();
    
    calendarHTML += '<div class="calendar-day ' + (isToday ? 'today' : '') + '">';
    calendarHTML += '<div class="day-name">' + days[i] + '</div>';
    calendarHTML += '<div class="day-score">' + (dayScore || '-') + '</div>';
    calendarHTML += '</div>';
  }
  
  calendarHTML += '</div>';
  calendarDiv.innerHTML = calendarHTML;
  
  // Add navigation listeners
  document.getElementById('prev-week').addEventListener('click', function() {
    showWeeklyCalendar(dailyBests, weekOffset + 1);
  });
  
  const nextBtn = document.getElementById('next-week');
  if (nextBtn && !nextBtn.disabled) {
    nextBtn.addEventListener('click', function() {
      showWeeklyCalendar(dailyBests, weekOffset - 1);
    });
  }
}

// Badge system
function showBadges(badges) {
  const badgesDiv = document.getElementById('badges');
  
  const allBadges = [
    { id: 'first10', name: 'Starter', icon: '🌱', condition: 'Complete 10 problems' },
    { id: 'first100', name: 'Dedicated', icon: '💪', condition: 'Complete 100 problems' },
    { id: 'first1000', name: 'Master', icon: '🏆', condition: 'Complete 1000 problems' },
    { id: 'sub1sec', name: 'Lightning', icon: '⚡', condition: 'Solve a problem in under 1 second' },
    { id: 'score50', name: 'Half Century', icon: '5️⃣0️⃣', condition: 'Score 50+ in one session' },
    { id: 'score100', name: 'Century', icon: '💯', condition: 'Score 100+ in one session' },
    { id: 'consistent', name: 'Consistent', icon: '🎯', condition: '90% problems under 3 seconds (50+ problems)' },
    { id: 'weekStreak', name: 'Week Warrior', icon: '📅', condition: 'Play 7 days in a row' }
  ];
  
  let badgesHTML = '<div class="badges-grid">';
  
  allBadges.forEach(function(badge) {
    const earned = badges[badge.id];
    badgesHTML += '<div class="badge ' + (earned ? 'earned' : 'locked') + '" title="' + badge.condition + '">';
    badgesHTML += '<div class="badge-icon">' + (earned ? badge.icon : '🔒') + '</div>';
    badgesHTML += '<div class="badge-name">' + badge.name + '</div>';
    badgesHTML += '</div>';
  });
  
  badgesHTML += '</div>';
  badgesDiv.innerHTML = badgesHTML;
}

// Check and award badges
function checkAndAwardBadges(results, badges) {
  const newBadges = Object.assign({}, badges);
  let anyNew = false;
  
  // Problem count badges
  if (results.length >= 10 && !newBadges.first10) {
    newBadges.first10 = true;
    anyNew = true;
  }
  if (results.length >= 100 && !newBadges.first100) {
    newBadges.first100 = true;
    anyNew = true;
  }
  if (results.length >= 1000 && !newBadges.first1000) {
    newBadges.first1000 = true;
    anyNew = true;
  }
  
  // Speed badge
  if (!newBadges.sub1sec && results.some(r => r.time < 1000)) {
    newBadges.sub1sec = true;
    anyNew = true;
  }
  
  // Consistency badge
  if (results.length >= 50 && !newBadges.consistent) {
    const under3sec = results.filter(r => r.time < 3000).length;
    if (under3sec / results.length >= 0.9) {
      newBadges.consistent = true;
      anyNew = true;
    }
  }
  
  if (anyNew) {
    chrome.storage.local.set({ badges: newBadges });
  }
}

// Update daily best score
function updateDailyBest(results, dailyBests) {
  // Group results by timestamp to find sessions
  const sessions = {};
  results.forEach(function(result) {
    const date = new Date(result.timestamp);
    const dateKey = date.toISOString().split('T')[0];
    
    if (!sessions[dateKey]) {
      sessions[dateKey] = [];
    }
    sessions[dateKey].push(result);
  });
  
  // Find best score for each day (assuming 120 problems max in 2 minutes)
  const newDailyBests = Object.assign({}, dailyBests);
  let updated = false;
  
  Object.keys(sessions).forEach(function(dateKey) {
    const dayResults = sessions[dateKey];
    // Estimate session scores (group problems within 2.5 minutes)
    let sessionScore = 0;
    let maxScore = 0;
    let lastTime = null;
    
    dayResults.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    dayResults.forEach(function(result) {
      const time = new Date(result.timestamp);
      if (!lastTime || (time - lastTime) < 150000) { // Within 2.5 minutes
        sessionScore++;
      } else {
        maxScore = Math.max(maxScore, sessionScore);
        sessionScore = 1;
      }
      lastTime = time;
    });
    maxScore = Math.max(maxScore, sessionScore);
    
    if (!newDailyBests[dateKey] || newDailyBests[dateKey] < maxScore) {
      newDailyBests[dateKey] = maxScore;
      updated = true;
    }
  });
  
  if (updated) {
    chrome.storage.local.set({ dailyBests: newDailyBests });
  }
}

// Setup clear button
function setupClearButton(records) {
  const clearBtn = document.getElementById('clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      if (confirm('Clear all statistics? Your personal records will be kept.')) {
        chrome.storage.local.set({ results: [] }, function() {
          // Keep records, badges, and daily bests
          location.reload();
        });
      }
    });
  }
}

// === HELPER FUNCTIONS ===

function analyzeByOperatorDetailed(results) {
  const stats = {
    '+': { count: 0, total: 0, avg: 0 },
    '-': { count: 0, total: 0, avg: 0 },
    '*': { count: 0, total: 0, avg: 0 },
    '/': { count: 0, total: 0, avg: 0 }
  };
  
  results.forEach(function(result) {
    const match = result.problem.match(/(\d+)\s*(\S)\s*(\d+)/);
    if (match) {
      const op = normalizeOperator(match[2]);
      if (stats[op]) {
        stats[op].count++;
        stats[op].total += result.time;
      }
    }
  });
  
  Object.keys(stats).forEach(function(op) {
    if (stats[op].count > 0) {
      stats[op].avg = stats[op].total / stats[op].count;
    }
  });
  
  return stats;
}

function getSpeedDistribution(results) {
  const ranges = { lightning: 0, fast: 0, medium: 0, slow: 0 };
  
  results.forEach(function(r) {
    if (r.time < 1000) ranges.lightning++;
    else if (r.time < 2000) ranges.fast++;
    else if (r.time < 3000) ranges.medium++;
    else ranges.slow++;
  });
  
  const total = results.length;
  return {
    lightning: Math.round(ranges.lightning / total * 100),
    fast: Math.round(ranges.fast / total * 100),
    medium: Math.round(ranges.medium / total * 100),
    slow: Math.round(ranges.slow / total * 100)
  };
}

function normalizeOperator(opSymbol) {
  if (opSymbol === '×' || opSymbol === 'x' || opSymbol === 'X' || opSymbol === '*') return '*';
  if (opSymbol === '÷' || opSymbol === '/') return '/';
  if (opSymbol === '–' || opSymbol === '-' || opSymbol === '−') return '-';
  if (opSymbol === '+') return '+';
  return opSymbol;
}

function getOperationName(op) {
  const names = { '+': 'Add', '-': 'Sub', '*': 'Mult', '/': 'Div' };
  return names[op] || 'Unknown';
}