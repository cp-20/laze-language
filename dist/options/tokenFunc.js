"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rowColumnToIndex = exports.indexToRowColumn = exports.regexpToString = void 0;
const regexpToString = (regexp) => regexp.toString().match(/\/(.*)\/[igmsuy]*/)[1];
exports.regexpToString = regexpToString;
const indexToRowColumn = (content, i) => ({
    row: content.substring(0, i).split('\n').length - 1,
    column: content.substring(0, i).split('\n').slice(-1)[0].length,
});
exports.indexToRowColumn = indexToRowColumn;
const rowColumnToIndex = (content, row, column) => content.split('\n').slice(0, row).join('\n').length + column + 1;
exports.rowColumnToIndex = rowColumnToIndex;
//# sourceMappingURL=tokenFunc.js.map