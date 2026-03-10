// scripts/clear_firestore.js
// Destructive script: deletes all documents from selected collections in your Firebase project.
// Usage:
// 1. Obtain a Firebase service account JSON for the project (from Firebase Console → Project Settings → Service accounts).
// 2. Set environment variable FIREBASE_SERVICE_ACCOUNT to the path of that JSON file, or set GOOGLE_APPLICATION_CREDENTIALS.
// 3. Install dependency: npm install firebase-admin
// 4. Run: node scripts/clear_firestore.js

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) {
  console.error('ERROR: Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS to the service account JSON path');
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Collections to wipe. Modify if you want to keep some data.
const COLLECTIONS_TO_DELETE = ['users', 'registrations', 'attempts'];

async function deleteCollection(collectionPath, batchSize = 500) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) {
      console.log(`No more documents in ${collectionPath}`);
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Deleted ${snapshot.size} documents from ${collectionPath}`);

    // Loop again until collection is empty
    if (snapshot.size < batchSize) break;
  }
}

(async () => {
  try {
    console.log('Starting Firestore wipe for collections:', COLLECTIONS_TO_DELETE.join(', '));
    for (const col of COLLECTIONS_TO_DELETE) {
      console.log(`
Deleting collection: ${col}`);
      await deleteCollection(col);
    }
    console.log('Firestore wipe complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error wiping Firestore:', err);
    process.exit(1);
  }
})();
