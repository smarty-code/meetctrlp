import { cert, getApps, initializeApp, type App } from "firebase-admin/app";

import {
	assertFirebaseCredentials,
	getFirebaseConfig,
	hasFirebaseCredentials,
} from "./config.js";

const appName = "ctrlp";

export function getFirebaseApp(): App {
	const existingApp = getApps().find((app) => app.name === appName);

	if (existingApp) {
		return existingApp;
	}

	const config = getFirebaseConfig();

	if (!hasFirebaseCredentials(config)) {
		return initializeApp(undefined, appName);
	}

	assertFirebaseCredentials(config);

	return initializeApp(
		{
			credential: cert({
				projectId: config.projectId,
				clientEmail: config.clientEmail,
				privateKey: config.privateKey,
			}),
		},
		appName,
	);
}
