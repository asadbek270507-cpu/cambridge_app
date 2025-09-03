const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/** 🔒 ixtiyoriy: teacher rolini tekshirish (custom claims) */
function mustBeTeacher(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Login talab qilinadi.");
  }
  const isTeacher = context.auth.token && context.auth.token.teacher === true;
  if (!isTeacher) {
    throw new functions.https.HttpsError("permission-denied", "Teacher huquqi kerak.");
  }
}

/** ➕ CREATE: Auth + Firestore */
exports.createStudent = functions.https.onCall(async (data, context) => {
  // Agar hozircha claims qo‘ymasangiz, quyidagini vaqtincha o‘chirib tursangiz ham bo‘ladi:
  // mustBeTeacher(context);

  const { name, email, password } = data || {};
  if (!name || !email || !password) {
    throw new functions.https.HttpsError("invalid-argument", "name, email, password kerak.");
  }

  try {
    // Auth’da yaratamiz
    const user = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      disabled: false,
    });

    // Firestore’da students/{uid}
    await db.collection("students").doc(user.uid).set({
      uid: user.uid,
      name,
      email,
      role: "student",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      // ❗ Parolni saqlamaslik kerak. Maxfiylik uchun Faqat Auth’da bo‘ladi.
    });

    return { ok: true, uid: user.uid };
  } catch (err) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});

/** ✏️ UPDATE: Auth (email/password/name) + Firestore */
exports.updateStudent = functions.https.onCall(async (data, context) => {
  // mustBeTeacher(context);

  const { uid, name, email, password } = data || {};
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "uid kerak.");
  }

  const updateAuth = {};
  if (name) updateAuth.displayName = name;
  if (email) updateAuth.email = email;
  if (password) updateAuth.password = password;

  try {
    if (Object.keys(updateAuth).length) {
      await admin.auth().updateUser(uid, updateAuth);
    }

    const updateFS = {};
    if (name) updateFS.name = name;
    if (email) updateFS.email = email;
    updateFS.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("students").doc(uid).update(updateFS);
    return { ok: true };
  } catch (err) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});

/** 🗑 DELETE: Auth + Firestore */
exports.deleteStudent = functions.https.onCall(async (data, context) => {
  // mustBeTeacher(context);

  const { uid } = data || {};
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "uid kerak.");
  }

  try {
    await admin.auth().deleteUser(uid);                      // Auth’dan o‘chadi → kira olmaydi
    await db.collection("students").doc(uid).delete();       // Firestore’dan ham o‘chadi
    return { ok: true };
  } catch (err) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});
