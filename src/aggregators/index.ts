import {
  HandlerContext,
  Message,
  Subscription,
} from 'npm:message-db-connector@0.0.13'

import { CONFIG } from '../config.ts'
import {
  Entity,
  Processed,
  projection as inventoryProcessorProjection,
  State as InventoryProcessor,
} from '../components/InventoryProcessor/index.ts'

const subscriberId = '830e9576-85df-4763-865f-585084e68b68';

export class ProcessingAggregator {
  private config: CONFIG;
  private InMemoryStore: InventoryProcessor[] = [];
  private subscriptions: Subscription[] = [];
  private completedCount: number = 0;

  constructor(config: CONFIG) {
    // Create our subscription(s)
    this.config = config;

    const inventoryProcessorAggregator = new Subscription({
      messageStore: config.messageStore,
      streamName: Entity,
      subscriberId,
      batchSize: 5, // messages at a time
      intervalTimeMs: 1000, // time between messages
    });

    // Register hanlders with the subscription
    inventoryProcessorAggregator.registerHandler<Message<Processed>>(this.HandleProcessed.bind(this), 'Processed');

    this.subscriptions.push(inventoryProcessorAggregator);
  }

  Start() {
    // Start our subscription(s)
    this.subscriptions.forEach(subscription => subscription.start())
  }

  async HandleProcessed(processed: Message<Processed>, context: HandlerContext) {
    const { streamName } = processed;
    const currentState = await context.messageStore.fetch<InventoryProcessor>(streamName, inventoryProcessorProjection);

    this.InMemoryStore.push(currentState);
    this.completedCount++

    if (this.completedCount > 5) {
      this.completedCount = 0;

      // Prep records for elasticsearch
      // The flatMap creates the specific Newline Delimited JSON (NDJSON) format required by the Bulk API.
      // Each document needs two lines: the action/metadata (specifying index and optionally ID) and the document source.
      const body = this.InMemoryStore.flatMap(record => {
        const metadata = {
          index: {
            _index: this.config.env.indexName,
            _id: record.faaId,
          }
        };

        return [JSON.stringify(metadata), JSON.stringify(record)];
      }).join('\n') + '\n'; // NDJSON format needs a newline at the end

      // Send a Bulk Request
      try {
        const response = await fetch(`${this.config.env.elasticSearchUrl}/_bulk`, {
          method: 'POST',
          headers: {
            // Need to use the application/x-ndjson header for the Bulk Api
            'Content-Type': 'application/x-ndjson'
          },
          body: body
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Bulk request failed: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const result = await response.json();

        // Check for errors within the Bulk API response items
        if (result.errors) {
          console.warn("Some documents failed during bulk indexing:");
          result.items.forEach((item: any) => {
            if (item.index && item.index.error) {
              console.error(`  ID ${item.index._id}: ${item.index.error.type} - ${item.index.error.reason}`);
            }
          });
        } else {
           console.log(`Successfully indexed 5 documents. Took: ${result.took}ms`);
        }
      } catch(e) {
        console.error("Failed to send bulk request:", e);
      }
    }
  }
}

