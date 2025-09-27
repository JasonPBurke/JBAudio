import { FloatingPlayer } from '@/components/FloatingPlayer';
import LibraryScreen from './(library)';

const LibraryLayout = () => {
  return (
    <>
      <LibraryScreen />
      <FloatingPlayer
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 10,
        }}
      />
    </>
  );
};

export default LibraryLayout;
