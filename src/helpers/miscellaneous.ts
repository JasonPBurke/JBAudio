export const formatSecondsToMinutes = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  return formattedHours === '00'
    ? `${formattedMinutes}:${formattedSeconds}`
    : `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
};

export const formatSecondsToHoursMinutes = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const formattedHours = String(hours);
  const formattedMinutes = String(minutes).padStart(2, '0');

  return hours === 0
    ? `${formattedMinutes}m`
    : `${formattedHours}h ${formattedMinutes}m`;
};

/**
 * Compare two strings using natural sort order, where numeric segments
 * (including decimals like 15.5) are compared as numbers rather than
 * lexicographically. e.g. "#2" sorts before "#15.5".
 */
export const naturalCompare = (a: string, b: string): number => {
  const re = /(\d+(?:\.\d+)?)/;
  const aParts = a.split(re);
  const bParts = b.split(re);
  const len = Math.min(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    const aPart = aParts[i];
    const bPart = bParts[i];

    // Even indices are text segments, odd indices are numeric segments
    if (i % 2 === 1) {
      const diff = parseFloat(aPart) - parseFloat(bPart);
      if (diff !== 0) return diff;
    } else {
      const cmp = aPart.localeCompare(bPart);
      if (cmp !== 0) return cmp;
    }
  }

  return aParts.length - bParts.length;
};

const stripLeadingArticle = (title: string): string =>
  title.replace(/^(The|A|An)\s+/i, '');

/** Natural sort for book titles, ignoring leading articles (The, A, An). */
export const compareBookTitles = (a: string, b: string): number =>
  naturalCompare(stripLeadingArticle(a), stripLeadingArticle(b));

export const formatDate = (dateString: string | Date | undefined) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
};
