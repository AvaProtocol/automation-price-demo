import _ from 'lodash';
import '@oak-network/api-augment';

import { rpc, types, runtime } from '@oak-network/types';
import { ApiPromise, WsProvider } from '@polkadot/api';

class TuringAdapter {
  constructor(config) {
    this.config = config;
    this.api = undefined;
    this.isInitializing = false;
    this.subscriptions = [];
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

  /**
   * Get all entries in the automationPrice.tasks storage and run callback with retrieved tasks
   * @param {*} cb
   */
  fetchTasksFromStorage = async (cb) => {
    if (this.api) {
      try {
        const values = await this.api.query.automationPrice.tasks.entries();
        cb(_.map(values, (item) => item[1].toHuman()));
      } catch (ex) {
        console.log('subscribePrice exception', ex);
      }
    }
  };

  /**
   * Subscribe to all chain events, filter out TaskScheduled, TaskExecuted, TaskCancelled events, and run callback with tasks contained in the events
   * @param {function} cb callback function from the caller
   */
  subscribeTasks = async (cb) => {
    if (this.api && _.isUndefined(this.subscriptionTasks)) {
      try {
        const unsub = await this.api.query.system.events(async (events) => {
          const foundTaskEvents = _.filter(_.map(events, ({ phase, event: { data, method, section } }) => {
            // console.log(`${phase.toString()} : ${section}.${method} ${data.toString()}`);

            if (section === 'automationPrice') { // TaskScheduled, TaskExecuted, TaskCancelled events contain the same data for now
              const eventData = data.toHuman(); // {who: '6757gffjjMc7E4sZJtkfvq8fmMzH2NPRrEL3f3tqpr2PzXYq', taskId: '1775-0-1'}
              return { section, method, data: { ownerId: eventData.who, taskId: eventData.taskId } };
            }

            return undefined;
          }), (event) => !_.isUndefined(event));

          cb(foundTaskEvents);
        });

        this.subscriptions.push(unsub);
      } catch (ex) {
        console.log('subscribeTask exception', ex);
      }
    }
  };

  /**
   * Subscribe to priceRegistry storage value change and run callback with the new value
   * @param {function} cb callback function from the caller
   */
  subscribePrice = async (cb) => {
    if (this.api && _.isUndefined(this.subscriptionPrice)) {
      try {
        const storageKeys = await this.api.query.automationPrice.priceRegistry.keys('shibuya', 'arthswap');
        const unsub = await this.api.rpc.state.subscribeStorage(storageKeys, (results) => {
          // console.log('subscribePrice.api.rpc.state.subscribeStorage.result', result);

          cb(_.map(results, (item) => item.toHuman()));
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
