function getEntropy (info, last_entropy, state) {
	if (isNaN(last_entropy)) last_entropy = 0;
	if (isNaN(state)) state = 0;
	if (typeof info === 'string') {
		info = info.split('');
		info = info.map(function (char) {
			return char.charCodeAt(0);
		});
	}
	info = differential(info);
	var num_array = [], index_array = [];
	var num_total = 0, index_total = 0, last_index = 0;
	if (info[info.length - 1] > 0) {
		last_index = 0;
	}
	else {
		last_index = 1;
	}
	num_max = info[0];
	info.map(function (num) {
		if (num >= 0) {
			num_array.push(num);
			num_total += num;
			if (last_index === 0) {
				index_array.push(0);
			}
			else {
				index_array.push(1);
				index_total ++;
				last_index = 0;
			}
		}
		else {
			num_array.push(-num);
			num_total -= num;
			if (last_index === 0) {
				index_array.push(1);
				index_total ++;
				last_index = 1;
			}
			else {
				index_array.push(0);
			}
		}
	});
	var entropy_num = 0; entropy_index = 0;
	if (num_total > 0) {
		num_array.map(function (num) {
			if (num > 0) {
				num = num / num_total;
				entropy_num -= num * Math.log(num);
			}
		});
	}
	if (index_total > 0) {
		index_array.map(function (index) {
			if (index > 0) {
				index = index / index_total;
				entropy_index -= index * Math.log(index);
			}
		});
	}
	var entropy = (1 + entropy_num) * (1 + entropy_index) - 1, next_diff_entropy = 0, next_smooth_entropy = 0;
	if (info.length > 1 && entropy > 0 && last_entropy !== entropy) {
		if (state !== 1) {
			next_diff_entropy = getEntropy(differential(info), entropy, 2);
			next_diff_entropy = next_diff_entropy / info.length * (info.length - 1);
		}
		if (state !== 2) {
			next_smooth_entropy = getEntropy(smoothify(info), entropy, 1);
			next_smooth_entropy = next_smooth_entropy / info.length * (info.length - 1);
		}
		entropy += next_diff_entropy + next_smooth_entropy;
	}
	return entropy;
}

function differential (array) {
	var result = [], total = array.length - 1, i;
	for (i = 0; i < total; i ++) {
		result[i] = array[i + 1] - array[i];
		if (Math.abs(result[i]) < 0.0000001) result[i] = 0;
	}
	return result;
}
function smoothify (array) {
	var result = [], total = array.length, i;
	for (i = 1; i < total; i ++) {
		result[i - 1] = (array[i] + array[i - 1]) / 2;
	}
	return result;
}

function randomArray (length, max, min) {
	if (isNaN(length)) length = 1;
	if (isNaN(min)) min = 0;
	if (isNaN(max)) max = 1;
	var delta = max - min;
	var result = [], i;
	for (i = 0; i < length; i++) {
		result.push(Math.random() * delta + min);
	}
	return result;
}

function lineArray (length, max, min) {
	if (isNaN(length)) length = 1;
	if (isNaN(min)) min = 0;
	if (isNaN(max)) max = 1;
	var delta = max - min;
	var result = [], i;
	if (length <= 1) {
		result.push((min + max) / 2);
	}
	else {
		for (i = 0; i < length; i++) {
			result.push(i / (length - 1) * delta + min);
		}
	}
	return result;
}

function zigzagArray (length, max, min, delta) {
	if (isNaN(length)) length = 1;
	if (isNaN(min)) min = 0;
	if (isNaN(max)) max = 1;
	if (max < min) {
		min = max + min;
		max = min - max;
		min = min - max;
	}
	// if (isNaN(delta)) delta = Math.random() * (max - min);
	if (isNaN(delta)) delta = (max - min) / Math.PI;
	var result = [max], i;
	for (i = 1; i < length; i++) {
		result[i] = result[i - 1] - delta;
		if (result[i] < min) result[i] += max - min;
	}
	return result;
}

console.log('=========================');
console.log(getEntropy('abababababababababababababababab'));
console.log('=========================');
console.log(getEntropy('abababababababxbabababababababab'));
console.log(getEntropy('abababababababaxabababababababab'));
console.log('=========================');
console.log(getEntropy('4c1j5b2p0cv4w1x8rx2y39umgw5q85s7'));
console.log('=========================');
console.log(getEntropy('4c1j5b2p0cv4w1xaaaaaaaamgw5q85s7'));
console.log('=========================');
console.log(getEntropy(randomArray(32, 256, 0)));
console.log(getEntropy(randomArray(32, 256, 200)));
console.log(getEntropy(randomArray(32, 60, 90)));
console.log(getEntropy(lineArray(32, 256, 0)));
console.log(getEntropy(lineArray(32, 256, 200)));
console.log(getEntropy(lineArray(32, 60, 90)));
console.log(getEntropy(zigzagArray(32, 256, 0)));
console.log(getEntropy(zigzagArray(32, 256, 200)));
console.log(getEntropy(zigzagArray(32, 60, 90)));
console.log('=========================');
console.log(getEntropy('d30a7d2b0587'));
console.log(getEntropy(randomArray(12, 60, 90)));