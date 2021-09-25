"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const keywords_1 = require("./options/keywords");
const tokens_1 = require("./options/tokens");
const tokenFunc_1 = require("./options/tokenFunc");
const tokenTypes = new Map();
const tokenModifiers = new Map();
const legend = (function () {
    const tokenTypesLegend = [
        'comment',
        'string',
        'keyword',
        'number',
        'regexp',
        'operator',
        'namespace',
        'type',
        'struct',
        'class',
        'interface',
        'enum',
        'typeParameter',
        'function',
        'method',
        'macro',
        'variable',
        'parameter',
        'property',
        'label',
        'default',
    ];
    tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));
    const tokenModifiersLegend = ['declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated', 'modification', 'async', 'defaultLibrary'];
    tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));
    return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();
let completions = [];
// セマンティック解析
const DocumentSemanticTokensProvider = {
    provideDocumentSemanticTokens: (document) => {
        const content = document.getText();
        const { contentDatas, completionDatas } = TokenProvider(content);
        // トークン
        contentDatas.sort((a, b) => a.index - b.index);
        // スコープ
        completions = [{ type: 'scope', name: '@start_scope', row: 0, column: 0 }];
        completionDatas.sort((a, b) => a.index - b.index);
        completionDatas.forEach((completionData) => {
            const { row, column } = tokenFunc_1.indexToRowColumn(content, completionData.index);
            completions.push({
                type: completionData.type,
                name: completionData.name,
                row: row,
                column: column,
                varType: completionData.varType,
            });
        });
        completions.push({ type: 'scope', name: '@end_scope', row: document.lineCount, column: 0 });
        const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
        contentDatas.forEach(({ index, length, modifier, type }) => {
            const start = tokenFunc_1.indexToRowColumn(content, index);
            const end = tokenFunc_1.indexToRowColumn(content, index + length);
            tokensBuilder.push(new vscode.Range(new vscode.Position(start.row, start.column), new vscode.Position(end.row, end.column)), type, modifier === '' ? [] : [modifier]);
        });
        return tokensBuilder.build();
    },
};
// インテリセンス
const completionItemProvider = {
    provideCompletionItems: CompletionProvider,
};
const selector = { language: 'laze' };
function activate(context) {
    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(selector, DocumentSemanticTokensProvider, legend));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selector, completionItemProvider));
}
exports.activate = activate;
let includes = {};
function TokenProvider(content) {
    var _a, _b, _c;
    const contentDatas = [];
    const completionDatas = [];
    let classes = [];
    //#region コメント
    // ラインコメント //
    for (let match = null; (match = tokens_1.tokenPatterns.comment.line.exec(content));) {
        content = content.substring(0, match.index) + ' '.repeat(match[0].length) + content.substr(match.index + match[0].length);
        contentDatas.push({
            index: match.index,
            length: match[0].length,
            type: 'comment',
            modifier: '',
        });
    }
    // ブロックコメント /* */
    let blockStack = null;
    for (let match = null; (match = tokens_1.tokenPatterns.comment.block.exec(content));) {
        if (match[0] === '/*') {
            // start
            if (blockStack === null) {
                blockStack = match.index;
            }
        }
        else {
            // end
            if (blockStack !== null) {
                const inComment = content.substring(blockStack, match.index + 2).replace(/[^\n]/g, ' ');
                content = content.substring(0, blockStack) + inComment + content.substr(match.index + 2);
                let indexOffset = blockStack;
                for (const line of inComment.split('\n')) {
                    contentDatas.push({
                        index: indexOffset,
                        length: line.length,
                        type: 'comment',
                        modifier: '',
                    });
                    indexOffset += line.length + 1;
                }
                blockStack = null;
            }
        }
    }
    //#endregion
    // include
    for (let match = null; (match = tokens_1.tokenPatterns.syntax.include.exec(content));) {
        const filename = match[2] || match[3];
        if (!Object.keys(includes).includes(filename)) {
            fetch(`/common/${filename}`)
                .then((res) => (res.status === 200 ? res.text() : undefined))
                .then((text) => {
                if (text) {
                    const { completionDatas: classCompletionDatas, classes: classList } = TokenProvider(text);
                    includes[filename] = {
                        completionDatas: classCompletionDatas.filter((data) => data.type === 'class').map((data) => (data.index = 0) || data),
                        classes: classList,
                    };
                }
            })
                .catch((err) => console.error(err));
        }
        if (Object.keys(includes).includes(filename)) {
            completionDatas.push(...includes[filename].completionDatas);
            classes.push(...includes[filename].classes);
        }
    }
    //#region 文字列
    // 文字 ''
    for (let match = null; (match = tokens_1.tokenPatterns.string.char.exec(content));) {
        const inComment = content.substring(match.index, match.index + match[0].length).replace(/[^\n]/g, ' ');
        content = content.substring(0, match.index) + inComment + content.substr(match.index + match[0].length);
        contentDatas.push({
            index: match.index,
            length: match[0].length,
            type: 'string',
            modifier: '',
        });
    }
    // 文字片方 ''
    for (let match = null; (match = tokens_1.tokenPatterns.string.charInvalid.exec(content));) {
        const inComment = content.substring(match.index, match.index + match[0].length).replace(/[^\n]/g, ' ');
        content = content.substring(0, match.index) + inComment + content.substr(match.index + match[0].length);
        contentDatas.push({
            index: match.index,
            length: match[0].length,
            type: 'string',
            modifier: 'invalid',
        });
    }
    // 文字列 ""
    let stringStack = null;
    for (let match = null; (match = tokens_1.tokenPatterns.string.string.exec(content));) {
        if (stringStack !== null) {
            const inString = content.substring(stringStack, match.index + 1).replace(/[^\n]/g, ' ');
            content = content.substring(0, stringStack) + inString + content.substr(match.index + 1);
            let indexOffset = stringStack;
            for (const line of inString.split('\n')) {
                contentDatas.push({
                    index: indexOffset,
                    length: line.length,
                    type: 'string',
                    modifier: '',
                });
                indexOffset += line.length + 1;
            }
            stringStack = null;
        }
        else {
            stringStack = match.index;
        }
    }
    // 文字列片方
    if (stringStack !== null) {
        const lineEnd = content.substr(stringStack).indexOf('\n');
        const inString = content.substring(stringStack, stringStack + lineEnd).replace(/[^\n]/g, ' ');
        content = content.substring(0, stringStack) + inString + content.substr(stringStack + lineEnd);
        contentDatas.push({
            index: stringStack,
            length: lineEnd,
            type: 'string',
            modifier: '',
        });
    }
    // 文字列「」
    let japaneseStack = null;
    for (let match = null; (match = tokens_1.tokenPatterns.string.japanese.exec(content));) {
        if (match[0] === '「') {
            if (japaneseStack === null) {
                japaneseStack = match.index;
            }
        }
        else {
            if (japaneseStack !== null) {
                const inString = content.substring(japaneseStack, match.index + 1).replace(/[^\n]/g, ' ');
                content = content.substring(0, japaneseStack) + inString + content.substr(match.index + 1);
                let indexOffset = japaneseStack;
                for (const line of inString.split('\n')) {
                    contentDatas.push({
                        index: indexOffset,
                        length: line.length,
                        type: 'string',
                        modifier: '',
                    });
                    indexOffset += line.length + 1;
                }
                japaneseStack = null;
            }
        }
    }
    // 文字列片方 「」
    if (japaneseStack !== null) {
        const lineEnd = content.substr(japaneseStack).indexOf('\n');
        const inString = content.substring(japaneseStack, japaneseStack + lineEnd).replace(/[^\n]/g, ' ');
        content = content.substring(0, japaneseStack) + inString + content.substr(japaneseStack + lineEnd);
        contentDatas.push({
            index: japaneseStack,
            length: lineEnd,
            type: 'string',
            modifier: '',
        });
    }
    //#endregion
    // スコープ {}
    for (let match = null; (match = tokens_1.tokenPatterns.scope.exec(content));) {
        completionDatas.push({
            type: 'scope',
            name: '{｛'.includes(match[0]) ? '@start_scope' : '@end_scope',
            index: match.index,
        });
    }
    // テンプレート（宣言）
    for (let match = null; (match = tokens_1.tokenPatterns.template.exec(content));) {
        contentDatas.push({
            index: match.index + match[0].indexOf(match[1]) + match[1].indexOf(match[2]),
            length: match[2].length,
            type: 'class',
            modifier: '',
        });
        classes.push(match[2]);
        completionDatas.push({
            type: 'class',
            name: match[2],
            index: match.index,
        });
    }
    // クラス（宣言）
    for (let match = null; (match = tokens_1.tokenPatterns.class.exec(content));) {
        contentDatas.push({
            index: match.index + match[0].length - match[1].length,
            length: match[1].length,
            type: 'class',
            modifier: '',
        });
        classes.push(match[1]);
        completionDatas.push({
            type: 'class',
            name: match[1],
            index: match.index,
        });
    }
    // typeKeywordsにclassを追加
    let tokenPatternDefineEdit = tokens_1.tokenPatternDefine;
    tokenPatternDefineEdit.typesWithClass = tokens_1.tokenPatternDefine.types.replace(tokens_1.tokens.typeKeywords.join('|') + ')', tokens_1.tokens.typeKeywords.concat(classes).join('|') + ')');
    let tokenPatternsEdit = tokens_1.tokenPatterns;
    tokenPatternsEdit.typesWithClass = new RegExp(tokenFunc_1.regexpToString(tokens_1.tokenPatterns.types).replace(tokens_1.tokens.typeKeywords.join('|') + ')', tokens_1.tokens.typeKeywords.concat(classes).join('|') + ')'), 'g');
    tokenPatternsEdit.functionWithClass = new RegExp(tokenFunc_1.regexpToString(tokens_1.tokenPatterns.function).replace(tokens_1.tokens.typeKeywords.join('|') + ')', tokens_1.tokens.typeKeywords.concat(classes).join('|') + ')'), 'g');
    // テンプレート（呼び出し）
    const templateCall = new RegExp(`(${classes.join('|')})\\s*([<＜]\\s*(${tokens_1.tokens.typeKeywords.concat(classes).join('|')})\\s*[>＞])\\s*${tokens_1.tokens.colon}\\s*(${tokens_1.tokenPatternDefine.name})`, 'g');
    for (let match = null; (match = templateCall.exec(content));) {
        contentDatas.push({
            index: match.index,
            length: match[1].length,
            type: 'class',
            modifier: '',
        });
        contentDatas.push({
            index: match.index + match[0].indexOf(match[2]) + match[2].indexOf(match[3]),
            length: match[3].length,
            type: 'type',
            modifier: '',
        });
        contentDatas.push({
            index: match.index + match[0].length - match[4].length,
            length: match[4].length,
            type: 'variable',
            modifier: '',
        });
        completionDatas.push({
            type: 'variable',
            name: match[4],
            index: match.index + match[0].length - match[4].length,
            varType: match[1],
        });
    }
    // キーワード
    for (let match = null; (match = tokens_1.tokenPatterns.keyword.exec(content));) {
        if (tokens_1.tokens.control.includes(match[0])) {
            contentDatas.push({
                index: match.index,
                length: match[0].length,
                type: 'keyword',
                modifier: '',
            });
            if (match[0] === keywords_1.jaKeywordList.control.private) {
                completionDatas.push({
                    type: 'scope',
                    name: '@private',
                    index: match.index,
                });
            }
            else if (match[0] === keywords_1.jaKeywordList.control.public) {
                completionDatas.push({
                    type: 'scope',
                    name: '@public',
                    index: match.index,
                });
            }
        }
        else if (tokens_1.tokens.keywords.includes(match[0]))
            contentDatas.push({
                index: match.index,
                length: match[0].length,
                type: 'default',
                modifier: '',
            });
    }
    // 関数（宣言・呼び出し）
    let functions = [];
    for (let match = null; (match = tokens_1.tokenPatterns.functionWithClass.exec(content));) {
        if (match[1])
            continue;
        if (!tokens_1.tokens.control.includes(match[3])) {
            if (tokens_1.tokens.functions.includes(match[3])) {
                contentDatas.push({
                    index: match.index + (((_a = match[2]) === null || _a === void 0 ? void 0 : _a.length) || 0),
                    length: match[3].length,
                    type: 'default',
                    modifier: '',
                });
            }
            else {
                contentDatas.push({
                    index: match.index + (((_b = match[2]) === null || _b === void 0 ? void 0 : _b.length) || 0),
                    length: match[3].length,
                    type: 'function',
                    modifier: match[2] ? 'declaration' : '',
                });
            }
        }
        // 宣言時
        if (match[2]) {
            functions.push(match[3]);
            completionDatas.push({
                type: 'function',
                name: match[3],
                index: match.index,
            });
            // スコープ
            let indexOffset = match.index + match[0].length;
            const syntax = content.substr(indexOffset).match(tokens_1.tokenPatterns.syntax.function);
            completionDatas.push({
                type: 'scope',
                name: '@start_func',
                index: (indexOffset += syntax.index || 0),
            }, {
                type: 'scope',
                name: '@end_func',
                index: (indexOffset += 1 + (syntax[1].length || 0)),
            }, {
                type: 'scope',
                name: '@start_func',
                index: (indexOffset += 1 + (syntax[2].length || 0)),
            }, {
                type: 'scope',
                name: '@end_func',
                index: (indexOffset += 1 + (syntax[3].length || 0)),
            });
            if (syntax[4]) {
                completionDatas.push({
                    type: 'scope',
                    name: '@start_scope',
                    index: indexOffset + 1 + (((_c = syntax[4].match(/[\=＝]/)) === null || _c === void 0 ? void 0 : _c.index) || 0),
                }, {
                    type: 'scope',
                    name: '@end_scope',
                    index: (indexOffset += syntax[4].length || 0),
                });
            }
        }
    }
    // 変数
    for (let match = null; (match = tokens_1.tokenPatterns.variable.exec(content));) {
        const name = match[4] || match[3];
        if (!tokens_1.tokens.control.concat(tokens_1.tokens.keywords, tokens_1.tokens.typeKeywords, classes, functions).includes(name)) {
            // 呼び出し
            if (match[4]) {
                contentDatas.push({
                    index: match.index + match[0].length - name.length,
                    length: name.length,
                    type: functions.includes(name) ? 'function' : 'variable',
                    modifier: '',
                });
            }
            // 宣言
            else {
                contentDatas.push({
                    index: match.index + match[0].length - name.length,
                    length: name.length,
                    type: 'variable',
                    modifier: 'declaration',
                });
                completionDatas.push({
                    type: 'variable',
                    name: name,
                    index: match.index + 1 + match[2].length,
                    varType: match[1].match(/([^\s<>]+)(?:<[^\s<>]>)?\s*[:：]\s*/)[1],
                });
            }
        }
    }
    // 型
    for (let match = null; (match = tokens_1.tokenPatterns.typesWithClass.exec(content));) {
        contentDatas.push({
            index: match.index,
            length: match[1].length,
            type: 'typeParameter',
            modifier: '',
        });
    }
    // 数（BIN・DEC・HEX）
    for (let match = null; (match = tokens_1.tokenPatterns.number.exec(content));) {
        contentDatas.push({
            index: match.index + 1,
            length: match[1].length,
            type: 'number',
            modifier: '',
        });
    }
    // オペレーター
    for (let match = null; (match = tokens_1.tokenPatterns.operator.exec(content));) {
        contentDatas.push({
            index: match.index,
            length: match[0].length,
            type: 'operator',
            modifier: '',
        });
    }
    // 特殊構文
    // からまで
    for (let match = null; (match = tokens_1.tokenPatterns.syntax.for.exec(content));) {
        let index = match.index;
        completionDatas.push({
            type: 'scope',
            name: '@start_for_dec',
            index: index,
        }, {
            type: 'scope',
            name: '@end_for_dec',
            index: (index += 1 + match[1].length),
        }, {
            type: 'scope',
            name: '@start_for_condition',
            index: (index += 1 + match[2].length),
        }, {
            type: 'scope',
            name: '@end_for_condition',
            index: (index += 1 + match[3].length),
        }, {
            type: 'scope',
            name: '@start_for_loop',
            index: (index += 1 + match[4].length),
        }, {
            type: 'scope',
            name: '@end_for_loop',
            index: (index += 1 + match[5].length),
        });
    }
    // 回繰り返す
    for (let match = null; (match = tokens_1.tokenPatterns.syntax.repeat.exec(content));) {
        completionDatas.push({
            index: match.index,
            type: 'scope',
            name: '@repeat',
        });
    }
    return {
        contentDatas,
        completionDatas,
        classes,
    };
}
function CompletionProvider(document, position) {
    const content = document.getText();
    const lines = document.getText();
    let insertSnippet = true;
    const suggestions = [];
    let stack = [[]];
    let stackLevel = 0;
    let stackPos = [];
    let forPos = { row: 0, column: 0 };
    let classStack = {
        flag: false,
        name: '',
        level: 0,
        accessType: 'public',
    };
    let classMembers = {};
    completions.forEach((completion, index, array) => {
        if (completion.type === 'scope') {
            switch (completion.name) {
                case '@start_scope':
                    stackLevel++;
                    if (!stack[stackLevel])
                        stack[stackLevel] = [];
                    stackPos[stackLevel] = { row: completion.row, column: completion.column };
                    if (classStack.flag && classStack.level == 0) {
                        classStack.level = stackLevel;
                    }
                    break;
                case '@end_scope':
                    if (position.compareTo(new vscode.Position(stackPos[stackLevel].row, stackPos[stackLevel].column)) > 0 && position.compareTo(new vscode.Position(completion.row, completion.column)) < 0) {
                        // クラスのメンバー補完
                        const offset = tokenFunc_1.rowColumnToIndex(content, position.line, position.character) - 1;
                        const charnum = new RegExp(`[${tokens_1.tokens.charnum}]`);
                        const char = new RegExp(`^\\s*([${tokens_1.tokens.char}]|$|\n)`);
                        let memberFlag = 0;
                        let member = false;
                        for (let i = offset; memberFlag != -1; i--) {
                            if (i < 0)
                                break;
                            if (/\s/.test(content[i]))
                                continue;
                            switch (memberFlag) {
                                case 0:
                                    if (content[i] !== '.') {
                                        if (!charnum.test(content[i]))
                                            memberFlag = -1;
                                    }
                                    else {
                                        if (char.test(content.substr(i + 1)))
                                            memberFlag = 1;
                                        else
                                            memberFlag = -1;
                                    }
                                    break;
                                case 1:
                                    if (i == 0 || !charnum.test(content[i - 1])) {
                                        const match = content.substr(i).match(new RegExp(`^([${tokens_1.tokens.charnum}]*?)\\.`));
                                        if (match) {
                                            const comp = stack[stackLevel].filter((stack) => stack.name === match[1] && stack.type === 'variable');
                                            if (comp.length > 0) {
                                                member = true;
                                                if (comp[0].varType) {
                                                    for (const member of classMembers[comp[0].varType]) {
                                                        if (member.accessType === 'public') {
                                                            suggestions.push({
                                                                label: member.name,
                                                                kind: member.type === 'variable' ? vscode.CompletionItemKind.Variable : vscode.CompletionItemKind.Function,
                                                                insertText: member.name,
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        memberFlag = -1;
                                    }
                                    break;
                            }
                        }
                        if (!member) {
                            stack[stackLevel].forEach((completionItem) => {
                                suggestions.push({
                                    label: completionItem.name,
                                    kind: (() => {
                                        switch (completionItem.type) {
                                            case 'function':
                                                return vscode.CompletionItemKind.Function;
                                            case 'variable':
                                                return vscode.CompletionItemKind.Variable;
                                            case 'class':
                                                return vscode.CompletionItemKind.Class;
                                            default:
                                                return vscode.CompletionItemKind.Text;
                                        }
                                    })(),
                                    insertText: completionItem.name,
                                });
                            });
                        }
                        else {
                            insertSnippet = false;
                        }
                    }
                    if (classStack.flag && classStack.level == stackLevel) {
                        // @ts-ignore
                        classMembers[classStack.name] = stack[stackLevel];
                        classStack = {
                            flag: false,
                            name: '',
                            level: 0,
                            accessType: 'public',
                        };
                    }
                    stack[stackLevel] = [];
                    stackLevel--;
                    break;
                case '@start_for_dec':
                case '@start_func':
                    stackLevel++;
                    if (!stack[stackLevel])
                        stack[stackLevel] = [];
                    break;
                case '@end_for_dec':
                case '@end_func':
                    stackLevel--;
                    break;
                case '@start_for_condition':
                case '@start_for_loop':
                    forPos = { row: completion.row, column: completion.column };
                    break;
                case '@end_for_condition':
                case '@end_for_loop':
                    if (position.compareTo(new vscode.Position(forPos.row, forPos.column)) > 0 && position.compareTo(new vscode.Position(completion.row, completion.column)) < 0) {
                        for (let i = index; i < array.length; i++) {
                            if (array[i].name === '@start_scope') {
                                position = position.with(array[i].row + 1, array[i].column + 2);
                                break;
                            }
                        }
                    }
                    break;
                case '@repeat':
                    if (!stack[stackLevel + 1])
                        stack[stackLevel + 1] = [];
                    stack[stackLevel + 1].push({
                        type: 'variable',
                        name: 'カウンタ',
                        varType: '整数',
                        accessType: classStack.accessType,
                    });
                    break;
                case '@private':
                    classStack.accessType = 'private';
                    break;
                case '@protected':
                    classStack.accessType = 'protected';
                    break;
                case '@public':
                    classStack.accessType = 'public';
                    break;
            }
        }
        else {
            stack[stackLevel].push({
                type: completion.type,
                name: completion.name,
                varType: completion.varType,
                accessType: classStack.accessType,
            });
            if (completion.type === 'class') {
                classStack.flag = true;
                classStack.name = completion.name;
            }
            if (completion.type === 'template') {
                if (!stack[stackLevel + 1])
                    stack[stackLevel + 1] = [];
                stack[stackLevel + 1].push({
                    name: completion.name,
                    type: 'class',
                });
            }
        }
    });
    if (insertSnippet)
        suggestions.push({
            label: '実行',
            kind: vscode.CompletionItemKind.Snippet,
            insertText: ['関数:実行 () => () {', '\t', '}'].join('\n'),
            documentation: ['```', 'メイン実行関数', '', '無：実行() = {', '\t', '}', '```'].join('\n'),
        }, {
            label: 'もし',
            kind: vscode.CompletionItemKind.Snippet,
            insertText: ['もし ( ${1:条件} ) ならば {', '\t$0', '}'].join('\n'),
            documentation: ['```', '条件分岐処理', '', 'もし ( 条件 ) ならば {', '\t', '}', '```'].join('\n'),
        }, {
            label: 'からまで',
            kind: vscode.CompletionItemKind.Snippet,
            insertText: ['(整数：${1:カウンタ} = 0;) から (${1:カウンタ} == ${2:回数}) まで (${1:カウンタ}++;) {', '\t$0', '}'].join('\n'),
            documentation: ['```', '繰り返し処理', '', '(整数：カウンタ = 0;) から (カウンタ == 回数) まで (カウンタ++;) {', '\t', '}', '```'].join('\n'),
        }, {
            label: '回繰り返す',
            kind: vscode.CompletionItemKind.Snippet,
            insertText: ['(${1:回数}) 回繰り返す {', '\t$0', '}'].join('\n'),
            documentation: ['```', '(回数) 回繰り返す {', '\t$0', '}', '```'].join('\n'),
        }, {
            label: '関数',
            kind: vscode.CompletionItemKind.Snippet,
            insertText: ['関数:${1:関数名} (${2:引数}) => (${3:戻り値}) {', '\t$0', '}'].join('\n'),
            documentation: ['```', '関数の宣言', '', '関数:関数名 (引数) => (戻り値) {', '\t', '}', '```'].join('\n'),
        }, {
            label: 'クラス',
            kind: vscode.CompletionItemKind.Snippet,
            insertText: ['クラス:${1:クラス名} {', '\t関数:${1:クラス名} () => () {', '\t\t$0', '\t}', '\t公開:', '\t非公開:', '}'].join('\n'),
            documentation: ['```', 'クラス定義', '', 'クラス:クラス名 {', '\t関数:クラス名 () => () {', '\t\t', '\t}', '\t公開:', '\t非公開:', '}', '```'].join('\n'),
        });
    const provideSuggests = suggestions.map((suggest) => {
        var _a, _b;
        const completion = new vscode.CompletionItem(suggest.label, suggest.kind);
        completion.insertText = new vscode.SnippetString((_a = suggest.insertText) === null || _a === void 0 ? void 0 : _a.toString());
        completion.documentation = new vscode.MarkdownString((_b = suggest.documentation) === null || _b === void 0 ? void 0 : _b.toString());
        return completion;
    });
    return provideSuggests;
}
//# sourceMappingURL=extension.js.map