import React, { useCallback } from 'react';
import _ from 'lodash';
import BN from 'bn.js';
import moment from 'moment';
import { u8aToHex } from '@polkadot/util';
import { Buffer } from 'buffer';
import {
  Button, Space, message,
} from 'antd';
import Keyring from '@polkadot/keyring';

import { useWalletPolkadot } from '../context/WalletPolkadot';
import {
  listenEvents, sendExtrinsic, getHourlyTimestamp, getDerivativeAccountV2, getDerivativeAccountV3,
} from '../common/utils';

import { WEIGHT_REF_TIME_PER_SECOND } from '../config';
import SignButton from './SignButton';

function AutomationTimeComponent() {
  const {
    wallet, apis,
  } = useWalletPolkadot();

  const onClickSchedule = useCallback(async () => {
    if (_.isNull(wallet)) {
      message.error('Wallet needs to be connected first.');
    }

    console.log('wallet: ', wallet);
    console.log('apis: ', apis);

    try {
      const turingApi = apis[0];
      const parachainApi = apis[1];

      console.log('turingApi: ', turingApi);
      console.log('parachainApi: ', parachainApi);

      const parachainParaId = (await parachainApi.query.parachainInfo.parachainId()).toNumber();
      const parachainSs58Prifx = parachainApi.consts.system.ss58Prefix.toNumber();
      console.log('parachainParaId: ', parachainParaId, 'ss58', parachainSs58Prifx);

      const turingParaId = (await turingApi.query.parachainInfo.parachainId()).toNumber();

      const turingSs58Prifx = turingApi.consts.system.ss58Prefix.toNumber();
      console.log('turingParaId: ', turingParaId, 'ss58', turingSs58Prifx);
      const storageValue = await turingApi.query.assetRegistry.locationToAssetId({ parents: 1, interior: { X1: { Parachain: parachainParaId } } });
      const assetId = storageValue.unwrap();

      const keyring = new Keyring({ type: 'sr25519' });
      const aliceKeyringPair = keyring.addFromUri('//Alice', undefined, 'sr25519');
      aliceKeyringPair.meta.name = 'Alice';

      console.log('Transfer TUR from Alice to user account on Turing...');
      const minTuringBalance = new BN('1000000000000');
      const topUpAmounTur = minTuringBalance.mul(new BN(10));
      const { data: { free: turingBalance } } = await turingApi.query.system.account(wallet?.address);
      if (turingBalance.lt(minTuringBalance)) {
        const transferToAccountOnTuring = turingApi.tx.balances.transfer(wallet?.address, topUpAmounTur);
        await sendExtrinsic(turingApi, transferToAccountOnTuring, aliceKeyringPair, undefined);
      } else {
        console.log('TUR Balance is enough. Skip transfer.');
      }

      console.log('Transfer RSTR from Alice to user account on Parachain...');
      const minParachainBalance = new BN('100000000000000000000');
      const topUpAmountRstr = minParachainBalance.mul(new BN(10));
      const { data: { free: parachainBalance } } = await parachainApi.query.system.account(wallet?.address);
      if (parachainBalance.lt(minTuringBalance)) {
        const transferToAccountOnParachain = parachainApi.tx.balances.transfer(wallet?.address, topUpAmountRstr);
        await sendExtrinsic(parachainApi, transferToAccountOnParachain, aliceKeyringPair, undefined);
      } else {
        console.log('RSTR Balance is enough. Skip transfer.');
      }

      console.log('Add proxy on Turing for the execution of XCM from Parachain to Turing ...');
      const derivativeAccountOnTuring = getDerivativeAccountV2(turingApi, u8aToHex(keyring.decodeAddress(wallet?.address)), parachainParaId, { locationType: 'XcmV3MultiLocation', networkType: 'rococo' });
      const turingProxyType = 'Any';
      const turingProxies = (await turingApi.query.proxy.proxies(wallet?.address))[0];
      const turingProxyAddress = keyring.encodeAddress(derivativeAccountOnTuring, turingSs58Prifx);
      const matchedProxyOnTuring = _.find(turingProxies, ({ delegate, proxyType }) => delegate.toString() === turingProxyAddress && proxyType.toString() === turingProxyType);
      if (!matchedProxyOnTuring) {
        const proxyExtrinsicOnTuring = turingApi.tx.proxy.addProxy(derivativeAccountOnTuring, 'Any', 0);
        await sendExtrinsic(turingApi, proxyExtrinsicOnTuring, wallet?.address, wallet?.signer);
      } else {
        console.log('Proxy on Turing is already added. Skip adding proxy.');
      }

      const batchExtrinsics = [];

      console.log('Add proxy on Parachain for the execution of XCM from Turing to Parachain ...');
      const derivativeAccountOnParachain = getDerivativeAccountV3(u8aToHex(keyring.decodeAddress(wallet?.address)), turingParaId);
      const parachainProxyType = 'Any';
      const parachainProxies = (await parachainApi.query.proxy.proxies(wallet?.address))[0];
      const parachainProxyAddress = keyring.encodeAddress(derivativeAccountOnParachain, parachainSs58Prifx);
      const matchedProxyOnParachain = _.find(parachainProxies, ({ delegate, proxyType }) => delegate.toString() === parachainProxyAddress && proxyType.toString() === parachainProxyType);
      if (!matchedProxyOnParachain) {
        const proxyExtrinsicOnParachain = parachainApi.tx.proxy.addProxy(derivativeAccountOnParachain, 'Any', 0);
        batchExtrinsics.push(proxyExtrinsicOnParachain);
        console.log('Added extrinsic to batchExtrinsics: ', proxyExtrinsicOnParachain.method.toHex());
      } else {
        console.log('Proxy on Parachain is already added. Skip adding proxy.');
      }

      console.log('Checking if there’s enough RSTR in the proxy account of Parachain...');
      const minProxyBalanceOnParachain = new BN('10000000000000000000');
      const { data: { free: proxyBalanceOnParachain } } = await parachainApi.query.system.account(parachainProxyAddress);
      console.log('proxyBalanceOnParachain: ', proxyBalanceOnParachain.toString());
      if (proxyBalanceOnParachain.lt(minProxyBalanceOnParachain)) {
        console.log('Transfering RSTR to the proxy account of Parachain...');
        const transferToProxyOnParachain = parachainApi.tx.balances.transfer(derivativeAccountOnParachain, minProxyBalanceOnParachain);
        batchExtrinsics.push(transferToProxyOnParachain);
        console.log('Added extrinsic to batchExtrinsics, extrinsic: ', transferToProxyOnParachain.method.toHex());
      } else {
        console.log('RSTR Balance is enough. Skip transfer.');
      }

      console.log('Checking if there’s enough RSTR in the proxy account of Turing ...');
      const minProxyRstrBalanceOnTuring = new BN('10000000000000000000');
      const { free: proxyRstrBalanceOnTuring } = await turingApi.query.tokens.accounts(derivativeAccountOnTuring, assetId);
      if (proxyRstrBalanceOnTuring.lt(minProxyRstrBalanceOnTuring)) {
        console.log('Transfer RSTR to proxy account of Turing...');
        const transferToProxyOnTuring = parachainApi.tx.xtokens.transferMultiasset(
          {
            V3: {
              id: { Concrete: { parents: 0, interior: 'Here' } },
              fun: { Fungible: minProxyRstrBalanceOnTuring },
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
        batchExtrinsics.push(transferToProxyOnTuring);
        console.log('Added extrinsic to batchExtrinsics, extrinsic: ', transferToProxyOnTuring.method.toHex());
      } else {
        console.log('Balance is enough. Skip transfer.');
      }

      console.log('Send Xcm message to Turing to schedule task...');
      const taskPayloadExtrinsic = parachainApi.tx.proxy.proxy(wallet?.address, 'Any', parachainApi.tx.ethereumChecked.transact({
        gasLimit: 201596,
        target: '0xA17E7Ba271dC2CC12BA5ECf6D178bF818A6D76EB',
        value: new BN('10000000000000000'),
        // eslint-disable-next-line max-len
        input: '0x7ff36ab5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000005446cff2194e84f79513acf6c8980d6e60747253000000000000000000000000000000000000000000000000018abef7846071c700000000000000000000000000000000000000000000000000000000000000020000000000000000000000007d5d845fd0f763cefc24a1cb1675669c3da62615000000000000000000000000e17d2c5c7761092f31c9eca49db426d5f2699bf0',
      }));

      // const taskPayloadExtrinsic = parachainApi.tx.proxy.proxy(wallet?.address, 'any', parachainApi.tx.system.remarkWithEvent('HELLO'));
      const taskEncodedCallWeightRaw = (await taskPayloadExtrinsic.paymentInfo(wallet?.address)).weight;
      const taskEncodedCallWeight = { refTime: taskEncodedCallWeightRaw.refTime.unwrap(), proofSize: taskEncodedCallWeightRaw.proofSize.unwrap() };
      const instructionCountOnTuring = 4;
      const astarInstrcutionWeight = { refTime: new BN('1000000000'), proofSize: new BN(64 * 1024) };
      const taskOverallWeight = {
        refTime: taskEncodedCallWeight.refTime.add(astarInstrcutionWeight.refTime.muln(instructionCountOnTuring)),
        proofSize: taskEncodedCallWeight.proofSize.add(astarInstrcutionWeight.proofSize.muln(instructionCountOnTuring)),
      };
      const fee = await parachainApi.call.transactionPaymentApi.queryWeightToFee(taskOverallWeight);
      const scheduleFeeLocation = { V3: { parents: 1, interior: { X1: { Parachain: parachainParaId } } } };
      const executionFee = { assetLocation: { V3: { parents: 1, interior: { X1: { Parachain: parachainParaId } } } }, amount: fee };

      // For immediate execution in dev environment
      // const schedule = { Fixed: { executionTimes: [0] } };

      // Recur every 10 minutes, starting from the next whole 10 minutes
      const nowInSeconds = (moment().valueOf()) / 1000;
      const nextWholeTenMin = nowInSeconds - (nowInSeconds % 600) + 600;
      const schedule = { Recurring: { frequency: 600, nextExecutionTime: nextWholeTenMin } };

      const taskExtrinsic = turingApi.tx.automationTime.scheduleXcmpTaskThroughProxy(
        schedule,
        { V3: { parents: 1, interior: { X1: { Parachain: parachainParaId } } } },
        scheduleFeeLocation,
        executionFee,
        taskPayloadExtrinsic.method.toHex(),
        taskEncodedCallWeight,
        taskOverallWeight,
        wallet?.address,
      );

      const encodedCallWeightRaw = (await taskExtrinsic.paymentInfo(wallet?.address)).weight;
      const encodedCallWeight = { refTime: encodedCallWeightRaw.refTime.unwrap(), proofSize: encodedCallWeightRaw.proofSize.unwrap() };
      const instructionCount = 4;
      const instructionWeight = { refTime: new BN('1000000000'), proofSize: new BN(0) };
      const overallWeight = {
        refTime: encodedCallWeight.refTime.add(instructionWeight.refTime.muln(instructionCount)),
        proofSize: encodedCallWeight.proofSize.add(instructionWeight.proofSize.muln(instructionCount)),
      };

      const metadataStorageValue = await turingApi.query.assetRegistry.metadata(assetId);
      const { additional } = metadataStorageValue.unwrap();
      const feePerSecond = additional.feePerSecond.unwrap();
      const timePerSecond = new BN(WEIGHT_REF_TIME_PER_SECOND);
      const feeAmount = overallWeight.refTime.mul(feePerSecond).div(timePerSecond);

      const xcmMessage = {
        V3: [
          {
            WithdrawAsset: [
              {
                fun: { Fungible: feeAmount },
                id: { Concrete: { parents: 1, interior: { X1: { Parachain: parachainParaId } } } },
              },
            ],
          },
          {
            BuyExecution: {
              fees: {
                fun: { Fungible: feeAmount },
                id: { Concrete: { parents: 1, interior: { X1: { Parachain: parachainParaId } } } },
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
      const extrinsic = parachainApi.tx.polkadotXcm.send(dest, xcmMessage);
      batchExtrinsics.push(extrinsic);
      console.log('Added extrinsic to batchExtrinsics, extrinsic: ', extrinsic.method.toHex());

      console.log('Send batchExtrinsics to chain: ', batchExtrinsics.map((item) => item.method.toHex()));
      await parachainApi.tx.utility.batch(batchExtrinsics).signAndSend(wallet?.address, { nonce: -1, signer: wallet?.signer });

      console.log('Listen automationTime.TaskScheduled event on Turing...');
      const listenResult = await listenEvents(turingApi, 'automationTime', 'TaskScheduled', undefined, 60000);
      const { foundEvent: taskScheduledEvent } = listenResult;
      const taskId = Buffer.from(taskScheduledEvent.event.data.taskId).toString();
      console.log('Found taskId from TaskScheduled event:', taskId);

      console.log(`Listen automationTime.TaskTriggered event with taskId(${taskId}) and find xcmpQueue.XcmpMessageSent event on Turing...`);
      const listenEventsResult = await listenEvents(turingApi, 'automationTime', 'TaskTriggered', { taskId }, 60000);

      if (_.isNull(listenEventsResult)) {
        console.log('No automationTime.TaskTriggered event found.');
        return;
      }

      const { events, foundEventIndex } = listenEventsResult;
      const xcmpMessageSentEvent = _.find(events, (event) => {
        const { section, method } = event.event;
        return section === 'xcmpQueue' && method === 'XcmpMessageSent';
      }, foundEventIndex);
      console.log('XcmpMessageSent event: ', xcmpMessageSentEvent);
      const { messageHash } = xcmpMessageSentEvent.event.data;
      console.log('messageHash: ', messageHash.toString());

      console.log(`Listen xcmpQueue.Success event with messageHash(${messageHash}) and find proxy.ProxyExecuted event on Parachain...`);
      const timeout = nextWholeTenMin * 1000 + 300000 - moment().valueOf();
      const result = await listenEvents(parachainApi, 'xcmpQueue', 'Success', { messageHash }, timeout);
      if (_.isNull(result)) {
        console.log('No xcmpQueue.Success event found.');
        return;
      }
      const { events: xcmpQueueEvents, foundEventIndex: xcmpQueuefoundEventIndex } = result;
      const proxyExecutedEvent = _.find(_.reverse(xcmpQueueEvents), (event) => {
        const { section, method } = event.event;
        return section === 'proxy' && method === 'ProxyExecuted';
      }, xcmpQueueEvents.length - xcmpQueuefoundEventIndex - 1);
      console.log('ProxyExecuted event: ', JSON.stringify(proxyExecutedEvent.event.data.toHuman()));
    } catch (error) {
      console.log(error);
    }
  }, [wallet, apis]);

  return (
    <SignButton tooltip="Please connect a polkadot.js wallet first" onClickCallback={onClickSchedule} wallet={wallet}>Daily Cost Average</SignButton>
  );
}

export default AutomationTimeComponent;
