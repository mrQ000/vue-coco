#!/usr/bin/env node

"use strict";

/***********************************************************************************************************************
 * VUE-COCO - COMPONENT COMPOSER for VUE
 ***********************************************************************************************************************
 * -> see github repo readme.md for description
 * XREFS
 *	- NPM building - medium.freecodecamp.org/how-to-create-and-publish-your-npm-package-node-module-in-just-10-minutes-b8ca3a100050
 *	- NPM building - blog.npmjs.org/post/118810260230/building-a-simple-command-line-tool-with-npm
 *
 * RELEASE TO NPM
 *      move to project source directory
 *	npm login -> mrq7,...
 *	npm version patch
 *	npm publish
 **********************************************************************************************************************/


// typ. 'C:\\Users\\AAI\\AppData\\Roaming\\npm\\node_modules\\';	// win> set NODE_PATH=%AppData%\npm\node_modules\
const path = require( 'path');
const fsx = require( 'fs-extra');
const chokidar = require( 'chokidar');
const pug = require( 'pug');
const less = require( 'less');

// todo remove?
const FN_LOG= './log.log';

const target= process.argv[2] || '';
const watchmode= process.argv[3] === '--watch';


function log(msg){
	const stamp= new Date();
	fsx.appendFile( FN_LOG, stamp.toISOString()+'\t'+msg+'\n');
}
function throwErr( code, msg) {
	const err= new Error( msg || code);
	err.code= code;
	throw err;
}

function kebabCase( s){
	let r='';
	for( const c of s) {
		if (c>='A' && c<='Z') {
			if (r) r+='-';
			r+= c.toLowerCase();
		}
		else r+= c;
	}
	return r;
}

/**
 * load output file, update/add/remove modified section, save back output file
 *
 * @param outfn - output filename incl. path and extension
 * @param delimtest:string - '// ===== vue-component ===== ${name} ====='
 * @param srcfn:string - name of source file / component
 * @param lines[]:string|undefined - undefined to delete section
 * @throws {code,message} - file error if cant not read/create/write outputfile
 */
function updateOutputFile( outfn, delimtest, srcfn, lines) {
	const [deliml,delimr] = delimtest.split('${name}');
	const mydelim= deliml + srcfn + delimr;

	// load output file
	let f;
	try {
		f= fsx.readFileSync( outfn, 'utf-8').split('\n');
	}
	catch(err) {	// err.code==='ENOENT' when output file does not exist yet
		if (err.code!=='ENOENT') throwErr(err.code, err.message);
		f= [];
	}

	// split into sections (one section per source file)
	const sects= {};
	let sect;
	for( let ln of f) {
		if (ln.startsWith( deliml) && ln.endsWith( delimr)) {
			if ( sects[ln]!==undefined) throwErr( 'VDC_OF_SECTWIN', 'internal fault - section "${ln}" exists twice in output file "${outfn}"');
			sect= sects[ln]= [];
		}
		else {
			if (!sect) throwErr( 'VDC_OF_NOSECT', `internal fault - missing first section delimiter in output file "${outfn}"`);
			sect.push( ln);
		}
	}

	// update/add/remove section
	if (lines === undefined) delete sects[mydelim];
	else 					 sects[mydelim]= lines;

	// save back output file with alpha-sorted sections
	const out=[];
	Object.keys( sects).sort().forEach( sectdelim => {
		const sect= sects[sectdelim];
		out.push( sectdelim);
		out.push( ...sect);
	});
	fsx.outputFileSync( outfn, out.join('\n'));
}

function trimEmptyLines( lines) {

	const firstNoneEmpty= lines.findIndex( ln => ln.trim());
	let lastNoneEmpty = lines.length-1;
	while( lastNoneEmpty>=0 && !lines[lastNoneEmpty].trim()) lastNoneEmpty--;

	lines.splice( lastNoneEmpty+1);
	lines.splice( 0, firstNoneEmpty);
}

/**
 * load source (.vue) file - decompose it into script/style/template parts
 * @param srcFilePath
 * @returns {script:[],style:[],template:[]}
 * @throws {code,message}
 * 		- file error if cant not read from source file
 * 		- VDC_SF_SYNTAX - invalid syntax found in source file
 */
