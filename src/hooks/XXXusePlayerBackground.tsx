import { BookImageColors } from '@/helpers/imageColorExtractor';

/**
 * @deprecated Color extraction has been moved to the library scanning process.
 * Colors should be accessed directly from the book object.
 * This hook is now a pass-through and will be removed.
 */
export const usePlayerBackground = (
  imageColors: BookImageColors | null
) => {
  return { imageColors };
};
