import React, {
  createContext,
  useContext,
  useState,
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

  return (
    <PermissionContext.Provider
      value={{ audioPermissionStatus, setAudioPermissionStatus }}
    >
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
