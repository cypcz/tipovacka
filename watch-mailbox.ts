import * as functions from "firebase-functions";
import { ENV, gmail } from "./setup";

export const watchMailbox = functions
  .region("europe-west2")
  .pubsub.schedule("0 4 * * *")
  .timeZone(ENV.TIMEZONE)
  .onRun(async (context) => {
    try {
      await gmail.users.watch({
        userId: "me",
        requestBody: {
          labelIds: ["INBOX"],
          topicName: ENV.TOPIC_NAME,
        },
      });
      console.info(`mailbox watched at ${new Date().toISOString()}`);
    } catch (e) {
      console.error(JSON.stringify(e, null, 2));
    }

    return null;
  });
