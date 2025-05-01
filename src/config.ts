import {
  MessageStore,
  MessageDbReader,
  MessageDbWriter,
} from "npm:message-db-connector@0.0.13"

import { ENV } from './env.ts'

export interface CONFIG {
  env: ENV,
  messageStore: MessageStore,
}

export async function createConfig(env: ENV): Promise<CONFIG> {
  // Create a reader
  const reader = await MessageDbReader.Make({
    pgConnectionConfig: {
      connectionString: env.connectionString
    }
  });
  // Create a writer
  const writer = await MessageDbWriter.Make({
    pgConnectionConfig: {
      connectionString: env.connectionString
    }
  });

  // Create a message store
  const messageStore = new MessageStore({
    reader,
    writer,
  })

  return {
    env,
    messageStore,
  }
}
