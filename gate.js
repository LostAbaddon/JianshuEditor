/*
 * @ModuleName: Gate
 * @Author: LostAbaddon
 * @Date:   2015-05-06 12:08:52
 * @Last Modified by:   LostAbaddon
 * @Last Modified time: 2015-05-12 10:13:26
 */

(function () {
	var root = null;
	(function init () {
		// For Node.js
		if (typeof module !== 'undefined' && typeof exports === 'object') {
			if (!global.jLAss) global.jLAss = {};
			root = global.jLAss;
		}
		// For WebWorker
		else if (typeof importScripts !== 'undefined') {
			if (!self.jLAss) self.jLAss = {};
			root = self.jLAss;
		}
		// For Browser
		else {
			if (!window.jLAss) window.jLAss = {};
			root = window.jLAss;
		}
		if (!root.addModule) root.addModule = function () {};
	}) ();

	var Key = function (id, gate, isOmni) {
		var open = false;
		isOmni = !!isOmni;
		this.isOmni = function () {
			return isOmni;
		};
		this.getID = function () {
			return id;
		};
		this.open = function (target_gate) {
			if (gate !== target_gate) return;
			open = true;
		};
		this.close = function (target_gate) {
			if (gate !== target_gate) return;
			open = false;
		};
		this.didOpened = function () {
			return open;
		};
	};

	var Gate = function () {
		this.locks = {};

		// Add Event Manager
		new root.EventManager(this);
	};
	Gate.prototype.waiting = function () {
		var locks = this.locks;
		return Object.keys(this.locks).map(function (lock_name) {
			return locks[lock_name];
		}).filter(function (lock) {
			return !lock.didOpened();
		}).length;
	};
	Gate.prototype.getKey = function (id) {
		if (this.locks[id]) {
			return null;
		}
		else {
			var key = new Key(id, this);
			this.locks[id] = key;
			this.fire('newKey', id);
			return key;
		}
	};
	Gate.prototype.getOmniKey = function (id) {
		if (this.locks[id]) {
			this.fire('newKey', id);
			return this.locks[id];
		}
		else {
			var key = new Key(id, this, true);
			this.locks[id] = key;
			this.fire('newKey', id);
			return key;
		}
	};
	Gate.prototype.unlock = function (key) {
		if (!(key instanceof Key)) return;
		var id = key.getID();
		var innerKey = this.locks[id];
		if (key !== innerKey) return;
		key.open(this);
		var left = this.waiting();
		this.fire('unlock', id, left);
		if (left === 0) {
			var self = this;
			var omniKeys = self.locks;
			var newKeys = {};
			Object.keys(omniKeys).map(function (name) {
				var key = omniKeys[name];
				if (key.isOmni()) {
					newKeys[name] = key;
				}
			});
			self.locks = newKeys;
			this.fire('open');
		}
	};
	Gate.prototype.lock = function () {
		var self = this;
		Object.keys(self.locks).map(function (name) {
			var key = self.locks[name];
			key.close(self);
		});
		this.fire('close');
	};

	// Module Info
	Gate.ModuleName = 'Gate';
	Gate.ModuleVersion = 1;
	Gate.ModuleRequirement = [
		{
			name: 'EventManager',
			min: 1
		}
	];

	// Exports
	root.addModule(Gate);
}) ();