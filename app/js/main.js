var now = require('right-now');

function compare (r1, r2, noTempo) {
	var error, multiplier, length;

	if (typeof r1._tap === 'number' || typeof r2._tap === 'number') {
		throw new Error('Can\'t compare Rhythms before calling done()');
	}

	length = r1.length;
	if (length !== r2.length) return false;

	r1 = r1._taps;
	r2 = r2._taps;

	if (noTempo === true) {
		// calculate the multiplier
		multiplier = r1.map(function (tap, i) {
			return tap / r2[i];
		}).reduce(function (acc, ratio) {
			return acc + ratio;
		}) / length;

		// normalize r2
		r2 = r2.map(function (tap) {
			return tap * multiplier;
		});
	}

	// 1 - mean absolute error normalized to [0, 1]
	return 1 - r1.reduce(function (acc, tap1, i) {
		var tap2 = r2[i];
		var hi = Math.max(tap1, tap2);
		var lo = Math.min(tap1, tap2);

		return acc + (hi - lo) / hi;
	}, 0) / length;
}

function average () {
	var args = Array.prototype.slice.call(arguments);
	var r0, w0, length, weight, taps;

	if (args.some(function (a) { return typeof a._tap === 'number'; })) {
		throw new Error('Can\'t combine Rhythms before calling done()');
	}

	weight = args.reduce(function (acc, r) {
		return acc + r._weight;
	}, 0);

	r0 = args.shift();
	length = r0.length;

	if (args.some(function (a) { return a.length !== length; })) {
		throw new Error('Can\'t combine Rhythms of different lengths');
	}

	w0 = r0._weight;

	taps = r0._taps.map(function (tap0, i) {
		return (tap0 * w0 + args.reduce(function (acc, r) {
			return acc + r._taps[i] * r._weight;
		}, 0)) / weight;
	});

	return new Rhythm({
		length: length,
		_taps: taps,
		_weight: weight
	});
}

function Rhythm (obj) {
	// checks null and undefined
	if (obj == null) {
		this.length   = 0;
		this._prevTap = 0;
		this._curTap  = 0;
		this._taps    = [];
		this._weight  = 1;
	} else if (obj.constructor === Array) {
		if (!obj.length) {
			throw new Error('Rhythm array cannot be empty');
		}
		if (obj.some(function (c) { return typeof c !== 'number' || !c; })) {
			throw new Error('Rhythm array must only contain non-zero numbers');
		}

		this.length   = obj.length + 1;
		this._taps    = obj;
		this._weight   = 1;
	} else {
		if (!obj.hasOwnProperty('length') ||
		    !obj.hasOwnProperty('_taps')  ||
		    !obj.hasOwnProperty('_weight')) {
			throw new Error('Object passed to Rhythm is poorly formatted');
		}

		this.length   = obj.length;
		this._taps    = obj._taps;
		this._weight  = obj._weight;
	}
}

Rhythm.prototype.tap = function tappy_tap () {
	var prevTap, curTap = this._curTap;

	if (typeof curTap === 'undefined') {
		throw new Error('Can\'t call tap() after calling done()');
	}

	prevTap = this._prevTap = curTap;
	curTap = this._curTap = now();

	if (prevTap) {
		this._taps.push((curTap - prevTap) || 1);
	}

	this.length++;
	return this;
};

Rhythm.prototype.done = function tappy_done () {
	if (this.length < 2) {
		throw new Error('Can\'t call done() with less than 2 taps');
	}

	delete this._curTap;
	delete this._prevTap;
	delete this._nextTap;
	Object.freeze(this);

	return this;
};

Rhythm.prototype.playback = function tappy_playback (cb, multiplier) {
	function nextCb () {
		var diff, time;

		cb(i);
		if (i < length) {
			time = now();
			diff = time - prevTap - taps[i];

			setTimeout(nextCb, taps[++i] - diff);

			prevTap = time;
		}
	}

	if (typeof this._curTap === 'number') {
		throw new Error('Can\'t call playback() before calling done()');
	}

	var i = 0;
	var length = this.length;
	var prevTap, taps = this._taps;

	if (multiplier) {
		taps = taps.map(function (tap) {
			return tap * multiplier;
		});
	}

	prevTap = now();

	nextCb();

	return this;
};

module.exports = {
	compare: compare,
	average: average,
	Rhythm: Rhythm
};
