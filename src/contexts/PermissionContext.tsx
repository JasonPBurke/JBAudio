import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
} from 'react';

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface PermissionContextType {
  audioPermissionStatus: PermissionStatus;
  setAudioPermissionStatus: (status: PermissionStatus) => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(
  undefined
);

export const PermissionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [audioPermissionStatus, setAudioPermissionStatus] =
    useState<PermissionStatus>('undetermined');

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    () => ({ audioPermissionStatus, setAudioPermissionStatus }),
    [audioPermissionStatus],
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error(
      'usePermission must be used within a PermissionProvider'
    );
  }
  return context;
};
