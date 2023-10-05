import _ from 'lodash';
import '@oak-network/api-augment';

import { rpc, types, runtime } from '@oak-network/types';
import { types as polkadotTypes, StorageKey, createType } from '@polkadot/types';
import { xxhashAsHex } from '@polkadot/util-crypto';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { chains, assets } from '@oak-network/config';

const { stringToU8a } = require('@polkadot/util');

const { turingLocal } = chains;

class TuringAdapter {
  constructor(config) {
    this.config = config;
    this.api = undefined;
    this.isInitializing = false;
    this.subscriptions = [];
    this.unsub = undefined;
  }

  initialize = async () => {
    // Make sure we don't call ApiPromise.create() multiple times. This is important because React components can be re-rendered multiple times
    // in a very short period of time, during which ApiPromise.create() can be called multiple times.
    if (this.isInitializing) {
      return undefined;
    }

    if (_.isUndefined(this.api)) {
      this.isInitializing = true;
      this.api = await ApiPromise.create({
        provider: new WsProvider(this.config.endpoint), rpc, types, runtime,
      });

      this.isInitializing = false;
      // console.log('TuringAdapter.initialize has completed ApiPromise.create.', this.api);
    }

    return this.api;
  };

  subscribeTasks = async (cb) => {
    if (this.api && _.isUndefined(this.subscriptionTasks)) {
      try {
        const metadata = await this.api.rpc.state.getMetadata();
        console.log('subscribeTasks.metadata', metadata.toHuman());

        // // const storageValues =   xxhash128("ModuleName") + xxhash128("StorageName");
        // // Extract the info
        // const { meta, method, section } = this.api.query.automationPrice.tasks;

        // const section = 'AutomationPrice';
        // const method = 'AccountTasks';
        // console.log('section', section, 'method', method);

        // const encodedSection = xxhashAsHex(section, 128);
        // const encodedMethod = xxhashAsHex(method, 128);

        // console.log('encodedSection', encodedSection, 'encodedMethod', encodedMethod);
        // const concated = encodedSection + _.trimStart(encodedMethod, '0x');
        // console.log('concated', concated);

        // Display some info on a specific entry
        // console.log(section, method, meta.toHuman());
        // console.log(`query key: ${this.api.query.automationPrice.tasks.key()}`);

        // const queryKey = xxhashAsHex(stringToU8a('automationPrice tasks'), 128);
        // console.log('queryKey', queryKey.toString());
        // const storageKeys = await this.api.query.automationPrice.accountTasks;
        // console.log('subscribeTasks.storageKeys', storageKeys);

        // const unsub = await this.api.rpc.state.subscribeStorage([concated], (result) => {
        //   console.log('subscribeTask.api.rpc.state.subscribeStorage.result', result);
        //   console.log('subscribeTask.api.rpc.state.subscribeStorage.result.isNone', result[0].isNone);

        //   let valuesToReturn = [];
        //   if (!_.isEmpty(result) && !result[0].isNone) {
        //     valuesToReturn = _.map(result, (item) => item.toHuman());
        //   }

        //   cb(valuesToReturn);
        // });

        const unsub = await this.api.query.system.events((events) => {
          console.log('subscribeTasks.api.rpc.chain.subscribeAllHeads.events', events);

          events.forEach(({ phase, event: { data, method, section } }) => {
            if (section === 'automationPrice' && method === 'TaskScheduled') {
              console.log(`${phase.toString()} : ${section}.${method} ${data.toString()}`);
              console.log('data.toHuman', data.toHuman());
              const eventData = data.toHuman(); // {who: '6757gffjjMc7E4sZJtkfvq8fmMzH2NPRrEL3f3tqpr2PzXYq', taskId: '1775-0-1'}

              // TODO: use system events to get notification of new tasks
              // turingAdapter.getTask(taskId)
            }
          });
        });

        // this.subscriptions.push(unsub);
      } catch (ex) {
        console.log('subscribeTask exception', ex);
      }
    }
  };

  subscribePrice = async (cb) => {
    if (this.api && _.isUndefined(this.subscriptionPrice)) {
      try {
        const storageKeys = await this.api.query.automationPrice.priceRegistry.keys('shibuya', 'arthswap');
        const unsub = await this.api.rpc.state.subscribeStorage(storageKeys, (result) => {
          // console.log('subscribePrice.api.rpc.state.subscribeStorage.result', result);

          cb(_.map(result, (item) => item.toHuman()));
        });

        this.subscriptions.push(unsub);
      } catch (ex) {
        console.log('subscribePrice exception', ex);
      }
    }
  };

  disconnect = async () => {
    // Call all the unsub functions
    _.each(this.subscriptions, (unsub) => {
      unsub();
    });

    // Disconnect the api
    this.api.disconnect();
  };
}

let instance;

// Singleton implementation so that we can pass config to the constructor
export default {
  getInstance(config) {
    if (_.isUndefined(instance)) {
      instance = new TuringAdapter(config);
    }
    return instance;
  },
};
