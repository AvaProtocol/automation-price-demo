import React, { useState, useEffect, useCallback } from 'react';
import _ from 'lodash';
import BN from 'bn.js';
import {
  Row, Col, Input, Button, Form, Modal, Radio, Space, message,
} from 'antd';
import './App.css';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { u8aToHex, hexToU8a } from '@polkadot/util';
import Keyring from '@polkadot/keyring';
import { TypeRegistry } from '@polkadot/types';
import { blake2AsU8a } from '@polkadot/util-crypto';
import { Buffer } from 'buffer';
// import { chains } from '@oak-network/config';
// import { AstarAdapter } from '@oak-network/adapter';
import moment from 'moment';
import abi from './common/arthswap/abi';
import erc20ABI from './common/arthswap/erc20ABI';
import polkadotHelper from './common/polkadotHelper';
// import polkadotHelper from './common/polkadotHelper';

const ethers = require('ethers'); // eslint-disable-line import/no-extraneous-dependencies

const ROUTER_ADDRESS = '0xA17E7Ba271dC2CC12BA5ECf6D178bF818A6D76EB';
const ARSW_ADDRESS = '0xE17D2c5c7761092f31c9Eca49db426D5f2699BF0';
const WRSTR_ADDRESS = '0x7d5d845Fd0f763cefC24A1cb1675669C3Da62615';
const DEADLINE = '111111111111111111';
const WEIGHT_REF_TIME_PER_SECOND = new BN('1000000000000');

const network = {
  name: 'Rocstar',
  // endpoint: 'wss://rocstar.astar.network',
  endpoint: 'ws://127.0.0.1:9948',
  chainId: 692,
  symbol: 'RSTR',
  decimals: 18,
};

const sendExtrinsic = async (api, extrinsic, address, signer, { isSudo = false } = {}) => new Promise((resolve) => {
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
  });
});

