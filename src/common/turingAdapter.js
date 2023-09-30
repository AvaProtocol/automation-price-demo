import _ from 'lodash';
import '@oak-network/api-augment';

import { rpc, types, runtime } from '@oak-network/types';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { chains, assets } from '@oak-network/config';

const { turingLocal } = chains;

class TuringAdapter {
  constructor(config) {
    this.config = config;
    this.api = undefined;
    this.isInitializing = false;
  }

  initialize = async () => {
    console.log('TuringAdapter.initialize is called.', this.api);

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
      console.log('TuringAdapter.initialize has completed ApiPromise.create.', this.api);
    }

    return this.api;
  };

  disconnect = async () => {
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
