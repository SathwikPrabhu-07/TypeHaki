# Clear Firestore Data (Destructive)

This repository includes a small Node script to delete all documents from selected collections in your Firebase project. Use with extreme caution — this permanently deletes data.

Collections the script deletes by default:
- `users` (user profiles)
- `registrations`
- `attempts`

Steps

1. Get a Firebase service account JSON for your project:
   - Console → Project settings → Service accounts → Generate new private key
   - Save the JSON file locally (e.g., `C:\keys\typehaki-service-account.json`).

2. Install dependencies (locally in repo):

```bash
npm install firebase-admin
```

3. Set environment variable pointing to the service account file. Examples:

PowerShell:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT = 'C:\keys\typehaki-service-account.json'
node scripts/clear_firestore.js
```

Windows CMD:

```cmd
set FIREBASE_SERVICE_ACCOUNT=C:\keys\typehaki-service-account.json
node scripts/clear_firestore.js
```

Or set `GOOGLE_APPLICATION_CREDENTIALS` instead.

4. Run the script:

```bash
node scripts/clear_firestore.js
```

Notes

- This script deletes documents in batches and will not remove subcollections automatically. If you use subcollections, extend the script accordingly.
- If you want to preserve `rounds`, remove it from `COLLECTIONS_TO_DELETE` in `scripts/clear_firestore.js`.
- Ensure you are pointing to the correct Firebase project — this action is irreversible.

After wipe

- Rebuild and redeploy hosting so new clients receive the app changes (if any):

```bash
npm run build
firebase deploy --only hosting
```

- Advise users to clear caches / unregister service workers so they fetch fresh assets.
