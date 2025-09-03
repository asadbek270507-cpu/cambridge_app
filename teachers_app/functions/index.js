// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.deleteStudentAccount = functions.https.onCall(async (data, context) => {
  const teacherUid = context.auth?.uid;
  if (!teacherUid) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }
  const { studentUid } = data || {};
  if (!studentUid) {
    throw new functions.https.HttpsError("invalid-argument", "studentUid required");
  }

  const studentRef = admin.firestore().collection("users").doc(studentUid);
  const snap = await studentRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Student not found");
  }
  const student = snap.data();
  if (student.teacherId !== teacherUid) {
    throw new functions.https.HttpsError("permission-denied", "Not your student");
  }

  // 1) Auth'dan o'chirish
  try {
    await admin.auth().deleteUser(studentUid);
  } catch (e) {
    // agar user allaqachon o'chirilgan bo'lsa - hushyorlik bilan davom etamiz
    if (e?.code !== "auth/user-not-found") {
      throw new functions.https.HttpsError("internal", e.message || "Auth delete failed");
    }
  }

  // 2) Firestore'da soft-delete
  await studentRef.update({
    status: "deleted",
    deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    deletedBy: teacherUid,
  });

  return { ok: true };
});

exports.adminSetStudentPassword = functions.https.onCall(async (data, context) => {
  const teacherUid = context.auth?.uid;
  if (!teacherUid) {
    throw new functions.https.HttpsError("unauthenticated", "Login required");
  }
  const { studentUid, newPassword } = data || {};
  if (!studentUid || typeof newPassword !== "string" || newPassword.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "studentUid & strong newPassword required");
  }

  const studentRef = admin.firestore().collection("users").doc(studentUid);
  const snap = await studentRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Student not found");
  }
  const student = snap.data();
  if (student.teacherId !== teacherUid) {
    throw new functions.https.HttpsError("permission-denied", "Not your student");
  }

  await admin.auth().updateUser(studentUid, { password: newPassword });
  await studentRef.update({
    lastPasswordSetAt: admin.firestore.FieldValue.serverTimestamp(),
    lastPasswordSetBy: teacherUid,
  });

  return { ok: true };
});
