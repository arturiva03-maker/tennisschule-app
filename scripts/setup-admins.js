const admin = require("firebase-admin");
const path = require("path");

// Service Account laden
const serviceAccount = require("C:\\Users\\artur\\tennisschule-app-firebase-adminsdk-fbsvc-d4d9e35f83.json");

// Firebase Admin initialisieren
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

// === HIER DIE 3 ADMIN-ACCOUNTS EINTRAGEN ===
const admins = [
  {
    email: "admin1@tennisschule.de",
    password: "admin123456",
    name: "Admin 1",
  },
  {
    email: "admin2@tennisschule.de",
    password: "admin123456",
    name: "Admin 2",
  },
  {
    email: "admin3@tennisschule.de",
    password: "admin123456",
    name: "Admin 3",
  },
];
// ===========================================

async function setupAdmins() {
  console.log("🚀 Starte Setup...\n");

  for (const adminData of admins) {
    try {
      // 1. User in Firebase Auth anlegen
      const userRecord = await auth.createUser({
        email: adminData.email,
        password: adminData.password,
        displayName: adminData.name,
      });

      console.log(`✅ Auth-User erstellt: ${adminData.email} (UID: ${userRecord.uid})`);

      // 2. User-Dokument in Firestore anlegen
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: adminData.email,
        name: adminData.name,
        rolle: "admin",
        createdAt: new Date().toISOString(),
      });

      console.log(`✅ Firestore-Dokument erstellt für: ${adminData.name}\n`);
    } catch (error) {
      if (error.code === "auth/email-already-exists") {
        console.log(`⚠️  User existiert bereits: ${adminData.email}\n`);
      } else {
        console.error(`❌ Fehler bei ${adminData.email}:`, error.message, "\n");
      }
    }
  }

  console.log("✅ Setup abgeschlossen!");
  console.log("\n📋 Admin-Logins:");
  console.log("================");
  for (const a of admins) {
    console.log(`   Email: ${a.email}`);
    console.log(`   Passwort: ${a.password}\n`);
  }

  process.exit(0);
}

setupAdmins();
