console.log('[Zetamac Tracker] Content script loaded');

function areSettingsDefault() {
  try {
    const scripts = document.querySelectorAll('script');
    let settingsScript = null;

    for (const script of scripts) {
      if (script.textContent.includes('import { init }')) {
        settingsScript = script;
        break;
      }
    }

    if (!settingsScript) return false;

    const match = settingsScript.textContent.match(/init\((.*?)\);/);
    if (!match || !match[1]) return false;

    const settings = JSON.parse(match[1]);
    const defaultsAreOn = settings.add && settings.sub && settings.mul && settings.div;
    
    if (!defaultsAreOn) {
      console.log("[Zetamac Tracker] Non-default operations detected:", settings);
    }
    
    return defaultsAreOn;

  } catch (error) {
    console.error("[Zetamac Tracker] Error checking settings:", error);
    return false;
  }
}

function initializeTracker(problemElement) {
  console.log('[Zetamac Tracker] Initializing tracker');
  let currentProblem = null;
  let startTime = null;
  let problemCount = 0;
  let sessionStart = Date.now();
  let sessionProblems = 0;

  const saveResult = (problem, time) => {
    const newResult = {
      problem: problem,
      time: time,
      timestamp: new Date().toISOString()
    };
    
    sessionProblems++;
    console.log('[Zetamac Tracker] Saving result #' + (++problemCount) + ':', problem, Math.round(time) + 'ms');
    
    chrome.storage.local.get({ results: [] }, (data) => {
      const updatedResults = data.results;
      updatedResults.push(newResult);
      chrome.storage.local.set({ results: updatedResults });
    });
  };
  
  // Check for session end to save records
  const checkSessionEnd = () => {
    const timerElement = document.querySelector('span.left');
    if (timerElement && timerElement.textContent.includes('Seconds left: 0')) {
      // Session ended, save as a record if it was a full 2-minute session
      if (Date.now() - sessionStart >= 110000) { // At least 110 seconds
        chrome.storage.local.get({ records: [] }, (data) => {
          const records = data.records || [];
          records.push({
            score: sessionProblems,
            timestamp: new Date().toISOString()
          });
          // Keep only top 10 records
          records.sort((a, b) => b.score - a.score);
          chrome.storage.local.set({ records: records.slice(0, 10) });
          console.log('[Zetamac Tracker] Session record saved:', sessionProblems, 'problems');
        });
      }
    }
  };
  
  setInterval(checkSessionEnd, 1000);

  const observerCallback = (mutationsList, observer) => {
    const newProblem = problemElement.textContent.trim();
    
    if (newProblem === currentProblem || !newProblem) {
      return;
    }
    
    if (startTime !== null && currentProblem !== null) {
      const endTime = performance.now();
      const timeTaken = endTime - startTime;
      saveResult(currentProblem, timeTaken);
    }
    
    currentProblem = newProblem;
    startTime = performance.now();
  };

  const observer = new MutationObserver(observerCallback);
  observer.observe(problemElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

const intervalId = setInterval(() => {
  const problemElement = document.querySelector('span.problem');
  const timerElement = document.querySelector('span.left');

  if (problemElement && timerElement) {
    const timerText = timerElement.textContent.trim();
    const isTimerDefault = timerText === 'Seconds left: 120' || timerText.includes('120');
    const areOpsDefault = areSettingsDefault();

    if (isTimerDefault && areOpsDefault) {
      console.log("[Zetamac Tracker] Default settings confirmed. Starting tracker!");
      clearInterval(intervalId);
      initializeTracker(problemElement);
    } else {
      console.log("[Zetamac Tracker] Non-default settings. Tracker disabled.");
      clearInterval(intervalId);
    }
  }
}, 250);