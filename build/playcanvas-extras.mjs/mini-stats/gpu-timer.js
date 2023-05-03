/**
 * @license
 * PlayCanvas Engine v1.63.0 revision 29d4ce307
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class GpuTimer {
	constructor(app) {
		this._gl = app.graphicsDevice.gl;
		this._ext = app.graphicsDevice.extDisjointTimerQuery;
		this._freeQueries = [];
		this._frameQueries = [];
		this._frames = [];
		this._timings = [];
		this._prevTimings = [];
		this.enabled = true;
		this.unitsName = 'ms';
		this.decimalPlaces = 1;
		app.on('frameupdate', this.begin.bind(this, 'update'));
		app.on('framerender', this.mark.bind(this, 'render'));
		app.on('frameend', this.end.bind(this));
	}
	loseContext() {
		this._freeQueries = [];
		this._frameQueries = [];
		this._frames = [];
	}
	begin(name) {
		if (!this.enabled) {
			return;
		}
		if (this._frameQueries.length > 0) {
			this.end();
		}
		this._checkDisjoint();
		if (this._frames.length > 0) {
			if (this._resolveFrameTimings(this._frames[0], this._prevTimings)) {
				const tmp = this._prevTimings;
				this._prevTimings = this._timings;
				this._timings = tmp;
				this._freeQueries = this._freeQueries.concat(this._frames.splice(0, 1)[0]);
			}
		}
		this.mark(name);
	}
	mark(name) {
		if (!this.enabled) {
			return;
		}
		if (this._frameQueries.length > 0) {
			this._gl.endQuery(this._ext.TIME_ELAPSED_EXT);
		}
		const query = this._allocateQuery();
		query[0] = name;
		this._gl.beginQuery(this._ext.TIME_ELAPSED_EXT, query[1]);
		this._frameQueries.push(query);
	}
	end() {
		if (!this.enabled) {
			return;
		}
		this._gl.endQuery(this._ext.TIME_ELAPSED_EXT);
		this._frames.push(this._frameQueries);
		this._frameQueries = [];
	}
	_checkDisjoint() {
		const disjoint = this._gl.getParameter(this._ext.GPU_DISJOINT_EXT);
		if (disjoint) {
			this._freeQueries = [this._frames, [this._frameQueries], [this._freeQueries]].flat(2);
			this._frameQueries = [];
			this._frames = [];
		}
	}
	_allocateQuery() {
		return this._freeQueries.length > 0 ? this._freeQueries.splice(-1, 1)[0] : ['', this._gl.createQuery()];
	}
	_resolveFrameTimings(frame, timings) {
		if (!this._gl.getQueryParameter(frame[frame.length - 1][1], this._gl.QUERY_RESULT_AVAILABLE)) {
			return false;
		}
		for (let i = 0; i < frame.length; ++i) {
			timings[i] = [frame[i][0], this._gl.getQueryParameter(frame[i][1], this._gl.QUERY_RESULT) * 0.000001];
		}
		return true;
	}
	get timings() {
		return this._timings.map(v => v[1]);
	}
}

export { GpuTimer };
