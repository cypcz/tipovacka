import * as dotenv from "dotenv";
dotenv.config();

enum ENV_VARS {
  TIMEZONE = "TIMEZONE",
  HISTORY_COLLECTION_KEY = "HISTORY_COLLECTION_KEY",
  HISTORY_DOC_ID = "HISTORY_DOC_ID",
  CLIENT_ID = "CLIENT_ID",
  CLIENT_SECRET = "CLIENT_SECRET",
  REDIRECT_URI = "REDIRECT_URI",
  PROJECT_ID = "PROJECT_ID",
  TOPIC_NAME = "TOPIC_NAME",
  SPREADSHEET_ID = "SPREADSHEET_ID",
}

export const getEnvVars = () => {
  const requiredEnvs = Object.keys(ENV_VARS);

  const missingEnvVars = requiredEnvs.reduce((acc, envName) => {
    if (!process.env[envName]) {
      return acc !== "" ? `${acc}, ${envName}` : `${envName}`;
    }
    return acc;
  }, "");

  if (missingEnvVars.length) {
    throw new Error(
      `You are missing required environment variables: ${missingEnvVars}`,
    );
  }

  return requiredEnvs.reduce(
    (envs, env) => ({ ...envs, [env]: process.env[env]! }),
    {} as { [key in ENV_VARS]: string },
  );
};
