import { cert, getApps, initializeApp, type App } from "firebase-admin/app";

import {
  assertExplicitCredentials,
  getFirebaseConfig,
  hasExplicitCredentials,
} from "./config.js";

const defaultAppName = "ctrlp";

export function getFirebaseApp(): App {
  const existingApp = getApps().find((app) => app.name === defaultAppName);

  if (existingApp) {
    return existingApp;
  }

  const config = getFirebaseConfig();

  if (hasExplicitCredentials(config)) {
    assertExplicitCredentials(config);

    return initializeApp(
      {
        credential: cert({
          projectId: config.projectId,
          clientEmail: config.clientEmail,
          privateKey: config.privateKey,
        }),
        storageBucket: config.storageBucket,
      },
      defaultAppName,
    );
  }

  return initializeApp(
    { storageBucket: config.storageBucket },
    defaultAppName,
  );
}
