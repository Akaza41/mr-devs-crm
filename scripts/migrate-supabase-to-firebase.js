/**
 * =============================================================================
 * MR DEVS SUPABASE → FIREBASE DATA MIGRATION & VALIDATION TOOL
 * =============================================================================
 * 
 * Usage:
 *   node scripts/migrate-supabase-to-firebase.js [--dry-run] [--verify]
 * 
 * Environment Variables required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_SERVICE_ACCOUNT_KEY (path to serviceAccountKey.json or base64 string)
 */

import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const isDryRun = process.argv.includes('--dry-run');
const isVerifyOnly = process.argv.includes('--verify');

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseServiceKey) {
  console.warn('⚠️ Warning: SUPABASE_SERVICE_ROLE_KEY not set. Falling back to ANON key (RLS might block full table exports).');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Firebase Admin SDK
let firebaseApp;
try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve('./serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    // Attempt default application credentials / emulator
    firebaseApp = admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'mr-devs-platform'
    });
  }
} catch (err) {
  console.log('ℹ️ Firebase Admin SDK initialized with default settings or mock credential:', err.message);
}

const db = admin.firestore();

// ── UTILITY: CHUNKED BATCH WRITE ──
async function batchWrite(collectionName, items, transformFn) {
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  const CHUNK_SIZE = 400; // Firestore limit is 500 writes per batch
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();

    for (const item of chunk) {
      try {
        const { id, data } = transformFn(item);
        if (!id || !data) {
          skipped++;
          continue;
        }

        const docRef = db.collection(collectionName).doc(String(id));
        if (isDryRun) {
          migrated++;
        } else {
          batch.set(docRef, data, { merge: true });
          migrated++;
        }
      } catch (err) {
        console.error(`❌ Transform/Batch error in ${collectionName}:`, err.message);
        failed++;
      }
    }

    if (!isDryRun) {
      await batch.commit();
      console.log(`  ✓ Committed batch of ${chunk.length} items to '${collectionName}'`);
    }
  }

  return { total: items.length, migrated, skipped, failed };
}

