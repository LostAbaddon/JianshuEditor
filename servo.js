var worker = new Worker('worker.js');
worker.onmessage = function (msg) {
	var data = msg.data;
	requestHandler(data, worker);
};

function send (tab, action, msg) {
	if (!isNaN(tab)) {
		chrome.tabs.sendMessage(tab, {action: action, msg: msg});
	}
}

function requestHandler (request, sender) {
	var data = request.msg;
	switch (request.action) {
		case "log":
			console.log('log: ', data);
			return true;
		case "tamarked":
			doesCurrentSend[request.__id] = false;
			worker.postMessage({
				action: 'parse',
				id: request.__id,
				time: new Date().getTime(),
				article: data
			});
			return true;
		case "parsed":
			send(data.id, 'parsed', {
				timeSpent: data.time.to - data.time.from,
				output: data.html
			});
			delete doesCurrentSend[data.id];
			return true;
		case "AnalyzeKeyWord":
			addTask(data);
			return true;
		case "GetKeyWordReport":
			shouldReport = true;
			requestID = request.__id;
			if (taskList.length === 0 && !analyzing) {
				reportAnalyze();
			}
		break;
		case "KeyWordAnalyzeDone":
			finishAnalyzeTask(data);
		break;
		case "ClusterAnalyzeDone":
			reportFinalReport(data);
		break;
	}
}

var kwTasks = {}, taskList = [], analyzing = false, shouldReport = false, requestID = -1;
function addTask (data) {
	shouldReport = false;
	kwTasks[data.slug] = {
		finish: false,
		result: '',
		content: data.content,
		title: data.title,
		author: data.author,
		like: data.like
	};
	taskList.push(data.slug);
	if (!analyzing) {
		startAnalyze();
	}
}
function startAnalyze () {
	var slug = taskList.shift();
	analyzing = true;
	worker.postMessage({
		action: 'keyword',
		data: {
			slug: slug,
			content: kwTasks[slug].content,
			title: kwTasks[slug].title
		}
	});
}
function finishAnalyzeTask (data) {
	var slug = data.slug;
	kwTasks[slug].finish = true;
	delete kwTasks[slug].content;
	kwTasks[slug].result = data.result;
	analyzing = false;
	if (taskList.length > 0) {
		startAnalyze();
	}
	else if (shouldReport) {
		reportAnalyze();
	}
}
function reportAnalyze () {
	console.log('Report Analyze!!!!');
	var result = {};
	Object.keys(kwTasks).map(function (slug) {
		result[slug] = kwTasks[slug].result;
		result[slug].title = kwTasks[slug].title;
	});
	worker.postMessage({
		action: "getCluster",
		data: result
	});
}
function reportFinalReport (result) {
	console.log("Get Final Report!!");
	result.clusters.map(function (cluster) {
		var heat = 0;
		cluster[0].map(function (article) {
			var info = kwTasks[article.slug];
			article.authorName = info.author.name;
			article.authorUrl = info.author.url;
			article.like = info.like;
			heat += article.relative * article.like;
		});
		cluster[2] = heat;
		cluster[0].sort(function (art1, art2) {
			if (art2.relative === art1. relative) {
				return art2.like - art1.like;
			}
			else {
				return art2.relative - art1.relative;
			}
		});
	});
	result.clusters.sort(function (clu1, clu2) {
		return clu2[2] - clu1[2];
	});
	result.topics.map(function (topic) {
		var heat = 0;
		topic[0].map(function (article) {
			var slug = article[0], info = kwTasks[slug];
			article[2] = {
				author: info.author,
				article: {
					title: info.title,
					slug: slug
				}
			}
			article[1] *= info.like;
			heat += article[1];
		});
		topic[0].sort(function (art1, art2) {
			return art2[1] - art1[1];
		});
		topic[2] = heat;
	});
	result.topics.sort(function (tpc1, tpc2) {
		return tpc2[2] - tpc1[2];
	});
	// console.log(result);
	send(requestID, 'GotAnalyzeReport', result);
	// kwTasks = {};
}

var doesCurrentSend = {};
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	request.__id = sender.tab ? sender.tab.id : 'popup_' + request.tabID;
	doesCurrentSend[request.__id] = true;
	var result = requestHandler(request, sender);
	if (doesCurrentSend[request.__id] === true) {
		sendResponse({result: result});
		delete doesCurrentSend[request.__id];
	}
});

// chrome.webRequest.onBeforeRequest.addListener(function (details) {
// 	var url = details.url;
// 	if (pageRequest.some(function (reg) {
// 		return reg.test(url);
// 	})) {
// 		chrome.tabs.sendMessage(details.tabId, {action: "content_request", url: url});
// 	}
// }, filter);
// chrome.webRequest.onCompleted.addListener(function (details) {
// 	var url = details.url;
// 	if (pageRequest.some(function (reg) {
// 		return reg.test(url);
// 	})) {
// 		chrome.tabs.sendMessage(details.tabId, {action: "content_loaded", url: url});
// 	}
// 	else if (/\/writer\/notes\/\w*\/content/i.test(url)) {
// 		chrome.tabs.sendMessage(details.tabId, {action: "writer_loaded"});
// 	}
// }, filter);