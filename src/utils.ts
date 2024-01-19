export function isEnabled(modal:any, id: string): boolean {
	return modal.app.plugins.enabledPlugins.has(id);
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

export function compareVersions(v1: any, v2: any) {
	const [Maj1, Min1, Patch1] = v1.split('.');
	const [Maj2, Min2, Patch2] = v2.split('.');

	if (Maj1 === Maj2) {
		if (Min1 === Min2) {
			return Patch1 - Patch2;
		}
		return Min1 - Min2;
	}
	return Maj1 - Maj2;
}

export function hasKeyStartingWith(obj: Record<string, any>, prefix: string): boolean {
	for (const key in obj) {
		if (key.startsWith(prefix)) {
			return true;
		}
	}
	return false;
}

export function getSelectedContent() {
	const selection = window.getSelection();
	return selection?.toString();
}

export function base64ToUint8Array(base64: string) {
	const binaryString = atob(base64);
	const length = binaryString.length;
	const bytes = new Uint8Array(length);
	for (let i = 0; i < length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}