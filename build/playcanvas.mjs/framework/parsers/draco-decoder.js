import { WasmModule } from '../../core/wasm-module.js';
import { DracoWorker } from './draco-worker.js';
import '../../core/debug.js';
import { http } from '../../platform/net/http.js';

const downloadMaxRetries = 3;
class JobQueue {
	constructor() {
		this.workers = [[], [], []];
		this.jobId = 0;
		this.jobQueue = [];
		this.jobCallbacks = new Map();
		this.run = (worker, job) => {
			worker.postMessage({
				type: 'decodeMesh',
				jobId: job.jobId,
				buffer: job.buffer
			}, [job.buffer]);
		};
	}
	init(workers) {
		workers.forEach(worker => {
			worker.addEventListener('message', message => {
				const data = message.data;
				const callback = this.jobCallbacks.get(data.jobId);
				if (callback) {
					callback(data.error, {
						indices: data.indices,
						vertices: data.vertices,
						attributes: data.attributes
					});
				}
				this.jobCallbacks.delete(data.jobId);
				if (this.jobQueue.length > 0) {
					const job = this.jobQueue.shift();
					this.run(worker, job);
				} else {
					const index2 = this.workers[2].indexOf(worker);
					if (index2 !== -1) {
						this.workers[2].splice(index2, 1);
						this.workers[1].push(worker);
					} else {
						const index1 = this.workers[1].indexOf(worker);
						if (index1 !== -1) {
							this.workers[1].splice(index1, 1);
							this.workers[0].push(worker);
						}
					}
				}
			});
		});
		this.workers[0] = workers;
		while (this.jobQueue.length && (this.workers[0].length || this.workers[1].length)) {
			const job = this.jobQueue.shift();
			if (this.workers[0].length > 0) {
				const worker = this.workers[0].shift();
				this.workers[1].push(worker);
				this.run(worker, job);
			} else {
				const worker = this.workers[1].shift();
				this.workers[2].push(worker);
				this.run(worker, job);
			}
		}
	}
	enqueueJob(buffer, callback) {
		const job = {
			jobId: this.jobId++,
			buffer: buffer
		};
		this.jobCallbacks.set(job.jobId, callback);
		if (this.workers[0].length > 0) {
			const worker = this.workers[0].shift();
			this.workers[1].push(worker);
			this.run(worker, job);
		} else if (this.workers[1].length > 0) {
			const worker = this.workers[1].shift();
			this.workers[2].push(worker);
			this.run(worker, job);
		} else {
			this.jobQueue.push(job);
		}
	}
}
const downloadScript = url => {
	return new Promise((resolve, reject) => {
		const options = {
			cache: true,
			responseType: 'text',
			retry: downloadMaxRetries > 0,
			maxRetries: downloadMaxRetries
		};
		http.get(url, options, (err, response) => {
			if (err) {
				reject(err);
			} else {
				resolve(response);
			}
		});
	});
};
const compileModule = url => {
	const compileManual = () => {
		return fetch(url).then(result => result.arrayBuffer()).then(buffer => WebAssembly.compile(buffer));
	};
	const compileStreaming = () => {
		return WebAssembly.compileStreaming(fetch(url)).catch(err => {
			return compileManual();
		});
	};
	return WebAssembly.compileStreaming ? compileStreaming() : compileManual();
};
const defaultNumWorkers = 1;
let jobQueue;
let lazyConfig;
const initializeWorkers = config => {
	if (jobQueue) {
		return true;
	}
	if (!config) {
		if (lazyConfig) {
			config = lazyConfig;
		} else {
			const moduleConfig = WasmModule.getConfig('DracoDecoderModule');
			if (moduleConfig) {
				config = {
					jsUrl: moduleConfig.glueUrl,
					wasmUrl: moduleConfig.wasmUrl,
					numWorkers: moduleConfig.numWorkers
				};
			} else {
				config = {
					jsUrl: 'draco.wasm.js',
					wasmUrl: 'draco.wasm.wasm',
					numWorkers: defaultNumWorkers
				};
			}
		}
	}
	if (!config.jsUrl || !config.wasmUrl) {
		return false;
	}
	jobQueue = new JobQueue();
	Promise.all([downloadScript(config.jsUrl), compileModule(config.wasmUrl)]).then(([dracoSource, dracoModule]) => {
		const code = ['/* draco */', dracoSource, '/* worker */', `(\n${DracoWorker.toString()}\n)()\n\n`].join('\n');
		const blob = new Blob([code], {
			type: 'application/javascript'
		});
		const workerUrl = URL.createObjectURL(blob);
		const numWorkers = Math.max(1, Math.min(16, config.numWorkers || defaultNumWorkers));
		const workers = [];
		for (let i = 0; i < numWorkers; ++i) {
			const worker = new Worker(workerUrl);
			worker.postMessage({
				type: 'init',
				module: dracoModule
			});
			workers.push(worker);
		}
		jobQueue.init(workers);
	});
	return true;
};
const dracoInitialize = config => {
	if (config != null && config.lazyInit) {
		lazyConfig = config;
	} else {
		initializeWorkers(config);
	}
};
const dracoDecode = (buffer, callback) => {
	if (!initializeWorkers()) {
		return false;
	}
	jobQueue.enqueueJob(buffer, callback);
	return true;
};

export { dracoDecode, dracoInitialize };
