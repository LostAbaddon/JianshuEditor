/*
 * @ModuleName: EventManager
 * @Author: LostAbaddon
 * @Date:   2015-05-06 10:19:27
 * @Last Modified by:   LostAbaddon
 * @Last Modified time: 2015-05-06 12:14:40
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
	}) ();

	var EventObject = function (name, target, eventManager) {
		this.name = name;
		this.target = target;
		this.manager = eventManager;
	};

	var EventManager = function (obj, allowMulti) {
		this.host = obj;
		this.pool = {};
		this.allowMulti = !!allowMulti;

		// Add Events
		var em = this;
		obj.addListener = function (event, listener, priority) {
			em.on(event, listener, priority);
		};
		obj.addOneTimeListener = function (event, listener, priority) {
			em.once(event, listener, priority);
		};
		obj.removeListener = function (event, listener, priority) {
			em.off(event, listener, priority);
		};
		obj.removeAllListeners = function (event, priority) {
			em.raze(event, priority);
		};
		obj.getListeners = function (event, priority) {
			return em.get(event, priority);
		};
		obj.fireEvent = function () {
			em.fire.apply(em, arguments);
		};
		if (!(obj.on || obj.once || obj.off || obj.raze || obj.get || obj.fire)) {
			obj.on = obj.addListener;
			obj.once = obj.addOneTimeListener;
			obj.off = obj.removeListener;
			obj.raze = obj.removeAllListeners;
			obj.get = obj.getListeners;
			obj.fire = obj.fireEvent;
		}
	};
	EventManager.prototype.on = function (event, listener, priority) {
		event = getEventName(event);
		if (!event || !listener) return;
		addEventListener(this, event, listener, getPriority(priority, 0), false);
	};
	EventManager.prototype.once = function (event, listener, priority) {
		event = getEventName(event);
		if (!event || !listener) return;
		addEventListener(this, event, listener, getPriority(priority, 0), true);
	};
	EventManager.prototype.off = function (event, listener, priority) {
		event = getEventName(event);
		if (!event || !listener) return;
		var pool = getEventPool(this, event);
		priority = getPriority(priority, -1);
		if (priority < 0) {
			this.pool[event] = pool.filter(function (info) {
				return info[0] !== listener;
			});
		}
		else {
			this.pool[event] = pool.filter(function (info) {
				return (info[0] !== listener) || (info[1] !== priority);
			});
		}
	};
	EventManager.prototype.raze = function (event, priority) {
		event = getEventName(event);
		if (!event) return;
		priority = getPriority(priority, -1);
		if (priority < 0) {
			this.pool[event] = [];
		}
		else {
			this.pool[event] = getEventPool(this, event).filter(function (info) {
				return info[1] !== priority;
			});
		}
	};
	EventManager.prototype.get = function (event, priority) {
		event = getEventName(event);
		if (!event) return;
		var pool = getEventPool(this, event);
		priority = getPriority(priority, -1);
		if (priority < 0) {
			return pool.map(getListenerFromPool);
		}
		else {
			return pool.filter(function (info) {
				return info[1] === priority;
			}).map(getListenerFromPool);
		}
	};
	EventManager.prototype.fire = function () {
		var args = arguments;
		var event = getEventName(args[0]);
		args[0] = new EventObject(event, this.host, this);
		var pool = getEventPool(this, event);
		var result = false;
		var host = this.host;
		pool.some(function (info) {
			var handler = info[0];
			var block = !!handler.apply(host, args);
			result = block;
			return result;
		});
		this.pool[event] = pool.filter(removeTempListener);
	};

	function addEventListener (em, event, listener, priority, isOnce) {
		var pool = getEventPool(em, event);
		if (em.allowMulti || !hasListener(pool, listener, priority)) {
			pool.push([listener, priority, isOnce]);
			em.pool[event] = pool.sort(sortEvents);
		}
	}
	function getEventName (eventName) {
		eventName = eventName || '';
		return eventName.replace(/^[\s_]*/, '').replace(/[\s_]*$/, '');
	}
	function getPriority (priority, min) {
		if (isNaN(min)) min = 0;
		priority = priority * 1;
		if (isNaN(priority) || priority < min) priority = min;
		return Math.floor(priority);
	}
	function getEventPool (em, event) {
		var pool = em.pool[event];
		if (!pool) {
			pool = [];
			em.pool[event] = pool;
		}
		return pool;
	}
	function hasListener (pool, listener, priority) {
		return pool.some(function (info) {
			return (info[1] === priority && info[0] === listener);
		});
	}
	function getListenerFromPool (info) {
		return info[0];
	}
	function removeTempListener (info) {
		return !info[2];
	}
	function sortEvents (eventA, eventB) {
		return eventB[1] - eventA[1];
	}

	// Exports
	root.EventManager = EventManager;
}) ();