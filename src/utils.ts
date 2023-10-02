
export function isEnabled(name: string): boolean {
	return (this.app as any).plugins.enabledPlugins.has(name);
}

export function removeItem<T>(arr: Array<T>, value: T): Array<T> {
	const index = arr.indexOf(value);
	if (index > -1) {
		arr.splice(index, 1);
	}
	return arr;
}

export function formatNumber(num: number, precision = 2) {
	const map = [
		{ suffix: "T", threshold: 1e12 },
		{ suffix: "B", threshold: 1e9 },
		{ suffix: "M", threshold: 1e6 },
		{ suffix: "K", threshold: 1e3 },
		{ suffix: "", threshold: 1 },
	];

	const found = map.find((x) => Math.abs(num) >= x.threshold);
	if (found) {
		const formatted =
			(num / found.threshold).toFixed(precision) + found.suffix;
		return formatted;
	}

	return num;
}


export function calculateTimeElapsed(datePasted: Date): string {
	const delta = Math.abs(new Date().getTime() - datePasted.getTime()) / 1000;

	const years = Math.floor(delta / (86400 * 365));
	if (years >= 2) {
        return `${years} years ago`;
	} else if (years === 1) {
		return "1 year ago";
	}

	const months = Math.floor(delta / (86400 * 30));
	if (months >= 2) {
        return `${months} months ago`;
	} else if (months === 1) {
        return "1 month ago";
	}
    
	const days = Math.floor(delta / 86400);
	if (days >= 2) {
        return `${days} days ago`;
	} else if (days === 1) {
        return "1 day ago";
	}
    
	const hours = Math.floor(delta / 3600) % 24;
	if (hours >= 2) {
        return `${hours} hours ago`;
	} else if (hours === 1) {
        return "1 hour ago";
	}
    
	const minutes = Math.floor(delta / 60) % 60;
	if (minutes >= 2) {
        return `${minutes} minutes ago`;
	} else if (minutes === 1) {
        return "1 minute ago";
	}

	return "seconds ago";
}