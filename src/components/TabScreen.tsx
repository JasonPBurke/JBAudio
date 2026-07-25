import TabButtons, { TabButtonsType } from '@/components/TabButtons';
import { CustomTabs } from '@/types/CustomTabs';

export { CustomTabs };

interface TabScreenProps {
  selectedTab: CustomTabs;
  setSelectedTab: (tab: CustomTabs) => void;
  bookCounts: {
    all: number;
    unplayed: number;
    playing: number;
    finished: number;
  };
}

const TabScreen = ({
  selectedTab,
  setSelectedTab,
  bookCounts,
}: TabScreenProps) => {
  const buttons: TabButtonsType[] = [
    { title: `Unplayed (${bookCounts.unplayed})` },
    { title: `Playing (${bookCounts.playing})` },
    { title: `Finished (${bookCounts.finished})` },
    { title: `All (${bookCounts.all})` },
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
