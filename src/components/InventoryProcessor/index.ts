import {
  HandlerContext,
  Message,
  Projection,
  Subscription,
} from 'npm:message-db-connector@0.0.13'
import { randomUUID as uuid } from 'node:crypto'

import { CONFIG } from '../../config.ts'

export const Entity = 'InventoryProcessor';

const subscriberId = '70cf84cf-01fa-4e27-ba35-59188e63088f';

// Command(s)
export interface Process {
  type: 'Process',
  data: {
    partnerId: string,
    faaId: string,
    model: string,
    make: string,
    basePrice: number,
    weightInGrams: number,
    options: string,
  }
}

// Event(s)
export interface Processing {
  type: 'Processing',
  data: {
    partnerId: string,
    faaId: string,
    model: string,
    make: string,
    basePrice: number,
    weightInGrams: number,
    options: string,
  }
}
export interface PricingCalculated {
  type: 'PricingCalculated',
  data: {
    calculatedPrice: number
  }
}
export interface Processed {
  type: 'Processed',
  data: {}
}

export class InventoryProcessor {
  private subscriptions: Subscription[] = [];

  constructor(config: CONFIG) {
    // Create our subscription(s)
    const commandStream = `${Entity}:command`;
    const commandStreamSubscription = new Subscription({
      messageStore: config.messageStore,
      streamName: commandStream,
      subscriberId,
      batchSize: 100, // 1 message at a time
      intervalTimeMs: 100, // time between messages
    });

    config.messageStore.logger.info(commandStream);

    // Register hanlders with the subscription
    commandStreamSubscription.registerHandler<Message<Process>>(this.HandleProcess.bind(this), 'Process');

    this.subscriptions.push(commandStreamSubscription);
  }

  Start() {
    // Start our subscription(s)
    this.subscriptions.forEach(subscription => subscription.start())
  }

  async HandleProcess(process: Message<Process>, context: HandlerContext) {
    const { streamName: commandStreamName } = process;

    // extract the 'partner' id
    // You can read about stream names here for this to make sense
    // http://docs.eventide-project.org/core-concepts/streams/stream-names.html
    const partnerId = commandStreamName.substring(commandStreamName.indexOf('-') + 1);
    const entityStreamName = `${Entity}-${partnerId}`;

    // Get the current state of our Inventory Processor for idempotence
    const currentState = await context.messageStore.fetch<State>(entityStreamName, projection);

    if (currentState.processed) {
      // We're done, noop
      return;
    }

    if (!currentState.partnerId) {
      // We've not done any processing so do it all
      const { data: { basePrice, model, options } } = process;
      await this.WriteProcessing(process, context, entityStreamName);
      await this.CalculateAndWritePricing(
        basePrice,
        model,
        JSON.parse(options),
        context,
        entityStreamName,
      );
      await this.WriteProcessed(entityStreamName, context);
      return;
    }

    if (!currentState.calculatedPrice) {
      // We need to calculate pricing
      const { basePrice, model, options } = currentState;
      if (basePrice === undefined || model === undefined || options === undefined ) {
        return;
      }
      await this.CalculateAndWritePricing(
        basePrice,
        model,
        options,
        context,
        entityStreamName,
      );
      await this.WriteProcessed(entityStreamName, context);
      return;
    }

    // The only thing left to do is tombstone our process
    await this.WriteProcessed(entityStreamName, context);
  }

  private async WriteProcessing(process: Message<Process>, context: HandlerContext, entityStreamName: string) {
    const processing = process.follow<Processing>({
      type: 'Processing',
      streamName: entityStreamName,
    });

    await context.messageStore.write(processing);
  }

  private async CalculateAndWritePricing(
    basePrice: number,
    model: string,
    options: string[],
    context: HandlerContext,
    streamName: string
  ) {
    const optionsCost = options.reduce((accu, curr) => {
      const costsForModel = availableOptions[model as keyof typeof availableOptions];
      const optionPrice = costsForModel?.[curr as keyof typeof costsForModel] ?? 0;

      return accu + optionPrice;
    }, 0);

    console.log('options cost', optionsCost)

    const pricingCalculated = new Message<PricingCalculated>({
      id: uuid({ disableEntropyCache: true }),
      streamName,
      type: 'PricingCalculated',
      data: {
        calculatedPrice: basePrice + optionsCost,
      },
      metadata: {},
    });

    console.log('writing message')
    await context.messageStore.write(pricingCalculated);
  }

  private async WriteProcessed(streamName: string, context: HandlerContext) {
    const processed = new Message<Processed>({
      id: uuid({ disableEntropyCache: true }),
      streamName,
      type: 'Processed',
      data: {},
      metadata: {},
    });

    await context.messageStore.write(processed);
  }
}

// This data could be pulled async and then used here, I'm cheating for the sake of demonstation
const availableOptions = {
  "Flyer Pro V2": {
    "Extra Battery": 150,
    "Carrying Case": 80,
    "Propeller Guards": 60,
    "GPS Upgrade": 200,
    "Extended Warranty": 200,
  },
  "Phantom Breeze": {
    "Extra Battery": 140,
    "Carrying Case": 75,
    "Propeller Guards": 55,
    "GPS Upgrade": 210,
    "Extended Warranty": 220,
  },
  "Thunderbolt 360": {
    "Extra Battery": 130,
    "Carrying Case": 70,
    "Propeller Guards": 50,
    "GPS Upgrade": 180,
    "Extended Warranty": 180,
  },
  "Sky Scout Mini": {
    "Extra Battery": 160,
    "Carrying Case": 90,
    "Propeller Guards": 65,
    "GPS Upgrade": 220,
    "Extended Warranty": 230,
  },
  "AeroX 2000": {
    "Extra Battery": 145,
    "Carrying Case": 85,
    "Propeller Guards": 58,
    "GPS Upgrade": 190,
    "Extended Warranty": 210,
  },
};

// State(s)
// This will represent the current state of a given 'InventoryProcessor'
export interface State {
  partnerId?: string,
  faaId?: string,
  model?: string,
  make?: string,
  basePrice?: number,
  calculatedPrice?: number,
  weightInGrams?: number,
  options?: string[],
  processed?: boolean,
}

export const projection: Projection<State, Message<any>> = {
  init: {},
  name: 'InventoryProcessorProjection',
  handlers: {
    Processing(state: State, message: Message<Processing>) {
      if (!state.partnerId) {
        // We've got no current state
        const options = JSON.parse(message.data.options);
        return { ...state, ...message.data, options }
      } else {
        return state;
      }

    },
    PricingCalculated(state: State, message: Message<PricingCalculated>) {
      if (!state.calculatedPrice) {
        const { data: { calculatedPrice } } = message;
        return { ...state, calculatedPrice }
      } else {
        return state;
      }
    },
    Processed(state: State, _message: Message<Processed>) {
      if (!state.processed) {
        return { ...state, processed: true }
      } else {
        return state;
      }
    },
  },
};

