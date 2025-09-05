# Zetamac Performance Tracker

A Chrome extension that provides comprehensive performance analytics for [Zetamac.com](https://arithmetic.zetamac.com), helping users improve their mental math speed through detailed statistics, visual analysis, and gamification.

![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)

## Overview

Zetamac Performance Tracker transforms your mental math practice into a data-driven improvement journey. By analyzing every problem you solve, it identifies your weaknesses and tracks your progress over time.


## Features

### **Performance Analytics**
- **Operation Breakdown** - Track average solving time for addition, subtraction, multiplication, and division
- **Speed Distribution** - Visualize what percentage of problems you solve in <1s, 1-2s, 2-3s, and >3s
- **Progress Tracking** - Compare your recent performance against earlier sessions

### **Personal Records**
- Track your top 3 best scores (problems completed in 2 minutes)
- Records persist even when clearing statistics
- Medal system for motivation

### **Multiplication Heatmap**
- Visual analysis of multiplication tables (2-12)
- Color-coded difficulty levels (red = hardest, green = easiest)
- Instantly identify which times tables need more practice

### **Weekly Calendar**
- View your best daily scores at a glance
- Navigate through previous weeks
- Track consistency and streak patterns

### **Achievement System**
Unlock badges as you improve:
- **Starter** - Complete 10 problems
- **Dedicated** - Complete 100 problems  
- **Master** - Complete 1000 problems
- **Lightning** - Solve a problem in under 1 second
- **Century** - Score 100+ in one session
- And more!

## Installation

### From Chrome Web Store

*(coming soon)*


### From Source (Development)
1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/zetamac-tracker.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the project folder
5. The extension icon should appear in your toolbar


## Technical Implementation

### Architecture
```
Extension
├── Content Script (content.js)
│   ├── Monitors game state
│   ├── Validates default settings
│   ├── Tracks problem timing
│   └── Saves to Chrome Storage
│
└── Popup Interface (popup.js + popup.html)
    ├── Retrieves stored data
    ├── Calculates statistics
    ├── Generates visualizations
    └── Manages achievements
```

### Key Technologies
- **Vanilla JavaScript** - Zero dependencies for optimal performance
- **Chrome Storage API** - Persistent local data storage
- **MutationObserver API** - Real-time DOM monitoring
- **CSS Grid & Flexbox** - Responsive layouts
- **Local-First Design** - All data stays in your browser

### Performance Optimizations
- Sub-5ms problem detection latency
- Efficient batch storage updates
- Debounced calculations
- Lightweight DOM operations


## Project Structure

```
zetamac-tracker/
├── manifest.json           # Extension configuration
├── popup.html             # Statistics interface
├── scripts/
│   ├── popup.js          # Statistics calculations & UI
│   └── content.js        # Game monitoring script
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## How It Works

1. **Detection**: Content script identifies when you're playing in default mode
2. **Monitoring**: Tracks each problem and solving time using MutationObserver
3. **Storage**: Saves results to Chrome's local storage
4. **Analysis**: Popup script processes data to generate insights
5. **Visualization**: Displays statistics through charts and grids


## Roadmap

### Version 1.1 (Planned)
- [ ] Export statistics to CSV
- [ ] Dark mode support
- [ ] Additional achievement badges
- [ ] Problem-specific tracking (e.g., "7×8" specifically)

### Version 1.2 (Future)
- [ ] Cloud backup option (opt-in)
- [ ] Comparison with community averages
- [ ] Custom training recommendations
- [ ] Session replay analysis


## Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/zetamac-tracker.git

# Navigate to project
cd zetamac-tracker

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the project folder

# Make changes and reload extension to test
```




## Contact

- GitHub: [@atai222](https://github.com/atai222)
- Project Link: [https://github.com/atai222/zetamac-tracker](https://github.com/atai222/zetamac-tracker)

---

