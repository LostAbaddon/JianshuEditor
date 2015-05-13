/*
 * @ModuleName: ModuleSpace
 * @Author: LostAbaddon
 * @Date:   2015-05-13 10:19:27
 * @Last Modified by:   LostAbaddon
 * @Last Modified time: 2015-05-13 11:12:53
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

	var space = {};

	function SpaceNode (name, fullpath) {
		this.name = name;
		this.fullpath = fullpath;
	}

	function getSpaceNode (path) {
		var node = space;
		var fullpath = '.';
		(path || '')
		.split('/')
		.map(function (node) {
			return node.replace(/^[\s_]+/g, '').replace(/[\s_]+$/g, '');
		})
		.filter(function (node) {
			return node.length > 0;
		})
		.map(function (name) {
			fullpath += '/' + name;
			if (!node[name]) {
				node[name] = new SpaceNode(name, fullpath);
			}
			node = node[name];
		});
		return node;
	}

	function Space (path, module) {
		var node = getSpaceNode(path);
		if (!!module) {
			var nV = module.version;
			if (isNaN(nV)) nV = 0;
			var oV = node.__proto__.version;
			if (isNaN(oV)) oV = -1;
			if (nV > oV) {
				module['v' + oV] = node.__proto__;
				Object.keys(node.__proto__).filter(function (name) {
					return !!name.match(/^v\d+$/);
				}).map(function (ov) {
					module[ov] = node.__proto__[ov];
					delete node.__proto__[ov];
				});
				node.__proto__ = module;
			}
			else if (oV > nV) {
				Object.keys(module).filter(function (name) {
					return !!name.match(/^v\d+$/);
				}).map(function (ov) {
					node.__proto__[ov] = module[ov];
					delete module[ov];
				});
				node.__proto__['v' + nV] = module;
			}
		}
		return node;
	};

	root.Space = Space;
}) ();