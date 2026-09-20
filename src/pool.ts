export async function mapWithConcurrency<I, O>(
	items: readonly I[],
	limit: number,
	fn: (item: I, index: number) => Promise<O>
): Promise<O[]> {
	const results: O[] = new Array<O>(items.length);
	let next = 0;

	async function worker(): Promise<void> {
		while (next < items.length) {
			const index = next;
			next += 1;
			results[index] = await fn(items[index] as I, index);
		}
	}

	const workers = Math.min(Math.max(1, Math.floor(limit)), items.length);
	await Promise.all(Array.from({ length: workers }, () => worker()));
	return results;
}
