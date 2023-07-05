import './debug.js';

const KEYWORD = /[ \t]*#(ifn?def|if|endif|else|elif|define|undef|extension)/g;
const DEFINE = /define[ \t]+([^\n]+)\r?(?:\n|$)/g;
const EXTENSION = /extension[ \t]+([\w-]+)[ \t]*:[ \t]*(enable|require)/g;
const UNDEF = /undef[ \t]+([^\n]+)\r?(?:\n|$)/g;
const IF = /(ifdef|ifndef|if)[ \t]*([^\r\n]+)\r?\n/g;
const ENDIF = /(endif|else|elif)([ \t]+[^\r\n]+)?\r?(?:\n|$)/g;
const IDENTIFIER = /([\w-]+)/;
const DEFINED = /(!|\s)?defined\(([\w-]+)\)/;
const INVALID = /[><=|&+-]/g;
class Preprocessor {
	static run(source) {
		source = source.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
		source = source.split(/\r?\n/).map(line => line.trimEnd()).join('\n');
		source = this._preprocess(source);
		if (source !== null) {
			source = source.split(/\r?\n/).map(line => line.trim() === '' ? '' : line).join('\n');
			source = source.replace(/(\n\n){3,}/gm, '\n\n');
		}
		return source;
	}
	static _preprocess(source) {
		const originalSource = source;
		const stack = [];
		let error = false;
		const defines = new Map();
		let match;
		while ((match = KEYWORD.exec(source)) !== null) {
			const keyword = match[1];
			switch (keyword) {
				case 'define':
					{
						DEFINE.lastIndex = match.index;
						const define = DEFINE.exec(source);
						error || (error = define === null);
						const expression = define[1];
						IDENTIFIER.lastIndex = define.index;
						const identifierValue = IDENTIFIER.exec(expression);
						const identifier = identifierValue[1];
						let value = expression.substring(identifier.length).trim();
						if (value === "") value = "true";
						const keep = Preprocessor._keep(stack);
						if (keep) {
							defines.set(identifier, value);
						}
						KEYWORD.lastIndex = define.index + define[0].length;
						break;
					}
				case 'undef':
					{
						UNDEF.lastIndex = match.index;
						const undef = UNDEF.exec(source);
						const identifier = undef[1].trim();
						const keep = Preprocessor._keep(stack);
						if (keep) {
							defines.delete(identifier);
						}
						KEYWORD.lastIndex = undef.index + undef[0].length;
						break;
					}
				case 'extension':
					{
						EXTENSION.lastIndex = match.index;
						const extension = EXTENSION.exec(source);
						error || (error = extension === null);
						if (extension) {
							const identifier = extension[1];
							const keep = Preprocessor._keep(stack);
							if (keep) {
								defines.set(identifier, "true");
							}
						}
						KEYWORD.lastIndex = extension.index + extension[0].length;
						break;
					}
				case 'ifdef':
				case 'ifndef':
				case 'if':
					{
						IF.lastIndex = match.index;
						const iff = IF.exec(source);
						const expression = iff[2];
						const evaluated = Preprocessor.evaluate(expression, defines);
						error || (error = evaluated.error);
						let result = evaluated.result;
						if (keyword === 'ifndef') {
							result = !result;
						}
						stack.push({
							anyKeep: result,
							keep: result,
							start: match.index,
							end: IF.lastIndex
						});
						KEYWORD.lastIndex = iff.index + iff[0].length;
						break;
					}
				case 'endif':
				case 'else':
				case 'elif':
					{
						ENDIF.lastIndex = match.index;
						const endif = ENDIF.exec(source);
						const blockInfo = stack.pop();
						const blockCode = blockInfo.keep ? source.substring(blockInfo.end, match.index) : "";
						source = source.substring(0, blockInfo.start) + blockCode + source.substring(ENDIF.lastIndex);
						KEYWORD.lastIndex = blockInfo.start + blockCode.length;
						const endifCommand = endif[1];
						if (endifCommand === 'else' || endifCommand === 'elif') {
							let result = false;
							if (!blockInfo.anyKeep) {
								if (endifCommand === 'else') {
									result = !blockInfo.keep;
								} else {
									const evaluated = Preprocessor.evaluate(endif[2], defines);
									result = evaluated.result;
									error || (error = evaluated.error);
								}
							}
							stack.push({
								anyKeep: blockInfo.anyKeep || result,
								keep: result,
								start: KEYWORD.lastIndex,
								end: KEYWORD.lastIndex
							});
						}
						break;
					}
			}
		}
		if (error) {
			console.warn("Failed to preprocess shader: ", {
				source: originalSource
			});
			return originalSource;
		}
		return source;
	}
	static _keep(stack) {
		for (let i = 0; i < stack.length; i++) {
			if (!stack[i].keep) return false;
		}
		return true;
	}
	static evaluate(expression, defines) {
		const correct = INVALID.exec(expression) === null;
		let invert = false;
		const defined = DEFINED.exec(expression);
		if (defined) {
			invert = defined[1] === '!';
			expression = defined[2];
		}
		expression = expression.trim();
		let exists = defines.has(expression);
		if (invert) {
			exists = !exists;
		}
		return {
			result: exists,
			error: !correct
		};
	}
}

export { Preprocessor };
