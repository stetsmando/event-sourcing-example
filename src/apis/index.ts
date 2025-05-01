import { randomUUID as uuid } from 'node:crypto'
import { Application, RouterContext, Router } from '@oak/oak'
import { parse  } from 'jsr:@std/csv'

import {
  Message,
} from 'npm:message-db-connector@0.0.13'

import { CONFIG } from '../config.ts'
import {
  Entity,
  Process,
} from '../components/InventoryProcessor/index.ts'

export class API {
  private config: CONFIG
  protected app

  constructor(config: CONFIG) {
    this.config = config;

    const router = new Router();
    router.get('/', context => {
      context.response.body = 'yay';
      context.response.status = 200;
    })
    router.post('/:partner/upload-inventory', this.HandleCSVUpload.bind(this));

    this.app = new Application();
    this.app.use(router.routes());
    this.app.use(router.allowedMethods());
  }

  Start() {
    const port = this.config.env.port;
    this.config.messageStore.logger.info(`Starting server on ${port}...`);
    this.app.listen({ port: Number(port) });
  }

  private async HandleCSVUpload({ request, response, params }: RouterContext<'/:partner/upload-inventory'>) {
    const partnerId = params.partner;
    if (!request.hasBody) {
      response.status = 400;
      response.body = { error: "No file uploaded" };
      return;
    }

    const body = request.body;
    const formData = await body.formData()
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      response.status = 400;
      response.body = { error: "No file named 'file' found in form data or it's not a file" };
      return;
    }

    const fileContent = await file.text();
    const parsedCsv = parse(fileContent, { skipFirstRow: true });

    for await (const row of parsedCsv) {
      const faaId = row['faa_id']
      const process = new Message<Process>({
        id: uuid({ disableEntropyCache: true }),
        streamName: `${Entity}:command-${faaId}`,
        type: 'Process',
        data: {
          partnerId,
          faaId: row['faa_id'],
          model: row.model,
          make: row.make,
          basePrice: Number(row['base_price']),
          weightInGrams: Number(row['weight_grams']),
          options: row.options,
        },
        metadata: {},
      });

      await this.config.messageStore.write(process);
    }

    response.status = 200;
    response.body = 'Sucessfully processed inventory file';
  }
}

