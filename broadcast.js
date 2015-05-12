/*
 * @ModuleName: BroadCast
 * @Author: LostAbaddon
 * @Date:   2015-05-12 10:19:27
 * @Last Modified by:   LostAbaddon
 * @Last Modified time: 2015-05-12 11:14:38
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

	var BroadCast = function (host) {
		this.channels = {};

		var br = this;
		host.subscribe = function (channel, listener) {
			br.subscribe(channel, listener);
		};
		host.unsubscribe = function (channel, listener) {
			br.unsubscribe(channel, listener);
		};
		host.broadcast = function (channel, message) {
			br.broadcast(channel, message);
		};
	};
	BroadCast.prototype.subscribe = function (channel, listener) {
		channel = getChannel(this, channel);
		channel._listeners.push(listener);
		postMessage(getChannel(this, 'jLAss/BroadCast/NewSubscribe'), {title: 'New Subscriber', channel: channel._name});
	};
	BroadCast.prototype.unsubscribe = function (channel, listener) {
		channel = getChannel(this, channel);
		var index = channel._listeners.indexOf(listener);
		if (index < 0) return;
		channel._listeners.splice(index, 1);
		postMessage(getChannel(this, 'jLAss/BroadCast/NewUnsubscribe'), {title: 'New Unsubscriber', channel: channel._name});
	};
	BroadCast.prototype.broadcast = function (channel, message) {
		channel = getChannel(this, channel);
		postMessage(channel, message);
	};

	function getChannel (br, channel) {
		var path = channel.split('/').map(function (path) {
			return path.replace(/^[\s_]+/, '').replace(/[\s_]+$/, '');
		}).filter(function (path) {
			return path.length > 0;
		});
		if (path.length < 1) return;
		var node = br.channels, fullpath = '';
		path.map(function (path) {
			fullpath = fullpath + '/' + path;
			if (!node[path]) {
				node[path] = {
					_name: fullpath,
					_listeners: [],
					_parent: node
				};
			}
			node = node[path];
		});
		return node;
	}
	function postMessage (channel, message, originChannel) {
		originChannel = originChannel || channel._name;
		channel._listeners.map(function (listener) {
			listener(message, channel._name, originChannel);
		});
		var level = channel._name.match(/\//g);
		if (!!level && level.length > 1) {
			postMessage(channel._parent, message, originChannel);
		}
	}

	// Module Info
	BroadCast.ModuleName = 'BroadCast';
	BroadCast.ModuleVersion = 1;

	// Exports
	root.addModule(BroadCast);

	// System Broadcast
	new BroadCast(root);
}) ();