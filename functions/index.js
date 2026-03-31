/* ================================================================
   Church Offering System — Firebase Cloud Functions (index.js)
   ================================================================ */

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin  = require('firebase-admin');
const cors   = require('cors')({ origin: true });

admin.initializeApp();
const db         = admin.firestore();
const COLLECTION = 'offerings';

// Set region close to Philippines
setGlobalOptions({ region: 'asia-southeast1' });

// ── Helpers ───────────────────────────────────────────────────────
function validateOffering(body) {
  const errors = [];
  if (!body.date)                         errors.push('date is required');
  if (!body.amount || isNaN(body.amount)) errors.push('a valid amount is required');
  if (parseFloat(body.amount) <= 0)       errors.push('amount must be greater than 0');
  return errors;
}

function sanitize(body) {
  return {
    name:     (body.name   || 'Anonymous').trim(),
    date:     body.date.trim(),
    type:     body.type    || 'Tithe',
    amount:   parseFloat(body.amount),
    method:   body.method  || 'Cash',
    ref:      (body.ref    || '').trim(),
    notes:    (body.notes  || '').trim(),
    recorded: new Date().toISOString()
  };
}

// ── Main API handler ──────────────────────────────────────────────
exports.api = onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const url    = req.path;          // e.g. /offerings or /offerings/abc123
      const method = req.method;
      const parts  = url.replace(/^\//, '').split('/'); // ['offerings'] or ['offerings','abc123']
      const base   = parts[0];  // 'offerings'
      const id     = parts[1];  // document ID or 'summary'

      if (base !== 'offerings') {
        return res.status(404).json({ success: false, error: 'Route not found' });
      }

      // ── GET /offerings/summary ──────────────────────────────────
      if (method === 'GET' && id === 'summary') {
        const snapshot = await db.collection(COLLECTION).get();
        const offerings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const today     = new Date().toISOString().slice(0, 10);
        const thisMonth = today.slice(0, 7);

        const todayTotal = offerings.filter(o => o.date === today).reduce((s, o) => s + o.amount, 0);
        const monthTotal = offerings.filter(o => o.date.startsWith(thisMonth)).reduce((s, o) => s + o.amount, 0);
        const overall    = offerings.reduce((s, o) => s + o.amount, 0);
        const byType     = {};
        offerings.forEach(o => {
          const key = o.type === 'Building Fund' ? 'Building' : o.type;
          byType[key] = (byType[key] || 0) + o.amount;
        });

        return res.json({ success: true, data: { todayTotal, monthTotal, overall, count: offerings.length, byType } });
      }

      // ── GET /offerings ──────────────────────────────────────────
      if (method === 'GET' && !id) {
        const { search, type, month } = req.query;
        let query = db.collection(COLLECTION);
        if (type)  query = query.where('type', '==', type);
        if (month) query = query.where('date', '>=', `${month}-01`).where('date', '<=', `${month}-31`);
        query = query.orderBy('date', 'desc');

        const snapshot = await query.get();
        let offerings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (search) {
          const q = search.toLowerCase();
          offerings = offerings.filter(o =>
            o.name.toLowerCase().includes(q) ||
            o.type.toLowerCase().includes(q) ||
            o.method.toLowerCase().includes(q)
          );
        }
        return res.json({ success: true, count: offerings.length, data: offerings });
      }

      // ── GET /offerings/:id ──────────────────────────────────────
      if (method === 'GET' && id) {
        const snap = await db.collection(COLLECTION).doc(id).get();
        if (!snap.exists) return res.status(404).json({ success: false, error: 'Offering not found' });
        return res.json({ success: true, data: { id: snap.id, ...snap.data() } });
      }

      // ── POST /offerings ─────────────────────────────────────────
      if (method === 'POST' && !id) {
        const errors = validateOffering(req.body);
        if (errors.length) return res.status(400).json({ success: false, errors });
        const data   = sanitize(req.body);
        const docRef = await db.collection(COLLECTION).add(data);
        return res.status(201).json({ success: true, message: 'Offering recorded successfully', data: { id: docRef.id, ...data } });
      }

      // ── PUT /offerings/:id ──────────────────────────────────────
      if (method === 'PUT' && id) {
        const errors = validateOffering(req.body);
        if (errors.length) return res.status(400).json({ success: false, errors });
        const snap = await db.collection(COLLECTION).doc(id).get();
        if (!snap.exists) return res.status(404).json({ success: false, error: 'Offering not found' });
        const data = { ...sanitize(req.body), updatedAt: new Date().toISOString() };
        await db.collection(COLLECTION).doc(id).set(data);
        return res.json({ success: true, message: 'Offering updated', data: { id, ...data } });
      }

      // ── PATCH /offerings/:id ────────────────────────────────────
      if (method === 'PATCH' && id) {
        const snap = await db.collection(COLLECTION).doc(id).get();
        if (!snap.exists) return res.status(404).json({ success: false, error: 'Offering not found' });
        const allowed = ['name', 'date', 'type', 'amount', 'method', 'ref', 'notes'];
        const patch   = { updatedAt: new Date().toISOString() };
        allowed.forEach(f => {
          if (req.body[f] !== undefined) patch[f] = f === 'amount' ? parseFloat(req.body[f]) : req.body[f];
        });
        await db.collection(COLLECTION).doc(id).update(patch);
        return res.json({ success: true, message: 'Offering partially updated', data: { id, ...patch } });
      }

      // ── DELETE /offerings/:id ───────────────────────────────────
      if (method === 'DELETE' && id) {
        const snap = await db.collection(COLLECTION).doc(id).get();
        if (!snap.exists) return res.status(404).json({ success: false, error: 'Offering not found' });
        await db.collection(COLLECTION).doc(id).delete();
        return res.json({ success: true, message: 'Offering deleted', data: { id } });
      }

      // ── DELETE /offerings (bulk) ────────────────────────────────
      if (method === 'DELETE' && !id) {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ success: false, error: 'Provide an array of IDs to delete' });
        }
        const batch = db.batch();
        ids.forEach(i => batch.delete(db.collection(COLLECTION).doc(i)));
        await batch.commit();
        return res.json({ success: true, message: `${ids.length} offering(s) deleted`, data: { deleted: ids } });
      }

      res.status(405).json({ success: false, error: 'Method not allowed' });

    } catch (err) {
      console.error('API error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
});
