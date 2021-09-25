const regexpToString = (regexp: RegExp) => regexp.toString().match(/\/(.*)\/[igmsuy]*/)![1];

const indexToRowColumn = (content: string, i: number) => ({
	row: content.substring(0, i).split('\n').length - 1,
	column: content.substring(0, i).split('\n').slice(-1)[0].length,
});
const rowColumnToIndex = (content: string, row: number, column: number) => content.split('\n').slice(0, row).join('\n').length + column + 1;

export { regexpToString, indexToRowColumn, rowColumnToIndex };
