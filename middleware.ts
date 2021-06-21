import express from "express";
import { oAuth2Client } from "./setup";

export const verifyWebhookRequest = async (req: express.Request) => {
  const idToken = req.headers.authorization?.replace("Bearer ", "");

  if (!idToken) throw new Error("Unauthorized request");

  try {
    const ticket = await oAuth2Client.verifyIdToken({ idToken });
    const claim = ticket.getPayload();
    if (claim?.iss !== "https://accounts.google.com" || !claim.email_verified) {
      throw new Error("Claim verification failed");
    }
  } catch (e) {
    console.error(e);
    throw new Error("Token verification failed");
  }
};