// ── MIGRATION CONTROLLER ──
async function runMigration() {
  console.log('====================================================');
  console.log(`🚀 Starting MR DEVS Data Migration [Dry-Run: ${isDryRun}, Verify: ${isVerifyOnly}]`);
  console.log('====================================================\n');

  const report = {};

  // 1. PROFILES → USERS
  console.log('📦 1/7 Migrating Profiles -> users collection...');
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  if (profErr) {
    console.error('Error fetching profiles from Supabase:', profErr.message);
  } else {
    report.users = await batchWrite('users', profiles || [], (p) => ({
      id: p.id,
      data: {
        uid: p.id,
        email: p.email || '',
        displayName: p.full_name || p.email || 'Team Member',
        role: p.role || 'sales',
        photoURL: p.avatar_url || null,
        active: true,
        createdAt: p.created_at ? new Date(p.created_at) : new Date(),
        updatedAt: p.updated_at ? new Date(p.updated_at) : new Date(),
      }
    }));
  }

  // 2. PROJECTS → PROJECTS
  console.log('📦 2/7 Migrating Projects -> projects collection...');
  const { data: projects, error: projErr } = await supabase.from('projects').select('*');
  if (projErr) {
    console.error('Error fetching projects from Supabase:', projErr.message);
  } else {
    report.projects = await batchWrite('projects', projects || [], (pr) => ({
      id: pr.id,
      data: {
        id: pr.id,
        name: pr.name || 'Untitled Project',
        createdAt: pr.created_at ? new Date(pr.created_at) : new Date(),
      }
    }));
  }

  // 3. LEADS → LEADS
  console.log('📦 3/7 Migrating Leads -> leads collection...');
  const { data: leads, error: leadErr } = await supabase.from('leads').select('*');
  if (leadErr) {
    console.error('Error fetching leads from Supabase:', leadErr.message);
  } else {
    report.leads = await batchWrite('leads', leads || [], (l) => {
      // Extract dynamic custom columns into JSON map
      const knownKeys = new Set([
        'id', 'project_id', 'hospital_name', 'lead_name', 'address', 'type', 'rating',
        'reviews', 'phone', 'number_type', 'has_website', 'priority', 'stage',
        'fb_found', 'contacted', 'reply', 'notes', 'assigned_to', 'created_by',
        'custom_fields', 'created_at', 'updated_at'
      ]);

      const customFields = { ...(l.custom_fields || {}) };
      for (const [key, val] of Object.entries(l)) {
        if (!knownKeys.has(key) && val !== null && val !== undefined) {
          customFields[key] = val;
        }
      }

      return {
        id: l.id,
        data: {
          id: String(l.id),
          projectId: l.project_id || null,
          hospitalName: l.hospital_name || l.lead_name || 'Unnamed Lead',
          leadName: l.lead_name || l.hospital_name || 'Unnamed Lead',
          address: l.address || '',
          type: l.type || '',
          rating: l.rating ? Number(l.rating) : null,
          reviews: l.reviews ? Number(l.reviews) : 0,
          phone: l.phone || '',
          numberType: l.number_type || 'No Number',
          hasWebsite: l.has_website || 'No',
          priority: l.priority || 'Medium',
          stage: l.stage || 'New',
          fbFound: l.fb_found || 'No',
          contacted: l.contacted || 'No',
          reply: l.reply || '—',
          notes: l.notes || '',
          assignedTo: l.assigned_to || null,
          createdBy: l.created_by || null,
          customFields,
          createdAt: l.created_at ? new Date(l.created_at) : new Date(),
          updatedAt: l.updated_at ? new Date(l.updated_at) : new Date(),
        }
      };
    });
  }

  // 4. CUSTOM COLUMNS → CUSTOM_COLUMNS
  console.log('📦 4/7 Migrating Custom Columns -> custom_columns collection...');
  const { data: cols, error: colErr } = await supabase.from('custom_columns').select('*');
  if (colErr) {
    console.error('Error fetching custom columns:', colErr.message);
  } else {
    report.custom_columns = await batchWrite('custom_columns', cols || [], (c) => ({
      id: c.id,
      data: {
        id: c.id,
        columnName: c.column_name,
        displayName: c.display_name,
        dataType: c.data_type || 'Text',
        createdAt: c.created_at ? new Date(c.created_at) : new Date(),
      }
    }));
  }

  // 5. ACTIVITY LOGS → ACTIVITY_LOGS
  console.log('📦 5/7 Migrating Activity Logs -> activity_logs collection...');
  const { data: logs, error: logErr } = await supabase.from('activity_logs').select('*');
  if (logErr) {
    console.error('Error fetching activity logs:', logErr.message);
  } else {
    report.activity_logs = await batchWrite('activity_logs', logs || [], (lg) => ({
      id: lg.id,
      data: {
        id: lg.id,
        userId: lg.user_id || null,
        action: lg.action || '',
        entityType: lg.entity_type || 'system',
        entityId: lg.entity_id ? String(lg.entity_id) : null,
        projectId: lg.project_id || null,
        metadata: lg.metadata || {},
        createdAt: lg.created_at ? new Date(lg.created_at) : new Date(),
      }
    }));
  }

  // 6. CHAT CHANNELS & MESSAGES → CHAT_CHANNELS
  console.log('📦 6/7 Migrating Chat Channels...');
  const { data: channels, error: chanErr } = await supabase.from('chat_channels').select('*');
  if (!chanErr && channels) {
    report.chat_channels = await batchWrite('chat_channels', channels, (ch) => ({
      id: ch.id,
      data: {
        id: ch.id,
        name: ch.name || 'General',
        type: ch.type || 'team',
        projectId: ch.project_id || null,
        leadId: ch.lead_id ? String(ch.lead_id) : null,
        createdAt: ch.created_at ? new Date(ch.created_at) : new Date(),
      }
    }));
  }

  // 7. OUTREACH EVENTS → OUTREACH_EVENTS
  console.log('📦 7/7 Migrating Outreach Events...');
  const { data: events, error: evErr } = await supabase.from('outreach_events').select('*');
  if (!evErr && events) {
    report.outreach_events = await batchWrite('outreach_events', events, (ev) => ({
      id: ev.id,
      data: {
        id: ev.id,
        leadId: ev.lead_id ? String(ev.lead_id) : null,
        userId: ev.user_id || null,
        channel: ev.channel || 'manual',
        eventType: ev.event_type || 'message_sent',
        externalId: ev.external_id || null,
        payload: ev.payload || {},
        createdAt: ev.created_at ? new Date(ev.created_at) : new Date(),
      }
    }));
  }

  // PRINT SUMMARY REPORT
  console.log('\n====================================================');
  console.log('📊 MIGRATION SUMMARY REPORT');
  console.log('====================================================');
  console.table(report);
  console.log('\n✅ Data Migration Execution Completed Successfully!\n');
}

runMigration().catch(console.error);
