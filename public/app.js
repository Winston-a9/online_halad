/* ================================================================
   Church Offering System — public/app.js
   Uses Firebase JS SDK v9 (modular) directly — NO Cloud Functions
   Free Spark plan compatible ✅
   ================================================================ */

// ── Firebase Config — paste your own from Firebase Console ───────
// Go to: Firebase Console → Project Settings → Your apps → SDK setup
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── YOUR FIREBASE CONFIG ─────────────────────────────────────────
// Replace these values with your own from Firebase Console
// Firebase Console → Project Settings → General → Your apps → Config
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBoVUsXwp93JwlGsmY_pOcEVZNUC7XgaIs",
  authDomain: "online-halad.firebaseapp.com",
  projectId: "online-halad",
  storageBucket: "online-halad.firebasestorage.app",
  messagingSenderId: "742489102752",
  appId: "1:742489102752:web:795400a3ba2c36326eecc5",
  measurementId: "G-Q7F350BENE"
};

// ── Init Firebase ─────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const COLLECTION = 'offerings';

let selectedType = 'Tithe';

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('offeringDate').valueAsDate = new Date();
  loadSummary();
  loadDailyVerse();
});

// ── Tab navigation ────────────────────────────────────────────────
function switchTab(tab, e) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (e && e.target) e.target.classList.add('active');
  if (tab === 'ledger') renderTable();
  if (tab === 'report') renderReport();
}
window.switchTab = switchTab;

// ── Offering type selector ────────────────────────────────────────
function selectType(el, type) {
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedType = type;
  document.getElementById('offeringType').value = type;
}
window.selectType = selectType;

// ── Amount preset selector ────────────────────────────────────────
function selectAmount(el, amount) {
  document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('offeringAmount').value = amount;
}
window.selectAmount = selectAmount;

