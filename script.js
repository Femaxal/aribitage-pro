// --- Real-time Rate Simulation + Discount Rules ---
/*let buyRate = 1500;
let sellRate = 1650;

const MIN_BUY = 1450;
const MAX_BUY = 1550;
const MIN_SELL = 1600;
const MAX_SELL = 1700;*/

// === SESSION TIMEOUT SETTINGS ===
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const WARNING_TIME = 5 * 60 * 1000; // show warning at 10 minutes (5 min before logout)
let lastActivityTime = Date.now();
let warningShown = false;

// --- Authentication Guard (Redirect if not logged in) ---
document.addEventListener("DOMContentLoaded", () => {
  const isAuthPage = window.location.pathname.endsWith("auth.html");
  const activeUser = localStorage.getItem("activeUser");

  if (!isAuthPage && !activeUser) {
    // Not logged in, redirect to auth page
    window.location.href = "auth.html";
  }

  // If user is logged in and tries to open auth page, redirect to dashboard
  if (isAuthPage && activeUser) {
    window.location.href = "index.html";
  }
});

// --- Display Logged-in Username ---
document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("activeUser");
  const nameDisplay = document.getElementById("welcomeUser");

  if (username && nameDisplay) {
    nameDisplay.textContent = `👋 Welcome, ${username}!`;
  }
});

const RATE_UPDATE_INTERVAL = 5000; // every 5 seconds

// Account initialization
// Automatically generate 44 user accounts
let accounts = [];
const INITIAL_BALANCE = 0;

for (let i = 1; i <= 44; i++) {
    accounts.push({
        id: i,
        name: `Account ${i}`,
        ngnBalance: 0,// local currency wallet
        usdBalance: 0, // foreign currency holdings
        initialBalance: INITIAL_BALANCE,
        totalProfit: 0,
        trades: [],
        savedWallets: [],
        chart: null
});

}

let selectedAccountIndex = 0;
let currentAccountId = null;
let portfolioChart = null;

// Update portfolio summary
function updateSummary() {
    const summaryBar = document.getElementById('summaryBar');
    if (!summaryBar) {
        // If we're on a page without summaryBar, just update platform totals and exit
        updatePlatformTotals();
        return;
    }
    const totalUsd = accounts.reduce((sum, a) => sum + a.usdBalance, 0);
    const totalNgn = accounts.reduce((sum, a) => sum + a.ngnBalance, 0);
    const totalProfit = accounts.reduce((sum, a) => sum + a.totalProfit, 0);
    const totalTrades = accounts.reduce((sum, a) => sum + a.trades.length, 0);
    const totalInitial = accounts.reduce((sum, a) => sum + a.initialBalance, 0);
    const roi = totalInitial > 0 ? ((totalProfit / totalInitial) * 100).toFixed(1) : '0.0';

    summaryBar.innerHTML = `
        <div class="summary-item">
            <div class="summary-label">💼 Total Portfolio Value</div>
            <div class="summary-value">$${totalUsd.toFixed(2)}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">💰 Total Profit Generated</div>
            <div class="summary-value" style="color: #2ecc71;">$${totalProfit.toFixed(2)}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">📊 Total Trades Executed</div>
            <div class="summary-value">${totalTrades}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">📈 Portfolio ROI</div>
            <div class="summary-value" style="color: ${roi >= 0 ? '#2ecc71' : '#e74c3c'};">${roi}%</div>
        </div>
    `;
    // Update dashboard totals if elements exist
    if (document.getElementById('totalUsd')) {
        const totalUsd = accounts.reduce((sum, a) => sum + a.usdBalance, 0);
        const totalProfit = accounts.reduce((sum, a) => sum + a.totalProfit, 0);
        document.getElementById('totalUsd').textContent = totalUsd.toFixed(2);
        document.getElementById('totalProfit').textContent = totalProfit.toFixed(2);
    }
    // keep platform totals in sync (if those DOM elements exist)
    updatePlatformTotals();
}

// Destroy chart helper
function destroyChart(chart) {
    if (chart) {
        chart.destroy();
        return null;
    }
}

