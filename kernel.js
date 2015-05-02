var send = function (action, msg, callback) {
	chrome.runtime.sendMessage({action: action, msg: msg}, callback);
};

function show (msg) {
	openElement(mention);
	mention.innerHTML = msg;
}

function getCollectionID () {
	return window.location.pathname.replace(/^\/collection\//, '');
}

function statistics (from, to) {
	show('Start Statistics');
	start_time = new Date().getTime();

	from = from.toLowerCase().trim();
	to = to.toLowerCase().trim();
	var list = document.querySelectorAll('#list-container li');
	var indexFrom = -1, indexTo = -1, i = 0;
	var links = [].map.call(list, function (article) {
		var link = article.querySelector('h5 a');
		var title = link.innerHTML;
		if (!!title.match(/^[#《].+?([总小]结|好文推荐)$/)) return null;
		title = title.toLowerCase().trim();
		var slug = link.getAttribute('href');
		if (slug) {
			slug = slug.replace('/p/', '');
			slug = slug.toLowerCase().trim();
		}
		var comment = article.querySelector('.fa-comments-o');
		var like = article.querySelector('.like-icon-button');
		console.log(title, from, title === from, to, title === to);
		if (title === from || slug === from) indexFrom = i;
		if (title === to || slug === to) indexTo = i;
		if (comment) {
			comment = comment.parentElement.innerText.trim() * 1;
		}
		else {
			comment = -1;
		}
		if (like) {
			like = like.innerText.trim() * 1;
		}
		else {
			like = -1;
		}
		i++;
		return [title, slug, article, comment, like];
	});
	if (indexFrom === -1 || indexTo === -1) {
		console.log('From:', indexFrom, 'To:', indexTo);
		return true;
	}
	if (indexFrom > indexTo) {
		indexTo = indexFrom + indexTo;
		indexFrom = indexTo - indexFrom;
		indexTo = indexTo - indexFrom;
	}
	i = 0;
	list = links.filter(function (article) {
		if (article === null) return false;
		if (i >= indexFrom && i <= indexTo) {
			i++;
			return true;
		}
		i++;
		return false;
	});
	console.log('Get Links:', list.length);

	setTimeout(function () {
		console.log('Start Page-Loading and Analyzing...');
		loadAndStatic(list);
	}, 0);
	return true;
}

function getWilsonIndex (total, number) {
	total -= 10;
	if (total < 1) total = 1;
	number -= 5;
	if (number < 0) return 0;
	if (number > total) number = total;
	var rate = number/ total;
	var inverse = 1 / total;
	var result = rate + 2 / 3 * (1 - 2 * rate) * inverse - Math.sqrt(2 * rate * (1 - rate) * inverse);
	if (result > rate) result = rate;
	return result;
}

function loadAndStatic (list) {
	var total = list.length, articles = [];
	function readPage (text, like, comment) {
		text = text.replace(/<!DOCTYPE .*?>\n*/gi, '');
		text = text.replace(/<\/?(html|body).*?>\n*/gi, '');
		text = text.replace(/<head.*?>[\w\W]*<\/head>\n*/gi, '');
		text = text.replace(/<!--[\w\W]*?-->\n*/gi, '');
		var article = document.createElement('div'), temp;
		article.innerHTML = text;
		var content = getContent(article.querySelector('.show-content'));
		var title = article.querySelector('h1').innerText.trim().replace(/\|/g, '｜').replace(/《/g, '〈').replace(/》/g, '〉');
		temp = article.querySelector('.author-info .info-r>p>a');
		var author = {
			name : temp.innerText.replace(/\n/gi, '').trim(),
			url : temp.getAttribute('href')
		};
		temp = article.querySelector('script[data-name=note]').innerHTML;
		temp = eval('(' + temp + ')');
		var wordage = temp.wordage || 0;
		var readCount = temp.views_count || 0;
		if (like < 0) like = temp.likes_count || 0;
		return {
			title: title,
			author: author.name,
			authorURL: author.url,
			read: readCount,
			word: wordage,
			like: like,
			comment: comment,
			content: content
		}
	}
	function loadPage (index) {
		var slug = list[index][1], comment = list[index][3], like = list[index][4], url = '/p/' + slug;
		ajax(
			url,
			{
				ready: function () {
					index ++;
					if (index < total) loadPage(index);
				},
				success: function (text) {
					var result = readPage(text, like, comment);
					result.url = url;
					result.slug = slug;
					result.likeRate = getWilsonIndex(result.read, result.like) * 100;
					result.commentRate = getWilsonIndex(result.read, result.comment) * 100;
					result.likePerKWord = getWilsonIndex(result.word, result.like) * 1000;
					result.commentPerKWord = getWilsonIndex(result.word, result.comment) * 1000;
					articles.push(result);
					send('AnalyzeKeyWord', {
						slug: slug,
						content: result.content,
						title: result.title,
						author: {
							name: result.author,
							url: result.authorURL
						},
						like: result.like
					});
					delete result.content;
				},
				fail: function (err) {
				},
				always: function () {
					show('完成度：' + index + '/' + total);
					if (index === total) {
						analyzeArticles(articles);
					}
				}
			}
		);
	}
	show('完成度：' + 0 + '/' + total);
	loadPage(0);
}

const SHOW_MENTIONED_AUTHORS = true;
function createArticleReport (articles) {
	show('分析中...');
	var results = '#卷首语\n\n----\n\n';
	results += '#上周活动数据统计\n';

	var num, MAX = 10, MAX2 = 10, mentions = [], mentions2 = [];
	function arrangeArticle (itemName, words, title, options) {
		results += '\n###' + title + '：\n';
		if (options && options.description) {
			results += '\n　　**' + options.description + '**\n';
		}
		if (options && options.hideData) {
			results += '\n| |作者|文章|';
			results += '\n|-|-|-|';
		}
		else {
			results += '\n| |作者|文章|' + words.title + '|';
			results += '\n|-|-|-|-|';
		}
		var isSingle = (typeof itemName === 'string');
		if (isSingle) {
			articles.sort(function (a1, a2) {
				return a2[itemName] - a1[itemName];
			});
		}
		else {
			articles.sort(function (a1, a2) {
				var v1 = a1, v2 = a2;
				var t = itemName.length, i;
				for (i = 0; i < t; i++) {
					v1 = v1[itemName[i]];
					v2 = v2[itemName[i]];
				}
				return v2 - v1;
			});
		}
		num = MAX;
		var table_index = 1;
		articles.some(function (article) {
			var value, t, i, extras = '';
			if (isSingle) {
				value = article[itemName];
			}
			else {
				value = article;
				t = itemName.length;
				for (i = 0; i < t; i++) {
					value = value[itemName[i]];
				}
			}
			if (options) {
				if (options.calculate) {
					value = options.calculate(value);
				}
				if (options.extras) {
					t = options.extras.length;
					for (i = 0; i < t; i++) {
						extras += '' + options.extras[i].title + article[options.extras[i].item] + options.extras[i].end;
					}
				}
			}
			if (num > 0) {
				if (mentions.indexOf(article.author) === -1) mentions.push(article.author);
				if (num + MAX2 > MAX && mentions2.indexOf(article.author) === -1) mentions2.push(article.author);
				// results += '\n1. [' + article.author + '](' + article.authorURL + ')的[《' + article.title + '》](' + article.url + ')　　' + words.pro + value + words.post + extras;
				if (options && options.hideData) {
					results += '\n|' + table_index + '|[' + article.author + '](' + article.authorURL + ')|[《' + article.title + '》](' + article.url + ')|';
				}
				else if (options && options.showItem === false) {
					results += '\n|' + table_index + '|[' + article.author + '](' + article.authorURL + ')|[《' + article.title + '》](' + article.url + ')|' + extras + '|';
				}
				else {
					results += '\n|' + table_index + '|[' + article.author + '](' + article.authorURL + ')|[《' + article.title + '》](' + article.url + ')|' + value + (extras.length > 0 ? '　｜　' : '') + extras + '|';
				}
				table_index++;
			}
			num --;
			article._select++;
			return num <= 0;
		});
		results += '\n\n';
	}
	function arrangeAuthor (itemName, words, title, options) {
		results += '\n###' + title + '：\n';
		if (options && options.description) {
			results += '\n　　**' + options.description + '**\n';
		}
		if (options && options.hideData) {
			results += '\n| |作者|';
			results += '\n|-|-|';
		}
		else {
			results += '\n| |作者|' + words.title + '|';
			results += '\n|-|-|-|';
		}
		var isSingle = (typeof itemName === 'string');
		if (isSingle) {
			authors.sort(function (a1, a2) {
				return authorInfo[a2][itemName] - authorInfo[a1][itemName];
			});
		}
		else {
			authors.sort(function (a1, a2) {
				var v1 = authorInfo[a1], v2 = authorInfo[a2];
				var t = itemName.length, i;
				for (i = 0; i < t; i++) {
					v1 = v1[itemName[i]];
					v2 = v2[itemName[i]];
				}
				return v2 - v1;
			});
		}
		num = MAX;
		var table_index = 1;
		authors.some(function (author) {
			var value, t, i, extras = '', info = authorInfo[author];
			if (isSingle) {
				value = info[itemName];
			}
			else {
				value = info;
				t = itemName.length;
				for (i = 0; i < t; i++) {
					value = value[itemName[i]];
				}
			}
			if (options) {
				if (options.calculate) {
					value = options.calculate(value);
				}
				if (options.extras) {
					t = options.extras.length;
					for (i = 0; i < t; i++) {
						extras += '' + options.extras[i].title + info[options.extras[i].item] + options.extras[i].end;
					}
				}
			}
			if (num > 0) {
				if (mentions.indexOf(author) === -1) mentions.push(author);
				if (num + MAX2 > MAX && mentions2.indexOf(author) === -1) mentions2.push(author);
				// results += '\n1. [' + author + '](' + info.url + ')　　' + words.pro + value + words.post + extras;
				if (options && options.hideData) {
					results += '\n|' + table_index + '|[' + author + '](' + info.url + ')|';
				}
				else if (options && options.showItem === false) {
					results += '\n|' + table_index + '|[' + author + '](' + info.url + ')|' + extras + '|';
				}
				else {
					results += '\n|' + table_index + '|[' + author + '](' + info.url + ')|' + value + (extras.length > 0 ? '　｜　' : '') + extras + '|';
				}
			}
			table_index++;
			num --;
			return num <= 0;
		});
		results += '\n\n';
	}

	results += '\n\n----\n'

	// Get totals:
	var total = articles.length, wordages = 0, readers = 0, likes = 0, comments = 0, authors = [], authorInfo = {};
	articles.map(function (article) {
		article.arrange = {};
		wordages += article.word;
		readers += article.read;
		likes += article.like;
		comments += article.comment;
		if (authors.indexOf(article.author) < 0) {
			authors.push(article.author);
			authorInfo[article.author] = {url: article.authorURL, articles: []};
			authorInfo[article.author].articles.push(article);
		}
		else {
			authorInfo[article.author].articles.push(article);
		}
	});
	results += '\n##整体情况：\n';
	results += '\n　　本次活动统计从[' + articles[articles.length - 1].author + '](' + articles[articles.length - 1].authorURL + ')的[《' + articles[articles.length - 1].title + '》](' + articles[articles.length - 1].url + ')到[' + articles[0].author + '](' + articles[0].authorURL + ')的[《' + articles[0].title + '》](' + articles[0].url + ')，总共收到了来自' + authors.length + '位作者的' + total + '篇文章，共计' + wordages + '字。';
	results += '\n　　共有' + readers + '人次阅读，收获了' + likes + '个赞，引发了' + comments + '条讨论。';
	results += '\n\n>　　\n';
	results += '\n----\n'

	// GetLists
	function round (v) {
		result = Math.round(v * 100) / 100;
		result = '' + result;
		if (result.length < 4) result = result + '0';
		else if (result.length > 4) result = result.substring(0, 4);
		return result;
	}

	var ALR = 10, ALK = 8, ACR = 5, ACM = 3;

	// Recommendation Index
	num = articles.length;
	articles.sort(function (art1, art2) {
		return art2.like - art1.like;
	}).map(function (article) {
		article.arrange.like = num * num;
		num--;
	});
	num = articles.length;
	articles.sort(function (art1, art2) {
		return art2.likeRate - art1.likeRate;
	}).map(function (article) {
		article.arrange.likeRate = num * num;
		num--;
	});
	num = articles.length;
	articles.sort(function (art1, art2) {
		return art2.comment - art1.comment;
	}).map(function (article) {
		article.arrange.comment = num * num;
		num--;
	});
	num = articles.length;
	articles.sort(function (art1, art2) {
		return art2.commentRate - art1.commentRate;
	}).map(function (article) {
		article.arrange.commentRate = num * num;
		num--;
	});
	articles.map(function (article) {
		var arrange = article.arrange;
		article.recommendation = arrange.likeRate * ALR + arrange.like * ALK + arrange.commentRate * ACR + arrange.comment * ACM;
	});

	authors.map(function (author) {
		var info = authorInfo[author];
		var articles = info.articles;
		info.arrange = {};
		info.word = 0;
		info.read = 0;
		info.like = 0;
		info.comment = 0;
		info.collect = 0;
		articles.map(function (article) {
			info.word += article.word;
			info.read += article.read;
			info.like += article.like;
			info.comment += article.comment;
		});
		info.likeRate = getWilsonIndex(info.read, info.like) * 100;
		info.commentRate = getWilsonIndex(info.read, info.comment) * 100;
		info.likePerKWord = getWilsonIndex(info.word, info.like) * 1000;
		info.commentPerKWord = getWilsonIndex(info.word, info.comment) * 1000;
	});

	num = authors.length;
	authors.sort(function (info1, info2) {
		info1 = authorInfo[info1];
		info2 = authorInfo[info2];
		return info2.like - info1.like;
	}).map(function (info) {
		authorInfo[info].arrange.like = num * num;
		num--;
	});
	num = authors.length;
	authors.sort(function (info1, info2) {
		info1 = authorInfo[info1];
		info2 = authorInfo[info2];
		return info2.likeRate - info1.likeRate;
	}).map(function (info) {
		authorInfo[info].arrange.likeRate = num * num;
		num--;
	});
	num = authors.length;
	authors.sort(function (info1, info2) {
		info1 = authorInfo[info1];
		info2 = authorInfo[info2];
		return info2.comment - info1.comment;
	}).map(function (info) {
		authorInfo[info].arrange.comment = num * num;
		num--;
	});
	num = authors.length;
	authors.sort(function (info1, info2) {
		info1 = authorInfo[info1];
		info2 = authorInfo[info2];
		return info2.commentRate - info1.commentRate;
	}).map(function (info) {
		authorInfo[info].arrange.commentRate = num * num;
		num--;
	});
	authors.map(function (info) {
		info = authorInfo[info];
		var arrange = info.arrange;
		info.recommendation = arrange.likeRate * ALR + arrange.like * ALK + arrange.commentRate * ACR + arrange.comment * ACM;
	});

	// Recommendations:
	results += "\n##上周最受欢迎：\n";

	// Recommendation Most
	arrangeArticle('recommendation', {pro: '', post: '', title: '推荐指数'}, '上周最受欢迎文章', {hideData: true});
	results += ">　　这是根据两份点赞榜与两份评论榜综合统计出的上周最受欢迎文章，大家鼓掌！\n　　在下文会具体介绍这些文章，大家不要着急哦～～\n";

	// Recommendation Most
	arrangeAuthor('recommendation', {pro: '', post: '', title: '推荐指数'}, '上周最受欢迎作者', {hideData: true});
	results += ">　　这是根据两份点赞榜与两份评论榜综合统计出的上周最受欢迎作者，大家鼓掌！\n　　在下文会着重介绍这几位作者哦～～\n";

	results += "\n----\n";

	results += '\n##文章榜单：\n';

	// Like Most
	arrangeArticle('like', {pro: '共获得', post: '个赞', title: '点赞数'}, '总点赞榜');
	// LR Most
	arrangeArticle('likeRate',
		{
			pro: '转化率为：',
			post: 'LPR',
			title: '点赞／阅读'
		},
		'均点赞榜',
		{
			showItem: true,
			calculate: round,
			extras: [{
				title: '',
				item: 'like',
				end: '／'
			}, {
				title: '',
				item: 'read',
				end: ''
			}]
		}
	);
	results += ">　　这两份分别是总点赞榜与均点赞榜。\n";
	// Comment Most
	arrangeArticle('comment', {pro: '共有', post: '条评论', title: '评论数'}, '总评论榜');
	// CR Most
	arrangeArticle('commentRate',
		{
			pro: '转化率为：',
			post: 'CPR',
			title: '评论／阅读'
		},
		'均评论榜',
		{
			showItem: true,
			calculate: round,
			extras: [{
				title: '',
				item: 'comment',
				end: '／'
			}, {
				title: '',
				item: 'read',
				end: ''
			}]
		}
	);
	results += ">　　这两份分别是总评论榜与均评论榜。\n";
	// Read Most
	arrangeArticle('read', {pro: '共有', post: '人次阅读', title: '阅读量'}, '阅读榜');
	results += ">　　\n";
	// Word Most
	arrangeArticle('word', {pro: '共有', post: '字', title: '字数'}, '字数榜');
	results += ">　　\n";

	results += '\n----\n';

	// Author Analyze
	results += '\n##作者榜单：\n';

	// Like Most
	arrangeAuthor('like', {pro: '共获得', post: '个赞', title: '点赞数'}, '总点赞榜');
	// LR Most
	arrangeAuthor('likeRate',
		{
			pro: '转化率为：',
			post: 'LPR',
			title: '点赞／阅读'
		},
		'均点赞榜',
		{
			showItem: true,
			calculate: round,
			extras: [{
				title: '',
				item: 'like',
				end: '／'
			}, {
				title: '',
				item: 'read',
				end: ''
			}]
		}
	);
	results += ">　　这两份分别是总点赞榜与均点赞榜。\n";
	// Comment Most
	arrangeAuthor('comment', {pro: '共引发', post: '条评论', title: '评论数'}, '总评论榜');
	// CR Most
	arrangeAuthor('commentRate',
		{
			pro: '转化率为：',
			post: 'CPR',
			title: '评论／阅读'
		},
		'均评论榜',
		{
			showItem: true,
			calculate: round,
			extras: [{
				title: '',
				item: 'comment',
				end: '／'
			}, {
				title: '',
				item: 'read',
				end: ''
			}]
		}
	);
	results += ">　　\n";
	// Read Most
	arrangeAuthor('read', {pro: '共有', post: '人次阅读', title: '阅读量'}, '阅读榜');
	results += ">　　\n";
	// Article Most
	arrangeAuthor(['articles', 'length'], {pro: '共写了', post: '篇文章', title: '文章数'}, '总发文榜');
	results += ">　　\n";
	// Word Most
	arrangeAuthor('word', {pro: '共写了', post: '字', title: '字数'}, '总码字榜');
	results += ">　　\n";

	results += '\n----\n';

	if (SHOW_MENTIONED_AUTHORS) {
		results += '@' + mentions.join(' @') + '\n';
		results += '\n----\n';
	}

	return {
		report: results,
		author_info: authorInfo,
		mentions: mentions
	}
}

function analyzeArticles (articles) {
	var results, authorInfo;

	results = 0;
	articles.map(function (note) {
		note._index = results;
		note._select = 0;
		results++;
	});

	article_records = articles;

	results = createArticleReport(article_records);
	notes_result = results.report;
	authorInfo = results.author_info;
	md_result = notes_result;
	localStorage[getCollectionID() + '_result'] = md_result;

	show('<p>分析已完成</p>');
	tamarked_task = function (data) {
		html_result = data.output;
		pad.innerHTML = data.output;
		localStorage[getCollectionID() + '_output'] = html_result;
		openElement(pad);
		showHTML = true;
		if (!switcher.onClick) {
			switcher.onClick = switchEvent;
			switcher.addEventListener('click', switcher.onClick);
		}
		mention.appendChild(switcher);
	};
	start_time = new Date().getTime() - start_time;
	send('tamarked', md_result);

	analyzeTrend(articles, authorInfo);
	send('GetKeyWordReport');
	show('<p>分析耗时: ' + (start_time / 1000) + '秒</p>');
}

function analyzeTrend (articles, authors) {
	return;
	console.log('Analyze Trend...');
	function retrieve (item) {
		return [item.word, item.read, item.like, item.comment];
	}
	var arts = articles.map(retrieve), auts = [];
	var items = Object.keys(authors), item;
	for (item in items) {
		auts.push(authors[items[item]]);
	}
	auts = auts.map(retrieve);
	console.log(arts);
	console.log(auts);
	arts = arts.map(function (art) {
		return art.join('\t');
	});
	auts = auts.map(function (aut) {
		return aut.join('\t');
	});
	console.log(arts.join('\n'));
	console.log(auts.join('\n'));
	show('<p>Waiting For Analyze Report</p>');
	start_analyze = new Date().getTime();
}

const STRUCTURE_LIMIT = 0.7;
const SHOW_KEYWORD_CLUSTER = false;
const SHOW_TOPIC_CLUSTER = true;
function getAnalyzeReport (data) {
	console.log('Get Analyze Report!!!!');
	start_analyze = (new Date().getTime()) - start_analyze;
	start_analyze /= 1000;
	show('Get KW-Report! TimeSpent: ' + start_analyze + 's');
	mention.appendChild(switcher);

	var temp = '';
	data.keywords.map(function (info) {
		temp += info.word + '\t' + info.occur + '\t' + info.power + '\t' + info.ratio + '\t' + info.avePower + '\t' + info.aveRatio + '\t' + info.index + '\n';
	});
	console.log(temp);

	analy_result = '\n#文章内容分析：\n'
	analy_result += '\n##最常见关键词：'
	analy_result += '\n\n| |关键词|出现次数|'
	// analy_result += '\n\n| |关键词|出现次数|影响因子|权重|频率|'
	analy_result += '\n|-|-|-|'
	var i = 0, limit = 500;
	data.keywords.some(function (info) {
		i++;
		// analy_result += '\n|' + i + '|' + info.word + '|' + info.occur + '|' + (Math.round(info.index * 100) / 100) + '|' + (Math.round(info.power * 100) / 100) + '|' + (Math.round(info.ratio * 100) / 100) + '|';
		analy_result += '\n|' + i + '|' + info.word + '|' + info.occur + '|';
		limit --;
		return limit <= 0;
	});
	analy_result += '\n\n----\n';

	console.log(data.topics);
	if (SHOW_KEYWORD_CLUSTER) {
		analy_result += '\n##最热关键词文章：\n';
		data.topics.map(function (topic) {
			if (topic[2] <= topic[0].length) return;
			analy_result += '\n###关键词：' + topic[1] + '　　热度：' + (Math.round(topic[2] * 100) / 100) + '\n';
			analy_result += '\n|作者|文章|热度|\n';
			analy_result += '|-|-|-|\n';
			topic[0].map(function (article) {
				analy_result += '|[' + article[2].author.name + '](' + article[2].author.url + ')|[《' + article[2].article.title + '》](/p/' + article[2].article.slug + ')|' + (Math.round(article[1] * 100) / 100) + '|\n';
			});
			analy_result += '\n\n';
		});
		analy_result += '\n----\n';
	}

	console.log(data.clusters);
	if (SHOW_TOPIC_CLUSTER) {
		analy_result += '\n##最热话题文单：\n';
		data.clusters.map(function (cluster) {
			if (cluster[2] <= cluster[0].length) return;
			analy_result += '\n###话题：' + cluster[1].join('，') + '　　热度：' + (Math.round(cluster[2] * 100) / 100) + '\n';
			analy_result += '\n|作者|文章|相关度|热度|\n';
			analy_result += '|-|-|-|-|\n';
			cluster[0].map(function (point) {
				analy_result += '|[' + point.authorName + '](' + point.authorUrl + ')|[《' + point.title + '》](/p/' + point.slug + ')|' + (Math.round(point.relative * 100) / 100) + '|' + point.like + '|\n';
			});
			analy_result += '\n\n';
		});
		analy_result += '\n----\n';
	}

	md_result += analy_result;

	localStorage[getCollectionID() + '_result'] = md_result;
	send('tamarked', md_result);
}

function showResult () {
	var result = localStorage[getCollectionID() + '_result'];
	var output = localStorage[getCollectionID() + '_output'];
	show('<p>上次结果</p>');
	pad.innerHTML = output;
	openElement(pad);
	showHTML = true;
	if (!switcher.onClick) {
		switcher.onClick = switchEvent;
		switcher.addEventListener('click', switcher.onClick);
	}
	mention.appendChild(switcher);
}

function showArticleFilter () {
	article_records.sort(function (noteA, noteB) {
		var index = noteB._select - noteA._select;
		if (index === 0) index = noteA._index - noteB._index;
		return index;
	});

	openElement(article_filter);
	article_filter.innerHTML = '<table style="width:95%;min-width:500px;"><thead><tr><th>作者</th><th>文章</th><th>操作</th></tr></thead><tbody></tbody></table>';
	var table = article_filter.querySelector('tbody');
	article_records.map(function (info) {
		insertLineForAF(info, table);
	});
	article_filter.innerHTML += '<div style="text-align:center;margin-top:50px;"><button target="Submit">提交</button></div>';
}
function insertLineForAF (info, table) {
	var record = newElement('tr');
	record.innerHTML = '<td><a href="http://www.jianshu.com/' + info.authorURL + '" target="_blank">' + info.author + '</a></td>';
	record.innerHTML += '<td><a href="http://www.jianshu.com/' + info.url + '" target="_blank">' + info.title + '</a></td>';
	record.innerHTML += '<td style="text-align:center;"><button target="RemoveArticle" name="' + info.slug + '">移除</button></td>';
	table.appendChild(record);
}
function onArticleFilterEvent (event) {
	var host = event.toElement, task = host.getAttribute('target'), target = null, index, found;
	if (task === 'RemoveArticle') {
		target = host.getAttribute('name');
		index = -1;
		found = article_records.some(function (info) {
			index++;
			return info.slug === target;
		});
		if (found) {
			article_records.splice(index, 1);
		}
		host.parentElement.parentElement.parentElement.removeChild(host.parentElement.parentElement);
	}
	else if (task === 'Submit') {
		closeElement(article_filter);
		target = createArticleReport(article_records);
		show('<p>分析已完成</p>');
		notes_result = target.report;
		index = target.author_info;

		md_result = notes_result + analy_result;
		localStorage[getCollectionID() + '_result'] = md_result;
		send('tamarked', md_result);

		analyzeTrend(article_records, index);
	}
}

var start_time = 0, start_analyze = 0;
var tamarked_task = null;
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	var msg = request.msg;
	switch (request.action) {
		case "log":
			console.log('log: ', msg);
		break;
		case "analyzeArticles":
			console.log('Analyze: ', msg);
			sendResponse({
				origin: request.action,
				success: statistics(msg.articleFrom, msg.articleTo),
				needRecall: false,
				msg: 'Job Done.'
			});
		break;
		case "parsed":
			if (tamarked_task) tamarked_task(msg);
		break;
		case "GotAnalyzeReport":
			getAnalyzeReport(msg);
		break;
		case "showResult":
			showResult();
		break;
		case "filterArticle":
			showArticleFilter();
		break;
		case "filterKeyword":
			console.log('Request For Keyword Filter');
		break;
		default:
			console.log("Get Request:");
			console.log(request);
		break;
	}
});

var pad, mention, switcher, notes_result, analy_result, md_result, html_result, showHTML = true, subpages = [], article_records, article_filter, keywords_filter;
function switchEvent () {
	if (showHTML) {
		pad.innerHTML = '<p>' + localStorage[getCollectionID() + '_result'].replace(/\n/g, '<br>') + '</p>';
	}
	else {
		pad.innerHTML = localStorage[getCollectionID() + '_output'];
	}
	showHTML = !showHTML;
}

function newElement (type, classes) {
	var element;
	if (type === 'text') {
		element = document.createTextNode(classes || '');
	}
	else {
		element = document.createElement(type);
		if (!!classes) {
			element.className = classes;
		}
	}
	return element;
}
function appendToPage (element) {
	subpages.push(element);
	document.body.appendChild(element);
}
function openElement (element) {
	element.style.display = 'block';
}
function closeElement (element) {
	element.style.display = 'none';
}

function stopPropagation (event) {
	event.stopPropagation();
	event.preventDefault();
	event.cancelBubble = true;
}

document.addEventListener('DOMContentLoaded', function () {
	switcher = newElement('button');
	switcher.innerHTML = '切换Markdown/HTML';

	// 顶部提示框
	mention = newElement('div', '_extension_mention');
	mention.addEventListener('click', stopPropagation);
	appendToPage(mention);

	// 结果展示区
	pad = newElement('div', '_extension_pad');
	pad.addEventListener('click', stopPropagation);
	appendToPage(pad);

	// 文章列表筛选区
	article_filter = newElement('div', '_extension_pad');
	article_filter.addEventListener('click', stopPropagation);
	article_filter.addEventListener('click', onArticleFilterEvent);
	appendToPage(article_filter);

	document.body.addEventListener('click', function (e) {
		if (switcher.onClick) switcher.addEventListener('click', switcher.onClick);
		subpages.map(closeElement);
	});
});