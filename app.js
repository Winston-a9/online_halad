/* ================================================================
   Church Offering System — app.js
   ================================================================ */

let offerings = JSON.parse(localStorage.getItem('churchOfferings') || '[]');
let selectedType = 'Tithe';

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Always re-read from localStorage on every page load
  offerings = JSON.parse(localStorage.getItem('churchOfferings') || '[]');
  document.getElementById('offeringDate').valueAsDate = new Date();
  updateSummary();
  loadDailyVerse();
});

// ── Tab navigation ────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  event.target.classList.add('active');
  if (tab === 'ledger') renderTable();
  if (tab === 'report') renderReport();
}

// ── Offering type selector ────────────────────────────────────────
function selectType(el, type) {
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedType = type;
  document.getElementById('offeringType').value = type;
}

// ── Amount preset selector ────────────────────────────────────────
function selectAmount(el, amount) {
  document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('offeringAmount').value = amount;
}

// ── Formatting helpers ────────────────────────────────────────────
function formatCurrency(val) {
  return '₱' + parseFloat(val).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Submit offering ───────────────────────────────────────────────
function submitOffering() {
  const name   = document.getElementById('donorName').value.trim() || 'Anonymous';
  const date   = document.getElementById('offeringDate').value;
  const amount = parseFloat(document.getElementById('offeringAmount').value);
  const method = document.getElementById('paymentMethod').value;
  const ref    = document.getElementById('refNumber').value.trim();
  const notes  = document.getElementById('offeringNotes').value.trim();

  if (!date)              return showToast('⚠️ Please select a date.', 'Missing Field');
  if (!amount || amount <= 0) return showToast('⚠️ Please enter a valid amount.', 'Missing Field');

  const offering = {
    id: Date.now(),
    name, date, type: selectedType, amount, method, ref, notes,
    recorded: new Date().toISOString()
  };

  offerings.push(offering);
  save();
  updateSummary();
  showReceipt(offering);
  resetForm();
  showToast('Offering recorded with gratitude.', 'Blessing Recorded ✦');
}

// ── Receipt modal ─────────────────────────────────────────────────
function showReceipt(o) {
  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-row">
      <span class="receipt-label">Donor</span>
      <span class="receipt-value">${o.name}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Date</span>
      <span class="receipt-value">${formatDate(o.date)}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Type</span>
      <span class="receipt-value">${o.type}</span>
    </div>
    <div class="receipt-row">
      <span class="receipt-label">Method</span>
      <span class="receipt-value">${o.method}</span>
    </div>
    ${o.ref ? `
    <div class="receipt-row">
      <span class="receipt-label">Reference</span>
      <span class="receipt-value">${o.ref}</span>
    </div>` : ''}
    ${o.notes ? `
    <div class="receipt-row">
      <span class="receipt-label">Notes</span>
      <span class="receipt-value">${o.notes}</span>
    </div>` : ''}
    <div style="text-align:center; margin-top:16px; padding-top:16px; border-top:1px solid rgba(201,168,76,0.3);">
      <span class="receipt-amount">${formatCurrency(o.amount)}</span>
    </div>
  `;
  document.getElementById('receiptModal').classList.add('show');
  loadReceiptVerse();
}

function closeModal() {
  document.getElementById('receiptModal').classList.remove('show');
}

// ── Reset form ────────────────────────────────────────────────────
function resetForm() {
  document.getElementById('donorName').value        = '';
  document.getElementById('offeringAmount').value   = '';
  document.getElementById('refNumber').value        = '';
  document.getElementById('offeringNotes').value    = '';
  document.getElementById('offeringDate').valueAsDate = new Date();
  document.getElementById('paymentMethod').value    = 'Cash';
  document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  document.querySelector('.type-card').classList.add('selected');
  selectedType = 'Tithe';
}

// ── Ledger table ──────────────────────────────────────────────────
function renderTable() {
  const query    = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const filtered = offerings
    .filter(o =>
      o.name.toLowerCase().includes(query)   ||
      o.type.toLowerCase().includes(query)   ||
      o.method.toLowerCase().includes(query)
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('offeringTable');

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="icon">🕊️</div>
            <p>No offerings found.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  const typeClass = {
    Tithe: 'tithe',
    Offering: 'offering',
    Mission: 'mission',
    'Building Fund': 'building',
    Building: 'building',
    Special: 'special'
  };

  tbody.innerHTML = filtered.map(o => `
    <tr>
      <td>${formatDate(o.date)}</td>
      <td>${o.name}</td>
      <td><span class="badge badge-${typeClass[o.type] || 'offering'}">${o.type}</span></td>
      <td>${o.method}</td>
      <td style="color:var(--gold-light); font-family:'Cormorant Garamond',serif; font-size:1.05rem;">
        ${formatCurrency(o.amount)}
      </td>
      <td>
        <button class="btn-delete" onclick="deleteOffering(${o.id})" title="Delete">✕</button>
      </td>
    </tr>
  `).join('');
}

function deleteOffering(id) {
  if (!confirm('Remove this offering record?')) return;
  offerings = offerings.filter(o => o.id !== id);
  save();
  updateSummary();
  renderTable();
  showToast('Record removed.', 'Deleted');
}

// ── Reports ───────────────────────────────────────────────────────
function renderReport() {
  const types  = ['Tithe', 'Offering', 'Mission', 'Building', 'Special'];
  const colors = ['#E88080', '#C9A84C', '#80B0E8', '#90E880', '#E880DC'];
  const totals = {};
  types.forEach(t => (totals[t] = 0));

  offerings.forEach(o => {
    const key = o.type === 'Building Fund' ? 'Building' : o.type;
    if (totals[key] !== undefined) totals[key] += o.amount;
  });

  const max = Math.max(...Object.values(totals), 1);

  document.getElementById('reportChart').innerHTML = types.map((t, i) => {
    const pct = Math.round((totals[t] / max) * 100);
    return `
      <div class="chart-row">
        <div class="chart-label">${t}</div>
        <div class="chart-bar-bg">
          <div class="chart-bar"
               style="width:${pct}%; background:${colors[i]}; min-width:${totals[t] > 0 ? '60px' : '0'}">
            ${totals[t] > 0 ? formatCurrency(totals[t]) : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  const grand = types.reduce((s, t) => s + totals[t], 0);

  document.getElementById('reportSummaryTable').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Type</th><th>Count</th><th>Total</th><th>% of Total</th>
        </tr>
      </thead>
      <tbody>
        ${types.map(t => {
          const count = offerings.filter(o =>
            (o.type === 'Building Fund' ? 'Building' : o.type) === t
          ).length;
          const pct = grand > 0 ? ((totals[t] / grand) * 100).toFixed(1) : '0.0';
          return `
            <tr>
              <td><span class="badge badge-${t.toLowerCase()}">${t}</span></td>
              <td>${count}</td>
              <td style="color:var(--gold-light); font-family:'Cormorant Garamond',serif;">
                ${formatCurrency(totals[t])}
              </td>
              <td>${pct}%</td>
            </tr>`;
        }).join('')}
        <tr style="border-top:1px solid rgba(201,168,76,0.3);">
          <td style="font-family:'Cinzel',serif; font-size:0.7rem; letter-spacing:0.1em; color:var(--gold);">
            TOTAL
          </td>
          <td>${offerings.length}</td>
          <td style="color:var(--gold-light); font-family:'Cormorant Garamond',serif; font-size:1.1rem;">
            ${formatCurrency(grand)}
          </td>
          <td>100%</td>
        </tr>
      </tbody>
    </table>`;
}

// ── Summary dashboard ─────────────────────────────────────────────
function updateSummary() {
  const today     = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const todayTotal = offerings
    .filter(o => o.date === today)
    .reduce((s, o) => s + o.amount, 0);

  const monthTotal = offerings
    .filter(o => o.date.startsWith(thisMonth))
    .reduce((s, o) => s + o.amount, 0);

  const overall = offerings.reduce((s, o) => s + o.amount, 0);

  document.getElementById('totalToday').textContent   = formatCurrency(todayTotal);
  document.getElementById('totalMonth').textContent   = formatCurrency(monthTotal);
  document.getElementById('totalCount').textContent   = offerings.length;
  document.getElementById('totalOverall').textContent = formatCurrency(overall);
}

// ── Persistence ───────────────────────────────────────────────────
function save() {
  localStorage.setItem('churchOfferings', JSON.stringify(offerings));
}

// ── Toast notification ────────────────────────────────────────────
function showToast(msg, title = 'Notice') {
  const t = document.getElementById('toast');
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastText').textContent  = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── CSV Export ────────────────────────────────────────────────────
function exportCSV() {
  if (offerings.length === 0) return showToast('No records to export.', 'Empty');

  const headers = ['Date', 'Donor', 'Type', 'Amount', 'Method', 'Reference', 'Notes'];
  const rows    = offerings.map(o =>
    [o.date, o.name, o.type, o.amount, o.method, o.ref, o.notes]
      .map(v => `"${v ?? ''}"`)
      .join(',')
  );

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'church_offerings.csv';
  a.click();
  showToast('Ledger exported successfully.', 'Export Complete');
}

// ── Bible Verse of the Day (bible-api.com) ────────────────────────
const VERSE_REFERENCES = [
  'Luke 6:38',        'Malachi 3:10',     'Proverbs 3:9-10',
  '2 Corinthians 9:7','Philippians 4:19', 'Proverbs 11:24-25',
  'Matthew 6:19-21',  'Hebrews 13:16',    '1 Timothy 6:17-18',
  'Acts 20:35',       'Deuteronomy 15:10','Luke 21:1-4',
  'Psalm 37:21',      'Proverbs 22:9',    '1 Chronicles 29:14',
  'Romans 12:13',     'James 1:17',       'John 3:16',
  'Psalm 23:1',       'Isaiah 40:31',     'Jeremiah 29:11',
  'Romans 8:28',      'Philippians 4:13', 'Matthew 5:16',
  'Galatians 6:9-10', 'Colossians 3:23',  'Psalm 119:105',
  'Matthew 22:37-39', 'Micah 6:8',        'Psalm 100:4-5'
];

let cachedVerse = null;

function getDailyVerseRef() {
  // Pick a deterministic verse per calendar day so it stays consistent all day
  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  return VERSE_REFERENCES[dayOfYear % VERSE_REFERENCES.length];
}

async function fetchBibleVerse(reference) {
  const encoded = encodeURIComponent(reference);
  const res = await fetch(`https://bible-api.com/${encoded}?translation=kjv`);
  if (!res.ok) throw new Error('API error');
  const data = await res.json();
  return {
    text: data.text.replace(/\n/g, ' ').trim(),
    reference: data.reference
  };
}

async function loadDailyVerse() {
  const el = document.getElementById('dailyVerse');
  if (!el) return;

  // Try cache (sessionStorage so it refreshes next tab open each day)
  const cacheKey = 'churchVerseCache';
  const today    = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(sessionStorage.getItem(cacheKey));
    if (stored && stored.date === today) {
      cachedVerse = stored.verse;
      el.textContent = `"${stored.verse.text}" — ${stored.verse.reference}`;
      return;
    }
  } catch (_) {}

  const ref = getDailyVerseRef();
  try {
    const verse = await fetchBibleVerse(ref);
    cachedVerse = verse;
    el.textContent = `"${verse.text}" — ${verse.reference}`;
    sessionStorage.setItem(cacheKey, JSON.stringify({ date: today, verse }));
  } catch (err) {
    // Fallback to a hardcoded verse if offline or API fails
    el.textContent = '"Give, and it will be given to you." — Luke 6:38';
    console.warn('Bible API unavailable, using fallback verse.', err);
  }
}

async function loadReceiptVerse() {
  const el = document.getElementById('receiptVerse');
  if (!el) return;

  // Reuse cached daily verse if available, otherwise fetch a random one
  if (cachedVerse) {
    el.textContent = `"${cachedVerse.text}" — ${cachedVerse.reference}`;
    return;
  }

  // Pick a random verse for the receipt if daily verse hasn't loaded yet
  const ref = VERSE_REFERENCES[Math.floor(Math.random() * VERSE_REFERENCES.length)];
  try {
    const verse = await fetchBibleVerse(ref);
    el.textContent = `"${verse.text}" — ${verse.reference}`;
  } catch (_) {
    el.textContent = '"Give, and it will be given to you." — Luke 6:38';
  }
}
