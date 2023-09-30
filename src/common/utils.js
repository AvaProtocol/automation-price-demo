import _ from 'lodash';
import { u8aToHex, hexToU8a } from '@polkadot/util';
import moment from 'moment';
import { TypeRegistry } from '@polkadot/types';
import { blake2AsU8a } from '@polkadot/util-crypto';

const listenEvents = async (api, section, method, conditions, timeout = undefined) => new Promise((resolve) => {
  let unsub = null;
  let timeoutId = null;

  if (timeout) {
    timeoutId = setTimeout(() => {
      unsub();
      resolve(null);
    }, timeout);
  }

  const listenSystemEvents = async () => {
    unsub = await api.query.system.events((events) => {
      const foundEventIndex = _.findIndex(events, ({ event }) => {
        const { section: eventSection, method: eventMethod, data } = event;
        if (eventSection !== section || eventMethod !== method) {
          return false;
        }

        if (!_.isUndefined(conditions)) {
          return true;
        }

        let conditionPassed = true;
        _.each(_.keys(conditions), (key) => {
          if (conditions[key] === data[key]) {
            conditionPassed = false;
          }
        });

        return conditionPassed;
      });

      console.log('events', events);

      if (foundEventIndex !== -1) {
        const foundEvent = events[foundEventIndex];
        console.log('foundEvent', foundEvent);
        const {
          event: {
            section: eventSection, method: eventMethod, typeDef: types, data: eventData,
          }, phase,
        } = foundEvent;

        // Print out the name of the event found
        console.log(`\t${eventSection}:${eventMethod}:: (phase=${phase.toString()})`);

        // Loop through the conent of the event, displaying the type and data
        eventData.forEach((data, index) => {
          console.log(`\t\t\t${types[index].type}: ${data.toString()}`);
        });

        unsub();

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        resolve({
          events,
          foundEvent,
          foundEventIndex,
        });
      }
    });
  };

  listenSystemEvents().catch(console.log);
});

const sendExtrinsic = async (api, extrinsic, address, signer, { isSudo = false } = {}) => new Promise((resolve, reject) => {
  const newExtrinsic = isSudo ? api.tx.sudo.sudo(extrinsic) : extrinsic;
  newExtrinsic.signAndSend(address, { nonce: -1, signer }, ({ status, events }) => {
    console.log('status.type', status.type);

    if (status.isInBlock || status.isFinalized) {
      events
        // find/filter for failed events
        .filter(({ event }) => api.events.system.ExtrinsicFailed.is(event))
        // we know that data for system.ExtrinsicFailed is
        // (DispatchError, DispatchInfo)
        .forEach(({ event: { data: [error] } }) => {
          if (error.isModule) {
            // for module errors, we have the section indexed, lookup
            const decoded = api.registry.findMetaError(error.asModule);
            const { docs, method, section } = decoded;
            console.log(`${section}.${method}: ${docs.join(' ')}`);
          } else {
            // Other, CannotLookup, BadOrigin, no extra info
            console.log(error.toString());
          }
        });

      if (status.isFinalized) {
        resolve({ events, blockHash: status.asFinalized.toString() });
      }
    }
  }).catch((ex) => {
    console.log('ex', ex);
    reject(ex);
  });
});

const getHourlyTimestamp = (hour) => (moment().add(hour, 'hour').startOf('hour')).valueOf();

const getDerivativeAccountV2 = (api, accountId, paraId, { locationType = 'XcmV2MultiLocation', networkType = 'Any' } = {}) => {
  const account = hexToU8a(accountId).length === 20
    ? { AccountKey20: { network: networkType, key: accountId } }
    : { AccountId32: { network: networkType, id: accountId } };

  const location = {
    parents: 1,
    interior: { X2: [{ Parachain: paraId }, account] },
  };
  const multilocation = api.createType(locationType, location);
  const toHash = new Uint8Array([
    ...new Uint8Array([32]),
    ...new TextEncoder().encode('multiloc'),
    ...multilocation.toU8a(),
  ]);

  return u8aToHex(api.registry.hash(toHash).slice(0, 32));
};

const getDerivativeAccountV3 = (accountId, paraId, deriveAccountType = 'AccountId32') => {
  const accountType = hexToU8a(accountId).length === 20 ? 'AccountKey20' : 'AccountId32';
  const decodedAddress = hexToU8a(accountId);

  // Calculate Hash Component
  const registry = new TypeRegistry();
  const toHash = new Uint8Array([
    ...new TextEncoder().encode('SiblingChain'),
    ...registry.createType('Compact<u32>', paraId).toU8a(),
    ...registry.createType('Compact<u32>', accountType.length + hexToU8a(accountId).length).toU8a(),
    ...new TextEncoder().encode(accountType),
    ...decodedAddress,
  ]);

  return u8aToHex(blake2AsU8a(toHash).slice(0, deriveAccountType === 'AccountKey20' ? 20 : 32));
};

function trimString(str, maxLength) {
  if (str.length <= maxLength) {
    return str;
  }

  const ellipsis = '...';
  const startLength = Math.floor((maxLength - ellipsis.length) / 2);
  const endLength = maxLength - startLength - ellipsis.length;

  const trimmedStr = `${str.slice(0, startLength)}${ellipsis}${str.slice(-endLength)}`;
  return trimmedStr;
}

export {
  listenEvents, sendExtrinsic, getHourlyTimestamp, getDerivativeAccountV2, getDerivativeAccountV3, trimString,
};