// Update accounts display
function updateAccountsDisplay() {
    const accountsGrid = document.getElementById('accountsGrid');
    if (!accountsGrid) return; // page doesn't show accounts grid
    accountsGrid.innerHTML = '';

    const account = accounts[selectedAccountIndex];
        const expectedProfitSell = account.usdBalance > 0 ?
            ((account.usdBalance * (sellRate - buyRate)) / buyRate).toFixed(2) : '0.00';


        let tradeHistoryHTML = '';
        if (account.trades.length === 0) {
            tradeHistoryHTML = '<div class="trade-row" style="border-bottom: none; color: #7f8c8d;"><span>No trades yet</span><span>-</span></div>';
        } else {
            const recentTrades = account.trades.slice(-5);
            recentTrades.forEach((trade, index) => {
                const tradeNum = account.trades.length - recentTrades.length + index + 1;
                let emoji = '💱';
                let color = '#3498db';
                let statusText = '';

                if (trade.type.includes('Buy')) emoji = '🛒';
                else if (trade.type.includes('Sell')) emoji = '💰';
                else if (trade.type.includes('Deposit')) emoji = '💵';
                else if (trade.type.includes('Withdraw')) emoji = '🏧';

                if (trade.status === 'Pending') {
                    color = '#f39c12';
                    statusText = ' (Pending...)';
                } else if (trade.type.includes('Withdraw')) {
                    color = '#e74c3c';
                } else if (trade.type.includes('Deposit')) {
                    color = '#27ae60';
                }

                const profitDisplay = trade.rate
                    ? `₦${(trade.rate * trade.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : `₦${trade.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

                tradeHistoryHTML += `
                    <div class="trade-row">
                        <span>${emoji} ${trade.type} - Trade ${tradeNum}${statusText}</span>
                        <span style="color: ${color};">${profitDisplay}</span>
                    </div>
                `;
            });

        }

        const accountCard = document.createElement('div');
        accountCard.className = 'account-card';
        accountCard.id = `account-${account.id}`;
        accountCard.innerHTML = `
            <div class="account-header">
                <h3>💼 ${account.name}</h3>
                <div class="balance-display">
                    <div class="balance-item">
                        <div class="balance-label">USD Balance</div>
                        <div class="balance-value">$${account.usdBalance.toFixed(2)}</div>
                        </div>
                        <div class="balance-item">
                            <div class="balance-label">NGN Balance</div>
                            <div class="balance-value">₦${account.ngnBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                    <div class="balance-item">
                        <div class="balance-label">Total Profit</div>
                        <div class="balance-value profit-value">$${account.totalProfit.toFixed(2)}</div>
                    </div>
                </div>
            </div>
            <div class="account-body">
                <div class="trade-preview">
                    <h4 style="margin-top:0; color:#2c3e50;">📊 Trading Info</h4>
                    <div class="trade-row">
                        <span>💵 USD Balance:</span>
                        <span>$${account.usdBalance.toFixed(2)}</span>
                    </div>
                    <div class="trade-row">
                        <span>💳 NGN Balance:</span>
                        <span>₦${account.ngnBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>

                    <div class="trade-row">
                        <span>🎯 Expected Sell Profit:</span>
                        <span style="color: #27ae60;">$${expectedProfitSell}</span>
                    </div>
                    <div class="trade-row">
                        <span>📈 Total Trades:</span>
                        <span>${account.trades.length}</span>
                    </div>
                    <h4 style="margin-top:15px; color:#2c3e50;">📋 Recent Trade History:</h4>
                    ${tradeHistoryHTML}
                </div>

                <div class="trade-feedback" id="feedback-${account.id}"></div>

                <div class="account-actions">
                    <button class="btn btn-primary" onclick="openBuyModal(${account.id})">🛒 Buy USD</button>
                    <button class="btn btn-success" onclick="openSellModal(${account.id})" ${account.usdBalance <= 0 ? 'disabled' : ''}>💰 Sell USD</button>
                    <button class="btn btn-warning" onclick="openDepositModal(${account.id})">➕ Deposit</button>
                    <button class="btn btn-danger" onclick="openWithdrawModal(${account.id})" ${account.ngnBalance <= 0 ? 'disabled' : ''}>➖ Withdraw</button>
                    <button class="btn btn-secondary" onclick="resetAccount(${account.id})">🔄 Reset</button>
                </div>
            </div>
        `;
        accountsGrid.appendChild(accountCard);

    updatePortfolioChart();
}

// Update portfolio chart
function updatePortfolioChart() {
    const canvas = document.getElementById('portfolioChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const labels = accounts.map(account => account.name);
    const balanceData = accounts.map(account => account.usdBalance);
    const profitData = accounts.map(account => account.totalProfit);

    portfolioChart = destroyChart(portfolioChart);

    portfolioChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Current Balance ($)',
                    data: balanceData,
                    backgroundColor: '#3498db',
                    borderColor: '#2980b9',
                    borderWidth: 2
                },
                {
                    label: 'Total Profit ($)',
                    data: profitData,
                    backgroundColor: '#27ae60',
                    borderColor: '#229954',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true },
                x: { grid: { color: 'rgba(0,0,0,0.1)' } }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

// --- Modal Control Helper ---
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
  } else {
    console.warn(`Modal with ID '${modalId}' not found.`);
  }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function openBuyModal(accountId) {
  const paystackAccount = "3" + Math.floor(100000000 + Math.random() * 900000000);
  document.getElementById('paystackAccountNumber').textContent = paystackAccount;
  document.getElementById('liveBuyRateDisplay').textContent = buyRate.toFixed(2);

    currentAccountId = accountId;
    document.getElementById('buyAmountInput').value = '';
    document.getElementById('ngnRequired').textContent = '0';
    document.getElementById('buyModal').classList.add('show');
}

function openSellModal(accountId) {
    currentAccountId = accountId;
    const account = accounts.find(a => a.id === accountId);

    const dropdown = document.getElementById('savedWalletsDropdown');
    dropdown.innerHTML = '<option value="">Select saved wallet</option>';

    if (account.savedWallets.length > 0) {
        dropdown.style.display = 'block';
        account.savedWallets.forEach(wallet => {
            const option = document.createElement('option');
            option.value = wallet;
            option.textContent = `${wallet.substring(0, 20)}...`;
            dropdown.appendChild(option);
        });
    } else dropdown.style.display = 'none';

    document.getElementById('usdToSell').textContent = account.usdBalance.toFixed(2);
    document.getElementById('ngnToReceive').textContent = (account.usdBalance * sellRate).toLocaleString();
    const expectedProfit = account.usdBalance > 0 ?
        ((account.usdBalance * (sellRate - buyRate)) / buyRate).toFixed(2) : '0.00';
    document.getElementById('profitToEarn').textContent = expectedProfit;

    document.getElementById('sellWalletInput').value = '';
    document.getElementById('sellModal').classList.add('show');
}

// ===== DEPOSIT / WITHDRAW SIMULATION (Realistic Delay + History Logging) =====

let activeAccountId = null;

// Open Deposit Modal
function openDepositModal(accountId) {
    activeAccountId = accountId;
    document.getElementById('depositAmountInput').value = '';
    openModal('depositModal');
}

// Open Withdraw Modal
function openWithdrawModal(accountId) {
    activeAccountId = accountId;
    document.getElementById('withdrawAmountInput').value = '';
    openModal('withdrawModal');
}

// Confirm Withdraw
function confirmWithdraw() {
    const amount = parseFloat(document.getElementById('withdrawAmountInput').value);
    if (!amount || amount <= 0) return alert('Enter a valid amount.');

    const account = accounts.find(a => a.id === activeAccountId);

    if (account.ngnBalance < amount) {
        alert('❌ Insufficient balance for withdrawal.');
        return;
    }

    // Log pending transaction
    const pendingTrade = {
        type: 'Withdraw (Pending)',
        amount,
        profit: 0,
        timestamp: new Date(),
        rate: null,
        status: 'Pending'
    };
    account.trades.push(pendingTrade);

    // Deduct immediately to simulate “funds on hold”
    account.ngnBalance -= amount;

    showTradeSuccess(account.id, `💸 Withdrawal of ₦${amount.toLocaleString()} initiated... awaiting network confirmation.`);

    // Simulate realistic 30–60s delay
    const delay = Math.random() * 30000 + 30000; // 30–60 seconds

    setTimeout(() => {
        // Update trade record
        pendingTrade.type = 'Withdraw';
        pendingTrade.status = 'Completed';

        showTradeSuccess(account.id, `✅ ₦${amount.toLocaleString()} withdrawal completed successfully!`);
        updateAccountsDisplay();
        updateSummary();
    }, delay);

    closeModal('withdrawModal');
    updateAccountsDisplay();
    updateSummary();
}

let pendingWithdrawal = null;

// Step 1: Open withdrawal modal
function openWithdrawModal(accountId) {
  activeAccountId = accountId;
  document.getElementById('withdrawAmountInput').value = '';
  openModal('withdrawModal');
}

// Step 2: After user enters amount, open PIN modal
function initiateWithdraw() {
  const amount = parseFloat(document.getElementById('withdrawAmountInput').value);
  if (!amount || amount <= 0) return alert('Enter a valid withdrawal amount.');

  const account = accounts.find(a => a.id === activeAccountId);
  if (account.ngnBalance < amount) return alert('❌ Insufficient balance.');

  pendingWithdrawal = { accountId: account.id, amount };
  closeModal('withdrawModal');
  openModal('pinModal');
}

// Step 3: Toggle PIN visibility
function togglePinVisibility() {
  const pinInput = document.getElementById('pinInput');
  pinInput.type = pinInput.type === 'password' ? 'text' : 'password';
}

// Step 4: Verify PIN and simulate processing
function confirmPIN() {
  const pin = document.getElementById('pinInput').value.trim();
  if (!/^\d{4}$/.test(pin)) return alert('Please enter a valid 4-digit PIN.');

  const { accountId, amount } = pendingWithdrawal;
  const account = accounts.find(a => a.id === accountId);

  closeModal('pinModal');
  document.getElementById('pinInput').value = '';

  // === Popup 1: Verifying PIN ===
  const popup = document.createElement('div');
  popup.classList.add('verification-popup');
  popup.innerHTML = `
    <div class="verification-box">
      <p>🔐 <strong>Verifying PIN<span class="dots"><span>.</span><span>.</span><span>.</span></span></strong></p>
      <p style="font-size:0.9em;color:#7f8c8d;">Please wait while we confirm your PIN.</p>
    </div>
  `;
  document.body.appendChild(popup);

  // Show "PIN Verified!" after 4 seconds
  setTimeout(() => {
    popup.querySelector('.verification-box').innerHTML = `
      <p>✅ <strong>PIN Verified!</strong></p>
      <p style="font-size:0.9em;color:#27ae60;">Proceeding with withdrawal...</p>
    `;
  }, 4000);

  // After 6 seconds total → show the loading screen
  setTimeout(() => {
    popup.remove();

    // === Popup 2: Loading Animation ===
    const loadingPopup = document.createElement('div');
    loadingPopup.classList.add('verification-popup');
    loadingPopup.innerHTML = `
      <div class="verification-box">
        <div class="loader"></div>
        <p>💸 <strong>Processing Withdrawal...</strong></p>
        <p style="font-size:0.9em;color:#7f8c8d;">Please wait a moment...</p>
      </div>
    `;
    document.body.appendChild(loadingPopup);

    // Delay between 15–20 seconds total (including previous steps)
    const delay = 9000 + Math.random() * 6000; // (~15s total from start)

    setTimeout(() => {
      loadingPopup.remove();

      account.ngnBalance -= amount;
      account.trades.push({
        type: 'Withdraw',
        amount,
        profit: 0,
        timestamp: new Date(),
        status: 'Completed'
      });

      showTradeSuccess(account.id, `✅ ₦${amount.toLocaleString()} successfully withdrawn!`);
      updateAccountsDisplay();
      updateSummary();

      pendingWithdrawal = null;
    }, delay);
  }, 6000);
}


function fillWalletFromDropdown() {
    const selectedWallet = document.getElementById('savedWalletsDropdown').value;
    if (selectedWallet) document.getElementById('sellWalletInput').value = selectedWallet;
}

// Buy flow - attach listener only if element exists
document.addEventListener('DOMContentLoaded', function() {
    const buyAmountInput = document.getElementById('buyAmountInput');
    if (buyAmountInput) {
        buyAmountInput.addEventListener('input', function() {
            const amount = parseFloat(this.value) || 0;

            // Apply discount rules dynamically based on live rate
            let discount = 0.10;
            if (amount >= 10000) discount = 0.20;
            else if (amount >= 1000) discount = 0.15;

            const effectiveRate = buyRate * (1 - discount);
            const ngnRequired = amount * effectiveRate;

            // Reflect in modal
            const ngnEl = document.getElementById('ngnRequired');
            if (ngnEl) ngnEl.textContent = ngnRequired.toLocaleString(undefined, { maximumFractionDigits: 2 });

            // (Optional) show rate info dynamically
            this.setAttribute('data-effective-rate', effectiveRate.toFixed(2));
            this.setAttribute('data-discount', (discount * 100).toFixed(0));
        });
    }
});

function confirmBuy() {
  const amount = parseFloat(document.getElementById('buyAmountInput').value) || 0;
  if (amount <= 0) return alert('Please enter a valid USD amount.');

  const account = accounts[selectedAccountIndex];

  let discount = 0.10;
  if (amount >= 10000) discount = 0.20;
  else if (amount >= 1000) discount = 0.15;

  const effectiveRate = buyRate * (1 - discount);
  const totalNGN = amount * effectiveRate;

  if (account.ngnBalance < totalNGN) return alert('Insufficient NGN balance.');

  account.ngnBalance -= totalNGN;
  closeModal('buyModal');

  // Show "Processing Transaction..." popup
  const processingPopup = document.createElement('div');
  processingPopup.classList.add('verification-popup');
  processingPopup.innerHTML = `
    <div class="verification-box glassy">
      <div class="loader"></div>
      <p>💳 <strong>Processing Transaction...</strong></p>
      <p style="font-size:0.9em;color:#7f8c8d;">Finalizing your USD purchase. Please wait...</p>
    </div>
  `;
  document.body.appendChild(processingPopup);

  // 3–5 minute delay (180,000–300,000 ms)
  const delay = 180000 + Math.random() * 120000;

  // Midway status update (after half of the delay)
  setTimeout(() => {
    if (document.body.contains(processingPopup)) {
      processingPopup.querySelector('p strong').textContent = "Still Processing...";
      processingPopup.querySelector('p:nth-of-type(2)').textContent = "This may take a few more minutes.";
    }
  }, delay / 2);

  // Final completion
  setTimeout(() => {
    processingPopup.remove();

    account.usdBalance += amount;
    account.trades.push({
      type: 'Buy',
      amount,
      profit: 0,
      timestamp: new Date(),
      rate: effectiveRate,
      discount: `${(discount * 100).toFixed(0)}%`,
      totalPaid: totalNGN
    });

    updateAccountsDisplay();
    updateSummary();
    showTradeSuccess(account.id, `✅ ${amount.toFixed(2)} USD credited after processing.`);
  }, delay);
}

// Sell flow
function confirmSell() {
  const usdInput = parseFloat(document.getElementById("sellAmountInput").value);
  if (!usdInput || usdInput <= 0) {
    alert("Please enter a valid USD amount to sell.");
    return;
  }

  const account = accounts.find(a => a.id === currentAccountId);
  if (!account) {
    alert("No account selected.");
    return;
  }

  if (usdInput > accounts.usdBalance) {
    alert("Insufficient USD balance to complete this transaction.");
    return;
  }

  if (!document.getElementById('sellWalletInput').value.trim())
    return alert('Please enter a crypto wallet address');

  const ngnEarned = usdInput * sellRate;
  const profit = usdInput * ((sellRate - buyRate) / buyRate);
  account.usdBalance -= usdInput;

  closeModal('sellModal');

  // Show "Processing Transaction..." popup
  const processingPopup = document.createElement('div');
  processingPopup.classList.add('verification-popup');
  processingPopup.innerHTML = `
    <div class="verification-box glassy">
      <div class="loader"></div>
      <p>💰 <strong>Processing Transaction...</strong></p>
      <p style="font-size:0.9em;color:#7f8c8d;">Please wait while we process your sale.</p>
    </div>
  `;
  document.body.appendChild(processingPopup);

  // 3–5 minute delay (180,000–300,000 ms)
  const delay = 180000 + Math.random() * 120000;

  // Midway update
  setTimeout(() => {
    if (document.body.contains(processingPopup)) {
      processingPopup.querySelector('p strong').textContent = "Still Processing...";
      processingPopup.querySelector('p:nth-of-type(2)').textContent = "Transaction is being confirmed on the network.";
    }
  }, delay / 2);

  // Final completion
  setTimeout(() => {
    processingPopup.remove();

    const profit = (usdInput * (sellRate - buyRate)) / buyRate;
    account.ngnBalance += ngnEarned;
    account.totalProfit += profit;

    account.trades.push({
      type: 'Sell',
      amount: usdInput,
      profit,
      timestamp: new Date(),
      rate: sellRate
    });

    updateAccountsDisplay();
    updateSummary();
    showTradeSuccess(account.id, `✅ ₦${ngnEarned.toLocaleString()} credited after sale completion.`);
  }, delay);
}

document.addEventListener("DOMContentLoaded", function() {
  const sellAmountInput = document.getElementById("sellAmountInput");
  if (sellAmountInput) {
    sellAmountInput.addEventListener("input", function() {
      const amount = parseFloat(this.value) || 0;
      const ngnToReceive = amount * sellRate;
      const profit = amount * ((sellRate - buyRate) / buyRate);

      document.getElementById("ngnToReceive").textContent = ngnToReceive.toLocaleString(undefined, { maximumFractionDigits: 2 });
      document.getElementById("profitToEarn").textContent = profit.toFixed(2);
      document.getElementById("usdToSell").textContent = amount.toFixed(2);
    });
  }
});

// Feedback animation
function showTradeSuccess(accountId, message) {
    const feedbackElement = document.getElementById(`feedback-${accountId}`);
    const accountCard = document.getElementById(`account-${accountId}`);
    feedbackElement.innerHTML = `🎉 ${message}`;
    feedbackElement.classList.add('show');
    accountCard.classList.add('trading', 'pulse');
    setTimeout(() => {
        feedbackElement.classList.remove('show');
        accountCard.classList.remove('trading', 'pulse');
    }, 4000);
}

// Reset functions
function resetAccount(accountId) {
    if (!confirm('Are you sure you want to reset this account?')) return;
    const account = accounts.find(a => a.id === accountId);
    account.ngnBalance = account.initialBalance * buyRate;
    account.usdBalance = 0;
    account.totalProfit = 0;
    account.trades = [];
    account.savedWallets = [];
    showTradeSuccess(accountId, '🔄 Account Reset Successfully');
    updateAccountsDisplay();
    updateSummary();
}

function resetAllAccounts() {
    if (!confirm('Are you sure you want to reset ALL accounts?')) return;
    accounts.forEach(account => {
        account.ngnBalance = account.initialBalance * buyRate;
        account.usdBalance = 0;
        account.totalProfit = 0;
        account.trades = [];
        account.savedWallets = [];
    });
    const summaryBar = document.getElementById('summaryBar');
    summaryBar.style.background = '#27ae60';
    summaryBar.innerHTML = `<div style="text-align:center;font-size:1.2em;">🔄 All Accounts Reset Successfully! 🎉</div>`;
    setTimeout(() => { summaryBar.style.background = '#2c3e50'; updateSummary(); }, 3000);
    updateAccountsDisplay();
}

// Export JSON
function exportData() {
    const exportData = {
        accounts,
        exportDate: new Date().toISOString(),
        summary: {
            totalUsdValue: accounts.reduce((s,a)=>s+a.usdBalance,0),
            totalNgnValue: accounts.reduce((s,a)=>s+a.ngnBalance,0),
            totalProfit: accounts.reduce((s,a)=>s+a.totalProfit,0),
            totalTrades: accounts.reduce((s,a)=>s+a.trades.length,0)
        },
        tradingRates: {
            buyRate, sellRate,
            profitMargin: ((sellRate - buyRate) / buyRate * 100).toFixed(1) + '%'
        }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `arbitrage-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const summaryBar = document.getElementById('summaryBar');
    summaryBar.style.background = '#3498db';
    summaryBar.innerHTML = `<div style="text-align:center;font-size:1.2em;">📊 Data Exported Successfully! 💾</div>`;
    setTimeout(() => { summaryBar.style.background = '#2c3e50'; updateSummary(); }, 2000);
}

// Modal close helpers
document.addEventListener('click', e => {
    document.querySelectorAll('.modal').forEach(modal => {
        if (e.target === modal) modal.classList.remove('show');
    });
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    populateAccountDropdown();
    updateAccountsDisplay();
    updateSummary();
    startRateSimulation(); // 🚀 start live rate updates
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'e') { e.preventDefault(); exportData(); }
        if (e.key === 'r' && e.shiftKey) { e.preventDefault(); resetAllAccounts(); }
    }
});

// Add tooltips
function addTooltips() {
    const elements = [
        { selector: '.btn-primary', text: 'Purchase USD using Nigerian bank transfer' },
        { selector: '.btn-success', text: 'Sell USD and receive payment to crypto wallet' },
        { selector: '.btn-secondary', text: 'Reset account to initial state' },
        { selector: '.btn-info', text: 'Export trading data as JSON file (Ctrl+E)' }
    ];
    elements.forEach(item => {
        document.querySelectorAll(item.selector).forEach(el => el.setAttribute('title', item.text));
    });
}
document.addEventListener('DOMContentLoaded', addTooltips);

// Populate dropdown with all accounts
function populateAccountSelector() {
    const dropdown = document.getElementById('accountSelect');
    dropdown.innerHTML = '';
    accounts.forEach((acc, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${acc.name}`;
        dropdown.appendChild(option);
    });
    dropdown.value = selectedAccountIndex;
}

