const {compareTwoStrings: compareTwoStringsBi} = require('string-similarity');
const fs = require('fs');
const minimist = require('minimist');
const munkres = require('munkres-js');
const path = require('path');
const replaceExt = require('replace-ext');
const {weigh} = require('common-substrings');

const DEBUG_MODE = false;

const log = (...args) => {
	if(DEBUG_MODE)
		console.log(...args);
};

const SUBTITLE_EXTENSIONS = [
	'psb', 'srt', 'ssa', 'ass', 'sub', 'sami', 'smi', 'smil', 'usf', 'vtt'
];

const VIDEO_EXTENSIONS = [
	'3gp', 'asf', 'avi', 'dpl', 'dsf', 'flv', 'mkv', 'mov', 'mp4', 'mpe',
	'mpeg', 'mpg', 'nsr', 'ogm', 'rmvb', 'tp', 'ts', 'vob', 'wm', 'wmv'
];

const argv = minimist(process.argv.slice(2));
let directory = process.cwd();

if(argv._[0]) {
	directory = path.resolve(argv._[0]);
}

const toPath = (directory) => (v) => path.resolve(directory, v);
const extSubset = (files, extensions, directory) =>
	files.filter((v) => extensions.includes(path.extname(v).slice(1))).map(toPath(directory));

function compareTwoStringsMono(first, second) {
	first = first.replace(/\s+/g, '')
	second = second.replace(/\s+/g, '');
	
	if(first.length + second.length === 0) return 1;
	
	const mapChars = new Map();
	for (let i = 0; i < first.length; i++) {
		if(mapChars.has(first[i]))
			mapChars.set(first[i], mapChars.get(first[i]) + 1);
		
		else
			mapChars.set(first[i], 1);
	}
	
	let union = 0;
	let mapSecond = new Map();
	for(let j = 0; j < second.length; j++) {
		if(mapSecond.get(second[j]))
			continue;
		
		if(mapChars.has(second[j])) {
			union += mapChars.get(second[j]);
			mapSecond.set(second[j], true);
		}
	}
	
	return (union * 2) / (first.length + second.length);
}

function compareTwoStrings(s1, s2) {
	return compareTwoStringsBi(s1, s2) * 0.8 + compareTwoStringsMono(s1, s2) * 0.2;
}

// Extract number from filename and returns Map(number => filename)
const numberMap = (arr) => {
	let minOccurrence = arr.length - 2;
	if(minOccurrence < 4) minOccurrence = arr.length;
	
	const commonSubstrings = weigh(arr.map((v) => basename(v)), {
		minLength: 3, minOccurrence
	});
	
	log(`COMMON-SUBSTR, ${commonSubstrings.map(v => v.name)}`);
	
	const map = arr.map((v) => {
		let numericText = basename(v);
		commonSubstrings.forEach((v) => numericText = numericText.replace(v.name, ''));
		numericText = parseFloat(numericText.replace(/[^0-9.]/g, ''));
		
		log(`NUMBER-MAP, ${v} => ${numericText}`);
		return [numericText, v];
	});
	
	return new Map(map.filter((v, i) => map.every((v2, i2) => {
		if(i === i2) return true;
		if(v[0] === v2[0]) return false;
		return true;
	})).filter((v) => {
		if(v[0] === '') return false;
		return true;
	}));
};
const basename = (p) => path.basename(p, path.extname(p));

const files = fs.readdirSync(directory);
const videoFiles = extSubset(files, VIDEO_EXTENSIONS, directory);
const subtitleFiles = extSubset(files, SUBTITLE_EXTENSIONS, directory);

const resultMap = new Map(videoFiles.map((v) => [v, undefined]));

const directories = files.filter((v) => {
	return fs.statSync(path.join(directory, v)).isDirectory();
}).map(toPath(directory));

directories.forEach((v) => {
	const files = fs.readdirSync(v);
	subtitleFiles.push(...extSubset(files, SUBTITLE_EXTENSIONS, v));
});

// 숫자 우선 배정
const subtitleNums = numberMap(subtitleFiles);
const videoNums = numberMap(videoFiles);

videoNums.forEach((v, k) => {
	if(subtitleNums.has(k)) {
		const subtitle = subtitleNums.get(k);
		
		resultMap.set(v, subtitle);
		log(`STRATEGY: NUMBER, ${v} => ${subtitle}`);
		
		subtitleNums.delete(k);
		videoNums.delete(k);
		subtitleFiles.splice(subtitleFiles.indexOf(subtitle), 1);
		videoFiles.splice(videoFiles.indexOf(v), 1);
	}
});

// 숫자 거리 배정
if(subtitleNums.length > 0) {
	const subtitleNumsEntries = Array.from(subtitleNums.entries());
	const videoNumsEntries = Array.from(videoNums.entries());
	
	const assignmentMatrix = subtitleNumsEntries.map(
		([subtitleNum, subtitleName]) => {
			return videoNumsEntries.map(
				([videoNum, videoName]) => 1 - compareTwoStrings(`${subtitleNum}`, `${videoNum}`)
			);
		}
	);
	
	munkres(assignmentMatrix).forEach(
		([subtitleNumIdx, videoNumIdx]) => {
			const videoEntry = videoNumsEntries[videoNumIdx];
			const subtitleEntry = subtitleNumsEntries[subtitleNumIdx];
			
			resultMap.set(videoEntry[1], subtitleEntry[1]);
			log(`STRATEGY: NUMBER-DISTANCE, ${subtitleEntry[1]} => ${videoEntry[1]}`);
			
			videoNums.delete(videoEntry[0]);
			subtitleNums.delete(subtitleEntry[0]);
			videoFiles.splice(videoFiles.indexOf(videoEntry[1]), 1);
			subtitleFiles.splice(subtitleFiles.indexOf(subtitleEntry[1]), 1);
		}
	);
}

// 문자 거리 배정
if(subtitleFiles.length > 0) {
	const assignmentMatrix = subtitleFiles.map(
		subtitleName => videoFiles.map(videoName => 1 - compareTwoStrings(subtitleName, videoName))
	);
	
	log(assignmentMatrix, munkres(assignmentMatrix));
	
	munkres(assignmentMatrix).forEach(([subtitleFileIdx, videoFileIdx]) => {
		resultMap.set(videoFiles[videoFileIdx], subtitleFiles[subtitleFileIdx]);
		log(`STRATEGY: LETTER-DISTANCE, ${subtitleFiles[subtitleFileIdx]} => ${videoFiles[videoFileIdx]}`);
		
		// don't delete entries as it is final stage
	});
}

// 적용
resultMap.forEach((subtitle, video) => {
	if(subtitle === undefined) return;
	
	log(subtitle, replaceExt(video, path.extname(subtitle)));
	
	if(!DEBUG_MODE)
		fs.renameSync(subtitle, replaceExt(video, path.extname(subtitle)));
});