export const listenEvents = async (api, section, method, conditions, timeout = undefined) => new Promise((resolve) => {
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

      if (foundEventIndex !== -1) {
        const foundEvent = events[foundEventIndex];
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

const formatToken = (amount, decimals) => {
  const decimalBN = new BN(10).pow(new BN(decimals));
  return { a: amount.div(decimalBN), b: amount.mod(decimalBN) };
};

const formatTokenBalanceString = (amount, decimals) => {
  const { a, b } = formatToken(amount, decimals);
  return `${a.toString()}.${b.toString()}`;
};

function handleChainChanged(newChainId) {
  console.log('newChainId', newChainId);
  // We recommend reloading the page, unless you must do otherwise.
  window.location.reload();
}

window.ethereum.on('chainChanged', handleChainChanged);

let rocstarApiInstance;

const getRocstarApi = async () => {
  if (!rocstarApiInstance) {
    const wsProvider = new WsProvider(network.endpoint);
    rocstarApiInstance = await ApiPromise.create({ provider: wsProvider });
  }
  return rocstarApiInstance;
};

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

export const getDerivativeAccountV3 = (accountId, paraId, deriveAccountType = 'AccountId32') => {
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

/**
 * Wait for all promises to succeed, otherwise throw an exception.
 * @param {*} promises
 * @returns promise
 */
export const waitPromises = (promises) => new Promise((resolve, reject) => {
  Promise.all(promises).then(resolve).catch(reject);
});

function ArthSwapApp() {
  const [swapForm] = Form.useForm();

  // Modal Wallet Connect states
  const [isModalLoadingWalletConnect, setModalLoadingWalletConnect] = useState(false);
  const [isModalOpenWalletConnect, setModalOpenWalletConnect] = useState(false);
  const [radioValue, setRadioValue] = useState(1);

  // Polkadot Modal Wallet Connect states
  const [isPolkadotModalOpenWalletConnect, setPolkadotModalOpenWalletConnect] = useState(false);
  const [polkadotAccounts, setPolkadotAccounts] = useState([]);

  // Modal Swap states
  const [isModalLoadingSwap, setModalLoadingSwap] = useState(false);
  const [isModalOpenSwap, setModalOpenSwap] = useState(false);
  const [swapStatus, setSwapStatus] = useState('Waiting for Signature');
  const [receiptSwap, setReceiptSwap] = useState(null);

  // App states
  const [provider, setProvider] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [wallet, setWallet] = useState(null); /* New */

  // const [polkadotWallet, setPolkadotWallet] = useState(null);

  useEffect(() => {
    // This code will run after the component has rendered
    // Place your code here for actions to be performed after rendering
    console.log('Page components have rendered');

    async function asyncInit() {
      try {
        let providerOnLoad = null;
        if (_.isNull(window.ethereum)) {
          // If MetaMask is not installed, we use the default provider,
          // which is backed by a variety of third-party services (such as INFURA).
          // They do not have private keys installed so are only have read-only access
          console.log('MetaMask is not installed; using read-only default providers');
          providerOnLoad = ethers.getDefaultProvider();
        } else {
          // Connect to the MetaMask EIP-1193 object. This is a standard protocol
          // that allows Ethers access to make all read-only requests through MetaMask.
          providerOnLoad = new ethers.BrowserProvider(window.ethereum);
          console.log('MetaMask is installed and loaded.');
        }

        setProvider(providerOnLoad);

        const chainId = await providerOnLoad.send('eth_chainId', []);
        const chainIdDecimal = parseInt(chainId, 16);
        console.log(`network chainId: ${chainIdDecimal} (${chainIdDecimal === network.chainId ? 'Rocstar' : 'Unknown'})`);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    asyncInit(); // Call the async function inside useEffect

    // You can perform any cleanup or additional actions here if needed
    // For example, removing event listeners or making API requests
    // Be sure to return a cleanup function if necessary
    return () => {
      // Cleanup code here (if needed)
    };
  }, []); // The empty dependency array [] ensures that this effect runs only once, similar to componentDidMount

  const onFinish = (values) => {
    console.log('values: ', values);
  };

  const onValuesChange = () => {};

  const volatilityElement = null;

  /**
   * Modal Wallet Connect functions
   */
  const onClickConnectWallet = useCallback(async () => {
    console.log('onClickConnectWallet is called, provider: ', provider);

    // Request permission to connect users accounts from Metamask
    const requestedAccounts = await provider.send('eth_requestAccounts', []);

    console.log('requestedAccounts', requestedAccounts);
    setAccounts(requestedAccounts);
    setModalOpenWalletConnect(true);
  }, [provider]);

  const onClickConnectPolkadotWallet = async () => {
    await web3Enable('Automation price demo');
    const allAccounts = await web3Accounts({ accountType: 'sr25519', ss58Format: 51 });
    console.log('allAccounts', allAccounts);
    setPolkadotModalOpenWalletConnect(true);
    setPolkadotAccounts(allAccounts);
  };

  const closePolkadotModalWalletConnect = () => {
    setPolkadotModalOpenWalletConnect(false);
  };

  const onClickWalletSelectSubmitted = useCallback(async () => {
    console.log('Setting radioValue as selected account', radioValue);

    setModalLoadingWalletConnect(true);

    console.log('Found selected radio from provider', radioValue);

    const signer = await provider.getSigner(radioValue);
    console.log('signer: ', signer);

    const signerAddress = await signer.getAddress();

    console.log('signer.address: ', signerAddress);

    const balance = await provider.getBalance(signer.address);
    const formattedBalance = ethers.formatEther(balance);

    const nonce = await provider.getTransactionCount(signer.address);

    setModalLoadingWalletConnect(false);
    setModalOpenWalletConnect(false);

    setWallet({
      signer, address: signerAddress, balance: formattedBalance, nonce,
    });
  }, [radioValue, provider]);

  const onClickPolkadotkWalletSelectSubmitted = async () => {
    console.log('Setting radioValue as selected account', radioValue);
    const address = radioValue;

    setModalLoadingWalletConnect(true);

    console.log('Found selected radio from provider', radioValue);

    const { signer } = await web3FromAddress(radioValue);

    const rocstarApi = await getRocstarApi();
    const { nonce, data: { free: balance } } = await rocstarApi.query.system.account(address);

    setModalLoadingWalletConnect(false);
    setPolkadotModalOpenWalletConnect(false);

    setWallet({
      signer, address, balance, nonce,
    });
  };

  const closeModalWalletConnect = () => {
    setModalOpenWalletConnect(false);
  };

  const onRadioChange = (e) => {
    console.log('Selected Radio value', e.target.value);
    setRadioValue(e.target.value);
  };

  /**
   * Modal Swap functions
   */

  const onClickSwap = useCallback(async () => {
    if (_.isNull(wallet)) {
      message.error('Wallet needs to be connected first.');
      return;
    }

    setModalOpenSwap(true);

    const balance = ethers.formatEther(await provider.getBalance(wallet.address));
    const nonce = await provider.getTransactionCount(wallet.address);

    setWallet(_.extend(wallet, { balance, nonce }));

    setSwapStatus('Waiting for Signature');
  }, [provider, wallet]);

  const onClickSwapSubmitted = useCallback(async () => {
    console.log('Balance before swap: ', wallet.balance);
    setSwapStatus('Signing');

    try {
      const arthSwapContract = new ethers.Contract(ROUTER_ADDRESS, abi, wallet.signer);
      const erc20Contract = new ethers.Contract(ARSW_ADDRESS, erc20ABI, wallet.signer);

      setModalLoadingSwap(true);

      const result = await arthSwapContract.swapExactETHForTokens(
        0,
        [WRSTR_ADDRESS, ARSW_ADDRESS],
        wallet.address,
        DEADLINE,
        { value: ethers.parseEther('0.01') },
      );

      setSwapStatus('Pending');

      const receipt = await provider.waitForTransaction(result.hash);

      // The below comment is used to manually examine a receipt of a transaction
      // const receipt = await provider.getTransactionReceipt(
      //   '0x635bc1f893c09f5081fc1a265bec5af15dbfe0ffe035e9c43be4e9fef9fb598d',
      // );

      console.log('receipt', receipt);
      setReceiptSwap(receipt);

      message.info(`Transaction is mined at block ${receipt.blockNumber}.`);
      setSwapStatus('Mined');

      // Parse the logs in a tx receipt to return a human readable version
      const parsedLogs = _.filter(_.map(receipt.logs, (log) => {
        let parsedItem = arthSwapContract.interface.parseLog(log);

        if (_.isNull(parsedItem)) { // Try ERC20 API if the arthSwap ABI returns null
          parsedItem = erc20Contract.interface.parseLog(log);
        }

        if (!_.isNull(parsedItem)) {
          const itemizedLogs = _.map(parsedItem.fragment.inputs, (input, index) => {
            const inputValue = parsedItem.args[index];

            return {
              name: input.name,
              type: input.type,
              value: input.type === 'uint256'
                ? ethers.formatEther(inputValue)
                : inputValue,
            };
          });

          return {
            name: parsedItem.name,
            logs: itemizedLogs,
          };
        }

        return undefined;
      }), (item) => !_.isUndefined(item));

      console.log('parsedLogs', parsedLogs);

      // Print out the ETH balance after the transaction
      const balanceAfterSwap = ethers.formatEther(await provider.getBalance(wallet.address));
      console.log('Balance after swap: ', balanceAfterSwap);
    } catch (ex) {
      console.log(ex);

      // TODO: might need more mappings for Error handling
      if (ex.code === 'ACTION_REJECTED') {
        console.log('Signing was rejected by user.');
        message.error('Signing was rejected by user.');
        setSwapStatus('Waiting for Signature');
      }
    }

    setModalLoadingSwap(false);
  }, [wallet, provider]);

  const closeModalSwap = () => {
    setModalOpenSwap(false);
    setReceiptSwap(null);
  };

  const onClickDisconnectWallet = useCallback(async () => {
    console.log('onClickDisconnectWallet call back is called.');

    setAccounts([]);
    setWallet(null);
  }, []);

  const onClickDisconnectPolkadotWallet = useCallback(async () => {
    console.log('onClickDisconnectWallet call back is called.');

    setPolkadotAccounts([]);
    setWallet(null);
  }, []);

  /**
   * Use MetaMask to schedule a Swap transaction via XCM
   */
  const onClickScheduleByTime = useCallback(async () => {
    if (_.isNull(wallet)) {
      message.error('Wallet needs to be connected first.');
    }

    try {
      const rocstarApi = await getRocstarApi();
      const rocstarParaId = (await rocstarApi.query.parachainInfo.parachainId()).toNumber();
      console.log('rocstarParaId: ', rocstarParaId);

      const turingApi = await polkadotHelper.getPolkadotApi();
      const turingParaId = (await turingApi.query.parachainInfo.parachainId()).toNumber();
      console.log('turingParaId: ', turingParaId);

      const keyring = new Keyring({ type: 'sr25519' });
      const aliceKeyringPair = keyring.addFromUri('//Alice', undefined, 'sr25519');
      aliceKeyringPair.meta.name = 'Alice';

      console.log('Transfer TUR from Alice to user account on Turing...');
      const transferToAccountOnTuring = turingApi.tx.balances.transfer(wallet.address, new BN('1000000000000'));
      await sendExtrinsic(turingApi, transferToAccountOnTuring, aliceKeyringPair, undefined);

      console.log('Transfer RSTR from Alice to user account on Rocstar...');
      const transferToAccountOnRocstar = rocstarApi.tx.balances.transfer(wallet.address, new BN('100000000000000000000'));
      await sendExtrinsic(rocstarApi, transferToAccountOnRocstar, aliceKeyringPair, undefined);

      console.log('Add proxy on Turing...');
      const derivativeAccountOnTuring = getDerivativeAccountV2(turingApi, u8aToHex(keyring.decodeAddress(wallet.address)), rocstarParaId, { locationType: 'XcmV3MultiLocation', networkType: 'rococo' });
      const proxyExtrinsicOnTuring = turingApi.tx.proxy.addProxy(derivativeAccountOnTuring, 'Any', 0);
      await sendExtrinsic(turingApi, proxyExtrinsicOnTuring, wallet.address, wallet.signer);

      console.log('Add proxy on Rocstar...');
      const derivativeAccountOnRocstar = getDerivativeAccountV3(u8aToHex(keyring.decodeAddress(wallet.address)), turingParaId);
      const proxyExtrinsicOnRocstar = rocstarApi.tx.proxy.addProxy(derivativeAccountOnRocstar, 'Any', 0);
      await sendExtrinsic(rocstarApi, proxyExtrinsicOnRocstar, wallet.address, wallet.signer);

      console.log('Transfer RSTR to proxy account on Rocstar...');
      const transferToProxyOnRocstar = rocstarApi.tx.balances.transfer(derivativeAccountOnRocstar, new BN('10000000000000000000'));
      await sendExtrinsic(rocstarApi, transferToProxyOnRocstar, wallet.address, wallet.signer);

      console.log('Transfer RSTR to proxy account on Turing...');
      const transferToProxyOnTuring = rocstarApi.tx.xtokens.transferMultiasset(
        {
          V3: {
            id: { Concrete: { parents: 0, interior: 'Here' } },
            fun: { Fungible: new BN('10000000000000000000') },
          },
        },
        {
          V3: {
            parents: 1,
            interior: {
              X2: [
                { Parachain: turingParaId },
                { AccountId32: { network: null, id: derivativeAccountOnTuring } },
              ],
            },
          },
        },
        'Unlimited',
      );
      await sendExtrinsic(rocstarApi, transferToProxyOnTuring, wallet.address, wallet.signer);

      console.log('Send Xcm message to Turing to schedule task...');
      const taskPayloadExtrinsic = rocstarApi.tx.proxy.proxy(wallet.address, 'Any', rocstarApi.tx.ethereumChecked.transact({
        gasLimit: 201596,
        target: '0xA17E7Ba271dC2CC12BA5ECf6D178bF818A6D76EB',
        value: new BN('10000000000000000'),
        // eslint-disable-next-line max-len
        input: '0x7ff36ab5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000005446cff2194e84f79513acf6c8980d6e60747253000000000000000000000000000000000000000000000000018abef7846071c700000000000000000000000000000000000000000000000000000000000000020000000000000000000000007d5d845fd0f763cefc24a1cb1675669c3da62615000000000000000000000000e17d2c5c7761092f31c9eca49db426d5f2699bf0',
      }));

      // const taskPayloadExtrinsic = rocstarApi.tx.proxy.proxy(wallet.address, 'any', rocstarApi.tx.system.remarkWithEvent('HELLO'));
      const taskEncodedCallWeightRaw = (await taskPayloadExtrinsic.paymentInfo(wallet.address)).weight;
      const taskEncodedCallWeight = { refTime: taskEncodedCallWeightRaw.refTime.unwrap(), proofSize: taskEncodedCallWeightRaw.proofSize.unwrap() };
      const instructionCountOnTuring = 4;
      const astarInstrcutionWeight = { refTime: new BN('1000000000'), proofSize: new BN(64 * 1024) };
      const taskOverallWeight = {
        refTime: taskEncodedCallWeight.refTime.add(astarInstrcutionWeight.refTime.muln(instructionCountOnTuring)),
        proofSize: taskEncodedCallWeight.proofSize.add(astarInstrcutionWeight.proofSize.muln(instructionCountOnTuring)),
      };
      const fee = await rocstarApi.call.transactionPaymentApi.queryWeightToFee(taskOverallWeight);
      const scheduleFeeLocation = { V3: { parents: 1, interior: { X1: { Parachain: rocstarParaId } } } };
      const executionFee = { assetLocation: { V3: { parents: 1, interior: { X1: { Parachain: rocstarParaId } } } }, amount: fee };
      const nextExecutionTime = getHourlyTimestamp(1) / 1000;
      // const timestampTwoHoursLater = getHourlyTimestamp(2) / 1000;
      // const schedule = { Fixed: { executionTimes: [nextExecutionTime, timestampTwoHoursLater] } };
      const schedule = { Fixed: { executionTimes: [0] } };
      const taskExtrinsic = turingApi.tx.automationTime.scheduleXcmpTaskThroughProxy(
        schedule,
        { V3: { parents: 1, interior: { X1: { Parachain: rocstarParaId } } } },
        scheduleFeeLocation,
        executionFee,
        taskPayloadExtrinsic.method.toHex(),
        taskEncodedCallWeight,
        taskOverallWeight,
        wallet.address,
      );

      const encodedCallWeightRaw = (await taskExtrinsic.paymentInfo(wallet.address)).weight;
      const encodedCallWeight = { refTime: encodedCallWeightRaw.refTime.unwrap(), proofSize: encodedCallWeightRaw.proofSize.unwrap() };
      const instructionCount = 4;
      const instructionWeight = { refTime: new BN('1000000000'), proofSize: new BN(0) };
      const overallWeight = {
        refTime: encodedCallWeight.refTime.add(instructionWeight.refTime.muln(instructionCount)),
        proofSize: encodedCallWeight.proofSize.add(instructionWeight.proofSize.muln(instructionCount)),
      };

      const storageValue = await turingApi.query.assetRegistry.locationToAssetId({ parents: 1, interior: { X1: { Parachain: rocstarParaId } } });
      const assetId = storageValue.unwrap();
      const metadataStorageValue = await turingApi.query.assetRegistry.metadata(assetId);
      const { additional } = metadataStorageValue.unwrap();
      const feePerSecond = additional.feePerSecond.unwrap();
      const feeAmount = overallWeight.refTime.mul(feePerSecond).div(WEIGHT_REF_TIME_PER_SECOND);

      const xcmMessage = {
        V3: [
          {
            WithdrawAsset: [
              {
                fun: { Fungible: feeAmount },
                id: { Concrete: { parents: 1, interior: { X1: { Parachain: rocstarParaId } } } },
              },
            ],
          },
          {
            BuyExecution: {
              fees: {
                fun: { Fungible: feeAmount },
                id: { Concrete: { parents: 1, interior: { X1: { Parachain: rocstarParaId } } } },
              },
              weightLimit: { Limited: overallWeight },
            },
          },
          {
            Transact: {
              originKind: 'SovereignAccount',
              requireWeightAtMost: encodedCallWeight,
              call: { encoded: taskExtrinsic.method.toHex() },
            },
          },
        ],
      };

      const dest = { V3: { parents: 1, interior: { X1: { Parachain: turingParaId } } } };
      const extrinsic = rocstarApi.tx.polkadotXcm.send(dest, xcmMessage);
      console.log('extrinsic: ', extrinsic.method.toHex());
      sendExtrinsic(rocstarApi, extrinsic, wallet.address, wallet.signer);

      console.log('Listen automationTime.TaskScheduled event on Turing...');
      const { foundEvent: taskScheduledEvent } = await listenEvents(turingApi, 'automationTime', 'TaskScheduled', undefined, 60000);
      const taskId = Buffer.from(taskScheduledEvent.event.data.taskId).toString();
      console.log('taskId:', taskId);

      console.log(`Listen automationTime.TaskTriggered event with taskId(${taskId}) and find xcmpQueue.XcmpMessageSent event on Turing...`);
      const { events, foundEventIndex } = await listenEvents(turingApi, 'automationTime', 'TaskTriggered', { taskId }, 60000);
      const xcmpMessageSentEvent = _.find(events, (event) => {
        const { section, method } = event.event;
        return section === 'xcmpQueue' && method === 'XcmpMessageSent';
      }, foundEventIndex);
      console.log('XcmpMessageSent event: ', xcmpMessageSentEvent);
      const { messageHash } = xcmpMessageSentEvent.event.data;
      console.log('messageHash: ', messageHash.toString());

      console.log(`Listen xcmpQueue.Success event with messageHash(${messageHash}) and find proxy.ProxyExecuted event on Rocstar...`);
      const timeout = nextExecutionTime * 1000 + 300000 - moment().valueOf();
      const { events: xcmpQueueEvents, foundEventIndex: xcmpQueuefoundEventIndex } = await listenEvents(rocstarApi, 'xcmpQueue', 'Success', { messageHash }, timeout);
      const proxyExecutedEvent = _.find(_.reverse(xcmpQueueEvents), (event) => {
        const { section, method } = event.event;
        return section === 'proxy' && method === 'ProxyExecuted';
      }, xcmpQueueEvents.length - xcmpQueuefoundEventIndex - 1);
      console.log('ProxyExecuted event: ', JSON.stringify(proxyExecutedEvent.event.data.toHuman()));
    } catch (error) {
      console.log(error);
    }
  }, [wallet, provider]);

  /**
   * Use MetaMask to schedule a Swap transaction via XCM
   */
  const onClickScheduleByPrice = useCallback(async () => {
    if (_.isNull(wallet)) {
      message.error('Wallet needs to be connected first.');
    }
  }, [wallet, provider]);

  /**
   * Main functions
   */
  return (
    <div className="page-wrapper">
      <Space>
        <div className="main-container">
          <div className="container page-container">
            <Row>
              <Col span={24}>
                {/* { _.isNil(wallet)
                  ? (<Button onClick={onClickConnectWallet}>Connect Metamask</Button>)
                  : (
                    <div><div>Wallet:</div><div>{wallet.address}</div>
                      <div>Balance:</div><div>{wallet.balance} {network.symbol}</div>
                      <div>Nonce:</div><div>{wallet.nonce}</div>
                      <Button onClick={onClickConnectWallet}>Switch Wallet</Button>
                      <Button onClick={onClickDisconnectWallet}>Disconnect Metamask</Button>
                    </div>
                  )} */}
                { _.isNil(wallet)
                  ? (<Button onClick={onClickConnectPolkadotWallet}>Connect Polkadot.js</Button>)
                  : (
                    <div><div>Wallet:</div><div>{wallet.address}</div>
                      <div>Balance:</div><div>{ formatTokenBalanceString(wallet.balance, network.decimals) } {network.symbol}</div>
                      <div>Nonce:</div><div>{wallet.nonce.toString()}</div>
                      <Button onClick={onClickConnectPolkadotWallet}>Switch Wallet</Button>
                      <Button onClick={onClickDisconnectPolkadotWallet}>Disconnect</Button>
                    </div>
                  )}
                <Modal
                  open={isModalOpenWalletConnect}
                  title="Connect Wallet"
                  onOk={onClickWalletSelectSubmitted}
                  onCancel={closeModalWalletConnect}
                  maskClosable={false}
                  footer={[
                    <Button key="back" onClick={closeModalWalletConnect}>
                      Cancel
                    </Button>,
                    <Button key="submit" type="primary" loading={isModalLoadingWalletConnect} onClick={onClickWalletSelectSubmitted}>
                      Confirm
                    </Button>,
                  ]}
                >
                  <Radio.Group onChange={onRadioChange} value={radioValue}>
                    <Space direction="vertical">
                      {_.map(accounts, (item) => (<Radio value={item} key={item}>{item}</Radio>))}
                    </Space>
                  </Radio.Group>
                </Modal>
                <Modal
                  open={isPolkadotModalOpenWalletConnect}
                  title="Connect Polkadot.js Wallet"
                  onOk={onClickPolkadotkWalletSelectSubmitted}
                  onCancel={closePolkadotModalWalletConnect}
                  maskClosable={false}
                  footer={[
                    <Button key="back" onClick={closePolkadotModalWalletConnect}>Cancel</Button>,
                    <Button key="submit" type="primary" loading={isModalLoadingWalletConnect} onClick={onClickPolkadotkWalletSelectSubmitted}>Confirm</Button>,
                  ]}
                >
                  <Radio.Group onChange={onRadioChange} value={radioValue}>
                    <Space className="modal-wrapper" direction="vertical">
                      { _.map(polkadotAccounts, (item) => {
                        const title = `${item.meta.name} ${item.address}`;
                        return <Radio value={item.address} key={item.address}>{title}</Radio>;
                      })}
                    </Space>
                  </Radio.Group>
                </Modal>
              </Col>
            </Row>
            <Row>
              <Col span={12}>
                <div className="price-feed-container">
                  <h1>ArthSwap Price Feed:</h1>
                  <div>
                    <table>
                      <thead>
                        <tr className="price-row" style={{ color: '#95098B' }}>
                          <th className="price-col price-first-col">timestamp</th>
                          <th className="price-col">asset</th>
                          <th className="price-col">value</th>
                        </tr>
                      </thead>
                      <tbody />
                    </table>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div className="swap-container">
                  <h1>Swap Options</h1>
                  <div style={{ paddingTop: 12, paddingBottom: 24 }} />
                  <Form
                    form={swapForm}
                    name="basic"
                    labelCol={{ span: 6 }}
                    wrapperCol={{ span: 18 }}
                    initialValues={{ remember: true }}
                    onFinish={onFinish}
                    autoComplete="off"
                    onValuesChange={onValuesChange}
                    labelAlign="left"
                  >
                    <Row>
                      <Col span={24}>
                        <Form.Item label="Stop">
                          <Row>
                            <Col span={10}>
                              <Form.Item name="price" rules={[{ required: true, message: 'Please input price!' }]} noStyle>
                                <Input />
                              </Form.Item>
                            </Col>
                            <Col span={14}>
                              <span style={{ paddingLeft: 12, lineHeight: '32px' }} />
                              { volatilityElement }
                            </Col>
                          </Row>
                        </Form.Item>
                        <Form.Item label="Amount">
                          <Row>
                            <Col span={10}>
                              <Form.Item name="mgxAmount" rules={[{ required: true, message: 'Please enter a MGX amount' }]}>
                                <Input />
                              </Form.Item>
                            </Col>
                            <Col span={14}><span style={{ paddingLeft: 12, lineHeight: '32px' }} /></Col>
                          </Row>
                        </Form.Item>
                        <Form.Item label="Expected Output:">
                          <Row>
                            <Col span={16} />
                          </Row>
                        </Form.Item>

                      </Col>
                    </Row>

                    <div className="important">
                      <p className="title">Important:</p>
                      <p>Turing will trigger the transaction for inclusion after the price threshold has been met;</p>
                      we cannot guarantee the price received.
                    </div>

                    <div className="d-flex justify-content-center">
                      <Button className="connect-wallet-button" onClick={onClickSwap}>Swap</Button>
                      <Modal
                        open={isModalOpenSwap}
                        title="Swap Asset"
                        onOk={onClickSwapSubmitted}
                        onCancel={closeModalSwap}
                        maskClosable={false}
                        footer={receiptSwap ? [
                          <Button key="back" onClick={closeModalSwap}>
                            Close
                          </Button>,
                        ]
                          : [
                            <Button key="back" onClick={closeModalSwap}>
                              Cancel
                            </Button>,
                            <Button key="submit" type="primary" loading={isModalLoadingSwap} onClick={onClickSwapSubmitted}>
                              Submit
                            </Button>,
                          ]}
                      >
                        <dl>
                          <div>
                            <dt>Wallet</dt>
                            <dd>{wallet?.address}</dd>
                          </div>
                          <div>
                            <dt>Balance</dt>
                            <dd>{wallet?.balance} {network.symbol}</dd>
                          </div>
                          <div>
                            <dt>Smart Contract</dt>
                            <dd>{ROUTER_ADDRESS} (ArthSwap Router)</dd>
                          </div>
                          <div>
                            <dt>Method</dt>
                            <dd>swapExactETHForTokens (Market Buy)</dd>
                          </div>
                          <div>
                            <dt>Amount</dt>
                            <dd>0.01 ${network.symbol}</dd>
                          </div>
                          <div>
                            <dt>Estimated Amount</dt>
                            <dd>100 ARTH</dd>
                          </div>
                          <br />
                          <div>
                            <dt>Status</dt>
                            <dd>{swapStatus}</dd>
                          </div>
                          {receiptSwap?.blockNumber && (
                          <div>
                            <dt>Mined Block Height</dt>
                            <dd>{receiptSwap?.blockNumber}</dd>
                          </div>
                          )}
                          {receiptSwap?.hash && (
                          <div>
                            <dt>Transaction Hash</dt>
                            <dd>{receiptSwap?.hash}</dd>
                          </div>
                          )}
                        </dl>
                      </Modal>
                      <Button onClick={onClickScheduleByTime}>Schedule by Time</Button>
                      <Button onClick={onClickScheduleByPrice}>Schedule by Price</Button>
                    </div>
                  </Form>
                </div>
              </Col>
            </Row>
          </div>
        </div>
      </Space>
    </div>
  );
}

export default ArthSwapApp;
