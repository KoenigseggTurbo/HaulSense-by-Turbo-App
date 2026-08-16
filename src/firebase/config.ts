import appletConfig from "../../firebase-applet-config.json";

export const firebaseConfig = {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  storageBucket: (appletConfig as any).storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
  measurementId: appletConfig.measurementId,
};

export const firestoreDatabaseId = (appletConfig as any).firestoreDatabaseId || "(default)";