// Change selected account from dropdown
function changeSelectedAccount() {
    const dropdown = document.getElementById('accountSelect');
    selectedAccountIndex = parseInt(dropdown.value);
    updateAccountsDisplay();
}

// Navigation buttons
function showNextAccount() {
    if (selectedAccountIndex < accounts.length - 1) {
        selectedAccountIndex++;
        document.getElementById('selectedAccountName').textContent = accounts[selectedAccountIndex].name;
        updateAccountsDisplay();
    }
}

function showPrevAccount() {
    if (selectedAccountIndex > 0) {
        selectedAccountIndex--;
        document.getElementById('selectedAccountName').textContent = accounts[selectedAccountIndex].name;
        updateAccountsDisplay();
    }
}


// --- Custom dropdown behavior ---
function toggleAccountDropdown() {
    const menu = document.getElementById('accountDropdownMenu');
    menu.classList.toggle('show');
}

// Close dropdown if clicked outside
document.addEventListener('click', function(event) {
    const dropdown = document.querySelector('.dropdown');
    if (!dropdown) return;
    if (!dropdown.contains(event.target)) {
        const menu = document.getElementById('accountDropdownMenu');
        if (menu) menu.classList.remove('show');
    }
});

// Populate the dropdown dynamically with search support
function populateAccountDropdown() {
    const menu = document.getElementById('accountListContainer');
    if (!menu) return; // nothing to populate on pages without the dropdown
    menu.innerHTML = '';
    accounts.forEach((account, i) => {
        const item = document.createElement('div');
        item.textContent = `${account.name}`;
        item.dataset.index = i;
        item.onclick = () => {
            selectedAccountIndex = i;
            const selName = document.getElementById('selectedAccountName');
            if (selName) selName.textContent = account.name;
            const dropdownMenu = document.getElementById('accountDropdownMenu');
            if (dropdownMenu) dropdownMenu.classList.remove('show');
            updateAccountsDisplay();
        };
        menu.appendChild(item);
    });
}

