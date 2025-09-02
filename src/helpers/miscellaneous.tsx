export const formatSecondsToMinutes = (totalSeconds: number) => {
	// const hours = Math.floor()
	// const minutes = Math.floor(seconds / 60)
	// const remainingSeconds = Math.floor(seconds % 60)

	const dateObj = new Date(totalSeconds * 1000);
	const hours = dateObj.getUTCHours();
	const minutes = dateObj.getUTCMinutes();
	const seconds = dateObj.getSeconds();

	const formattedHours = String(hours).padStart(2, '0');
	const formattedMinutes = String(minutes).padStart(2, '0');
	const formattedSeconds = String(seconds).padStart(2, '0');

	return formattedHours === '00'
		? `${formattedMinutes}:${formattedSeconds}`
		: `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
};
