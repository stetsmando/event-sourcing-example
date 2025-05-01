// The env file pulls in all environmental variables that can be used in the project
// and exports them as an object

import process from 'node:process'
import dotenv from "npm:dotenv@16.5.0"

const envResults = dotenv.config();

if (envResults.error) {
  // We were unable to parse the env, die loudly
  process.exit(1);
}

// This is our actual ENV variables
export interface ENV {
  connectionString: string,
  port: string,
  elasticSearchUrl: string,
  indexName: string
}

function getFromEnvOrDie(varName: string) {
  const found = envResults!.parsed?.[varName];
  if (found)
    return found;

  console.error(`${varName} not found in .evn file!`);
  process.exit(1);
}

export const env: ENV = {
  connectionString: getFromEnvOrDie("CONNECTION_STRING"),
  port: getFromEnvOrDie("PORT"),
  elasticSearchUrl: getFromEnvOrDie("ELASTICSEARCH_URL"),
  indexName: getFromEnvOrDie("INDEX_NAME"),
}

