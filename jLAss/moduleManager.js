/*
 * @ModuleName: ModuleManager
 * @Author: LostAbaddon
 * @Date:   2015-05-06 10:19:27
 * @Last Modified by:   LostAbaddon
 * @Last Modified time: 2015-05-13 10:40:27
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

	function checkModule (module) {
		if (!module) return false;
		if (!module.ModuleName) return false;
		if (isNaN(module.ModuleVersion)) return false;
		module.ModuleVersion = Math.floor(module.ModuleVersion);
		module.ModuleRequirement = module.ModuleRequirement || [];
		return true;
	}

	function checkRequirement (module) {
		var require = module.ModuleRequirement;
		if (!require) return true;
		var valid = true;
		require.some(function (req) {
			var name = req.name;
			var min = req.min || 0;
			var max = req.max || 0;
			var pack = root[name];
			if (!pack) {
				valid = false;
				return true;
			}
			if (pack.ModuleVersion < min) {
				valid = false;
				return true;
			}
			if (max > 0 && pack.ModuleVersion > max) {
				valid = false;
				return true;
			}
			return false;
		});
		return valid;
	}

	function addModule (module) {
		if (!checkModule(module)) return;
		if (!checkRequirement(module)) return;

		var version = module.ModuleVersion;
		var name = module.ModuleName;
		var old_module = root[name];

		if (old_module) {
			var old_version = old_module.ModuleVersion;
			if (old_version >= version) return;
			module['v' + old_version] = old_module;
			Object.keys(old_module).filter(function (name) {
				return !!name.match(/^v\d+$/);
			}).map(function (ov) {
				module[ov] = old_module[ov];
				delete old_module[ov];
			});
			root[name] = module;
		}
		else {
			root[name] = module;
		}
	};

	root.addModule = addModule;
}) ();