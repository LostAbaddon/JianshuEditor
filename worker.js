importScripts('tamarked.js');

var FORBIDDEN_WORDS = [];

function send (action, msg) {
	postMessage({action: action, msg: msg});
}
function log (msg) {
	console.log(msg);
}

function parseMD (id, time, article) {
	var output = tamarked(article);
	send('parsed', {
		id: id,
		time: {
			from: time,
			to: new Date().getTime()
		},
		html: output
	});
}

const REG_PUNC = /[\?,\.;:'"`!=\+\*\\\/_~<>\(\)\[\]\{\}\|@#\$\%\^\&\d－＋＝—？！／、《》【】｛｝（）×｀～＠＃￥％…＆｜“”‘’；：，。·〈〉〖〗［］「」『』　]/;
const REG_WORD = /(\w+(\-\w+)* *|[\u4e00-\u9fa5])/g;
function getLines (content) {
	var result = [], wordage = 0;
	content.map(function (line) {
		line.split(REG_PUNC).map(function (part) {
			var parts = part.match(REG_WORD);
			if (parts) {
				wordage += parts.length;
				part = parts.join('').trim();
				if (part.length > 0) result.push({
					word: part,
					chars: parts
				});
			}
		});
	});
	return [result, wordage];
}
const FILTER_POWER = 2, LENGTH_POWER = 0.5, LENGTH_MULTIPLE = 1;
function analyzeKeyWords (slug, content, title) {
	content.push(title);
	var result = [], wordage;
	content = getLines(content);
	wordage = content[1];
	content = content[0];
	var maxLength = 0, i, j;
	content.map(function (part) {
		if (part.chars.length > maxLength) maxLength = part.chars.length;
	});
	var rst, keys, ans;
	// Prototype Key Words
	for (i = 1; i <= maxLength; i++) {
		rst = analyzeKW(content, i, wordage, title);
		if (Object.keys(rst).length > 0) result[i] = rst;
	}
	maxLength = result.length;

	getKeywordInTitle(result, title, wordage);

	// Remove Part of Phrase
	for (i = 2; i < maxLength; i++) {
		removePart(result[i - 1], result[i]);
	}

	// Get Head and Tail cut
	getHeadAndTail(content, result);

	// Get the power index
	calculatePower(result, wordage);

	removeOne(result);

	calculateOCWPower(result[1], wordage);

	removeWords(result);

	result = getKWPI(result);

	adjustTitlePower(result);

	result = getFilteredKW(result, wordage);

	console.log('Job Done: ' + slug);

	send("KeyWordAnalyzeDone", {
		slug: slug,
		title: title,
		result: result
	});
}

// 获取所有出现次数超过1的字词
const OCCURS_RATE = 1 / 1800, WORD_LIMIT = 5, WORD_LENGTH_RATE = 0.2;
function analyzeKW (content, length, wordage, title) {
	var result = {};
	content.map(function (part) {
		var t = part.chars.length - length + 1, i, word, j;
		for (i = 0; i < t; i++) {
			word = ''
			for (j = 0; j < length; j++) {
				word += part.chars[i + j];
			}
			word = word.trim();
			result[word] = result[word] || 0;
			result[word] += 1;
		}
	});
	Object.keys(result).map(function (key) {
		if (title.indexOf(key) >= 0) {
			result[key] = {
				word: key,
				number: result[key],
				parts: key.match(REG_WORD),
				ratio: result[key] / wordage,
				power: 0,
				head: 0,
				tail: 0,
				isWord: true,
				inTitle: true
			}
		}
		else {
			if (result[key] === 1) {
				delete result[key];
			}
			else {
				result[key] = {
					word: key,
					number: result[key],
					parts: key.match(REG_WORD),
					ratio: result[key] / wordage,
					power: 0,
					head: 0,
					tail: 0,
					isWord: true,
					inTitle: false
				}
			}
		}
	});
	return result;
}
function removePart (low, high) {
	Object.keys(high).map(function (word) {
		var bra = '', ket = '', info = high[word], l = info.parts.length, i;
		for (i = 1; i < l; i++) {
			bra += info.parts[i - 1];
			ket += info.parts[i];
		}
		bra = bra.trim();
		ket = ket.trim();
		bra = low[bra];
		ket = low[ket];
		if (bra && bra.number === info.number) {
			bra.isWord = false;
		}
		if (ket && ket.number === info.number) {
			ket.isWord = false;
		}
	});
}
// 通过出现频次分析权重
function calPow (wordage, P1, P2, L1, L2, Q, isEq) {
	var n = wordage - P1 * (L1 - 1) - P2 * (L2 - 1);
	var entP = 0, entR1 = 0, entR2 = 0, entR = 0, result = 0;
	var i;
	if (isEq) {
		result = calPow(wordage, P1 - Q * 2, Q, L1, L1 * 2, 0, false);
	}
	else {
		for (i = 1; i <= P1; i++) {
			entP += Math.log((n + 1 - i) / (n - P2 + 1 - i));
		}
		for (i = 1; i <= Q; i++) {
			entP += Math.log(i * (n - P1 - P2 + i) / (P1 + 1 - i) / (P2 + 1 - i));
			entR1 += Math.log((P1 + 1 - i) / i);
			entR2 += Math.log((P2 + 1 - i) / i);
		}
		if (entR1 > entR2) entR = entR2;
		else entR = entR1;
		result = entP / (1 + entR);
	}
	return result;
}
function calculatePower (keywords, wordage) {
	var total = keywords.length, i, wordSet;
	var limitPower = 0, totalKW = 0;
	for (i = 2; i < total; i++) {
		wordSet = keywords[i];
		Object.keys(wordSet).map(function (kw) {
			var info = wordSet[kw];
			if (!info.isWord) return;
			var parts = info.parts;
			var bra, ket, braW, ketW, braL, ketL, braP, ketP, power = 0, value, index, length = parts.length, i;
			braL = 1;
			ketL = length - 1;
			for (index = 1; index < length; index++, braL++, ketL--) {
				bra = '';
				ket = '';
				for (i = 0; i < index; i++) {
					bra = bra + parts[i];
				}
				for (i = index; i < length; i++) {
					ket = ket + parts[i];
				}
				braW = bra.trim();
				ketW = ket.trim();
				braP = (keywords[braL][braW] || {}).number || 0;
				ketP = (keywords[ketL][ketW] || {}).number || 0;
				value = calPow(wordage, braP, ketP, braL, ketL, info.number, braW === ketW);
				if (power === 0) power = value;
				else if (value < power) power = value;
			}
			info.power = power * Math.log(info.parts.length) * Math.log(info.number) + Math.log(1 + info.head) + Math.log(1 + info.tail) / 2;
			if (info.power > 0) {
				totalKW++;
				limitPower += info.power;
			}
		});
	}
	limitPower /= totalKW;
	for (i = 2; i < total; i++) {
		wordSet = keywords[i];
		Object.keys(wordSet).map(function (kw) {
			var info = wordSet[kw];
			if (info.power < limitPower) info.isWord = false;
		});
	}
}
// 获取位于分句开头与结尾的次数
function getHeadAndTail (contents, words) {
	contents.map(function (content) {
		var t = content.chars.length, i, j, protoBra = '', protoKet = '', word, set;
		for (i = 0; i < t; i++) {
			j = i + 1;
			protoBra = protoBra + content.chars[i];
			protoKet = content.chars[t - j] + protoKet;

			if (words[j]) {
				word = protoBra.trim();
				if (words[j][word]) {
					set = words[j][word];
					set.head = set.head + 1;
				}

				word = protoKet.trim();
				if (words[j][word]) {
					set = words[j][word];
					set.tail = set.tail + 1;
				}
			}
			else {
				break;
			}
		}
	});
}
// 根据已取得的关键字，重新计算出现次数
function removeWords (words) {
	var keywords = {};
	var i, j, t = words.length, w1, w2, info;
	for (i = 1; i < t; i++) {
		Object.keys(words[i]).map(function (word) {
			var info = words[i][word];
			if (info.isWord) {
				info.relates = [];
				keywords[word] = info;
			}
		});
	}
	words = Object.keys(keywords);
	t = words.length;
	for (i = 0; i < t; i++) {
		w1 = words[i];
		info = keywords[w1];
		for (j = i + 1; j < t; j++) {
			w2 = words[j];
			if (w1.indexOf(w2) >= 0 || w2.indexOf(w1) >= 0) {
				info.relates.push(w2);
				keywords[w2].relates.push(w1);
			}
		}
	}
	var connections = [];
	words.map(function (word) {
		var info = keywords[word];
		if (info.relates.length > 0) {
			connections.push(info);
			info.relates.map(function (kw) {
				kw = keywords[kw];
				if (info.parts.length > kw.parts.length) {
					kw.number = kw.number - info.number;
					if (kw.number < 0) kw.number = 0;
					if (kw.number < 2) kw.isWord = false;
				}
			});
		}
	});
}
// Calculatethe Entroy of One-Char-Word
function calculateOCWPower (keywords, wordage) {
	var words = Object.keys(keywords), totalNum = 0, totalPow = 0;
	words.map(function (word) {
		var info = keywords[word];
		if (!info.isWord) return;
		var ent1 = 0, ent2 = 0;
		var i;
		for (i = 0; i < info.number; i++) {
			ent1 += Math.log((wordage - i) / (i + 1));
		}
		for (i = 0; i < info.origin - info.number; i++) {
			ent2 += Math.log((info.origin - i) / (i + 1));
		}
		ent1 = ent1 / (1 + ent2);
		ent2 = 1 + Math.log(info.word.trim().length);
		ent2 = ent2 * ent2 * (1 + Math.log(ent2));
		ent1 *= ent2;
		ent1 *= info.number / info.origin * info.ratio * Math.log(info.number);
		info.power = ent1;
		if (info.power < 1) {
			info.isWord = false;
		}
		else {
			totalNum += 1;
			totalPow += info.power;
		}
	});
	totalPow /= totalNum;
	words.map(function (word) {
		var info = keywords[word];
		if (!info.isWord) return;
		if (info.power < totalPow) info.isWord = false;
	});
}
// Re-calculate First Level
function removeOne (keywords) {
	var first = keywords[1], ones = Object.keys(first);
	var kws = [];
	var t = keywords.length, i;
	for (i = 2; i < t; i++) {
		Object.keys(keywords[i]).map(function (word) {
			var info = keywords[i][word];
			if (info.isWord) kws.push(info);
		});
	}
	ones.map(function (word) {
		var info = first[word];
		info.origin = info.number;
	});
	ones.map(function (word) {
		kws.map(function (info) {
			if (info.word.indexOf(word) >= 0) {
				first[word].number -= info.number;
			}
		});
	});
	ones.map(function (word) {
		var info = first[word];
		if (info.number < 2) info.isWord = false;
	});
}
// Get Keyword Power Index
function getKWPI (keywords) {
	var result = [];
	keywords.map(function (kwset) {
		Object.keys(kwset).map(function (word) {
			var info = kwset[word];
			if (info.isWord && FORBIDDEN_WORDS.indexOf(info.word) < 0) {
				info.power = info.word.trim().length;
				info.power *= 1 + Math.log(info.power);
				info.power *= info.number;
				result.push(info);
			}
		});
	});
	result.sort(function (w1, w2) {
		return w2.power - w1.power;
	});
	return result;
}

function getKeywordInTitle (keywords, title, wordage) {
	var titlePower = title.length;
	titlePower = 1.25 + titlePower / wordage * 20;
	keywords.map(function (set) {
		Object.keys(set).map(function (word) {
			var info = set[word];
			if (info.inTitle) {
				info.number = Math.round(info.number * titlePower);
			}
		});
	});
}
function adjustTitlePower (keywords) {
	keywords.map(function (info) {
		if (info.isWord && info.inTitle && info.power > 0) {
			info.power *= 2;
		}
	});
}

function getFilteredKW (keywords, wordage) {
	var limit = 0;
	keywords.map(function (info) {
		limit += info.power * info.power;
	});
	limit /= keywords.length;
	limit = Math.sqrt(limit);
	keywords = keywords.filter(function (info) {
		return info.power >= limit;
	});
	if (keywords.length > 0) {
		limit = keywords[0].power;
	}
	else {
		limit = 1;
	}
	keywords.map(function (info) {
		info.power = info.power / limit * 100;
		info.ratio = info.number / wordage;
	});
	return keywords;
}

// 计算集团性
function getCluster (data) {
	console.log("Worker Get Cluster!!!!!");
	var keywords = {}, structure_limit = 0;
	Object.keys(data).map(function (slug) {
		structure_limit += 1;
		var report = data[slug];
		if (!report) return;
		report.map(function (info) {
			var word = info.word.trim();
			keywords[word] = keywords[word] || {
				occur: 0,
				ratio: 0,
				power: 0,
			};
			keywords[word].occur += 1;
			keywords[word].ratio += info.ratio;
			keywords[word].power += info.power;
		});
	});
	keywords = Object.keys(keywords).map(function (kw) {
		var info = keywords[kw], pow;
		info.aveRatio = info.ratio / info.occur;
		info.avePower = info.power / info.occur;
		pow = kw.length;
		pow = Math.log(pow) / (pow + Math.log(pow));
		info.index = info.avePower * pow * Math.log(info.occur);
		info.word = kw;
		return info;
	});
	keywords = keywords.filter(function (info) {
		return info.word.trim().length > 1 && info.occur > 1;
	});
	keywords.sort(function (w1, w2) {
		return w2.index - w1.index;
	});
	if (!keywords[0]) {
		console.log('Data Is Not Enough!');
		send("ClusterAnalyzeDone", {
			keywords: [],
			clusters: [],
			topics: []
		});
		return;
	}
	structure_limit = keywords[0].index;
	var kw_list = [], kw_power = [];
	keywords.map(function (info) {
		info.index = info.index / structure_limit * 100;
		kw_list.push(info.word);
		kw_power.push(info.index);
	});
	keywords.sort(function (w1, w2) {
		return w2.occur - w1.occur;
	});
	console.log('Common Keywords ::');
	console.log(keywords.map(function (kw) {return kw.word + '\t' + kw.occur + '\t' + kw.index;}).join('\n'));
	// console.log(kw_list);

	var articles = Object.keys(data);
	articles.map(function (article) {
		article = data[article];
		var lenSingle = 0, lenComplex = 0, lenOccur = 0, lenCorel = 0, lenCorelO = 0;
		article.fingerSingle = [];
		article.fingerComplex = [];
		article.fingerOccur = [];
		article.fingerCorel = [];
		article.fingerCorelO = [];
		kw_list.map(function (kw) {
			article.fingerSingle[lenSingle] = 0;
			article.fingerComplex[lenSingle] = 0;
			article.fingerOccur[lenSingle] = 0;
			article.fingerCorel[lenSingle] = 0;
			article.fingerCorelO[lenSingle] = 0;
			lenSingle++;
		});
		lenSingle = 0;
		article.map(function (kw) {
			var index = kw_list.indexOf(kw.word);
			if (index >= 0) {
				lenSingle += 1;
				lenComplex += kw.power * kw.power;
				lenOccur += kw.number * kw.number;
				if (kw.power > lenCorel) lenCorel = kw.power;
				if (kw.number > lenCorelO) lenCorelO = kw.number;
				article.fingerSingle[index] = 1;
				article.fingerComplex[index] = kw.power;
				article.fingerOccur[index] = kw.number;
				article.fingerCorel[index] = kw.power;
				article.fingerCorelO[index] = kw.number;
			}
		});
		lenSingle = Math.sqrt(lenSingle);
		lenComplex = Math.sqrt(lenComplex);
		lenOccur = Math.sqrt(lenOccur);
		if (lenSingle === 0) lenSingle = 1;
		if (lenComplex === 0) lenComplex = 1;
		if (lenOccur === 0) lenOccur = 1;
		if (lenCorel === 0) lenCorel = 1;
		if (lenCorelO === 0) lenCorelO = 1;
		article.fingerSingle = article.fingerSingle.map(function (dim) {
			return dim / lenSingle;
		});
		article.fingerComplex = article.fingerComplex.map(function (dim) {
			return dim / lenComplex;
		});
		article.fingerOccur = article.fingerOccur.map(function (dim) {
			return dim / lenOccur;
		});
		article.fingerCorel = article.fingerCorel.map(function (dim) {
			return dim / lenCorel;
		});
		article.fingerCorelO = article.fingerCorelO.map(function (dim) {
			return dim / lenCorelO;
		});
	});
	articles = articles.map(function (article) {
		return {
			slug: article,
			title: data[article].title,
			fingerSingle: data[article].fingerSingle,
			fingerComplex: data[article].fingerComplex,
			fingerOccur: data[article].fingerOccur,
			fingerCorel: data[article].fingerCorel,
			fingerCorelO: data[article].fingerCorelO
		};
	});

	var distSingle = [], distComplex = [], distOccur = [], distCorel = [], distCorelO = [];
	var total = articles.length, i, j, len = kw_list.length, k, temp;
	for (i = 1; i < total; i++) {
		distSingle[i] = [];
		distComplex[i] = [];
		distOccur[i] = [];
		distCorel[i] = [];
		distCorelO[i] = [];
		for (j = 0; j < i; j++) {
			distSingle[i][j] = 0;
			distComplex[i][j] = 0;
			distOccur[i][j] = 0;
			distCorel[i][j] = 0;
			distCorelO[i][j] = 0;
			for (k = 0; k < len; k++) {
				temp = articles[i].fingerSingle[k] * articles[j].fingerSingle[k];
				distSingle[i][j] += temp;
				temp = articles[i].fingerComplex[k] * articles[j].fingerComplex[k];
				distComplex[i][j] += temp;
				temp = articles[i].fingerOccur[k] * articles[j].fingerOccur[k];
				distOccur[i][j] += temp;
				temp = articles[i].fingerCorel[k] * articles[j].fingerCorel[k];
				if (temp > distCorel[i][j]) distCorel[i][j] = temp;
				temp = articles[i].fingerCorelO[k] * articles[j].fingerCorelO[k];
				if (temp > distCorelO[i][j]) distCorelO[i][j] = temp;
			}
		}
	}

	// var clustersSingle = getKernelGroup(distSingle);
	// clustersSingle = generateGroupReport(clustersSingle, 'Single', articles, kw_list);
	// var clustersComplex = getKernelGroup(distComplex);
	// clustersComplex = generateGroupReport(clustersComplex, 'Complex', articles, kw_list);
	// var clustersOccur = getKernelGroup(distOccur);
	// clustersOccur = generateGroupReport(clustersOccur, 'Occur', articles, kw_list);
	// var clustersCorel = getKernelGroup(distCorel);
	// clustersCorel = removeSameGroup(clustersCorel, articles, 'Corel');
	// clustersCorel = generateGroupReport(clustersCorel, 'Corel', articles, kw_list);
	// var clustersCorelO = getKernelGroup(distCorelO);
	// clustersCorelO = removeSameGroup(clustersCorelO, articles, 'CorelO');
	// clustersCorelO = generateGroupReport(clustersCorelO, 'CorelO', articles, kw_list);
	var clusters = getKernelGroup(distComplex);
	clusters = removeSameGroup(clusters, articles, 'Corel');
	clusters = generateGroupReport(clusters, 'Complex', articles, kw_list);

	var topics = getTopics('Corel', articles, kw_list);
	topics = removeSameGroup(topics, articles, 'Complex');

	// console.log(clustersComplex);
	// console.log(topics);
	send("ClusterAnalyzeDone", {
		keywords: keywords,
		clusters: clusters,
		topics: topics
	});
}

const RELATIVE_LIMIT = 0.5, GROUP_RELATIVE_LIMIT = 0.9;
function getKernelGroup (distances) {
	var l = 0, i, j, dist = [], delta = [], limit = 0;
	distances.map(function (dises) {
		dises.map(function (dis) {
			if (dis > 0) {
				dist.push(dis);
			}
		});
	});
	dist.sort(function (d1, d2) {
		return d2 - d1;
	});
	l = dist.length;
	for (i = 2; i < l; i++) {
		var diff = dist[i - 1] - dist[i];
		limit += diff * diff;
		delta.push(dist[i - 1] - dist[i]);
	}
	l = 0;
	delta.map(function (diff) {
		if (diff > 0) l++;
	});
	limit /= l;
	limit = Math.sqrt(limit);
	l = 1;
	delta.shift();
	delta.some(function (diff) {
		if (diff > limit) {
			return true;
		}
		else {
			l++;
			return false;
		}
	});
	limit = (dist[l] + dist[l - 1]) / 2;
	limit *= 0.9;

	l = distances.length;
	var points = [];
	for (i = 0; i < l; i++) {
		points.push({
			index: i,
			friends: [],
			used: false,
			groups: [],
		});
	}
	for (i = 1; i < l; i++) {
		for (j = 0; j < i; j++) {
			if (distances[i][j] >= limit) {
				points[i].friends.push(j);
				points[j].friends.push(i);
			}
		}
	}

	var kernels = [];
	points.filter(function (point) {
		return point.friends.length > 0;
	}).map(function (point) {
		if (point.used) return;
		var group = [];
		kernels.push(group);
		addToGroup(point, group, points);
	});
	i = 0;
	var clusters = [];
	kernels.map(function (group) {
		var cluster = [];
		clusters.push(cluster);
		points.map(function (point) {
			var dist = distanceToGroup(point.index, group, points, distances, limit);
			if (dist <= RELATIVE_LIMIT) return;
			// dist /= limit;
			// if (dist > 1) dist = 1;
			point.groups.push([i, dist]);
			cluster.push([point.index, dist]);
		});
		cluster.sort(function (c1, c2) {
			return c2[1] - c1[1];
		});
		i++;
	});
	return clusters;
}
function addToGroup (point, group, points) {
	var index = point.index;
	if (group.indexOf(index) >= 0 || point.used) return;
	group.push(index);
	point.used = true;
	point.friends.map(function (p) {
		addToGroup(points[p], group, points);
	});
}
function distanceToGroup (point, group, points, distances, limit) {
	var dist = 0;
	group.map(function (p) {
		var dis;
		p = points[p].index;
		if (p > point) {
			dis = distances[p][point];
		}
		else if (p < point) {
			dis = distances[point][p];
		}
		else {
			if (limit > 1) dis = limit;
			else dis = 1;
		}
		dist += dis;
	});
	dist /= group.length;
	if (dist > limit) dist = limit;
	return dist / limit;
}
function getGroupKeywords (group, finger, articles, keywords) {
	var result = {}, fingers = [];
	finger = 'finger' + finger;
	group.some(function (point) {
		var key, i, word, item;
		if (point[1] === 1) {
			key = articles[point[0]][finger];
			i = 0;
			key.map(function (kw) {
				if (kw > 0) {
					word = keywords[i];
					result[word] = result[word] || 0;
					result[word] += kw;
				}
				i++;
			});
			return false;
		}
		return true;
	});
	result = Object.keys(result).map(function (word) {
		var info = result[word];
		return [word, info];
	});
	result.sort(function (word1, word2) {
		return word2[1] - word1[1];
	});
	result = result.map(function (info) {
		return info[0];
	});
	return result;
}
function generateGroupReport (clusters, finger, articles, keywords) {
	console.log('=======================');
	console.log('  ===================');
	console.log('    ===============');
	console.log('      ===========');
	console.log('        =======');
	console.log(finger + ' Cluster:\n');
	var result = [], i = 1;
	console.log(clusters.map(function (cluster) {
		var string = 'Cluster ' + i + '\n';
		i++;
		var rst = [], kws;
		kws = getGroupKeywords(cluster, finger, articles, keywords);
		string += 'Keywords: ' + kws.join(', ') + '\n';
		cluster.map(function (point) {
			var article = articles[point[0]], info = {};
			info.title = article.title;
			info.slug = article.slug;
			info.relative = point[1];
			rst.push(info);
			string += article.title + ': ' + point[1] + '\n';
		});
		result.push([rst, kws]);
		return string + '------\n';
	}).join('\n'));
	return result;
}
function getTopics (finger, articles, keywords) {
	var result = [], l, i, j;
	console.log('Get Topics');
	j = 0;
	articles.map(function (article) {
		var kws = article['finger' + finger];
		l = kws.length;
		for (i = 0; i < l; i++) {
			if (kws[i] > 0) {
				result[i] = result[i] || [[], ''];
				result[i][0].push([article.slug, kws[i], j]);
			}
		}
		j++;
	});
	l = result.length;
	for (i = 0; i < l; i++) {
		result[i] = result[i] || [[], ''];
		result[i][0].sort(function (art1, art2) {
			return art2[1] - art1[1];
		});
		result[i][1] = keywords[i];
	}
	return result;
}

function removeSameGroup (groups, articles, finger) {
	var isTopic = false;
	if (typeof groups[0][1] === 'string') isTopic = true;
	finger = 'finger' + finger;
	groups.map(function (group) {
		if (isTopic) {
			group = group[0];
		}
		var fingers = [];
		group.map(function (article) {
			var info;
			if (isTopic) info = articles[article[2]];
			else info = articles[article[0]];
			var i = 0;
			info[finger].map(function (kw) {
				fingers[i] = fingers[i] || 0;
				fingers[i] += kw * article[1];
				i++;
			});
		});
		var max = 0;
		fingers.map(function (kw) {
			if (kw > max) max = kw;
		});
		if (max === 0) max = 1;
		group[finger] = fingers.map(function (kw) {
			return kw / max;
		});
	});
	var distance = [], i, j, k, m, n, g1, g2, l, subgroup = [];
	if (isTopic) n = groups[0][0][finger].length;
	else n = groups[0][finger].length;
	k = groups.length;
	for (i = 1; i < k; i++) {
		g1 = isTopic ? groups[i][0][finger] : groups[i][finger];
		distance[i] = [];
		for (j = 0; j < i; j++) {
			g2 = isTopic ? groups[j][0][finger] : groups[j][finger];
			l = 0;
			for (m = 0; m < n; m++) {
				l += g1[m] * g2[m];
			}
			distance[i][j] = l;
			if (l >= GROUP_RELATIVE_LIMIT) {
				subgroup.push([i, j]);
			}
		}
	}
	var sames = [];
	subgroup.map(function (pair) {
		l = sames.length;
		j = -1;
		for (i = 0; i < l; i++) {
			if (sames[i].indexOf(pair[0]) >= 0 || sames[i].indexOf(pair[1]) >= 0) {
				j = i;
				break;
			}
		}
		if (j === -1) {
			sames.push([pair[0], pair[1]]);
		}
		else {
			if (sames[j].indexOf(pair[0]) < 0) sames[j].push(pair[0]);
			if (sames[j].indexOf(pair[1]) < 0) sames[j].push(pair[1]);
		}
	});
	subgroup = [];
	sames.map(function (pair) {
		pair.map(function (index) {
			subgroup.push(index);
		});
	});
	var result = [];
	sames.map(function (pair) {
		var g = [], kws = [];
		pair.map(function (index) {
			var target = groups[index];
			if (isTopic) target = target[0];
			target.map(function (info) {
				l = g.length;
				j = -1;
				for (i = 0; i < l; i++) {
					if (g[i][0] === info[0]) {
						if (g[i][1] < info[1]) g[i][1] = info[1];
						j = i;
					}
				}
				if (j === -1) {
					g.push(info);
					if (isTopic && kws.indexOf(groups[index][1]) < 0) kws.push(groups[index][1]);
				}
			});
		});
		g.sort(function (g1, g2) {
			return g2[1] - g1[1];
		});
		if (isTopic) result.push([g, kws.join(', ')]);
		else result.push(g);
	});
	l = groups.length;
	for (i = 0; i < l; i++) {
		if (subgroup.indexOf(i) < 0) {
			result.push(groups[i]);
		}
	}
	return result;
}

onmessage = function (e) {
	var data = e.data;
	switch (data.action) {
		case "updateNotKeywordDB":
			FORBIDDEN_WORDS = data.data;
		break;
		case "parse":
			parseMD(data.id, data.time, data.article);
		break;
		case "keyword":
			analyzeKeyWords(data.data.slug, data.data.content, data.data.title);
		break;
		case "getCluster":
			getCluster(data.data);
		break;
	}
};