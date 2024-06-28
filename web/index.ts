import { z } from "zod";
import { API_URL, POLL_INTERVAL_IN_MS } from "../config.json";

const configSchema = z.record(z.string(), z.union([z.string(), z.boolean()]));

const verifyCredentialsSchema = z.discriminatedUnion("isValid", [
	z.object({
		isValid: z.literal(true),
		plan: z.enum(["free", "pro"]),
		config: configSchema,
	}),
	z.object({ isValid: z.literal(false), error: z.string() }),
]);

export class VarsyncClient {
	#token: string | null = null;
	#env: string | null = null;
	#config: Record<string, string | boolean | undefined> = {};
	#isInit: boolean = false;

	constructor(token: string, env: string) {
		if (!token || !env) throw new Error("Varsync: Missing token or env");

		this.#token = token;
		this.#env = env;
	}

	async init() {
		const res = await fetch(`${API_URL}/init`, {
			body: JSON.stringify({
				env: this.#env,
			}),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.#token}`,
			},
		});
		const data = verifyCredentialsSchema.parse(await res.json());
		if (!data.isValid) throw new Error(`Varsync: ${data.error}`);

		if (data.plan == "free") {
			this.#pollConfig();
		} else {
			const eventSource = new EventSource(`${API_URL}/config/${this.#env}`);
			eventSource.addEventListener("message", (e) => {
				this.#config = configSchema.parse(JSON.parse(e.data));
			});
			eventSource.addEventListener("error", () => {
				console.log("Varsync: Event source error. Falling back to polling.");
				this.#pollConfig();
			});
		}

		this.#config = data.config;
		this.#isInit = true;
	}

	#pollConfig() {
		setInterval(async () => {
			if (!this.#token || !this.#env) throw new Error("Varsync: Missing token or env");
			try {
				const res = await fetch(`${API_URL}/config/${this.#env}`, {
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.#token}`,
					},
				});
				this.#config = configSchema.parse(await res.json());
			} catch (error) {
				console.error("Varsync: Failed to fetch config");
			}
		}, POLL_INTERVAL_IN_MS);
	}

	get(key: string) {
		if (!this.#isInit) throw new Error("Varsync: Not initialized");
		return this.#config[key];
	}

	getAll() {
		if (!this.#isInit) throw new Error("Varsync: Not initialized");
		return this.#config;
	}
}