// ── Formatting helpers ────────────────────────────────────────────
function formatCurrency(val) {
  return '₱' + parseFloat(val || 0).toLocaleString('en-PH', {
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
async function submitOffering() {
  const name   = document.getElementById('donorName').value.trim() || 'Anonymous';
  const date   = document.getElementById('offeringDate').value;
  const amount = parseFloat(document.getElementById('offeringAmount').value);
  const method = document.getElementById('paymentMethod').value;
  const ref    = document.getElementById('refNumber').value.trim();
  const notes  = document.getElementById('offeringNotes').value.trim();

  if (!date)               return showToast('⚠️ Please select a date.', 'Missing Field');
  if (!amount || amount <= 0) return showToast('⚠️ Please enter a valid amount.', 'Missing Field');

  const btn = document.querySelector('#tab-record .btn-primary');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  try {
    const data = {
      name,
      date,
      type:     selectedType,
      amount,
      method,
      ref:      ref   || '',
      notes:    notes || '',
      recorded: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTION), data);
    console.log('✅ Saved to Firestore with ID:', docRef.id);

    await loadSummary();
    showReceipt({ id: docRef.id, ...data });
    resetForm();
    showToast('Offering recorded with gratitude.', 'Blessing Recorded ✦');
  } catch (err) {
    console.error('❌ Firestore error:', err);
    showToast('⚠️ ' + err.message, 'Error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '✦ Record Offering ✦';
  }
}
window.submitOffering = submitOffering;

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
    ${o.ref ? `<div class="receipt-row">
      <span class="receipt-label">Reference</span>
      <span class="receipt-value">${o.ref}</span>
    </div>` : ''}
    ${o.notes ? `<div class="receipt-row">
      <span class="receipt-label">Notes</span>
      <span class="receipt-value">${o.notes}</span>
    </div>` : ''}
    <div style="text-align:center;margin-top:16px;padding-top:16px;border-top:1px solid rgba(201,168,76,0.3);">
      <span class="receipt-amount">${formatCurrency(o.amount)}</span>
    </div>`;
  document.getElementById('receiptModal').classList.add('show');
  loadReceiptVerse();
}

function closeModal() {
  document.getElementById('receiptModal').classList.remove('show');
}
window.closeModal = closeModal;

// ── Reset form ────────────────────────────────────────────────────
function resetForm() {
  document.getElementById('donorName').value          = '';
  document.getElementById('offeringAmount').value     = '';
  document.getElementById('refNumber').value          = '';
  document.getElementById('offeringNotes').value      = '';
  document.getElementById('offeringDate').valueAsDate = new Date();
  document.getElementById('paymentMethod').value      = 'Cash';
  document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
  document.querySelector('.type-card').classList.add('selected');
  selectedType = 'Tithe';
}

// ── Get all offerings from Firestore ──────────────────────────────
async function fetchOfferings() {
  const q        = query(collection(db, COLLECTION), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Ledger table ──────────────────────────────────────────────────
async function renderTable() {
  const searchQuery = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const tbody       = document.getElementById('offeringTable');

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;opacity:.5;font-style:italic;">Loading…</td></tr>`;

  try {
    let offerings = await fetchOfferings();

    if (searchQuery) {
      offerings = offerings.filter(o =>
        (o.name   || '').toLowerCase().includes(searchQuery) ||
        (o.type   || '').toLowerCase().includes(searchQuery) ||
        (o.method || '').toLowerCase().includes(searchQuery)
      );
    }

    if (offerings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">
        <div class="empty-state"><div class="icon">🕊️</div><p>No offerings found.</p></div>
      </td></tr>`;
      return;
    }

    const typeClass = {
      Tithe: 'tithe', Offering: 'offering', Mission: 'mission',
      Building: 'building', 'Building Fund': 'building', Special: 'special'
    };

    tbody.innerHTML = offerings.map(o => `
      <tr>
        <td>${formatDate(o.date)}</td>
        <td>${o.name}</td>
        <td><span class="badge badge-${typeClass[o.type] || 'offering'}">${o.type}</span></td>
        <td>${o.method}</td>
        <td style="color:var(--gold-light);font-family:'Cormorant Garamond',serif;font-size:1.05rem;">
          ${formatCurrency(o.amount)}
        </td>
        <td>
          <button class="btn-delete" onclick="deleteOffering('${o.id}')" title="Delete">✕</button>
        </td>
      </tr>`).join('');
  } catch (err) {
    console.error('❌ Error loading ledger:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#E88080;padding:20px;">
      Error loading records: ${err.message}
    </td></tr>`;
  }
}
window.renderTable = renderTable;

async function deleteOffering(id) {
  if (!confirm('Remove this offering record?')) return;
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    await loadSummary();
    renderTable();
    showToast('Record removed.', 'Deleted');
  } catch (err) {
    console.error('❌ Delete error:', err);
    showToast('⚠️ ' + err.message, 'Error');
  }
}
window.deleteOffering = deleteOffering;

// ── Reports ───────────────────────────────────────────────────────
async function renderReport() {
  const chartEl = document.getElementById('reportChart');
  chartEl.innerHTML = `<p style="text-align:center;opacity:.5;font-style:italic;">Loading…</p>`;

  try {
    const offerings = await fetchOfferings();
    const types     = ['Tithe', 'Offering', 'Mission', 'Building', 'Special'];
    const colors    = ['#E88080', '#C9A84C', '#80B0E8', '#90E880', '#E880DC'];
    const totals    = {};
    types.forEach(t => (totals[t] = 0));

    offerings.forEach(o => {
      const key = o.type === 'Building Fund' ? 'Building' : o.type;
      if (totals[key] !== undefined) totals[key] += o.amount;
    });

    const overall = Object.values(totals).reduce((s, v) => s + v, 0);
    const max     = Math.max(...Object.values(totals), 1);

    chartEl.innerHTML = types.map((t, i) => {
      const pct = Math.round((totals[t] / max) * 100);
      return `
        <div class="chart-row">
          <div class="chart-label">${t}</div>
          <div class="chart-bar-bg">
            <div class="chart-bar"
                 style="width:${pct}%;background:${colors[i]};min-width:${totals[t] > 0 ? '60px' : '0'}">
              ${totals[t] > 0 ? formatCurrency(totals[t]) : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    document.getElementById('reportSummaryTable').innerHTML = `
      <table>
        <thead><tr><th>Type</th><th>Total</th><th>% of Total</th></tr></thead>
        <tbody>
          ${types.map(t => {
            const pct = overall > 0 ? ((totals[t] / overall) * 100).toFixed(1) : '0.0';
            return `<tr>
              <td><span class="badge badge-${t.toLowerCase()}">${t}</span></td>
              <td style="color:var(--gold-light);font-family:'Cormorant Garamond',serif;">${formatCurrency(totals[t])}</td>
              <td>${pct}%</td>
            </tr>`;
          }).join('')}
          <tr style="border-top:1px solid rgba(201,168,76,0.3);">
            <td style="font-family:'Cinzel',serif;font-size:.7rem;letter-spacing:.1em;color:var(--gold);">TOTAL</td>
            <td style="color:var(--gold-light);font-family:'Cormorant Garamond',serif;font-size:1.1rem;">${formatCurrency(overall)}</td>
            <td>100%</td>
          </tr>
        </tbody>
      </table>`;
  } catch (err) {
    chartEl.innerHTML = `<p style="color:#E88080;text-align:center;">Error loading report: ${err.message}</p>`;
  }
}
window.renderReport = renderReport;

// ── Summary dashboard ─────────────────────────────────────────────
async function loadSummary() {
  try {
    const offerings = await fetchOfferings();
    const today     = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);

    const todayTotal = offerings
      .filter(o => o.date === today)
      .reduce((s, o) => s + o.amount, 0);

    const monthTotal = offerings
      .filter(o => String(o.date).startsWith(thisMonth))
      .reduce((s, o) => s + o.amount, 0);

    const overall = offerings.reduce((s, o) => s + o.amount, 0);

    document.getElementById('totalToday').textContent   = formatCurrency(todayTotal);
    document.getElementById('totalMonth').textContent   = formatCurrency(monthTotal);
    document.getElementById('totalCount').textContent   = offerings.length;
    document.getElementById('totalOverall').textContent = formatCurrency(overall);
  } catch (err) {
    console.error('❌ Summary error:', err);
  }
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
async function exportCSV() {
  try {
    const offerings = await fetchOfferings();
    if (offerings.length === 0) return showToast('No records to export.', 'Empty');

    const headers = ['Date', 'Donor', 'Type', 'Amount', 'Method', 'Reference', 'Notes'];
    const rows    = offerings.map(o =>
      [o.date, o.name, o.type, o.amount, o.method, o.ref || '', o.notes || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'church_offerings.csv';
    a.click();
    showToast('Ledger exported successfully.', 'Export Complete');
  } catch (err) {
    showToast('⚠️ Export failed: ' + err.message, 'Error');
  }
}
window.exportCSV = exportCSV;

// ── Bible Verse of the Day ────────────────────────────────────────
const VERSE_REFERENCES = [
  'Luke 6:38','Malachi 3:10','Proverbs 3:9-10','2 Corinthians 9:7',
  'Philippians 4:19','Proverbs 11:24-25','Matthew 6:19-21','Hebrews 13:16',
  '1 Timothy 6:17-18','Acts 20:35','Deuteronomy 15:10','Luke 21:1-4',
  'Psalm 37:21','Proverbs 22:9','1 Chronicles 29:14','Romans 12:13',
  'James 1:17','John 3:16','Psalm 23:1','Isaiah 40:31','Jeremiah 29:11',
  'Romans 8:28','Philippians 4:13','Matthew 5:16','Galatians 6:9-10',
  'Colossians 3:23','Psalm 119:105','Matthew 22:37-39','Micah 6:8','Psalm 100:4-5'
];

let cachedVerse = null;

function getDailyVerseRef() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return VERSE_REFERENCES[dayOfYear % VERSE_REFERENCES.length];
}

async function fetchBibleVerse(reference) {
  const res  = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`);
  if (!res.ok) throw new Error('Bible API error');
  const data = await res.json();
  return { text: data.text.replace(/\n/g, ' ').trim(), reference: data.reference };
}

async function loadDailyVerse() {
  const el = document.getElementById('dailyVerse');
  if (!el) return;
  const cacheKey = 'churchVerseCache';
  const today    = new Date().toISOString().slice(0, 10);
  try {
    const stored = JSON.parse(sessionStorage.getItem(cacheKey));
    if (stored && stored.date === today) {
      cachedVerse    = stored.verse;
      el.textContent = `"${stored.verse.text}" — ${stored.verse.reference}`;
      return;
    }
  } catch (_) {}
  try {
    const verse    = await fetchBibleVerse(getDailyVerseRef());
    cachedVerse    = verse;
    el.textContent = `"${verse.text}" — ${verse.reference}`;
    sessionStorage.setItem(cacheKey, JSON.stringify({ date: today, verse }));
  } catch (_) {
    el.textContent = '"Give, and it will be given to you." — Luke 6:38';
  }
}

async function loadReceiptVerse() {
  const el = document.getElementById('receiptVerse');
  if (!el) return;
  if (cachedVerse) {
    el.textContent = `"${cachedVerse.text}" — ${cachedVerse.reference}`;
    return;
  }
  const ref = VERSE_REFERENCES[Math.floor(Math.random() * VERSE_REFERENCES.length)];
  try {
    const verse    = await fetchBibleVerse(ref);
    el.textContent = `"${verse.text}" — ${verse.reference}`;
  } catch (_) {
    el.textContent = '"Give, and it will be given to you." — Luke 6:38';
  }
}