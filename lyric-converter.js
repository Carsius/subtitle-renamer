const fs = require('fs');
const leven = require('leven');
const minimist = require('minimist');
const path = require('path');
const replaceExt = require('replace-ext');
const {weigh} = require('common-substrings');

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
const numberMap = (arr) => {
	let minOccurrence = arr.length - 2;
	if(minOccurrence < 4) minOccurrence = arr.length;
	
	const commonSubstrings = weigh(arr.map((v) => basename(v)), {
		minLength: 3, minOccurrence
	});
	
	const map = arr.map((v) => {
		let numericText = basename(v);
		commonSubstrings.forEach((v) => numericText = numericText.replace(v.name, ''));
		numericText = parseFloat(numericText.replace(/[^0-9.]/g, ''));
		
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
		subtitleNums.delete(k);
		videoNums.delete(k);
		
		subtitleFiles.splice(subtitleFiles.indexOf(subtitle), 1);
	}
});

//숫자 거리 배정
videoNums.forEach((videoName, videoNum) => {
	if(subtitleNums.size <= 0) return;
	
	const costMap = Array.from(subtitleNums.entries()).map(([subtitleNum, subtitleName]) => {
		return [leven(videoNum.toString(), subtitleNum.toString()), subtitleName];
	}).sort((v1, v2) => v1[0] - v2[0]);
	
	if(costMap.length === 1 || costMap[0][0] === costMap[1][0]) return;
	
	resultMap.set(videoFileName, costMap[0][1]);
	subtitleFiles.splice(subtitleFiles.indexOf(costMap[0][1]), 1);
});

//문자 거리 배정
videoFiles.forEach((videoFileName) => {
	if(subtitleFiles.length <= 0) return;
	
	const video = basename(videoFileName).toLowerCase();
	const costMap = subtitleFiles.map(
		(v) => [leven(basename(v).toLowerCase(), video), v]
	).sort((v1, v2) => v1[0] - v2[0]);
	
	if(costMap.length === 1 || costMap[0][0] === costMap[1][0]) return;
	
	resultMap.set(videoFileName, costMap[0][1]);
	subtitleFiles.splice(subtitleFiles.indexOf(costMap[0][1]), 1);
});


resultMap.forEach((subtitle, video) => {
	if(subtitle === undefined) return;
	
	fs.renameSync(subtitle, replaceExt(video, path.extname(subtitle)));
});
