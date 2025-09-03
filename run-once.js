const admin = require("firebase-admin");

// serviceAccount.json ni shu papkaga qo‘ygan bo‘lishingiz kerak
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function setTeacherRole() {
  const uid = "d5H90BNkaAeZ3JV6HwsBzysgLqt1"; // 👈 bu yerga o‘qituvchi foydalanuvchi UID ni yozing

  try {
    await admin.auth().setCustomUserClaims(uid, { teacher: true });
    console.log("✅ Teacher role set successfully!");
  } catch (error) {
    console.error("❌ Error setting role:", error);
  }
}

setTeacherRole();
