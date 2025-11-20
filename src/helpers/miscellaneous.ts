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
