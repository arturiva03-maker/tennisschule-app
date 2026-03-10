const admin = require("firebase-admin");

// Falls schon initialisiert, überspringen
if (!admin.apps.length) {
  const serviceAccount = require("C:\\Users\\artur\\tennisschule-app-firebase-adminsdk-fbsvc-d4d9e35f83.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const auth = admin.auth();
const db = admin.firestore();

const adminEmails = [
  "admin1@tennisschule.de",
  "admin2@tennisschule.de",
  "admin3@tennisschule.de",
];

async function createFirestoreDocs() {
  console.log("🚀 Erstelle Firestore-Dokumente...\n");

  for (const email of adminEmails) {
    try {
      // User aus Auth holen
      const userRecord = await auth.getUserByEmail(email);

      // Firestore-Dokument erstellen
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName || email.split("@")[0],
        rolle: "admin",
        createdAt: new Date().toISOString(),
      });

      console.log(`✅ Firestore-Dokument erstellt: ${email}`);
    } catch (error) {
      console.error(`❌ Fehler bei ${email}:`, error.message);
    }
  }

  console.log("\n✅ Fertig!");
  process.exit(0);
}

createFirestoreDocs();
