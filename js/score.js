// Pre-computed from 5000 simulation runs (5 strategies x 1000 games, normal difficulty)
// Each entry: [value, percent_of_runs_that_scored_lower]
const BASELINE_PERCENTILES = {
  days: [
    [3, 0], [4, 5], [5, 10], [6, 25], [7, 40], [8, 50], [9, 58], [10, 65], [11, 75], [12, 80], [13, 85], [14, 90], [15, 93], [16, 95], [17, 96], [18, 97], [19, 98], [20, 99]
  ],
  distances: [
    [0, 0], [5, 0], [10, 1], [15, 3], [20, 6], [25, 10], [30, 25], [35, 40], [40, 50], [45, 58], [50, 65], [55, 72], [60, 78], [65, 83], [70, 88], [75, 90], [80, 92], [85, 95], [90, 96], [95, 97], [100, 98], [110, 99]
  ]
};

const Score = {
  /**
   * Calculate final score from game state
   * @param {Object} gameState - final game state
   * @returns {Object} - score data object
   */
  calculate(gameState) {
    return {
      days: gameState.day,
      distance: Math.round(gameState.distanceCovered * 10) / 10,
      deathCause: gameState.deathCause || 'unknown',
      timesLostHunters: gameState.timesLostHunters || 0,
      achievements: this.getAchievements(gameState),
      date: new Date().toISOString().split('T')[0]
    };
  },

  /**
   * Get achievements earned during this run
   * @param {Object} gameState - final game state
   * @returns {Array<string>} - array of achievement strings
   */
  getAchievements(gameState) {
    const achievements = [];

    // Track stats for advanced achievements
    const stats = gameState.achievementStats || {};

    // Days survived (always shown)
    if (gameState.day === 1) {
      achievements.push('First steps taken');
    } else if (gameState.day >= 30) {
      achievements.push('Myth — Survived 30 days');
    } else if (gameState.day >= 20) {
      achievements.push('Legend — Survived 20 days');
    } else if (gameState.day >= 15) {
      achievements.push('The Long Road — Survived 15 days');
    } else if (gameState.day >= 10) {
      achievements.push('Into the Unknown — Survived 10 days');
    } else if (gameState.day >= 7) {
      achievements.push('Week of Running');
    }

    // Distance milestones
    if (gameState.distanceCovered >= 100) {
      achievements.push('Century Runner — 100+ miles covered');
    } else if (gameState.distanceCovered >= 75) {
      achievements.push('Long Strider — 75+ miles covered');
    } else if (gameState.distanceCovered >= 50) {
      achievements.push('Distance Master — 50+ miles covered');
    }

    // Lost hunters
    if (gameState.timesLostHunters >= 5) {
      achievements.push('Ghost — Lost hunters 5+ times');
    } else if (gameState.timesLostHunters >= 3) {
      achievements.push('Shadow Walker — Lost hunters 3+ times');
    } else if (gameState.timesLostHunters >= 1) {
      achievements.push(`Lost the hunters ${gameState.timesLostHunters} time${gameState.timesLostHunters > 1 ? 's' : ''}`);
    }

    // Night runner (pushed at night 3+ times)
    if (stats.nightPushes >= 3) {
      achievements.push('Night Runner — Pushed through darkness');
    }

    // Iron will (never rested)
    if (stats.timesRested === 0 && gameState.day >= 3) {
      achievements.push('Iron Will — Never rested');
    }

    // Desert crosser (survived with high thirst)
    if (stats.phasesWithHighThirst >= 3) {
      achievements.push('Desert Crosser — Survived extreme thirst');
    }

    // On the edge (survived near-death)
    if (stats.phasesNearDeath >= 3) {
      achievements.push('On the Edge — Danced with death');
    }

    // Perfect runner (never took damage from heat/exhaustion)
    if (stats.perfectRunner && gameState.day >= 5) {
      achievements.push('Perfect Balance — Mastered the chase');
    }

    // Doomed sprint (died on day 1)
    if (gameState.day === 1 && gameState.deathCause !== 'caught') {
      achievements.push('Too Fast, Too Soon');
    }

    return achievements;
  },

  /**
   * Calculate percentile comparisons from baseline simulation data
   * @param {Object} scoreData - score object from calculate()
   * @returns {Array<string>} - array of percentile strings
   */
  calculatePercentiles(scoreData) {
    const results = [];

    // Days percentile
    const dayPct = this.getPercentile(scoreData.days, BASELINE_PERCENTILES.days);
    if (dayPct > 0) {
      results.push(`You survived longer than ${dayPct}% of runs`);
    }

    // Distance percentile
    const distPct = this.getPercentile(scoreData.distance, BASELINE_PERCENTILES.distances);
    if (distPct > 0) {
      results.push(`Your distance was farther than ${distPct}% of runs`);
    }

    return results;
  },

  /**
   * Find percentile for a value given sorted breakpoints
   * @param {number} value - the player's value
   * @param {Array} breakpoints - array of [threshold, percentile] pairs
   * @returns {number} - percentile (0-100)
   */
  getPercentile(value, breakpoints) {
    let pct = 0;
    for (let i = 0; i < breakpoints.length; i++) {
      if (value >= breakpoints[i][0]) {
        pct = breakpoints[i][1];
      } else {
        break;
      }
    }
    return pct;
  },

  /**
   * Save score to localStorage leaderboard
   * @param {Object} scoreData - score object from calculate()
   */
  save(scoreData) {
    const leaderboard = this.loadLeaderboard();

    // Add new score
    leaderboard.push(scoreData);

    // Sort by days (desc), then distance (desc)
    leaderboard.sort((a, b) => {
      if (b.days !== a.days) {
        return b.days - a.days;
      }
      return b.distance - a.distance;
    });

    // Keep only top entries
    const maxEntries = (typeof CONFIG !== 'undefined' && CONFIG.score)
      ? CONFIG.score.maxLeaderboardEntries
      : 10;

    const trimmed = leaderboard.slice(0, maxEntries);

    // Save to localStorage
    try {
      localStorage.setItem('primalchase_leaderboard', JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save leaderboard:', e);
    }
  },

  /**
   * Load leaderboard from localStorage
   * @returns {Array<Object>} - array of score objects
   */
  loadLeaderboard() {
    try {
      const stored = localStorage.getItem('primalchase_leaderboard');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
    }
    return [];
  },

  /**
   * Generate shareable text for clipboard
   * @param {Object} scoreData - score object
   * @returns {string} - formatted share text
   */
  generateShareText(scoreData) {
    const lines = [];

    lines.push('PRIMAL CHASE');
    lines.push('');
    lines.push(`DAY ${scoreData.days} — ${this.formatDeathCauseUpper(scoreData.deathCause)}`);
    lines.push('━━━━━━━━━━━━━━━━━━');
    lines.push(`${scoreData.distance} miles covered`);

    if (scoreData.timesLostHunters > 0) {
      lines.push(`Lost hunters ${scoreData.timesLostHunters} time${scoreData.timesLostHunters > 1 ? 's' : ''}`);
    }

    if (scoreData.achievements && scoreData.achievements.length > 0) {
      lines.push('');
      scoreData.achievements.forEach(achievement => {
        lines.push(`• ${achievement}`);
      });
    }

    lines.push('');
    lines.push('How long can a King outrun a shadow?');
    lines.push('primalchase.com');

    return lines.join('\n');
  },

  /**
   * Format death cause in uppercase
   * @param {string} cause - death cause
   * @returns {string} - formatted uppercase cause
   */
  formatDeathCauseUpper(cause) {
    const causes = {
      caught: 'CAUGHT',
      heatstroke: 'HEATSTROKE',
      exhaustion: 'EXHAUSTION',
      dehydration: 'DEHYDRATION',
      starvation: 'STARVATION'
    };
    return causes[cause] || cause.toUpperCase();
  },

  /**
   * Copy text to clipboard
   * @param {string} text - text to copy
   * @param {HTMLElement} button - button element (for feedback)
   */
  copyToClipboard(text, button) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          // Show feedback
          if (button) {
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
              button.textContent = originalText;
            }, 2000);
          }
        })
        .catch(err => {
          console.error('Failed to copy text:', err);
          this.fallbackCopy(text);
        });
    } else {
      this.fallbackCopy(text);
    }
  },

  /**
   * Fallback copy method for browsers without clipboard API
   * @param {string} text - text to copy
   */
  fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(textarea);
  },

  /**
   * Generate and download share image
   * @param {Object} scoreData - score object
   */
  generateShareImage(scoreData) {
    const canvas = document.getElementById('share-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W = 600;
    const H = 600;
    canvas.width = W;
    canvas.height = H;

    // --- Background: warm savannah gradient ---
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#2e1c10');
    gradient.addColorStop(0.4, '#1a0f08');
    gradient.addColorStop(0.7, '#1c1209');
    gradient.addColorStop(1, '#2a1a0e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // --- Noise grain texture ---
    const imageData = ctx.getImageData(0, 0, W, H);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const noise = (Math.random() - 0.5) * 18;
      pixels[i] += noise;
      pixels[i + 1] += noise;
      pixels[i + 2] += noise;
    }
    ctx.putImageData(imageData, 0, 0);

    // --- Border frame ---
    const borderInset = 12;
    ctx.strokeStyle = '#4a3526';
    ctx.lineWidth = 2;
    ctx.strokeRect(borderInset, borderInset, W - borderInset * 2, H - borderInset * 2);

    // --- Colors ---
    const amber = '#d4883a';
    const gold = '#d4a574';
    const lightAmber = '#e8a864';
    const secondary = '#b8944f';
    ctx.textAlign = 'center';

    // --- Title ---
    ctx.fillStyle = lightAmber;
    ctx.font = 'bold 50px Georgia, serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('PRIMAL CHASE', W / 2, 70);
    ctx.letterSpacing = '0px';

    // --- Death line ---
    ctx.fillStyle = amber;
    ctx.font = 'bold 32px Georgia, serif';
    ctx.fillText(`DAY ${scoreData.days} — ${this.formatDeathCauseUpper(scoreData.deathCause)}`, W / 2, 125);

    // --- Separator ---
    ctx.strokeStyle = '#4a3526';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 152);
    ctx.lineTo(W - 80, 152);
    ctx.stroke();

    // --- Distance ---
    ctx.fillStyle = secondary;
    ctx.font = '26px Georgia, serif';
    ctx.fillText(`${scoreData.distance} miles covered`, W / 2, 190);

    // --- Achievements ---
    let yOffset = 235;
    if (scoreData.achievements && scoreData.achievements.length > 0) {
      ctx.font = 'bold 20px Georgia, serif';
      ctx.fillStyle = lightAmber;
      ctx.fillText('Achievements', W / 2, yOffset);
      yOffset += 30;

      ctx.font = '18px Georgia, serif';
      ctx.fillStyle = amber;
      scoreData.achievements.slice(0, 5).forEach(achievement => {
        const maxWidth = 460;
        const words = achievement.split(' ');
        let line = '';
        const lines = [];
        words.forEach(word => {
          const testLine = line + (line ? ' ' : '') + word;
          if (ctx.measureText(testLine).width > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = testLine;
          }
        });
        if (line) lines.push(line);
        lines.forEach(textLine => {
          ctx.fillText(textLine, W / 2, yOffset);
          yOffset += 24;
        });
      });
    }

    // --- Tagline (randomized) ---
    const taglines = [
      'How long can a King outrun a shadow?',
      'Born to rule. Destined to run.',
      'The distance closes. It always does.',
      'No throne. No rest. Only the chase.',
      'Every stride buys one more breath.',
      'You can outrun everything but time.',
      'Even Kings have shadows.',
      'Apex. Prey. The line blurs at dusk.',
    ];
    const tagline = taglines[Math.floor(Math.random() * taglines.length)];

    ctx.fillStyle = gold;
    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillText(tagline, W / 2, H - 50);

    // --- URL ---
    ctx.fillStyle = amber;
    ctx.font = '16px Georgia, serif';
    ctx.fillText('primalchase.com', W / 2, H - 25);

    // Copy image to clipboard (requires HTTPS — falls back to download on file://)
    const button = document.getElementById('btn-share-image');
    const feedback = (msg) => {
      if (!button) return;
      const orig = button.textContent;
      button.textContent = msg;
      setTimeout(() => { button.textContent = orig; }, 2000);
    };

    canvas.toBlob(blob => {
      if (!blob) { feedback('Failed'); return; }

      // Try clipboard (only works on HTTPS / secure contexts)
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined' && window.isSecureContext) {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          .then(() => feedback('Copied!'))
          .catch(() => {
            this._downloadBlob(blob);
            feedback('Saved!');
          });
      } else {
        this._downloadBlob(blob);
        feedback('Saved!');
      }
    }, 'image/png');
  },

  /**
   * Download a blob as a PNG file
   */
  _downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'primal-chase-score.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
