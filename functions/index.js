/* ================================================================
   Church Offering System — functions/index.js
   Firebase Cloud Functions v2 — REST API for Firestore CRUD
   ================================================================ */

const { onRequest }       = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();

const db         = admin.firestore();
const COLLECTION = 'offerings';

// Region closest to the Philippines
setGlobalOptions({ region: 'asia-southeast1' });

// ── CORS Helper ────────────────────────────────────────────────────
function setCorsHeaders(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
}

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
    date:     String(body.date).trim(),
    type:     body.type    || 'Tithe',
    amount:   parseFloat(body.amount),
    method:   body.method  || 'Cash',
    ref:      (body.ref    || '').trim(),
    notes:    (body.notes  || '').trim(),
    recorded: new Date().toISOString()
  };
}

// ── Main exported Cloud Function ──────────────────────────────────
exports.api = onRequest(async (req, res) => {
  // Set CORS headers on all responses
  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    const method = req.method;

      // req.path will be like /offerings, /offerings/summary, /offerings/abc123
      // Strip leading slash and split
      const parts = req.path.replace(/^\//, '').split('/');
      const base  = parts[0]; // always 'offerings'
      const seg   = parts[1]; // undefined | 'summary' | '<docId>'

      if (base !== 'offerings') {
        return res.status(404).json({ success: false, error: 'Route not found' });
      }

      // ════════════════════════════════════════════════════════════
      // GET /offerings/summary
      // IMPORTANT: must be checked BEFORE the generic GET /:id
      // branch, otherwise 'summary' gets treated as a Firestore doc ID.
      // ════════════════════════════════════════════════════════════
      if (method === 'GET' && seg === 'summary') {
        const snapshot  = await db.collection(COLLECTION).get();
        const offerings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const today     = new Date().toISOString().slice(0, 10);
        const thisMonth = today.slice(0, 7);

        const todayTotal = offerings
          .filter(o => o.date === today)
          .reduce((s, o) => s + o.amount, 0);

        const monthTotal = offerings
          .filter(o => String(o.date).startsWith(thisMonth))
          .reduce((s, o) => s + o.amount, 0);

        const overall = offerings.reduce((s, o) => s + o.amount, 0);

        const byType = {};
        offerings.forEach(o => {
          const key = o.type === 'Building Fund' ? 'Building' : o.type;
          byType[key] = (byType[key] || 0) + o.amount;
        });

        return res.json({
          success: true,
          data: { todayTotal, monthTotal, overall, count: offerings.length, byType }
        });
      }

      // ════════════════════════════════════════════════════════════
      // GET /offerings  (list, with optional ?search= ?type= ?month=)
      // ════════════════════════════════════════════════════════════
      if (method === 'GET' && !seg) {
        const { search, type, month } = req.query;

        // BUG FIX: Firestore requires a composite index when combining
        // where() + orderBy() on different fields. To avoid needing
        // that index in all filter combinations, we fetch and sort
        // in memory when filters are present. For the unfiltered case
        // we use the single-field index on 'date'.
        let offerings;

        if (type || month) {
          // Fetch with filters, sort in memory (no composite index needed)
          let query = db.collection(COLLECTION);
          if (type)  query = query.where('type', '==', type);
          if (month) {
            query = query
              .where('date', '>=', `${month}-01`)
              .where('date', '<=', `${month}-31`);
          }
          const snapshot = await query.get();
          offerings = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.date < b.date ? 1 : -1));
        } else {
          // No filters — use single-field index on 'date'
          const snapshot = await db.collection(COLLECTION)
            .orderBy('date', 'desc')
            .get();
          offerings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        // Text search (name / type / method) — done in memory
        if (search) {
          const q = search.toLowerCase();
          offerings = offerings.filter(o =>
            (o.name   || '').toLowerCase().includes(q) ||
            (o.type   || '').toLowerCase().includes(q) ||
            (o.method || '').toLowerCase().includes(q)
          );
        }

        return res.json({ success: true, count: offerings.length, data: offerings });
      }

      // ════════════════════════════════════════════════════════════
      // GET /offerings/:id
      // ════════════════════════════════════════════════════════════
      if (method === 'GET' && seg) {
        const snap = await db.collection(COLLECTION).doc(seg).get();
        if (!snap.exists) {
          return res.status(404).json({ success: false, error: 'Offering not found' });
        }
        return res.json({ success: true, data: { id: snap.id, ...snap.data() } });
      }

      // ════════════════════════════════════════════════════════════
      // POST /offerings  — create
      // ════════════════════════════════════════════════════════════
      if (method === 'POST' && !seg) {
        const errors = validateOffering(req.body);
        if (errors.length) {
          return res.status(400).json({ success: false, errors });
        }
        const data   = sanitize(req.body);
        const docRef = await db.collection(COLLECTION).add(data);
        return res.status(201).json({
          success: true,
          message: 'Offering recorded successfully',
          data: { id: docRef.id, ...data }
        });
      }

      // ════════════════════════════════════════════════════════════
      // PUT /offerings/:id  — full replace
      // ════════════════════════════════════════════════════════════
      if (method === 'PUT' && seg) {
        const errors = validateOffering(req.body);
        if (errors.length) {
          return res.status(400).json({ success: false, errors });
        }
        const snap = await db.collection(COLLECTION).doc(seg).get();
        if (!snap.exists) {
          return res.status(404).json({ success: false, error: 'Offering not found' });
        }
        const data = { ...sanitize(req.body), updatedAt: new Date().toISOString() };
        await db.collection(COLLECTION).doc(seg).set(data);
        return res.json({ success: true, message: 'Offering updated', data: { id: seg, ...data } });
      }

      // ════════════════════════════════════════════════════════════
      // PATCH /offerings/:id  — partial update
      // ════════════════════════════════════════════════════════════
      if (method === 'PATCH' && seg) {
        const snap = await db.collection(COLLECTION).doc(seg).get();
        if (!snap.exists) {
          return res.status(404).json({ success: false, error: 'Offering not found' });
        }
        const allowed = ['name', 'date', 'type', 'amount', 'method', 'ref', 'notes'];
        const patch   = { updatedAt: new Date().toISOString() };
        allowed.forEach(f => {
          if (req.body[f] !== undefined) {
            patch[f] = f === 'amount' ? parseFloat(req.body[f]) : req.body[f];
          }
        });
        await db.collection(COLLECTION).doc(seg).update(patch);
        return res.json({ success: true, message: 'Offering partially updated', data: { id: seg, ...patch } });
      }

      // ════════════════════════════════════════════════════════════
      // DELETE /offerings/:id  — delete single
      // ════════════════════════════════════════════════════════════
      if (method === 'DELETE' && seg) {
        const snap = await db.collection(COLLECTION).doc(seg).get();
        if (!snap.exists) {
          return res.status(404).json({ success: false, error: 'Offering not found' });
        }
        await db.collection(COLLECTION).doc(seg).delete();
        return res.json({ success: true, message: 'Offering deleted', data: { id: seg } });
      }

      // ════════════════════════════════════════════════════════════
      // DELETE /offerings  — bulk delete  body: { ids: [...] }
      // ════════════════════════════════════════════════════════════
      if (method === 'DELETE' && !seg) {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ success: false, error: 'Provide an array of IDs to delete' });
        }
        // Firestore batch max is 500 writes
        const batch = db.batch();
        ids.forEach(id => batch.delete(db.collection(COLLECTION).doc(id)));
        await batch.commit();
        return res.json({
          success: true,
          message: `${ids.length} offering(s) deleted`,
          data: { deleted: ids }
        });
      }

      // Fallthrough — method not handled
      return res.status(405).json({ success: false, error: 'Method not allowed' });

    } catch (err) {
      console.error('[API Error]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
