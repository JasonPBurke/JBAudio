// src/hooks/useTrackProgress.ts
import { useCallback } from 'react';
import { useLibraryStore } from '@/store/library'; // Changed import

export const useBookProgress = (id: string | number): number => {
  return useLibraryStore(
    useCallback(
      (state) => {
        return state.playbackProgress[id.toString()] || 0;
      },
      [id]
    )
  );
};