// Filter dropdown items based on search input
function filterAccountDropdown() {
    const input = document.getElementById('accountSearchInput').value.toLowerCase();
    const items = document.querySelectorAll('#accountListContainer div');

    items.forEach(item => {
        const name = item.textContent.toLowerCase();
        item.style.display = name.includes(input) ? 'block' : 'none';
    });
}

// === GUARD FUNCTION (Only Call If Function exists) ===
async function updateMarketChartGuard() {
    if (typeof window.updateMarketChart === 'function') {
        try {
            window.updateMarketChart(buyRate, sellRate);
        } catch (err) {
            console.error('updateMarketChart threw:', err);
        }
    } else {
        console.warn('updateMarketChart not available yet — skipped chart update');
    }
    console.log('🧩 Chart guard executed:', typeof window.updateMarketChart);
}

// === LIVE USD/NGN EXCHANGE RATE FETCHER (Enhanced Version with Timestamp + Source) ===
async function fetchLiveRate() {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();

    const realRate = data?.rates?.NGN;
    if (!realRate || isNaN(realRate)) throw new Error("Invalid NGN rate from API");

    buyRate = realRate * 0.995;
    sellRate = realRate * 1.005;

    const profitMargin = (((sellRate - buyRate) / buyRate) * 100).toFixed(1);

    // Update UI (buy/sell/profit)
    const buyEl = document.getElementById('buyRateDisplay');
    const sellEl = document.getElementById('sellRateDisplay');
    const profitEl = document.getElementById('profitMarginDisplay');
    if (buyEl) buyEl.textContent = buyRate.toFixed(2);
    if (sellEl) sellEl.textContent = sellRate.toFixed(2);
    if (profitEl) profitEl.textContent = profitMargin;

    // 🕒 Add last update info display
    const infoEl = document.getElementById('rateSourceInfo');
    if (infoEl) {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      infoEl.innerHTML = `💹 <strong>Live Source:</strong> Open Exchange API<br>🕒 Updated: <span style="color:#27ae60;">${timeString}</span>`;
    }

    // Refresh other UI elements
    updateAccountsDisplay();
    updateSummary();
    updateMarketChartGuard();

    const liveRateEl = document.getElementById('liveBuyRateDisplay');
    if (liveRateEl) liveRateEl.textContent = buyRate.toFixed(2);

    console.log(`✅ Live rate fetched: ₦${realRate.toFixed(2)} (Buy ₦${buyRate.toFixed(2)} | Sell ₦${sellRate.toFixed(2)})`);
  } catch (error) {
    console.error("⚠️ Error fetching live exchange rate:", error);

    // fallback simulation (minor rate drift)
    buyRate = Math.min(MAX_BUY, Math.max(MIN_BUY, buyRate + (Math.random() - 0.5) * 10));
    sellRate = Math.min(MAX_SELL, Math.max(MIN_SELL, sellRate + (Math.random() - 0.5) * 10));

    // 🕒 Update info element with fallback notice
    const infoEl = document.getElementById('rateSourceInfo');
    if (infoEl) {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      infoEl.innerHTML = `⚙️ <strong>Simulated Mode:</strong> Fallback rate<br>🕒 Last simulated: <span style="color:#e67e22;">${timeString}</span>`;
    }

    updateMarketChartGuard();
  }
}

