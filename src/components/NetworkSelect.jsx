import React, { useState, useCallback, useEffect } from 'react';
import _ from 'lodash';
import PropTypes from 'prop-types'; // Import PropTypes
import {
  Button, Space, Modal, message, Tooltip, Dropdown,
} from 'antd';
import { useNetwork } from '../context/Network';

const STORAGE_KEY = 'networkKey';

function NetworkSelect() {
  const {
    network, setNetwork, networks,
  } = useNetwork();

  // Construct the date for the dropdown item components
  const items = _.map(networks, (item) => ({ key: item.key, label: item.name }));

  const getNetworkByKey = (key) => _.find(networks, { key });

  useEffect(() => {
    // Initialize the wallet provider. This code will run once after the component has rendered for the first time
    async function asyncInit() {
      try {
        const storedKey = localStorage.getItem(STORAGE_KEY);

        if (!_.isNil(storedKey) && storedKey !== network.key) {
          console.log(`stored network key ${storedKey} is different from the current ${network.key}`, 'Setting current key to', storedKey);
          setNetwork(getNetworkByKey(storedKey));
        }
      } catch (error) {
        console.error('Error initialize stored network:', error);
      }
    }

    asyncInit(); // Call the async function inside useEffect
  }, []); // The empty dependency array [] ensures that this effect runs only once, similar to componentDidMount

  const onClick = ({ key }) => {
    console.log(`Network.onClick. network key ${key}`);

    if (!_.isNil(key) && key !== network.key) {
      console.log(`New network key ${key} is different from the current ${network.key}`, 'Setting storage key to ', key);
      // Update the stored network value in localStorage and then reload the window
      localStorage.setItem(STORAGE_KEY, key);
      window.location.reload();
    }
  };

  return (
    <Dropdown
      menu={{
        items,
        onClick,
        selectable: true,
        defaultSelectedKeys: [localStorage.getItem(STORAGE_KEY)?.key],
      }}
      placement="bottomRight"
      arrow
    >
      <Button>Network</Button>
    </Dropdown>
  );
}

NetworkSelect.propTypes = {
};

NetworkSelect.defaultProps = {
};

export default NetworkSelect;
