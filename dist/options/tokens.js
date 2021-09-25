"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenPatterns = exports.tokenPatternDefine = exports.tokens = void 0;
const keywords_1 = require("./keywords");
const tokens = (() => {
    let result = {
        colon: '[:：]',
        binnumber: '[0-1]',
        hexnumber: '[0-9a-fA-F]',
        number: '[0-9]',
        char: '㐀-龯ぁ-んァ-ヶa-zA-Zー#＃_＿',
        charnum: '㐀-龯ぁ-んァ-ヶa-zA-Z0-9ー#＃_＿',
        separators: '~!@\\$%\\^&\\*\\(\\)\\-\\=\\+\\[\\{\\]\\}\\|;\\:\'\\",\\.\\<\\>/\\?＆＊（）＝＋［｛］｝：’”、。＞\\s\\t',
        operator: '＋＝|＋=|\\+＝|\\+=|-＝|-=|＊＝|＊=|\\*＝|\\*=|/＝|/=|\\<＝|\\<=|＞＝|＞=|>＝|>=|＝＝|＝=|=＝|==|＆＆|＆&|&＆|&&|\\|\\||＋＋|＋\\+|\\+＋|\\+\\+|--|=\\>|＝\\>|=＞|＝＞|＝|=|\\<|＜|\\>|＞',
    };
    Object.keys(keywords_1.jaKeywordList).forEach((key) => {
        // @ts-ignore
        result[key] = Object.values(keywords_1.jaKeywordList[key]);
    });
    return result;
})();
exports.tokens = tokens;
const tokenPatternDefine = {
    types: `((?:${tokens.typeKeywords.join('|')})\\s*${tokens.colon}\\s*)`,
    typesWithClass: '',
    name: `[${tokens.char}][${tokens.charnum}]*`,
    separator: `(?:[${tokens.separators}]|^)`,
};
exports.tokenPatternDefine = tokenPatternDefine;
const tokenPatterns = {
    function: new RegExp(`${tokenPatternDefine.types}?(${keywords_1.jaKeywordList.keywords.function}\\s*${tokens.colon}\\s*)?(${tokenPatternDefine.name})(?=\\s*[\\(（])`, 'g'),
    functionWithClass: new RegExp(''),
    template: new RegExp(`${keywords_1.jaKeywordList.keywords.template}\\s*([<＜]\\s*(${tokenPatternDefine.name})\\s*[>＞])\\s*${tokens.colon}`, 'g'),
    class: new RegExp(`${keywords_1.jaKeywordList.keywords.class}\\s*${tokens.colon}\\s*(${tokenPatternDefine.name})`, 'g'),
    keyword: new RegExp(`[${tokens.char}][${tokens.charnum}]*`, 'g'),
    types: new RegExp(`(${tokens.typeKeywords.join('|')})\\s*(?=${tokens.colon})`, 'g'),
    typesWithClass: new RegExp(''),
    variable: new RegExp(`(${tokenPatternDefine.separator}
			(
				${tokenPatternDefine.name}\\s*${tokens.colon}\\s*
			)
			(
				${tokenPatternDefine.name}) | (?:[${tokens.separators.replace('\\:', '')}] | ^
			)
			(
				${tokenPatternDefine.name}
			)
			(?=
				\\s+[^\\(\\{（｛\\s\\:：\\.] | [^${tokens.charnum}\\(\\{（｛\\s\\:]|\\s*$
			)
		)`.replace(/\s/g, ''), 'g'),
    variableWithClass: new RegExp(''),
    number: new RegExp(`${tokenPatternDefine.separator}(0b${tokens.binnumber}+|0x${tokens.hexnumber}+|${tokens.number}(?:${tokens.number}|\\.${tokens.number})*)`, 'g'),
    operator: new RegExp(`(${tokens.operator})`, 'g'),
    scope: new RegExp('[\\{\\}｛｝]', 'g'),
    bracketsAll: new RegExp('[\\{\\}｛｝\\(\\)（）\\[\\]［］]', 'g'),
    brackets: new RegExp('[\\(\\)（）]', 'g'),
    syntax: {
        function: new RegExp('[\\(（](.*)[\\)）](\\s*\\=\\>\\s*)[\\(（](.*?)[\\)）](\\s*[\\=＝].*?(?:;|$))?'),
        for: new RegExp(`[\\(（](.*)[）\\)](\\s*${keywords_1.jaKeywordList.control.from}\\s*)[\\(（](.*)[）\\)](\\s*${keywords_1.jaKeywordList.control.until}\\s*)[\\(（](.*)[）\\)](?:\\s*[{｛}])`, 'g'),
        repeat: new RegExp(`${keywords_1.jaKeywordList.control.repeat}`, 'g'),
        include: new RegExp(`(${keywords_1.jaKeywordList.control.include})\\s+(?:"([^"]*)"|「([^」]*)」)`, 'g'),
    },
    comment: {
        line: new RegExp('\\/\\/.*', 'g'),
        block: new RegExp('/\\*|\\*/', 'g'),
    },
    string: {
        char: new RegExp("\\'.*\\'", 'g'),
        charInvalid: new RegExp("\\'[^\\']*?\n", 'g'),
        string: new RegExp('\\"', 'g'),
        japanese: new RegExp('[「」]', 'g'),
    },
};
exports.tokenPatterns = tokenPatterns;
//# sourceMappingURL=tokens.js.map