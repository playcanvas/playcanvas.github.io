import { Vec2 } from '../../../core/math/vec2.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from '../../../scene/constants.js';
import { FITTING_SHRINK, FITTING_BOTH, FITTING_STRETCH, FITTING_NONE } from './constants.js';

const AXIS_MAPPINGS = {};
AXIS_MAPPINGS[ORIENTATION_HORIZONTAL] = {
	axis: 'x',
	size: 'width',
	calculatedSize: 'calculatedWidth',
	minSize: 'minWidth',
	maxSize: 'maxWidth',
	fitting: 'widthFitting',
	fittingProportion: 'fitWidthProportion'
};
AXIS_MAPPINGS[ORIENTATION_VERTICAL] = {
	axis: 'y',
	size: 'height',
	calculatedSize: 'calculatedHeight',
	minSize: 'minHeight',
	maxSize: 'maxHeight',
	fitting: 'heightFitting',
	fittingProportion: 'fitHeightProportion'
};
const OPPOSITE_ORIENTATION = {};
OPPOSITE_ORIENTATION[ORIENTATION_HORIZONTAL] = ORIENTATION_VERTICAL;
OPPOSITE_ORIENTATION[ORIENTATION_VERTICAL] = ORIENTATION_HORIZONTAL;
const PROPERTY_DEFAULTS = {
	minWidth: 0,
	minHeight: 0,
	maxWidth: Number.POSITIVE_INFINITY,
	maxHeight: Number.POSITIVE_INFINITY,
	width: null,
	height: null,
	fitWidthProportion: 0,
	fitHeightProportion: 0
};
const FITTING_ACTION = {
	NONE: 'NONE',
	APPLY_STRETCHING: 'APPLY_STRETCHING',
	APPLY_SHRINKING: 'APPLY_SHRINKING'
};
const availableSpace = new Vec2();
function createCalculator(orientation) {
	let options;
	const a = AXIS_MAPPINGS[orientation];
	const b = AXIS_MAPPINGS[OPPOSITE_ORIENTATION[orientation]];
	function minExtentA(element, size) {
		return -size[a.size] * element.pivot[a.axis];
	}
	function minExtentB(element, size) {
		return -size[b.size] * element.pivot[b.axis];
	}
	function maxExtentA(element, size) {
		return size[a.size] * (1 - element.pivot[a.axis]);
	}
	function calculateAll(allElements, layoutOptions) {
		allElements = allElements.filter(shouldIncludeInLayout);
		options = layoutOptions;
		availableSpace.x = options.containerSize.x - options.padding.x - options.padding.z;
		availableSpace.y = options.containerSize.y - options.padding.y - options.padding.w;
		resetAnchors(allElements);
		const lines = reverseLinesIfRequired(splitLines(allElements));
		const sizes = calculateSizesOnAxisB(lines, calculateSizesOnAxisA(lines));
		const positions = calculateBasePositions(lines, sizes);
		applyAlignmentAndPadding(lines, sizes, positions);
		applySizesAndPositions(lines, sizes, positions);
		return createLayoutInfo(lines);
	}
	function shouldIncludeInLayout(element) {
		const layoutChildComponent = element.entity.layoutchild;
		return !layoutChildComponent || !layoutChildComponent.enabled || !layoutChildComponent.excludeFromLayout;
	}
	function resetAnchors(allElements) {
		for (let i = 0; i < allElements.length; ++i) {
			const element = allElements[i];
			const anchor = element.anchor;
			if (anchor.x !== 0 || anchor.y !== 0 || anchor.z !== 0 || anchor.w !== 0) {
				element.anchor = Vec4.ZERO;
			}
		}
	}
	function splitLines(allElements) {
		if (!options.wrap) {
			return [allElements];
		}
		const lines = [[]];
		const sizes = getElementSizeProperties(allElements);
		let runningSize = 0;
		const allowOverrun = options[a.fitting] === FITTING_SHRINK;
		for (let i = 0; i < allElements.length; ++i) {
			if (lines[lines.length - 1].length > 0) {
				runningSize += options.spacing[a.axis];
			}
			const idealElementSize = sizes[i][a.size];
			runningSize += idealElementSize;
			if (!allowOverrun && runningSize > availableSpace[a.axis] && lines[lines.length - 1].length !== 0) {
				runningSize = idealElementSize;
				lines.push([]);
			}
			lines[lines.length - 1].push(allElements[i]);
			if (allowOverrun && runningSize > availableSpace[a.axis] && i !== allElements.length - 1) {
				runningSize = 0;
				lines.push([]);
			}
		}
		return lines;
	}
	function reverseLinesIfRequired(lines) {
		const reverseAxisA = options.orientation === ORIENTATION_HORIZONTAL && options.reverseX || options.orientation === ORIENTATION_VERTICAL && options.reverseY;
		const reverseAxisB = options.orientation === ORIENTATION_HORIZONTAL && options.reverseY || options.orientation === ORIENTATION_VERTICAL && options.reverseX;
		if (reverseAxisA) {
			for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
				if (reverseAxisA) {
					lines[lineIndex].reverse();
				}
			}
		}
		if (reverseAxisB) {
			lines.reverse();
		}
		return lines;
	}
	function calculateSizesOnAxisA(lines) {
		const sizesAllLines = [];
		for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
			const line = lines[lineIndex];
			const sizesThisLine = getElementSizeProperties(line);
			const idealRequiredSpace = calculateTotalSpace(sizesThisLine, a);
			const fittingAction = determineFittingAction(options[a.fitting], idealRequiredSpace, availableSpace[a.axis]);
			if (fittingAction === FITTING_ACTION.APPLY_STRETCHING) {
				stretchSizesToFitContainer(sizesThisLine, idealRequiredSpace, a);
			} else if (fittingAction === FITTING_ACTION.APPLY_SHRINKING) {
				shrinkSizesToFitContainer(sizesThisLine, idealRequiredSpace, a);
			}
			sizesAllLines.push(sizesThisLine);
		}
		return sizesAllLines;
	}
	function calculateSizesOnAxisB(lines, sizesAllLines) {
		const largestElementsForEachLine = [];
		const largestSizesForEachLine = [];
		for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
			const line = lines[lineIndex];
			line.largestElement = null;
			line.largestSize = {
				width: Number.NEGATIVE_INFINITY,
				height: Number.NEGATIVE_INFINITY
			};
			for (let elementIndex = 0; elementIndex < line.length; ++elementIndex) {
				const sizesThisElement = sizesAllLines[lineIndex][elementIndex];
				if (sizesThisElement[b.size] > line.largestSize[b.size]) {
					line.largestElement = line[elementIndex];
					line.largestSize = sizesThisElement;
				}
			}
			largestElementsForEachLine.push(line.largestElement);
			largestSizesForEachLine.push(line.largestSize);
		}
		const idealRequiredSpace = calculateTotalSpace(largestSizesForEachLine, b);
		const fittingAction = determineFittingAction(options[b.fitting], idealRequiredSpace, availableSpace[b.axis]);
		if (fittingAction === FITTING_ACTION.APPLY_STRETCHING) {
			stretchSizesToFitContainer(largestSizesForEachLine, idealRequiredSpace, b);
		} else if (fittingAction === FITTING_ACTION.APPLY_SHRINKING) {
			shrinkSizesToFitContainer(largestSizesForEachLine, idealRequiredSpace, b);
		}
		for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
			const line = lines[lineIndex];
			for (let elementIndex = 0; elementIndex < line.length; ++elementIndex) {
				const sizesForThisElement = sizesAllLines[lineIndex][elementIndex];
				const currentSize = sizesForThisElement[b.size];
				const availableSize = lines.length === 1 ? availableSpace[b.axis] : line.largestSize[b.size];
				const elementFittingAction = determineFittingAction(options[b.fitting], currentSize, availableSize);
				if (elementFittingAction === FITTING_ACTION.APPLY_STRETCHING) {
					sizesForThisElement[b.size] = Math.min(availableSize, sizesForThisElement[b.maxSize]);
				} else if (elementFittingAction === FITTING_ACTION.APPLY_SHRINKING) {
					sizesForThisElement[b.size] = Math.max(availableSize, sizesForThisElement[b.minSize]);
				}
			}
		}
		return sizesAllLines;
	}
	function determineFittingAction(fittingMode, currentSize, availableSize) {
		switch (fittingMode) {
			case FITTING_NONE:
				return FITTING_ACTION.NONE;
			case FITTING_STRETCH:
				if (currentSize < availableSize) {
					return FITTING_ACTION.APPLY_STRETCHING;
				}
				return FITTING_ACTION.NONE;
			case FITTING_SHRINK:
				if (currentSize >= availableSize) {
					return FITTING_ACTION.APPLY_SHRINKING;
				}
				return FITTING_ACTION.NONE;
			case FITTING_BOTH:
				if (currentSize < availableSize) {
					return FITTING_ACTION.APPLY_STRETCHING;
				}
				return FITTING_ACTION.APPLY_SHRINKING;
			default:
				throw new Error(`Unrecognized fitting mode: ${fittingMode}`);
		}
	}
	function calculateTotalSpace(sizes, axis) {
		const totalSizes = sumValues(sizes, axis.size);
		const totalSpacing = (sizes.length - 1) * options.spacing[axis.axis];
		return totalSizes + totalSpacing;
	}
	function stretchSizesToFitContainer(sizesThisLine, idealRequiredSpace, axis) {
		const ascendingMaxSizeOrder = getTraversalOrder(sizesThisLine, axis.maxSize);
		const fittingProportions = getNormalizedValues(sizesThisLine, axis.fittingProportion);
		const fittingProportionSums = createSumArray(fittingProportions, ascendingMaxSizeOrder);
		let remainingUndershoot = availableSpace[axis.axis] - idealRequiredSpace;
		for (let i = 0; i < sizesThisLine.length; ++i) {
			const index = ascendingMaxSizeOrder[i];
			const targetIncrease = calculateAdjustment(index, remainingUndershoot, fittingProportions, fittingProportionSums);
			const targetSize = sizesThisLine[index][axis.size] + targetIncrease;
			const maxSize = sizesThisLine[index][axis.maxSize];
			const actualSize = Math.min(targetSize, maxSize);
			sizesThisLine[index][axis.size] = actualSize;
			const actualIncrease = Math.max(targetSize - actualSize, 0);
			const appliedIncrease = targetIncrease - actualIncrease;
			remainingUndershoot -= appliedIncrease;
		}
	}
	function shrinkSizesToFitContainer(sizesThisLine, idealRequiredSpace, axis) {
		const descendingMinSizeOrder = getTraversalOrder(sizesThisLine, axis.minSize, true);
		const fittingProportions = getNormalizedValues(sizesThisLine, axis.fittingProportion);
		const inverseFittingProportions = invertNormalizedValues(fittingProportions);
		const inverseFittingProportionSums = createSumArray(inverseFittingProportions, descendingMinSizeOrder);
		let remainingOvershoot = idealRequiredSpace - availableSpace[axis.axis];
		for (let i = 0; i < sizesThisLine.length; ++i) {
			const index = descendingMinSizeOrder[i];
			const targetReduction = calculateAdjustment(index, remainingOvershoot, inverseFittingProportions, inverseFittingProportionSums);
			const targetSize = sizesThisLine[index][axis.size] - targetReduction;
			const minSize = sizesThisLine[index][axis.minSize];
			const actualSize = Math.max(targetSize, minSize);
			sizesThisLine[index][axis.size] = actualSize;
			const actualReduction = Math.max(actualSize - targetSize, 0);
			const appliedReduction = targetReduction - actualReduction;
			remainingOvershoot -= appliedReduction;
		}
	}
	function calculateAdjustment(index, remainingAdjustment, fittingProportions, fittingProportionSums) {
		const proportion = fittingProportions[index];
		const sumOfRemainingProportions = fittingProportionSums[index];
		if (Math.abs(proportion) < 1e-5 && Math.abs(sumOfRemainingProportions) < 1e-5) {
			return remainingAdjustment;
		}
		return remainingAdjustment * proportion / sumOfRemainingProportions;
	}
	function calculateBasePositions(lines, sizes) {
		const cursor = {};
		cursor[a.axis] = 0;
		cursor[b.axis] = 0;
		lines[a.size] = Number.NEGATIVE_INFINITY;
		const positionsAllLines = [];
		for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
			const line = lines[lineIndex];
			if (line.length === 0) {
				positionsAllLines.push([]);
				continue;
			}
			const positionsThisLine = [];
			const sizesThisLine = sizes[lineIndex];
			for (let elementIndex = 0; elementIndex < line.length; ++elementIndex) {
				const element = line[elementIndex];
				const sizesThisElement = sizesThisLine[elementIndex];
				cursor[b.axis] -= minExtentB(element, sizesThisElement);
				cursor[a.axis] -= minExtentA(element, sizesThisElement);
				positionsThisLine[elementIndex] = {};
				positionsThisLine[elementIndex][a.axis] = cursor[a.axis];
				positionsThisLine[elementIndex][b.axis] = cursor[b.axis];
				cursor[b.axis] += minExtentB(element, sizesThisElement);
				cursor[a.axis] += maxExtentA(element, sizesThisElement) + options.spacing[a.axis];
			}
			line[a.size] = cursor[a.axis] - options.spacing[a.axis];
			line[b.size] = line.largestSize[b.size];
			lines[a.size] = Math.max(lines[a.size], line[a.size]);
			cursor[a.axis] = 0;
			cursor[b.axis] += line[b.size] + options.spacing[b.axis];
			positionsAllLines.push(positionsThisLine);
		}
		lines[b.size] = cursor[b.axis] - options.spacing[b.axis];
		return positionsAllLines;
	}
	function applyAlignmentAndPadding(lines, sizes, positions) {
		const alignmentA = options.alignment[a.axis];
		const alignmentB = options.alignment[b.axis];
		const paddingA = options.padding[a.axis];
		const paddingB = options.padding[b.axis];
		for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
			const line = lines[lineIndex];
			const sizesThisLine = sizes[lineIndex];
			const positionsThisLine = positions[lineIndex];
			const axisAOffset = (availableSpace[a.axis] - line[a.size]) * alignmentA + paddingA;
			const axisBOffset = (availableSpace[b.axis] - lines[b.size]) * alignmentB + paddingB;
			for (let elementIndex = 0; elementIndex < line.length; ++elementIndex) {
				const withinLineAxisBOffset = (line[b.size] - sizesThisLine[elementIndex][b.size]) * options.alignment[b.axis];
				positionsThisLine[elementIndex][a.axis] += axisAOffset;
				positionsThisLine[elementIndex][b.axis] += axisBOffset + withinLineAxisBOffset;
			}
		}
	}
	function applySizesAndPositions(lines, sizes, positions) {
		for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
			const line = lines[lineIndex];
			const sizesThisLine = sizes[lineIndex];
			const positionsThisLine = positions[lineIndex];
			for (let elementIndex = 0; elementIndex < line.length; ++elementIndex) {
				const element = line[elementIndex];
				element[a.calculatedSize] = sizesThisLine[elementIndex][a.size];
				element[b.calculatedSize] = sizesThisLine[elementIndex][b.size];
				if (options.orientation === ORIENTATION_HORIZONTAL) {
					element.entity.setLocalPosition(positionsThisLine[elementIndex][a.axis], positionsThisLine[elementIndex][b.axis], element.entity.getLocalPosition().z);
				} else {
					element.entity.setLocalPosition(positionsThisLine[elementIndex][b.axis], positionsThisLine[elementIndex][a.axis], element.entity.getLocalPosition().z);
				}
			}
		}
	}
	function createLayoutInfo(lines) {
		const layoutWidth = lines.width;
		const layoutHeight = lines.height;
		const xOffset = (availableSpace.x - layoutWidth) * options.alignment.x + options.padding.x;
		const yOffset = (availableSpace.y - layoutHeight) * options.alignment.y + options.padding.y;
		return {
			bounds: new Vec4(xOffset, yOffset, layoutWidth, layoutHeight)
		};
	}
	function getElementSizeProperties(elements) {
		const sizeProperties = [];
		for (let i = 0; i < elements.length; ++i) {
			const element = elements[i];
			const minWidth = Math.max(getProperty(element, 'minWidth'), 0);
			const minHeight = Math.max(getProperty(element, 'minHeight'), 0);
			const maxWidth = Math.max(getProperty(element, 'maxWidth'), minWidth);
			const maxHeight = Math.max(getProperty(element, 'maxHeight'), minHeight);
			const width = clamp(getProperty(element, 'width'), minWidth, maxWidth);
			const height = clamp(getProperty(element, 'height'), minHeight, maxHeight);
			const fitWidthProportion = getProperty(element, 'fitWidthProportion');
			const fitHeightProportion = getProperty(element, 'fitHeightProportion');
			sizeProperties.push({
				minWidth: minWidth,
				minHeight: minHeight,
				maxWidth: maxWidth,
				maxHeight: maxHeight,
				width: width,
				height: height,
				fitWidthProportion: fitWidthProportion,
				fitHeightProportion: fitHeightProportion
			});
		}
		return sizeProperties;
	}
	function getProperty(element, propertyName) {
		const layoutChildComponent = element.entity.layoutchild;
		if (layoutChildComponent && layoutChildComponent.enabled && layoutChildComponent[propertyName] !== undefined && layoutChildComponent[propertyName] !== null) {
			return layoutChildComponent[propertyName];
		} else if (element[propertyName] !== undefined) {
			return element[propertyName];
		}
		return PROPERTY_DEFAULTS[propertyName];
	}
	function clamp(value, min, max) {
		return Math.min(Math.max(value, min), max);
	}
	function sumValues(items, propertyName) {
		return items.reduce(function (accumulator, current) {
			return accumulator + current[propertyName];
		}, 0);
	}
	function getNormalizedValues(items, propertyName) {
		const sum = sumValues(items, propertyName);
		const normalizedValues = [];
		const numItems = items.length;
		if (sum === 0) {
			for (let i = 0; i < numItems; ++i) {
				normalizedValues.push(1 / numItems);
			}
		} else {
			for (let i = 0; i < numItems; ++i) {
				normalizedValues.push(items[i][propertyName] / sum);
			}
		}
		return normalizedValues;
	}
	function invertNormalizedValues(values) {
		if (values.length === 1) {
			return [1];
		}
		const invertedValues = [];
		const numValues = values.length;
		for (let i = 0; i < numValues; ++i) {
			invertedValues.push((1 - values[i]) / (numValues - 1));
		}
		return invertedValues;
	}
	function getTraversalOrder(items, orderBy, descending) {
		items.forEach(assignIndex);
		return items.slice().sort(function (itemA, itemB) {
			return descending ? itemB[orderBy] - itemA[orderBy] : itemA[orderBy] - itemB[orderBy];
		}).map(getIndex);
	}
	function assignIndex(item, index) {
		item.index = index;
	}
	function getIndex(item) {
		return item.index;
	}
	function createSumArray(values, order) {
		const sumArray = [];
		sumArray[order[values.length - 1]] = values[order[values.length - 1]];
		for (let i = values.length - 2; i >= 0; --i) {
			sumArray[order[i]] = sumArray[order[i + 1]] + values[order[i]];
		}
		return sumArray;
	}
	return calculateAll;
}
const CALCULATE_FNS = {};
CALCULATE_FNS[ORIENTATION_HORIZONTAL] = createCalculator(ORIENTATION_HORIZONTAL);
CALCULATE_FNS[ORIENTATION_VERTICAL] = createCalculator(ORIENTATION_VERTICAL);
class LayoutCalculator {
	calculateLayout(elements, options) {
		const calculateFn = CALCULATE_FNS[options.orientation];
		if (!calculateFn) {
			throw new Error('Unrecognized orientation value: ' + options.orientation);
		} else {
			return calculateFn(elements, options);
		}
	}
}

export { LayoutCalculator };