function loadVueFile( srcFilePath) {

	if (!srcFilePath) throwErr( 'VDC_SF_REQUIRED', 'source file required');
	if (!srcFilePath.endsWith( '.vue'))	throwErr( 'VFC_SF_NEED_VUE', 'source file requires extension ".vue"');

	// load source file
	const srcFile= path.parse( srcFilePath);
	const srcLines= fsx.readFileSync( srcFilePath, 'utf-8').split('\n');

	const warnings=[];
	const vue={
		name: srcFile.name,
		dir: srcFile.dir,
		script:[],
		style:[],
		template:[]
	};
	let sect='none';

	/* --- split/decode source file ---
		<script>
			...
		</script>
		<template lang="pug">
			...
		</template>
		<style lang="less">
			...
		</style>
	*/
	srcLines.forEach((ln,iln0) => {

		const ln1= ln.trimRight();
		const iln= iln0+1;

		if (ln1==='<script>') {
			if (sect!=='none') warnings.push(`${iln} - found "<script>" inside <${sect}>`);
			sect= 'script';
		}
		else if (ln1==='</script>') {
			if (sect!=='script') warnings.push(`${iln} -found "</script>" inside <${sect}>`);
			sect= 'none';
		}
		else if (ln1.match(/^<template\s+lang="pug">$/)) {
			if (sect!=='none') warnings.push(`${iln} - found "<template>" inside <${sect}>`);
			sect= 'template';
		}
		else if (ln1==='</template>') {
			if (sect!=='template') warnings.push(`${iln} - found "</template>" inside <${sect}>`);
			sect= 'none';
		}
		else if (ln1.match(/^<style\s+lang="less">$/) || ln1.match(/^<style\s+lang="less" scoped>$/)) {
			if (sect!=='none') warnings.push(`${iln} - found "<style>" inside <${sect}>`);
			sect= 'style';
			vue['style_scoped'] = !!ln1.includes('scoped');
		}
		else if (ln1==='</style>') {
			if (sect!=='style') warnings.push(`${iln} - found "</style>" inside <${sect}>`);
			sect= 'none';
		}
		else if (sect==='none') {  // ignore empty lines while in the 'none' section
			if (ln.trim()) warnings.push( `${iln} - unexpected text outside of script/template/style section: "${ln1}"`);
		}
		else {	// add regular line to script/template/style section
			if (ln.trim() && ln[0]!=='\t' && sect!=='script') warnings.push(`${iln} - Tab-indent missing in content of section <${sect}>`);
			vue[sect].push(ln.substr(1));	// truncate leading \t
		}
	});

	if (warnings.length) throwErr( 'VDC_SF_SYNTAX', 'syntax errors found\n' + warnings.join('\n'));
	return vue;
}

/**
 * load .vue file - decompose it - update output files
 *
 * @param srcFilePath:string - full qualified path and name of .vue file (incl. extension)
 * @param remove:bool - false=add/update .vue file to output; true=remove .vue file from output
 */
