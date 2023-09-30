import _ from 'lodash';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { message } from 'antd';
import {
  Bytes, Null, Option, OptionBool,
} from '@polkadot/types';
import { useWalletPolkadot } from '../context/WalletPolkadot';

const useSubscribeTasks = (updateFunc) => {
  const { apis } = useWalletPolkadot();
  const updateFuncRef = useRef(() => {});

  useLayoutEffect(() => {
    // To avoid closures referencing the same state, assign a value to updateFuncRef.current when updating layout.
    updateFuncRef.current = updateFunc;
  });

  useEffect(() => {
    if (_.isUndefined(apis[0])) {
      return;
    }
    const subscribeTasks = async () => {
      await apis[0].query.automationPrice.accountTasks.entries(async (result) => {
        console.log('apis[0].query.automationPrice.accountTasks.entries', result);

        if (result.isNone) {
          console.log('Found 0 entry from automationPrice.accountTasks ...');
          return;
        }

        // The accountTasks will return owner and taskId, which we will use here to query the task details.
        const promises = _.map(result, async ([{ args: [ownerHex, taskIdHex] }, value]) => {
          const taskDetail = await apis[0].query.automationPrice.tasks(taskIdHex);
          const taskDetailJson = taskDetail.toHuman();

          return {
            taskId: taskIdHex.toHuman(),
            ...taskDetailJson,
          };
        });

        const tasks = await Promise.all(promises);

        updateFuncRef.current(tasks);
      });
    };
    subscribeTasks();
  }, [apis]);
};

export default useSubscribeTasks;