// Start fetching rates every 15 seconds
function startRateSimulation() {
  fetchLiveRate();
  setInterval(fetchLiveRate, 15000);
}

// --- Cumulative Ledger Table Generator ---
function populateLedgerTable() {
  const tbody = document.getElementById('ledgerBody');
  if (!tbody) return; // Prevent errors if not on this page

  tbody.innerHTML = '';

  // Flatten all trades into one combined list
  const allTrades = accounts.flatMap(acc =>
    acc.trades.map(t => ({ ...t, accountName: acc.name }))
  );

  // Sort by date (newest first)
  allTrades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Render rows
  allTrades.forEach(trade => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(trade.timestamp).toLocaleString()}</td>
      <td>${trade.accountName}</td>
      <td>${trade.type}</td>
      <td>${trade.amount.toFixed(2)}</td>
      <td>₦${trade.rate.toFixed(2)}</td>
      <td>₦${trade.totalPaid ? trade.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}</td>
      <td>${trade.discount || '-'}</td>
      <td>${trade.profit ? trade.profit.toFixed(2) : '-'}</td>
    `;
    tbody.appendChild(row);
  });
}

// --- Populate Trade History Table and Filters ---
function populateTradeHistory() {
  const accountFilter = document.getElementById('accountFilter');
  const tbody = document.getElementById('tradeBody');
  if (!accountFilter || !tbody) return;

  // Populate account dropdown
  accountFilter.innerHTML = '<option value="all">All Accounts</option>';
  accounts.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = acc.name;
    opt.textContent = acc.name;
    accountFilter.appendChild(opt);
  });

  // Initial table
  renderTradeTable(accounts.flatMap(a => a.trades.map(t => ({ ...t, accountName: a.name }))));
  updateProfitChart();
}

// Filter trades based on selections
function filterTrades() {
  const selectedAccount = document.getElementById('accountFilter').value;
  const selectedType = document.getElementById('typeFilter').value;

  const filteredTrades = accounts.flatMap(a => a.trades.map(t => ({ ...t, accountName: a.name })))
    .filter(t => (selectedAccount === 'all' || t.accountName === selectedAccount) &&
                 (selectedType === 'all' || t.type === selectedType));

  renderTradeTable(filteredTrades);
  updateProfitChart(filteredTrades);
}

// Render table rows
function renderTradeTable(trades) {
  const tbody = document.getElementById('tradeBody');
  tbody.innerHTML = '';

  trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  trades.forEach(trade => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${new Date(trade.timestamp).toLocaleString()}</td>
      <td>${trade.accountName}</td>
      <td>${trade.type}</td>
      <td>${trade.amount.toFixed(2)}</td>
      <td>₦${trade.rate.toFixed(2)}</td>
      <td>₦${trade.totalPaid ? trade.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}</td>
      <td>${trade.discount || '-'}</td>
      <td>${trade.profit ? trade.profit.toFixed(2) : '-'}</td>
    `;
    tbody.appendChild(row);
  });
}

