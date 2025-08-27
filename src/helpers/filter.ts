export const bookTitleFilter = (title: string) => (book: any) => {
	return book.title?.toLowerCase().includes(title.toLowerCase());
};