async function processVueFile( workingDir, srcFilePath, remove) {

	const dstFilePath= srcFilePath.slice(0,-4) + '.mjs';		// replace .vue with .mjs
	const srcRelFilePath= './' + path.relative( workingDir, srcFilePath);
	console.log( srcRelFilePath, remove ? '- remove  ' : '- add/updt');
	const t0= Date.now();

	try {
		if (remove) {
			fsx.unlinkSync( dstFilePath);
			return;
		}

		const vue = loadVueFile(srcFilePath);

		const compTag = kebabCase( vue.name);		// component's tag
		const compTpl = '#qvc-' + compTag;			// component's template selector
		const compWrp = 'div.qvc-' + compTag;		// component's wrapper selector

		//scope the css main class if requested
		if(vue.style_scoped) {
			const scopeId = `coco-v-${Math.random().toString(36).substring(7)}`;
			//find the main css classname and scope it
			for (let idx in vue.style) {
				const ln = vue.style[idx];
				const css = ln.split(/(\s*)[.](.*?)(\s*)[{]/);
				if (css.length > 1) {
					const mainClass = css[2];
					const scopedClass = `${mainClass}[${scopeId}]`;
					vue.style[idx] = ln.replace(mainClass, scopedClass);
					//replace main css in pug code to.
					for (let pugIdx in vue.template) {
						const pugLn = vue.template[pugIdx];
						if (pugLn.includes(`.${mainClass}`)) {
							const hasopts = pugLn.lastIndexOf(')');
							//extend the options with the scope
							if (hasopts >= 0) {
								vue.template[pugIdx] = pugLn.substring(0, hasopts) + ` ${scopeId} ` + pugLn.substring(hasopts);
							} else {
								const pug = pugLn.match(/(\s*)[.](.*?)(\s*)[\s]/);
								const toReplace = pug ? pug[2] : `.${mainClass}`;
								//add options to the element
								if (pug || pugLn === `.${mainClass}`)
									vue.template[pugIdx] = pugLn.replace(toReplace, `${toReplace}(${scopeId})`);
							}
							break;
						}
					}
					break;
				}
			}
		}

		// tune <template> section
		trimEmptyLines( vue.template);
		vue.html= pug.render( vue.template.join('\n'), {
			filename:`${vue.dir}/${vue.name}.pug`,	// rqd for cache:true
			// cache: true
		});

		// tune <style> section
		trimEmptyLines( vue.style);
		vue.css= await less.render( vue.style.join('\n'), {
			// sourceMap: { sourceMapFileInline: true }
			filename: `${vue.dir}/${vue.name}.less`
		});
		
		// tune <script> section
		trimEmptyLines( vue.script);
		
		// find begin of component definition (to inject "template" there)
		let itpl = vue.script.findIndex(ln => /^\s*export\s+default\s*\{\s*$/.test(ln));	// export default {
		if (itpl < 0) itpl = vue.script.findIndex(ln => /^\s*Vue\.component\s*\(.+\,\s*\{\s*$/.test(ln));	// Vue.component( 'xxx', {
		if (itpl < 0) throwErr( 'VDC_SCRIPT_1', `script requires line "export default {" or "Vue.component( 'xxx', {"`);
		itpl++;
		
		const stpl= vue.html.replace(/`/g,'\\\`');	// escape back-tick quotes

		// generate and save output file (.mjs)
		const out=[
			`const st = document.createElement("style");`,					// comp. style/css
			`st.innerHTML = \`${vue.css.css}\`;`,
			`document.getElementsByTagName("head")[0].appendChild(st);`,		
			...vue.script.slice(0,Math.max(0,itpl)),						// comp. definition start/js
			`\ttemplate:\`${stpl}\`,`,										// comp. template/html
			...vue.script.slice(itpl)										// comp. definition tail/js
		];		

		fsx.outputFileSync( dstFilePath, out.join('\n'));
	}
	catch(err) {

		let title,info,code;

		if (err.constructor.name==='LessError') {
			title = `#${err.line}:${err.column} - LESS error - ${err.message}`;
			info  = err.extract.map( ln => ln||'');	// override undefined lines with ''
			code  = 'less.'+err.type.toLowerCase();
		}
		else {
			const tmp = err.message.split('\n');
			title = tmp[0];
			info  = tmp.slice(1);
			code  = err.code;
		}

		console.error( '-----');
		console.error( srcRelFilePath, '-', code, '-', title);
		info.forEach(ln => console.error('\t' + ln));

		console.log( srcRelFilePath, remove ? '- remove  ' : '- add/updt', `... ${Date.now()-t0}ms`);

		// signal error condition 
		// (when running as file-wacher only!)		
		if (!watchmode) process.exit(1); 
	}
}

let workingDir;
const jobs=[];
function addJob( path, remove) {
	const j= jobs.findIndex( job => job.path===path);
	if (j>=0) jobs.splice( j, 1);		// remove any pending twin-job
	jobs.push({
		path,
		remove,
		stamp:Date.now()
	});
	// immediately start job processing if we just added the very first job to the queue
	if (jobs.length===1) {
		do {
			const job = jobs.shift();							// take job from queue and process it
			processVueFile(workingDir, job.path, job.remove);
		} while( jobs.length);									// repeat processing until queue empty
	}
}

function startWatcher( workingDirRel){

	// note: __dirname is the executeable's location (and therefore not useful here)
	workingDir= path.resolve( workingDirRel).replace(/\\/g,'/'); // chokidar supports '/' only (and not '\')
	const filter= `${workingDir}/**/*.vue`;
	const ignored= '**/node_modules/**';

	console.log( `watcher starts looking out for "${filter}", but not "${ignored}"`);

	const watcher= chokidar.watch( filter, {ignored: ignored});
	watcher.on('ready', () => console.log( 'VDC ready'));
	watcher.on('error', err => console.error( 'VDC_ERROR', err));	// global watcher - does NOT need process.exit(1)
	watcher.on('add', path => addJob( path, false));
	watcher.on('change', path => addJob( path, false));
	watcher.on('unlink', path => addJob( path, true));
}


// help requested
if (['','-h','h','-help','help'].includes( target)) {
	console.log('vue-coco <filename>.vue ... process single file immediately');
	console.log('vue-coco <path> --watch ... install watcher for "<path>/**/*.vue"');
}

// install watcher for given path
else if (watchmode) {
	startWatcher( target || './');
}

// process a single file immediately
else {
	const srcFilePath= path.resolve( target);
	const srcFile= path.parse( srcFilePath);	
	
	console.log( `composing Vue component "${srcFilePath}"`);
	processVueFile( srcFile.dir, srcFilePath, false);
}
