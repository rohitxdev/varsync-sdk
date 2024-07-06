import config from "../../config.json" with { type: "json" };

const { API_URL } = config;

const isObject = (value: any): value is Record<string, any> =>
	value && typeof value === "object" && !Array.isArray(value);

export class VarsyncClient {
	#token: string | null = null;
	#config: Record<string, string | boolean | undefined> = {};
	#isInit: boolean = false;
	#pollIntervalInMs: number = 60000;

	constructor(token: string) {
		if (!token) throw new Error("varsync: missing access token");
		this.#token = token;
	}

	async #pollConfig() {
		if (!this.#token) throw new Error("varsync: missing access token");
		try {
			const res = await fetch(API_URL, {
				headers: {
					Authorization: `Bearer ${this.#token}`,
				},
			});
			const data = await res.json();
			const config = data?.config;
			const pollIntervalInMs = data?.pollIntervalInMs;

			if (!isObject(config) || typeof pollIntervalInMs !== "number") {
				throw new Error("varsync: invalid response");
			}
			for (const key in config) {
				if (!["string", "boolean"].includes(typeof config[key])) {
					throw new Error("varsync: invalid response");
				}
			}

			this.#config = config;
			this.#pollIntervalInMs = pollIntervalInMs;
			console.log(this.#config);
		} finally {
			setTimeout(() => this.#pollConfig(), this.#pollIntervalInMs);
		}
	}

	async init() {
		try {
			await this.#pollConfig();
			this.#isInit = true;
		} catch (error) {
			console.error(`varsync: ${error}`);
		}
	}

	get(key: string) {
		if (!this.#isInit) throw new Error("varsync: not initialized");
		return this.#config[key];
	}

	getAll() {
		if (!this.#isInit) throw new Error("varsync: not initialized");
		return this.#config;
	}
}
