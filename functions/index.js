const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onusercreated } = require("firebase-functions/v2/identity");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ── 1. ADMIN CREATE USER FUNCTION ──
// Secure HTTPS Callable function allowing Admin users to create team accounts
exports.createUser = onCall(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to create users.");
  }

  const callerUid = request.auth.uid;
  const callerSnap = await db.collection("users").doc(callerUid).get();
  
  if (!callerSnap.exists || callerSnap.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Only administrators can invite/create team users.");
  }

  const { email, password, fullName, role } = request.data;
  if (!email || !password || !fullName || !role) {
    throw new HttpsError("invalid-argument", "Missing required fields: email, password, fullName, role.");
  }

  const validRoles = ["admin", "manager", "sales", "lead generator", "viewer"];
  if (!validRoles.includes(role)) {
    throw new HttpsError("invalid-argument", `Invalid role. Must be one of: ${validRoles.join(", ")}`);
  }

  try {
    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: fullName,
      emailVerified: true,
    });

    // Set custom claims for DB security rules
    await admin.auth().setCustomUserClaims(userRecord.uid, { role });

    // Populate user profile document in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName: fullName,
      role,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, uid: userRecord.uid };
  } catch (err) {
    console.error("Error creating user:", err);
    throw new HttpsError("internal", err.message || "Failed to create user account.");
  }
});

// ── 2. LOG ACTIVITY CALLABLE ──
exports.logActivity = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to write activity logs.");
  }

  const { action, entityType, entityId, projectId, metadata } = request.data;

  try {
    const logRef = await db.collection("activity_logs").add({
      userId: request.auth.uid,
      action: action || "unknown",
      entityType: entityType || "system",
      entityId: entityId ? String(entityId) : null,
      projectId: projectId || null,
      metadata: metadata || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, id: logRef.id };
  } catch (err) {
    console.error("Activity log error:", err);
    throw new HttpsError("internal", "Failed to insert activity log.");
  }
});
