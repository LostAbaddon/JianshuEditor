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
		case "finishAnalyze":
			kwTasks = {};
			taskList = [];
			analyzing = false;
			shouldReport = false;
			requestID = -1;
			currentRecords = {};
		break;
		case "AppendArticleRecords":
			appendArticleRecords(data);
		break;
		case "AnalyzeArticles":
			data.records = currentRecords;
			send(request.tabID, 'analyzeArticles', data);
		break;
		case "test":
			console.log(request);
			console.log(kwTasks);
			console.log(taskList);
			console.log(analyzing);
			console.log(shouldReport);
			console.log(requestID);
		break;
		default:
			console.log('Get Request:');
			console.log(request);
	}
}

var kwTasks = {}, taskList = [], analyzing = false, shouldReport = false, requestID = -1, currentRecords = {};
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
}
function appendArticleRecords (articles) {
	articles.map(function (info) {
		currentRecords[info.slug] = info; // Use new data to overwrite older one.
	});
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

// Database :: indexedDB

const DB_NAME = "JS-Analyze-DB";
var jsdb = {version: 1};

function createDatabase (dbName, dbVersion) {
	if (!dbVersion) dbVersion = 1;

	var request = indexedDB.open(dbName, dbVersion);

	request.onerror = function (event) {
		var err = event.target.error;
		console.error('Fail to open datbase ' + dbName + ' with error:' + err.name + '\n' + err.message);
	};
	request.onsuccess = function (event) {
		var db = event.target.result;
		jsdb.datebase = db;
		console.log(db);
	};
	request.onupgradeneeded = function (event) {
		var db = event.target.result;
		var version = dbVersion;
		if (version === 1) {
			initNotKeywordDB(db);
		}
		else if (version !== dbVersion) {
			console.log('Need Update From ' + version + ' To ' + dbVersion);
		}
	};
}

function deleteDatabase (dbName) {
	try {
		indexedDB.deleteDatabase(dbName);
	}
	catch (err) {
		console.error(err.getMessage);
	}
}

// Not-Keyword DB
const dtNotKeyword = 'NotKeyword';
// const FORBIDDEN_WORDS = ['自己', '我们', '你们', '他们', '什么', '为什么', '的时候', '就是', '一个', '知道', '但是', '可是', '因为', '所以', '没有', '怎么', '可以', '然后', '现在', '事情', '的东西', '东西', '的事情', '可能', '不可能', '比如', '如果', '开始', '有些', '已经', '时候', '其实', '这样的', '这样', '那样', '那样的', '还是', '的时候', '还是', '自己的', '知道', '不知道', '当然', '或者', '仅仅是', '仅仅', '的生活', '那个时候', '这本书', '只是', '一直', '图片来自网络', '说道', '摇了摇头', '的地方', '它们', '的样子', '让我', '突然', '忽然', '了起来', '是一样的', '但我', '越来越', '不过是', '只是', '的味道', '是一样的', '的母亲', '日星期', '而且', '以及', '结果', '觉得', '发现', '需要', '告诉', '感觉', '于是', '我觉得', '篇文章', '图片来自', '的姑娘', '这些', '这个时候', '的故事', '应该', '对于', '大概是', '认为', '比较', '这个问题', '当时', '这种', '那种', '如果你', '如何', '那么', '图片来自Instagram', '的内容', '的声音', '必须', '很多', '并且', '是那么的', '这一天', '我们这里', '别人的', '每个人', '哈哈哈', 'com', '那些', '真的', '可以看出', '特别', '一起', '个故事', '因為', '了一辈子'];
const FORBIDDEN_WORDS = ['自己', '我们'];
function initNotKeywordDB (db) {
	console.log(db);
	var store = db.createObjectStore(dtNotKeyword, {keyPath: 'word'});
	store.createIndex('level', 'level', {unique: false});
	store.transaction.oncomplete = function (event) {
		var store = db.transaction(dtNotKeyword, 'readwrite').objectStore(dtNotKeyword);
		var request;
		for (item in FORBIDDEN_WORDS) {
			item = FORBIDDEN_WORDS[item];
			item = {
				word: item,
				level: 0
			};
			console.log(item);
			request = store.add(item);
			request.onsuccess = function (event) {
				console.log('DONE');
				console.log(event);
			};
			request.onerror = function (event) {
				console.log('ERROR');
				console.log(event);
			};
		}
		console.log(store);
	};
}

// DB Init

function initDB () {
	// deleteDatabase(DB_NAME);
	createDatabase(DB_NAME, jsdb.version);
}

initDB();