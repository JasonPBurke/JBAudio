import { useState } from 'react';
import TabButtons, { TabButtonsType } from '@/components/TabButtons';

export enum CustomTabs {
  All,
  Unread,
  Started,
  Finished,
}
const TabScreen = () => {
  const [selectedTab, setSelectedTab] = useState<CustomTabs>(
    CustomTabs.All
  );

  const buttons: TabButtonsType[] = [
    { title: 'All' },
    { title: 'Unread' },
    { title: 'Started' },
    { title: 'Finished' },
  ];

  return (
    <TabButtons
      buttons={buttons}
      selectedTab={selectedTab}
      setSelectedTab={setSelectedTab}
    />
  );
};

export default TabScreen;