// --- Profit Distribution Chart ---
let profitChart;

function updateProfitChart(filteredTrades = null) {
  const ctx = document.getElementById('profitChart');
  if (!ctx) return;

  const data = filteredTrades || accounts.flatMap(a => a.trades.map(t => ({ ...t, accountName: a.name })));

  const profits = {};
  data.forEach(trade => {
    if (!profits[trade.accountName]) profits[trade.accountName] = 0;
    profits[trade.accountName] += trade.profit || 0;
  });

  const labels = Object.keys(profits);
  const values = Object.values(profits);

  if (profitChart) profitChart.destroy();

  profitChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Profit ($)',
        data: values,
        backgroundColor: '#27ae60'
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: 'Accounts' } },
        y: { title: { display: true, text: 'Profit ($)' } }
      }
    }
  });
}

// --- Handle Specific Account Selection ---
function toggleAccountSelectionList() {
  const mode = document.getElementById('accountSelectionMode').value;
  const listDiv = document.getElementById('specificAccountsList');
  listDiv.innerHTML = '';

  if (mode === 'specific') {
    listDiv.classList.remove('hidden');
    accounts.forEach((acc, i) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${i}"> ${acc.name}`;
      listDiv.appendChild(label);
    });
  } else {
    listDiv.classList.add('hidden');
  }
}

