import TabButtons, { TabButtonsType } from '@/components/TabButtons';

export enum CustomTabs {
  All,
  Unplayed,
  Started,
  Finished,
}

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
    { title: `All (${bookCounts.all})` },
    { title: `Unplayed (${bookCounts.unplayed})` },
    { title: `Playing (${bookCounts.playing})` },
    { title: `Finished (${bookCounts.finished})` },
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
