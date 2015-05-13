/*
 * @ModuleName: Pipe
 * @Author: LostAbaddon
 * @Date:   2015-05-06 12:08:52
 * @Last Modified by:   LostAbaddon
 * @Last Modified time: 2015-05-12 10:13:31
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

	var TaskRing = function (pipe, currentIndex) {
		this.pipe = pipe;

		this.check = function (index) {
			return index === currentIndex;
		};
		this.done = function () {
			this.pipe = null;
			currentIndex = NaN;
		};
	};

	var Pipe = function () {
		this.pool = [];
		this.running = false;
		this.index = -1;
		this.ring = null;

		// Add Event Manager
		new root.EventManager(this);
	};
	Pipe.prototype.count = function () {
		return this.pool.length;
	};
	Pipe.prototype.waiting = function () {
		return this.pool.length - this.index - 1;
	};
	Pipe.prototype.addTask = function (task) {
		if (this.running) return;
		this.pool.push(task);
	};
	Pipe.prototype.removeTask = function (task) {
		if (this.running) return;
		this.pool = this.pool.filter(function (t) {
			return t !== task;
		});
	};
	Pipe.prototype.run = function () {
		if (this.pool.length === 0) return;
		this.running = true;
		var total = this.pool.length - 1;
		var task = this.pool[0];
		this.index = 0;
		while (!task && this.index < total) {
			this.index ++;
			task = this.pool[this.index];
		}
		if (task) {
			this.ring = new TaskRing(this, this.index);
			task(this.ring);
		}
		else {
			this.index = -1;
			this.running = false;
		}
	};
	Pipe.prototype.submit = function (taskRing) {
		if (!this.running) return;
		if (this.ring !== taskRing || !taskRing.check(this.index)) return;
		taskRing.done();
		var total = this.pool.length;
		this.index ++;
		this.fire('taskDone', total, total - this.index);
		if (this.index === total) {
			this.running = false;
			this.ring = null;
			this.index = -1;
			this.fire('jobDone');
		}
		else {
			var task = this.pool[this.index];
			total --;
			while (!task && this.index < total) {
				this.index ++;
				task = this.pool[this.index];
			}
			if (task) {
				this.ring = new TaskRing(this, this.index);
				task(this.ring);
			}
			else {
				this.running = false;
				this.ring = null;
				this.index = -1;
				this.fire('jobDone');
			}
		}
	};
	Pipe.prototype.clear = function () {
		if (this.running) return;
		this.pool = [];
		this.index = -1;
	};

	// Module Info
	Pipe.ModuleName = 'Pipe';
	Pipe.ModuleVersion = 1;
	Pipe.ModuleRequirement = [
		{
			name: 'EventManager',
			min: 1
		}
	];

	// Exports
	root.addModule(Pipe);
}) ();