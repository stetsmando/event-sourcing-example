import { env  }from './env.ts'
import { createConfig } from './config.ts'


import {
  InventoryProcessor,
} from './components/InventoryProcessor/index.ts'

import {
  ProcessingAggregator,
} from './aggregators/index.ts'

import { API } from './apis/index.ts'

if (import.meta.main) {
  console.log(env.connectionString);
  const config = await createConfig(env);

  // Start components
  const processor = new InventoryProcessor(config);
  processor.Start();

  // Start Aggregators
  const processingAggregator = new ProcessingAggregator(config);
  processingAggregator.Start();

  const api = new API(config);
  api.Start();
}
