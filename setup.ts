import { PubSub } from "@google-cloud/pubsub";
import * as admin from "firebase-admin";
import { gmail_v1, google, sheets_v4 } from "googleapis";
import credentials from "./credentials.json";
import token from "./token.json";
import { getEnvVars } from "./utils";

export const ENV = getEnvVars();

export const oAuth2Client = new google.auth.OAuth2(
  ENV.CLIENT_ID,
  ENV.CLIENT_SECRET,
  ENV.REDIRECT_URI,
);
oAuth2Client.setCredentials(token);

export const pubsub = new PubSub({
  projectId: ENV.PROJECT_ID,
  credentials,
});

export const gmail = new gmail_v1.Gmail({ auth: oAuth2Client });
export const sheets = new sheets_v4.Sheets({ auth: oAuth2Client });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(credentials as admin.ServiceAccount),
  });
}

export const db = admin.firestore();
