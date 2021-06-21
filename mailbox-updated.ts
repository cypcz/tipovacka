import { zonedTimeToUtc } from "date-fns-tz";
import { Request } from "express";
import * as functions from "firebase-functions";
import MATCHES from "./data/matches.json";
import PLAYERS from "./data/players.json";
import { verifyWebhookRequest } from "./middleware";
import { db, ENV, gmail, sheets } from "./setup";
import { Match, Tip, TipWithRange } from "./types";

export const getPlayerRow = (email: string): number | undefined =>
  PLAYERS[email.toLowerCase()];

export const getMatch = (
  matchNumber: number,
  row: number,
): Match | undefined => {
  const match = MATCHES[matchNumber];

  return match
    ? { ...match, range: match.range.replace(/-row/g, row.toString()) }
    : undefined;
};

const historyDoc = db
  .collection(ENV.HISTORY_COLLECTION_KEY)
  .doc(ENV.HISTORY_DOC_ID);

const getPreviousHistoryId = async (): Promise<string> =>
  (await historyDoc.get()).data()?.historyId;

const setHistoryId = (req: Request) => {
  const decoded = JSON.parse(
    Buffer.from(req.body.message.data, "base64").toString("utf-8"),
  );

  return historyDoc.set({
    historyId: decoded?.historyId,
    date: new Date(),
  });
};

const getSubject = (data: any) =>
  data.payload?.headers?.find((header) => header.name === "Subject")?.value;

const getPlayerEmail = (data: any) =>
  data.payload?.headers
    ?.find((header) => header.name === "From")
    ?.value?.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi)?.[0];

export const mailboxUpdated = functions
  .region("europe-west2")
  .https.onRequest(async (req, res) => {
    try {
      await verifyWebhookRequest(req);

      const { data: historyData } = await gmail.users.history.list({
        userId: "me",
        startHistoryId: await getPreviousHistoryId(),
        labelId: "INBOX",
      });

      await setHistoryId(req);

      const newMessages =
        historyData.history
          ?.flatMap((entry) =>
            entry.messagesAdded?.map(({ message }) => message),
          )
          .filter(Boolean) || [];

      if (!newMessages.length) {
        console.info("History updated, but no new messages");
        res.status(200).send();
        return;
      }

      const messagesDetailsPromises = newMessages.map((m) =>
        gmail.users.messages.get({
          userId: "me",
          id: m?.id || undefined,
        }),
      );

      const messages = await Promise.all(messagesDetailsPromises);

      const tips: Tip[] = [];

      for (const { data } of messages) {
        const subject = getSubject(data);
        if (!subject?.toLowerCase().trim().includes("tip")) {
          console.info(
            `New message, but subject '${subject}' does not include required keyword`,
          );
          res.status(200).send();
          return;
        }

        const playerEmail = getPlayerEmail(data);

        if (!playerEmail) {
          console.info("From email not found");
          continue;
        }

        const playerRow = getPlayerRow(playerEmail);

        if (!playerRow) {
          console.info(`Player ${playerEmail} not found`);
          continue;
        }

        const rawMessage = data.payload?.parts?.find(
          (p) => p.mimeType === "text/plain",
        )?.body?.data;

        if (!rawMessage) {
          console.info("Raw message not found");
          continue;
        }

        const decodedMessage = Buffer.from(rawMessage, "base64").toString(
          "utf-8",
        );

        const lines = decodedMessage.split("\n").filter(Boolean); // filters out empty lines

        lines.forEach((line) => {
          const joker = ["zol", "žol"].some((v) =>
            line.toLowerCase().includes(v),
          );

          const [matchNumber, scoreOne, scoreTwo] =
            line.match(/\d+/g)?.join(" ").split(" ") || [];

          if (!matchNumber || !scoreOne || !scoreTwo) {
            console.info(
              `Line has wrong format with values ${matchNumber}, ${scoreOne}, ${scoreTwo} - skipping`,
            );
            return;
          }

          tips.push({
            playerRow,
            playerEmail,
            matchNumber: Number(matchNumber),
            scoreOne: Number(scoreOne),
            scoreTwo: Number(scoreTwo),
            joker,
          });
        });
      }

      const tipsWithRange: TipWithRange[] = [];

      for (const tip of tips) {
        const match = getMatch(tip.matchNumber, tip.playerRow);

        if (!match) {
          console.info(`Match ${tip.matchNumber} not found`);
          continue;
        }

        if (new Date() > zonedTimeToUtc(match.start, ENV.TIMEZONE)) {
          console.info(
            `Cannot create tip for player ${tip.playerEmail} and match ${tip.matchNumber} because it already started at ${match.start}`,
          );
          continue;
        }

        tipsWithRange.push({ ...tip, range: match.range });
      }

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: ENV.SPREADSHEET_ID,
        requestBody: {
          data: tipsWithRange.flatMap((tip) => [
            {
              range: tip.range,
              values: [
                [
                  tip.scoreOne,
                  null,
                  tip.scoreTwo,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  tip.joker ? "Z" : "",
                ],
              ],
            },
          ]),
          valueInputOption: "USER_ENTERED",
        },
      });

      tipsWithRange.forEach(
        ({ playerEmail, matchNumber, range, scoreOne, scoreTwo }) => {
          console.info(
            `Tip player ${playerEmail} for match ${matchNumber} in ${range} with score ${scoreOne}:${scoreTwo} successfully inserted`,
          );
        },
      );

      res.status(200).send();
      return;
    } catch (e) {
      await setHistoryId(req);
      console.error(e);

      // intentionally returning 200 to not pile up wrong pubsub messages in queue
      res.status(200).send();
      return;
    }
  });
