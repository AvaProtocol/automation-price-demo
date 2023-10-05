import React, { useCallback, useEffect, useState } from 'react';
import _ from 'lodash';
import moment from 'moment';
import PropTypes from 'prop-types'; // Import PropTypes
import {
  Butto as AntButton, Space, message, Table, Tag,
} from 'antd';
import Item from 'antd/es/list/Item';
import BN from 'bn.js';
import SignButton from './SignButton';
import Task from '../models/task';
import { WEIGHT_REF_TIME_PER_SECOND, MOMENT_FORMAT } from '../config';
import { useWalletPolkadot } from '../context/WalletPolkadot';
import { sendExtrinsic, trimString } from '../common/utils';

const { Column } = Table;

function TaskList(/* { tasks, setTasks } */) {
  const {
    wallet, adapters,
  } = useWalletPolkadot();

  const [taskMap, setTaskMap] = useState(new Map());
  const [displayArray, setDisplayArray] = useState([]);

  useEffect(() => {
    // Initialize the wallet provider. This code will run once after the component has rendered for the first time
    async function asyncInit() {
      try {
        console.log('Initializing TaskList component.   ');
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    asyncInit(); // Call the async function inside useEffect

    return () => {
      // Cleanup code here (if needed)
    };
  }, []);

  useEffect(() => {
    if (_.isEmpty(adapters) || _.isUndefined(adapters[0])) {
      return;
    }

    try {
      console.log('Subscribe to tasks since Turing adapter is set.', adapters[0]);
      const turingAdapter = adapters[0];

      turingAdapter?.subscribeTasks((values) => {
        console.log('subscribeTasks. values', values);

        const existingArray = taskMap.values();

        const differences = _.xor(existingArray, values);

        if (_.isEmpty(differences)) {
          return;
        }

        console.log('Updating tasks array since the old value is different. Differences:', differences);

        _.each(differences, (item) => {
          console.log('differences.item', item);

          if (taskMap.has(item.taskId)) { // Previously existed task dispeared; this means completion or deletion
            const existingItem = taskMap.get(item.taskId);
            existingItem.status = 'Completed';
            // taskMap.set(taskItem.id, newTaskJson);
          } else { // The diff is from the new array; this means addition
            taskMap.set(item.taskId, item);
          }
        });

        console.log('taskMap', taskMap);
        setTaskMap(taskMap);

        console.log('taskMap.values()', Array.from(taskMap.values()));

        const taskItems = _.map(Array.from(taskMap.values()), (item) => {
          const taskItem = new Task(item);
          return taskItem.toJson();
        });
        console.log('taskItems', taskItems);

        // Update Table View right away for displaytrimString
        const formattedArray = taskItems.map(({ owner, ...rest }) => ({
          key: `${rest.id}`,
          owner: trimString(owner, 12),
          ...rest,
        }));

        console.log('formattedArray', formattedArray);
        setDisplayArray(formattedArray);
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [adapters, taskMap, setTaskMap]);

  const updateTasks = (tasks) => {
    _.each(tasks, (item) => {
      const newTask = new Task(item);
      const newTaskJson = newTask.toJson();

      // Check if the key exists in the Map
      if (!taskMap.has(newTaskJson.id)) {
        console.log('A new Task is to be set', newTaskJson);
        taskMap.set(newTaskJson.id, newTaskJson);
      }
    });
    // const newTask = new Task(record);
    // const newTaskJson = newTask.toJson();

    // // Check if the key exists in the Map
    // if (!taskMap.has(newTaskJson.id)) {
    //   console.log('A new Task is to be set', newTaskJson);
    //   taskMap.set(newTaskJson.id, newTaskJson);
    // }

    console.log('taskMap', taskMap);

    setTaskMap(taskMap);
    // Update Table View right away for display
    const formattedArray = Array.from(taskMap.values()).map(({ owner, ...rest }) => ({
      key: `${rest.id}`,
      owner: trimString(owner, 12),
      ...rest,
    }));

    console.log('formattedArray', formattedArray);
    setDisplayArray(formattedArray);
  };

  const onClickCancel = useCallback(async (record) => {
    console.log('onClickCancel is called', 'record.id', record.id);

    const api = adapters[0]?.api;
    const parachainApi = adapters[1]?.api;
    const turingParaId = (await api.query.parachainInfo.parachainId()).toNumber();
    const parachainParaId = (await parachainApi.query.parachainInfo.parachainId()).toNumber();
    const storageValue = await api.query.assetRegistry.locationToAssetId({ parents: 1, interior: { X1: { Parachain: parachainParaId } } });
    const assetId = storageValue.unwrap();

    // TODO: the cancel needs to go through astar
    console.log(`Send Xcm message to Turing to cancel the task ${record.id} ...`);

    const cancelExtrinsic = api.tx.automationPrice.cancelTask(record.id);

    const encodedCallWeightRaw = (await cancelExtrinsic.paymentInfo(wallet?.address)).weight;
    const encodedCallWeight = { refTime: encodedCallWeightRaw.refTime.unwrap(), proofSize: encodedCallWeightRaw.proofSize.unwrap() };
    const instructionCount = 4;
    const instructionWeight = { refTime: new BN('1000000000'), proofSize: new BN(0) };
    const overallWeight = {
      refTime: encodedCallWeight.refTime.add(instructionWeight.refTime.muln(instructionCount)),
      proofSize: encodedCallWeight.proofSize.add(instructionWeight.proofSize.muln(instructionCount)),
    };

    const metadataStorageValue = await api.query.assetRegistry.metadata(assetId);
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
            call: { encoded: cancelExtrinsic.method.toHex() },
          },
        },
      ],
    };

    const dest = { V3: { parents: 1, interior: { X1: { Parachain: turingParaId } } } };
    const xcmExtrinsic = parachainApi.tx.polkadotXcm.send(dest, xcmMessage);

    console.log('cancelExtrinsic.method.toHex()', cancelExtrinsic.method.toHex());
    console.log('xcmExtrinsic.method.toHex()', xcmExtrinsic.method.toHex());

    await xcmExtrinsic.signAndSend(wallet?.address, { nonce: -1, signer: wallet?.signer });
  }, [adapters, wallet]);

  return (
    <Table dataSource={displayArray} pagination={false} size="middle">
      <Column title="Task Id" dataIndex="id" key="id" />
      <Column title="Owner" dataIndex="owner" key="owner" />
      <Column title="Destination" dataIndex="destination" key="destination" />
      <Column title="Asset" dataIndex="asset" key="asset" />
      <Column title="Condition" dataIndex="condition" key="condition" />
      <Column
        title="Status"
        dataIndex="status"
        key="status"
        render={(_any, record) => (
          <Tag color="processing">Pending</Tag>
        )}
      />
      <Column
        title="Details"
        key="details"
        render={(_any, record) => (
          <a href={`https://turing.subscan.io/${undefined}`} target="_blank" rel="noreferrer">View</a>
        )}
      />
      <Column
        title="Action"
        key="action"
        render={(record) => (
          <Space size="middle">
            <SignButton
              onClickCallback={() => {
                console.log('onClickCancel is called', 'record', record);
                return onClickCancel(record);
              }}
              wallet={wallet}
              tooltip="Connect wallet to delete task"
            >Cancel
            </SignButton>
          </Space>
        )}
      />
    </Table>
  );
}

TaskList.propTypes = {
  // tasks: PropTypes.arrayOf(PropTypes.object).isRequired,
  // setTasks: PropTypes.func.isRequired,
};

export default TaskList;
