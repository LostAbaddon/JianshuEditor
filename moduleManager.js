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

	function addModule (module) {
		var version = module.ModuleVersion * 1;
		if (isNaN(version)) version = 1;
		var name = module.ModuleName;
		var old_module = root[name];

		if (old_module) {
			var old_version = old_module.ModuleVersion * 1;
			if (isNaN(old_version)) old_version = 0;
			if (old_version >= version) return;
			module.old = old_module;
			root[name] = module;
		}
		else {
			root[name] = module;
		}
	};

	root.addModule = addModule;
}) ();