// --- Execute Buy or Sell for Multiple Accounts ---
function confirmMultiTrade() {
  const type = document.querySelector('input[name="tradeType"]:checked').value;
  const mode = document.getElementById('accountSelectionMode').value;
  const amount = parseFloat(document.getElementById('multiTradeAmount').value);
  if (!amount || amount <= 0) return alert('Please enter a valid amount.');

  let targetAccounts = [];

  if (mode === 'all') {
    targetAccounts = accounts;
  } else {
    const selectedCheckboxes = document.querySelectorAll('#specificAccountsList input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) return alert('Select at least one account.');
    targetAccounts = Array.from(selectedCheckboxes).map(cb => accounts[parseInt(cb.value)]);
  }

  // Apply trade to selected accounts
  targetAccounts.forEach(acc => {
    if (type === 'buy') handleBuyForAccount(acc, amount);
    else handleSellForAccount(acc, amount);
  });

  updateSummary();
  updateAccountsDisplay();
  alert(`✅ ${type.toUpperCase()} executed for ${targetAccounts.length} account(s)!`);
  closeModal('multiTradeModal');
}

// --- Helper: Buy logic for each account ---
function handleBuyForAccount(account, amount) {
    const discount =
        amount >= 10000 ? 0.20 :
        amount >= 1000 ? 0.15 :
        0.10;

    const discountedRate = buyRate * (1 - discount);
    const totalCost = amount * discountedRate;

    if (account.ngnBalance < totalCost) return;
        account.ngnBalance -= totalCost;
        account.usdBalance += amount;


    account.trades.push({
        type: 'Buy',
        amount,
        rate: discountedRate,
        totalPaid: totalCost,
        discount: `${discount * 100}%`,
        timestamp: new Date().toISOString()
    });
}

// --- Helper: Sell logic for each account ---
function handleSellForAccount(account, amount) {
    if (account.usdBalance < amount) return; // insufficient USD
    const revenue = amount * sellRate;
    const profit = amount * (sellRate - buyRate) / buyRate;
    account.usdBalance -= amount;
    account.ngnBalance += revenue;
    account.totalProfit += profit;

    account.trades.push({
    type: 'Sell',
    amount,
    rate: sellRate,
    totalPaid: revenue,
    profit,
    timestamp: new Date().toISOString()
  });
}

// --- Update total platform DOM elements (kept separate to avoid overwriting main updateSummary) ---
function updatePlatformTotals() {
    const totalUsd = accounts.reduce((sum, acc) => sum + acc.usdBalance, 0);
    const totalProfit = accounts.reduce((sum, acc) => sum + (acc.totalProfit || 0), 0);

    const totalUsdEl = document.getElementById('totalPlatformBalance');
    const totalProfitEl = document.getElementById('totalPlatformProfit');

    if (totalUsdEl) totalUsdEl.textContent = totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (totalProfitEl) totalProfitEl.textContent = totalProfit.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// --- Deposit Simulation Flow ---
let pendingDeposit = null; // holds temp deposit info until OTP confirmation

function openDepositModal(accountId) {
  currentAccountId = accountId;
  document.getElementById('depositAmountInput').value = '';
  openModal('depositModal');
}

function initiateDeposit() {
  const amount = parseFloat(document.getElementById('depositAmountInput').value);
  if (!amount || amount <= 0) return alert('Please enter a valid deposit amount.');

  pendingDeposit = {
    accountId: currentAccountId,
    amount
  };

  closeModal('depositModal');
  openModal('otpModal');
}

function confirmOTP() {
  const otp = document.getElementById('otpInput').value.trim();

  // Validate OTP (any 6 digits)
  if (!/^\d{6}$/.test(otp)) {
    alert('Invalid OTP. Enter exactly 6 digits.');
    return;
  }

  const { accountId, amount } = pendingDeposit;
  const account = accounts.find(a => a.id === accountId);

  // Close OTP modal
  closeModal('otpModal');
  document.getElementById('otpInput').value = '';

  // === Popup 1: Verifying OTP ===
  const popup = document.createElement('div');
  popup.classList.add('verification-popup');
  popup.innerHTML = `
    <div class="verification-box glassy">
      <p>🔐 <strong>Verifying OTP<span class="dots"><span>.</span><span>.</span><span>.</span></span></strong></p>
      <p style="font-size:0.9em;color:#7f8c8d;">Please wait while we confirm your transaction.</p>
    </div>
  `;
  document.body.appendChild(popup);

  // Switch to "OTP Verified!" after 4 seconds
  setTimeout(() => {
    popup.querySelector('.verification-box').innerHTML = `
      <p>✅ <strong>OTP Verified!</strong></p>
      <p style="font-size:0.9em;color:#27ae60;">Processing your deposit...</p>
    `;
  }, 4000);

  // After 6 seconds → show "Processing Transaction..."
  setTimeout(() => {
    popup.remove();

    const loadingPopup = document.createElement('div');
    loadingPopup.classList.add('verification-popup');
    loadingPopup.innerHTML = `
      <div class="verification-box glassy">
        <div class="loader"></div>
        <p>💵 <strong>Processing Transaction...</strong></p>
        <p style="font-size:0.9em;color:#7f8c8d;">Please wait while we credit your balance.</p>
      </div>
    `;
    document.body.appendChild(loadingPopup);

    const delay = 9000 + Math.random() * 6000; // total 15–20s including all steps

    setTimeout(() => {
      loadingPopup.remove();

      account.ngnBalance += amount;
      account.trades.push({
        type: 'Deposit',
        amount,
        profit: 0,
        timestamp: new Date(),
        status: 'Completed'
      });

      showTradeSuccess(account.id, `✅ ₦${amount.toLocaleString()} successfully deposited!`);
      updateAccountsDisplay();
      updateSummary();

      pendingDeposit = null;
    }, delay);
  }, 6000);
}

function openNetworkSelector() {
  document.getElementById('networkSelectorModal').classList.add('show');
}

function closeNetworkSelector() {
  document.getElementById('networkSelectorModal').classList.remove('show');
}

function selectNetwork(name) {
  // Map network names to icon paths
  const iconMap = {
    "Ethereum (ERC20)": "Network Images/ethereum-eth-logo.svg",
    "TRON (TRC20)": "Network Images/tron-trx-logo.svg",
    "Arbitrum One": "Network Images/arbitrum-arb-logo.svg",
    "SOL": "Network Images/solana-sol-logo.svg",
    "BSC (BEP20)": "Network Images/bnb-bnb-logo.svg",
    "Polygon PoS": "Network Images/polygon-matic-logo.svg",
    "OP Mainnet": "Network Images/optimism-ethereum-op-logo.svg",
    "AVAXC": "Network Images/avalanche-avax-logo.svg"
  };

  // Update icon and text display
  const nameEl = document.getElementById('walletNetworkName');
  const iconEl = document.getElementById('walletNetworkIcon');
  
  if (nameEl && iconEl) {
    nameEl.textContent = name;
    iconEl.src = iconMap[name] || '';
    iconEl.style.display = iconMap[name] ? 'inline' : 'none';
  }

  closeNetworkSelector();
}

function logout() {
  if (confirm("Are you sure you want to log out?")) {
    localStorage.removeItem("activeUser");
    window.location.href = "auth.html";
  }
}
console.log("✅ logout() function loaded successfully");

// === AUTO LOGOUT AFTER INACTIVITY WITH WARNING ===
document.addEventListener("DOMContentLoaded", () => {
  const activeUser = localStorage.getItem("activeUser");
  if (!activeUser) return; // only run on protected pages

  // --- Create warning banner dynamically ---
  const warningBanner = document.createElement("div");
  warningBanner.id = "sessionWarning";
  warningBanner.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(231, 76, 60, 0.95);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    font-size: 0.95em;
    z-index: 9999;
    display: none;
    transition: opacity 0.3s ease;
  `;
  document.body.appendChild(warningBanner);

  // --- Activity reset handler ---
  const resetActivity = () => {
    lastActivityTime = Date.now();
    localStorage.setItem("lastActivity", lastActivityTime);
    warningShown = false;
    warningBanner.style.display = "none";
  };

  ["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(evt =>
    window.addEventListener(evt, resetActivity)
  );

  // --- Periodically check inactivity ---
  setInterval(() => {
    const now = Date.now();
    const storedActivity = parseInt(localStorage.getItem("lastActivity"), 10) || lastActivityTime;
    const inactivity = now - storedActivity;

    if (inactivity > SESSION_TIMEOUT) {
      alert("⚠️ You’ve been logged out due to inactivity.");
      logout();
    } 
    else if (inactivity > SESSION_TIMEOUT - WARNING_TIME && !warningShown) {
      const minutesLeft = Math.ceil((SESSION_TIMEOUT - inactivity) / 60000);
      warningBanner.innerHTML = `⏳ You will be logged out in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} due to inactivity.`;
      warningBanner.style.display = "block";
      warningShown = true;
    }
  }, 30000); // check every 30s
});
