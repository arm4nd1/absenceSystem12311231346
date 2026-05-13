const admin = require("firebase-admin");
const path  = require("path");

let db;

function initFirebase() {
  if (admin.apps.length === 0) {
    const credPath = path.resolve(process.env.FIREBASE_CREDENTIALS);
    const serviceAccount = require(credPath);

    admin.initializeApp({
      credential:  admin.credential.cert(serviceAccount),
      projectId:   process.env.FIREBASE_PROJECT_ID,
    });
  }
  db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

function getDb() {
  if (!db) initFirebase();
  return db;
}

module.exports = { initFirebase, getDb };
