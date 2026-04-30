async function fetchUrl(url, headers = {}) {
	try {
		const response = await fetch(url, { headers });
		if (!response.ok) {
			throw new Error(`Failed to fetch (status code: ${response.status}, url: "${url}")`);
		}

		return response;
	} catch (error) {
		throw new Error(`Network request failed (url: "${url}", error: ${error.message})`, { cause: error });
	}
}

class URLResolver {
	constructor(fs) {
		this.fs = fs;
		this.resolving = {};
		this.urlAccessPolicy = undefined;
	}

	/**
	 * @param {(url: string) => boolean} callback
	 */
	setUrlAccessPolicy(callback) {
		this.urlAccessPolicy = callback;
	}

	resolve(url, headers = {}) {
		const resolveUrlInternal = async () => {
			if (url.toLowerCase().startsWith('https://') || url.toLowerCase().startsWith('http://')) {
				if (this.fs.existsSync(url)) {
					return; // url was downloaded earlier
				}

				if ((typeof this.urlAccessPolicy !== 'undefined') && (this.urlAccessPolicy(url) !== true)) {
					throw new Error(`Access to URL denied by resource access policy: ${url}`);
				}

				const response = await fetchUrl(url, headers);

				if (response.redirected) { // validate access policy on redirected url
					if ((typeof this.urlAccessPolicy !== 'undefined') && (this.urlAccessPolicy(response.url) !== true)) {
						throw new Error(`Access to URL denied by resource access policy: ${response.url}`);
					}
				}

				const buffer = await response.arrayBuffer();
				this.fs.writeFileSync(url, buffer);
			}
			// else cannot be resolved
		};

		if (!this.resolving[url]) {
			this.resolving[url] = resolveUrlInternal();
		}
		return this.resolving[url];
	}

	resolved() {
		return Promise.all(Object.values(this.resolving));
	}

}

export default URLResolver;
