// chart.js (safe, non-conflicting version)
// Replaces previous chart.js to avoid 'marketChart' redeclaration errors.
// This file will only initialize a chart if the page has a canvas with id="marketChart"
// and if a chart instance hasn't already been created.

// --- Market Chart Initialization (Fixed DOM-ready Version) ---
document.addEventListener("DOMContentLoaded", function () {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js library not found — cannot render chart.');
    return;
  }

  const canvas = document.getElementById('marketChart');
  if (!canvas) {
    console.warn('marketChart canvas not found — skipping initialization.');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Create chart
  window.marketChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Buy Rate (₦)',
          borderColor: '#3498db',
          backgroundColor: 'rgba(52,152,219,0.15)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          data: []
        },
        {
          label: 'Sell Rate (₦)',
          borderColor: '#27ae60',
          backgroundColor: 'rgba(39,174,96,0.12)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          data: []
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      stacked: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#2c3e50', font: { size: 12, weight: '600' } }
        },
        title: {
          display: true,
          text: 'Live Market Rate (₦ / USD)',
          color: '#2c3e50',
          font: { size: 14, weight: '700' }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Time' },
          ticks: { color: '#34495e' },
          grid: { color: 'rgba(0,0,0,0.04)' }
        },
        y: {
          title: { display: true, text: '₦ per USD' },
          ticks: { color: '#34495e' },
          grid: { color: 'rgba(0,0,0,0.04)' }
        }
      }
    }
  });

      console.log("✅ Chart initialized successfully!");

    // --- Optional On-Screen Indicator ---
    const badge = document.createElement('div');
    badge.textContent = '✅ Chart Ready';
    Object.assign(badge.style, {
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: '#2ecc71',
      color: '#fff',
      padding: '6px 12px',
      borderRadius: '6px',
      fontSize: '13px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      zIndex: '9999'
    });
    document.body.appendChild(badge);

    // Fade out automatically after 4 seconds
    setTimeout(() => badge.remove(), 4000);

  // Define update function globally
  window.updateMarketChart = function (buy = window.buyRate || null, sell = window.sellRate || null) {
    if (!window.marketChart || !window.marketChart.data) return;

    const now = new Date().toLocaleTimeString();

    // push new data
    window.marketChart.data.labels.push(now);
    window.marketChart.data.datasets[0].data.push(Number(buy) || null);
    window.marketChart.data.datasets[1].data.push(Number(sell) || null);

    // keep only 25 points
    while (window.marketChart.data.labels.length > 25) {
      window.marketChart.data.labels.shift();
      window.marketChart.data.datasets.forEach(ds => ds.data.shift());
    }

    try {
      window.marketChart.update();
    } catch (err) {
      console.error('Error updating marketChart:', err);
    }
  };

  console.log('✅ Market chart initialized successfully after DOM load.');
});
