/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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

// The layout logic is largely identical for the horizontal and vertical orientations,
// with the exception of a few bits of swizzling re the primary and secondary axes to
// use etc. This function generates a calculator for a given orientation, with each of
// the swizzled properties conveniently placed in closure scope.
function createCalculator(orientation) {
  let options;

  // Choose which axes to operate on based on the orientation that we're using. For
  // brevity as they are used a lot, these are shortened to just 'a' and 'b', which
  // represent the primary and secondary axes.
  const a = AXIS_MAPPINGS[orientation];
  const b = AXIS_MAPPINGS[OPPOSITE_ORIENTATION[orientation]];

  // Calculates the left/top extent of an element based on its position and pivot value
  function minExtentA(element, size) {
    return -size[a.size] * element.pivot[a.axis];
  } // eslint-disable-line
  function minExtentB(element, size) {
    return -size[b.size] * element.pivot[b.axis];
  } // eslint-disable-line

  // Calculates the right/bottom extent of an element based on its position and pivot value
  function maxExtentA(element, size) {
    return size[a.size] * (1 - element.pivot[a.axis]);
  } // eslint-disable-line

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

  // Setting the anchors of child elements to anything other than 0,0,0,0 results
  // in positioning that is hard to reason about for the user. Forcing the anchors
  // to 0,0,0,0 gives us more predictable positioning, and also has the benefit of
  // ensuring that the element is not in split anchors mode on either axis.
  function resetAnchors(allElements) {
    for (let i = 0; i < allElements.length; ++i) {
      const element = allElements[i];
      const anchor = element.anchor;
      if (anchor.x !== 0 || anchor.y !== 0 || anchor.z !== 0 || anchor.w !== 0) {
        element.anchor = Vec4.ZERO;
      }
    }
  }

  // Returns a 2D array of elements broken down into lines, based on the size of
  // each element and whether the `wrap` property is set.
  function splitLines(allElements) {
    if (!options.wrap) {
      // If wrapping is disabled, we just put all elements into a single line.
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

      // For the None, Stretch and Both fitting modes, we should break to a new
      // line before we overrun the available space in the container.
      if (!allowOverrun && runningSize > availableSpace[a.axis] && lines[lines.length - 1].length !== 0) {
        runningSize = idealElementSize;
        lines.push([]);
      }
      lines[lines.length - 1].push(allElements[i]);

      // For the Shrink fitting mode, we should break to a new line immediately
      // after we've overrun the available space in the container.
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

  // Calculate the required size for each element along axis A, based on the requested
  // fitting mode.
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

  // Calculate the required size for each element on axis B, based on the requested
  // fitting mode.
  function calculateSizesOnAxisB(lines, sizesAllLines) {
    const largestElementsForEachLine = [];
    const largestSizesForEachLine = [];

    // Find the largest element on each line.
    for (let lineIndex = 0; lineIndex < lines.length; ++lineIndex) {
      const line = lines[lineIndex];
      line.largestElement = null;
      line.largestSize = {
        width: Number.NEGATIVE_INFINITY,
        height: Number.NEGATIVE_INFINITY
      };

      // Find the largest element on this line.
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

    // Calculate line heights using the largest element on each line.
    const idealRequiredSpace = calculateTotalSpace(largestSizesForEachLine, b);
    const fittingAction = determineFittingAction(options[b.fitting], idealRequiredSpace, availableSpace[b.axis]);
    if (fittingAction === FITTING_ACTION.APPLY_STRETCHING) {
      stretchSizesToFitContainer(largestSizesForEachLine, idealRequiredSpace, b);
    } else if (fittingAction === FITTING_ACTION.APPLY_SHRINKING) {
      shrinkSizesToFitContainer(largestSizesForEachLine, idealRequiredSpace, b);
    }

    // Calculate sizes for other elements based on the height of the line they're on.
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

    // Start by working out how much we have to stretch the child elements by
    // in total in order to fill the available space in the container
    let remainingUndershoot = availableSpace[axis.axis] - idealRequiredSpace;
    for (let i = 0; i < sizesThisLine.length; ++i) {
      // As some elements may have a maximum size defined, we might not be
      // able to scale all elements by the ideal amount necessary in order
      // to fill the available space. To account for this, we run through
      // the elements in ascending order of their maximum size, redistributing
      // any remaining space to the other elements that are more able to
      // make use of it.
      const index = ascendingMaxSizeOrder[i];

      // Work out how much we ideally want to stretch this element by, based
      // on the amount of space remaining and the fitting proportion value that
      // was specified.
      const targetIncrease = calculateAdjustment(index, remainingUndershoot, fittingProportions, fittingProportionSums);
      const targetSize = sizesThisLine[index][axis.size] + targetIncrease;

      // Work out how much we're actually able to stretch this element by,
      // based on its maximum size, and apply the result.
      const maxSize = sizesThisLine[index][axis.maxSize];
      const actualSize = Math.min(targetSize, maxSize);
      sizesThisLine[index][axis.size] = actualSize;

      // Work out how much of the total undershoot value we've just used,
      // and decrement the remaining value by this much.
      const actualIncrease = Math.max(targetSize - actualSize, 0);
      const appliedIncrease = targetIncrease - actualIncrease;
      remainingUndershoot -= appliedIncrease;
    }
  }

  // This loop is very similar to the one in stretchSizesToFitContainer() above,
  // but with some awkward inversions and use of min as opposed to max etc that
  // mean a more generalized version would probably be harder to read/debug than
  // just having a small amount of duplication.
  function shrinkSizesToFitContainer(sizesThisLine, idealRequiredSpace, axis) {
    const descendingMinSizeOrder = getTraversalOrder(sizesThisLine, axis.minSize, true);
    const fittingProportions = getNormalizedValues(sizesThisLine, axis.fittingProportion);
    const inverseFittingProportions = invertNormalizedValues(fittingProportions);
    const inverseFittingProportionSums = createSumArray(inverseFittingProportions, descendingMinSizeOrder);
    let remainingOvershoot = idealRequiredSpace - availableSpace[axis.axis];
    for (let i = 0; i < sizesThisLine.length; ++i) {
      const index = descendingMinSizeOrder[i];

      // Similar to the stretch calculation above, we calculate the ideal
      // size reduction value for this element based on its fitting proportion.
      // However, note that we're using the inverse of the fitting value, as
      // using the regular value would mean that an element with a fitting
      // value of, say, 0.4, ends up rendering very small when shrinking is
      // being applied. Using the inverse means that the balance of sizes
      // between elements is similar for both the Stretch and Shrink modes.
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

  // Calculate base positions based on the element sizes and spacing.
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

      // Distribute elements along the line
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

      // Record the size of the overall line
      line[a.size] = cursor[a.axis] - options.spacing[a.axis];
      line[b.size] = line.largestSize[b.size];

      // Keep track of the longest line
      lines[a.size] = Math.max(lines[a.size], line[a.size]);

      // Move the cursor to the next line
      cursor[a.axis] = 0;
      cursor[b.axis] += line[b.size] + options.spacing[b.axis];
      positionsAllLines.push(positionsThisLine);
    }

    // Record the size of the full set of lines
    lines[b.size] = cursor[b.axis] - options.spacing[b.axis];
    return positionsAllLines;
  }

  // Adjust base positions to account for the requested alignment and padding.
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

  // Applies the final calculated sizes and positions back to elements themselves.
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

  // Reads all size-related properties for each element and applies some basic
  // sanitization to ensure that minWidth is greater than 0, maxWidth is greater
  // than minWidth, etc.
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

  // When reading an element's width/height, minWidth/minHeight etc, we have to look in
  // a few different places in order. This is because the presence of a LayoutChildComponent
  // on each element is optional, and each property value also has a set of fallback defaults
  // to be used in cases where no value is specified.
  function getProperty(element, propertyName) {
    const layoutChildComponent = element.entity.layoutchild;

    // First attempt to get the value from the element's LayoutChildComponent, if present.
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
    // Guard against divide by zero error in the inversion calculation below
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

  // Returns a new array containing the sums of the values in the original array,
  // running from right to left.
  // For example, given: [0.2, 0.2, 0.3, 0.1, 0.2]
  // Will return:        [1.0, 0.8, 0.6, 0.3, 0.2]
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

/**
 * Used to manage layout calculations for {@link LayoutGroupComponent}s.
 *
 * @ignore
 */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5b3V0LWNhbGN1bGF0b3IuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvY29tcG9uZW50cy9sYXlvdXQtZ3JvdXAvbGF5b3V0LWNhbGN1bGF0b3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IE9SSUVOVEFUSU9OX0hPUklaT05UQUwsIE9SSUVOVEFUSU9OX1ZFUlRJQ0FMIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgRklUVElOR19CT1RILCBGSVRUSU5HX05PTkUsIEZJVFRJTkdfU0hSSU5LLCBGSVRUSU5HX1NUUkVUQ0ggfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbmNvbnN0IEFYSVNfTUFQUElOR1MgPSB7fTtcblxuQVhJU19NQVBQSU5HU1tPUklFTlRBVElPTl9IT1JJWk9OVEFMXSA9IHtcbiAgICBheGlzOiAneCcsXG4gICAgc2l6ZTogJ3dpZHRoJyxcbiAgICBjYWxjdWxhdGVkU2l6ZTogJ2NhbGN1bGF0ZWRXaWR0aCcsXG4gICAgbWluU2l6ZTogJ21pbldpZHRoJyxcbiAgICBtYXhTaXplOiAnbWF4V2lkdGgnLFxuICAgIGZpdHRpbmc6ICd3aWR0aEZpdHRpbmcnLFxuICAgIGZpdHRpbmdQcm9wb3J0aW9uOiAnZml0V2lkdGhQcm9wb3J0aW9uJ1xufTtcblxuQVhJU19NQVBQSU5HU1tPUklFTlRBVElPTl9WRVJUSUNBTF0gPSB7XG4gICAgYXhpczogJ3knLFxuICAgIHNpemU6ICdoZWlnaHQnLFxuICAgIGNhbGN1bGF0ZWRTaXplOiAnY2FsY3VsYXRlZEhlaWdodCcsXG4gICAgbWluU2l6ZTogJ21pbkhlaWdodCcsXG4gICAgbWF4U2l6ZTogJ21heEhlaWdodCcsXG4gICAgZml0dGluZzogJ2hlaWdodEZpdHRpbmcnLFxuICAgIGZpdHRpbmdQcm9wb3J0aW9uOiAnZml0SGVpZ2h0UHJvcG9ydGlvbidcbn07XG5cbmNvbnN0IE9QUE9TSVRFX09SSUVOVEFUSU9OID0ge307XG5PUFBPU0lURV9PUklFTlRBVElPTltPUklFTlRBVElPTl9IT1JJWk9OVEFMXSA9IE9SSUVOVEFUSU9OX1ZFUlRJQ0FMO1xuT1BQT1NJVEVfT1JJRU5UQVRJT05bT1JJRU5UQVRJT05fVkVSVElDQUxdID0gT1JJRU5UQVRJT05fSE9SSVpPTlRBTDtcblxuY29uc3QgUFJPUEVSVFlfREVGQVVMVFMgPSB7XG4gICAgbWluV2lkdGg6IDAsXG4gICAgbWluSGVpZ2h0OiAwLFxuICAgIG1heFdpZHRoOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksXG4gICAgbWF4SGVpZ2h0OiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksXG4gICAgd2lkdGg6IG51bGwsXG4gICAgaGVpZ2h0OiBudWxsLFxuICAgIGZpdFdpZHRoUHJvcG9ydGlvbjogMCxcbiAgICBmaXRIZWlnaHRQcm9wb3J0aW9uOiAwXG59O1xuXG5jb25zdCBGSVRUSU5HX0FDVElPTiA9IHtcbiAgICBOT05FOiAnTk9ORScsXG4gICAgQVBQTFlfU1RSRVRDSElORzogJ0FQUExZX1NUUkVUQ0hJTkcnLFxuICAgIEFQUExZX1NIUklOS0lORzogJ0FQUExZX1NIUklOS0lORydcbn07XG5cbmNvbnN0IGF2YWlsYWJsZVNwYWNlID0gbmV3IFZlYzIoKTtcblxuLy8gVGhlIGxheW91dCBsb2dpYyBpcyBsYXJnZWx5IGlkZW50aWNhbCBmb3IgdGhlIGhvcml6b250YWwgYW5kIHZlcnRpY2FsIG9yaWVudGF0aW9ucyxcbi8vIHdpdGggdGhlIGV4Y2VwdGlvbiBvZiBhIGZldyBiaXRzIG9mIHN3aXp6bGluZyByZSB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGF4ZXMgdG9cbi8vIHVzZSBldGMuIFRoaXMgZnVuY3Rpb24gZ2VuZXJhdGVzIGEgY2FsY3VsYXRvciBmb3IgYSBnaXZlbiBvcmllbnRhdGlvbiwgd2l0aCBlYWNoIG9mXG4vLyB0aGUgc3dpenpsZWQgcHJvcGVydGllcyBjb252ZW5pZW50bHkgcGxhY2VkIGluIGNsb3N1cmUgc2NvcGUuXG5mdW5jdGlvbiBjcmVhdGVDYWxjdWxhdG9yKG9yaWVudGF0aW9uKSB7XG4gICAgbGV0IG9wdGlvbnM7XG5cbiAgICAvLyBDaG9vc2Ugd2hpY2ggYXhlcyB0byBvcGVyYXRlIG9uIGJhc2VkIG9uIHRoZSBvcmllbnRhdGlvbiB0aGF0IHdlJ3JlIHVzaW5nLiBGb3JcbiAgICAvLyBicmV2aXR5IGFzIHRoZXkgYXJlIHVzZWQgYSBsb3QsIHRoZXNlIGFyZSBzaG9ydGVuZWQgdG8ganVzdCAnYScgYW5kICdiJywgd2hpY2hcbiAgICAvLyByZXByZXNlbnQgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBheGVzLlxuICAgIGNvbnN0IGEgPSBBWElTX01BUFBJTkdTW29yaWVudGF0aW9uXTtcbiAgICBjb25zdCBiID0gQVhJU19NQVBQSU5HU1tPUFBPU0lURV9PUklFTlRBVElPTltvcmllbnRhdGlvbl1dO1xuXG4gICAgLy8gQ2FsY3VsYXRlcyB0aGUgbGVmdC90b3AgZXh0ZW50IG9mIGFuIGVsZW1lbnQgYmFzZWQgb24gaXRzIHBvc2l0aW9uIGFuZCBwaXZvdCB2YWx1ZVxuICAgIGZ1bmN0aW9uIG1pbkV4dGVudEEoZWxlbWVudCwgc2l6ZSkge3JldHVybiAtc2l6ZVthLnNpemVdICogZWxlbWVudC5waXZvdFthLmF4aXNdOyB9ICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgZnVuY3Rpb24gbWluRXh0ZW50QihlbGVtZW50LCBzaXplKSB7IHJldHVybiAtc2l6ZVtiLnNpemVdICogZWxlbWVudC5waXZvdFtiLmF4aXNdOyB9IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblxuICAgIC8vIENhbGN1bGF0ZXMgdGhlIHJpZ2h0L2JvdHRvbSBleHRlbnQgb2YgYW4gZWxlbWVudCBiYXNlZCBvbiBpdHMgcG9zaXRpb24gYW5kIHBpdm90IHZhbHVlXG4gICAgZnVuY3Rpb24gbWF4RXh0ZW50QShlbGVtZW50LCBzaXplKSB7IHJldHVybiAgc2l6ZVthLnNpemVdICogKDEgLSBlbGVtZW50LnBpdm90W2EuYXhpc10pOyB9IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICBmdW5jdGlvbiBtYXhFeHRlbnRCKGVsZW1lbnQsIHNpemUpIHsgcmV0dXJuICBzaXplW2Iuc2l6ZV0gKiAoMSAtIGVsZW1lbnQucGl2b3RbYi5heGlzXSk7IH0gLy8gZXNsaW50LWRpc2FibGUtbGluZVxuXG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlQWxsKGFsbEVsZW1lbnRzLCBsYXlvdXRPcHRpb25zKSB7XG4gICAgICAgIGFsbEVsZW1lbnRzID0gYWxsRWxlbWVudHMuZmlsdGVyKHNob3VsZEluY2x1ZGVJbkxheW91dCk7XG4gICAgICAgIG9wdGlvbnMgPSBsYXlvdXRPcHRpb25zO1xuXG4gICAgICAgIGF2YWlsYWJsZVNwYWNlLnggPSBvcHRpb25zLmNvbnRhaW5lclNpemUueCAtIG9wdGlvbnMucGFkZGluZy54IC0gb3B0aW9ucy5wYWRkaW5nLno7XG4gICAgICAgIGF2YWlsYWJsZVNwYWNlLnkgPSBvcHRpb25zLmNvbnRhaW5lclNpemUueSAtIG9wdGlvbnMucGFkZGluZy55IC0gb3B0aW9ucy5wYWRkaW5nLnc7XG5cbiAgICAgICAgcmVzZXRBbmNob3JzKGFsbEVsZW1lbnRzKTtcblxuICAgICAgICBjb25zdCBsaW5lcyA9IHJldmVyc2VMaW5lc0lmUmVxdWlyZWQoc3BsaXRMaW5lcyhhbGxFbGVtZW50cykpO1xuICAgICAgICBjb25zdCBzaXplcyA9IGNhbGN1bGF0ZVNpemVzT25BeGlzQihsaW5lcywgY2FsY3VsYXRlU2l6ZXNPbkF4aXNBKGxpbmVzKSk7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9ucyA9IGNhbGN1bGF0ZUJhc2VQb3NpdGlvbnMobGluZXMsIHNpemVzKTtcblxuICAgICAgICBhcHBseUFsaWdubWVudEFuZFBhZGRpbmcobGluZXMsIHNpemVzLCBwb3NpdGlvbnMpO1xuICAgICAgICBhcHBseVNpemVzQW5kUG9zaXRpb25zKGxpbmVzLCBzaXplcywgcG9zaXRpb25zKTtcblxuICAgICAgICByZXR1cm4gY3JlYXRlTGF5b3V0SW5mbyhsaW5lcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2hvdWxkSW5jbHVkZUluTGF5b3V0KGVsZW1lbnQpIHtcbiAgICAgICAgY29uc3QgbGF5b3V0Q2hpbGRDb21wb25lbnQgPSBlbGVtZW50LmVudGl0eS5sYXlvdXRjaGlsZDtcblxuICAgICAgICByZXR1cm4gIWxheW91dENoaWxkQ29tcG9uZW50IHx8ICFsYXlvdXRDaGlsZENvbXBvbmVudC5lbmFibGVkIHx8ICFsYXlvdXRDaGlsZENvbXBvbmVudC5leGNsdWRlRnJvbUxheW91dDtcbiAgICB9XG5cbiAgICAvLyBTZXR0aW5nIHRoZSBhbmNob3JzIG9mIGNoaWxkIGVsZW1lbnRzIHRvIGFueXRoaW5nIG90aGVyIHRoYW4gMCwwLDAsMCByZXN1bHRzXG4gICAgLy8gaW4gcG9zaXRpb25pbmcgdGhhdCBpcyBoYXJkIHRvIHJlYXNvbiBhYm91dCBmb3IgdGhlIHVzZXIuIEZvcmNpbmcgdGhlIGFuY2hvcnNcbiAgICAvLyB0byAwLDAsMCwwIGdpdmVzIHVzIG1vcmUgcHJlZGljdGFibGUgcG9zaXRpb25pbmcsIGFuZCBhbHNvIGhhcyB0aGUgYmVuZWZpdCBvZlxuICAgIC8vIGVuc3VyaW5nIHRoYXQgdGhlIGVsZW1lbnQgaXMgbm90IGluIHNwbGl0IGFuY2hvcnMgbW9kZSBvbiBlaXRoZXIgYXhpcy5cbiAgICBmdW5jdGlvbiByZXNldEFuY2hvcnMoYWxsRWxlbWVudHMpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxFbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IGFsbEVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgY29uc3QgYW5jaG9yID0gZWxlbWVudC5hbmNob3I7XG5cbiAgICAgICAgICAgIGlmIChhbmNob3IueCAhPT0gMCB8fCBhbmNob3IueSAhPT0gMCB8fCBhbmNob3IueiAhPT0gMCB8fCBhbmNob3IudyAhPT0gMCkge1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuYW5jaG9yID0gVmVjNC5aRVJPO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmV0dXJucyBhIDJEIGFycmF5IG9mIGVsZW1lbnRzIGJyb2tlbiBkb3duIGludG8gbGluZXMsIGJhc2VkIG9uIHRoZSBzaXplIG9mXG4gICAgLy8gZWFjaCBlbGVtZW50IGFuZCB3aGV0aGVyIHRoZSBgd3JhcGAgcHJvcGVydHkgaXMgc2V0LlxuICAgIGZ1bmN0aW9uIHNwbGl0TGluZXMoYWxsRWxlbWVudHMpIHtcbiAgICAgICAgaWYgKCFvcHRpb25zLndyYXApIHtcbiAgICAgICAgICAgIC8vIElmIHdyYXBwaW5nIGlzIGRpc2FibGVkLCB3ZSBqdXN0IHB1dCBhbGwgZWxlbWVudHMgaW50byBhIHNpbmdsZSBsaW5lLlxuICAgICAgICAgICAgcmV0dXJuIFthbGxFbGVtZW50c107XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsaW5lcyA9IFtbXV07XG4gICAgICAgIGNvbnN0IHNpemVzID0gZ2V0RWxlbWVudFNpemVQcm9wZXJ0aWVzKGFsbEVsZW1lbnRzKTtcbiAgICAgICAgbGV0IHJ1bm5pbmdTaXplID0gMDtcbiAgICAgICAgY29uc3QgYWxsb3dPdmVycnVuID0gKG9wdGlvbnNbYS5maXR0aW5nXSA9PT0gRklUVElOR19TSFJJTkspO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsRWxlbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChsaW5lc1tsaW5lcy5sZW5ndGggLSAxXS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcnVubmluZ1NpemUgKz0gb3B0aW9ucy5zcGFjaW5nW2EuYXhpc107XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGlkZWFsRWxlbWVudFNpemUgPSBzaXplc1tpXVthLnNpemVdO1xuICAgICAgICAgICAgcnVubmluZ1NpemUgKz0gaWRlYWxFbGVtZW50U2l6ZTtcblxuICAgICAgICAgICAgLy8gRm9yIHRoZSBOb25lLCBTdHJldGNoIGFuZCBCb3RoIGZpdHRpbmcgbW9kZXMsIHdlIHNob3VsZCBicmVhayB0byBhIG5ld1xuICAgICAgICAgICAgLy8gbGluZSBiZWZvcmUgd2Ugb3ZlcnJ1biB0aGUgYXZhaWxhYmxlIHNwYWNlIGluIHRoZSBjb250YWluZXIuXG4gICAgICAgICAgICBpZiAoIWFsbG93T3ZlcnJ1biAmJiBydW5uaW5nU2l6ZSA+IGF2YWlsYWJsZVNwYWNlW2EuYXhpc10gJiYgbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgcnVubmluZ1NpemUgPSBpZGVhbEVsZW1lbnRTaXplO1xuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2goW10pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXS5wdXNoKGFsbEVsZW1lbnRzW2ldKTtcblxuICAgICAgICAgICAgLy8gRm9yIHRoZSBTaHJpbmsgZml0dGluZyBtb2RlLCB3ZSBzaG91bGQgYnJlYWsgdG8gYSBuZXcgbGluZSBpbW1lZGlhdGVseVxuICAgICAgICAgICAgLy8gYWZ0ZXIgd2UndmUgb3ZlcnJ1biB0aGUgYXZhaWxhYmxlIHNwYWNlIGluIHRoZSBjb250YWluZXIuXG4gICAgICAgICAgICBpZiAoYWxsb3dPdmVycnVuICYmIHJ1bm5pbmdTaXplID4gYXZhaWxhYmxlU3BhY2VbYS5heGlzXSAmJiBpICE9PSBhbGxFbGVtZW50cy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAgICAgcnVubmluZ1NpemUgPSAwO1xuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2goW10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxpbmVzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJldmVyc2VMaW5lc0lmUmVxdWlyZWQobGluZXMpIHtcbiAgICAgICAgY29uc3QgcmV2ZXJzZUF4aXNBID0gKG9wdGlvbnMub3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX0hPUklaT05UQUwgJiYgb3B0aW9ucy5yZXZlcnNlWCkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG9wdGlvbnMub3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX1ZFUlRJQ0FMICAgJiYgb3B0aW9ucy5yZXZlcnNlWSk7XG5cbiAgICAgICAgY29uc3QgcmV2ZXJzZUF4aXNCID0gKG9wdGlvbnMub3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX0hPUklaT05UQUwgJiYgb3B0aW9ucy5yZXZlcnNlWSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG9wdGlvbnMub3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX1ZFUlRJQ0FMICAgJiYgb3B0aW9ucy5yZXZlcnNlWCk7XG5cbiAgICAgICAgaWYgKHJldmVyc2VBeGlzQSkge1xuICAgICAgICAgICAgZm9yIChsZXQgbGluZUluZGV4ID0gMDsgbGluZUluZGV4IDwgbGluZXMubGVuZ3RoOyArK2xpbmVJbmRleCkge1xuICAgICAgICAgICAgICAgIGlmIChyZXZlcnNlQXhpc0EpIHtcbiAgICAgICAgICAgICAgICAgICAgbGluZXNbbGluZUluZGV4XS5yZXZlcnNlKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJldmVyc2VBeGlzQikge1xuICAgICAgICAgICAgbGluZXMucmV2ZXJzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxpbmVzO1xuICAgIH1cblxuICAgIC8vIENhbGN1bGF0ZSB0aGUgcmVxdWlyZWQgc2l6ZSBmb3IgZWFjaCBlbGVtZW50IGFsb25nIGF4aXMgQSwgYmFzZWQgb24gdGhlIHJlcXVlc3RlZFxuICAgIC8vIGZpdHRpbmcgbW9kZS5cbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVTaXplc09uQXhpc0EobGluZXMpIHtcbiAgICAgICAgY29uc3Qgc2l6ZXNBbGxMaW5lcyA9IFtdO1xuXG4gICAgICAgIGZvciAobGV0IGxpbmVJbmRleCA9IDA7IGxpbmVJbmRleCA8IGxpbmVzLmxlbmd0aDsgKytsaW5lSW5kZXgpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tsaW5lSW5kZXhdO1xuICAgICAgICAgICAgY29uc3Qgc2l6ZXNUaGlzTGluZSA9IGdldEVsZW1lbnRTaXplUHJvcGVydGllcyhsaW5lKTtcbiAgICAgICAgICAgIGNvbnN0IGlkZWFsUmVxdWlyZWRTcGFjZSA9IGNhbGN1bGF0ZVRvdGFsU3BhY2Uoc2l6ZXNUaGlzTGluZSwgYSk7XG4gICAgICAgICAgICBjb25zdCBmaXR0aW5nQWN0aW9uID0gZGV0ZXJtaW5lRml0dGluZ0FjdGlvbihvcHRpb25zW2EuZml0dGluZ10sIGlkZWFsUmVxdWlyZWRTcGFjZSwgYXZhaWxhYmxlU3BhY2VbYS5heGlzXSk7XG5cbiAgICAgICAgICAgIGlmIChmaXR0aW5nQWN0aW9uID09PSBGSVRUSU5HX0FDVElPTi5BUFBMWV9TVFJFVENISU5HKSB7XG4gICAgICAgICAgICAgICAgc3RyZXRjaFNpemVzVG9GaXRDb250YWluZXIoc2l6ZXNUaGlzTGluZSwgaWRlYWxSZXF1aXJlZFNwYWNlLCBhKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZml0dGluZ0FjdGlvbiA9PT0gRklUVElOR19BQ1RJT04uQVBQTFlfU0hSSU5LSU5HKSB7XG4gICAgICAgICAgICAgICAgc2hyaW5rU2l6ZXNUb0ZpdENvbnRhaW5lcihzaXplc1RoaXNMaW5lLCBpZGVhbFJlcXVpcmVkU3BhY2UsIGEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzaXplc0FsbExpbmVzLnB1c2goc2l6ZXNUaGlzTGluZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2l6ZXNBbGxMaW5lcztcbiAgICB9XG5cbiAgICAvLyBDYWxjdWxhdGUgdGhlIHJlcXVpcmVkIHNpemUgZm9yIGVhY2ggZWxlbWVudCBvbiBheGlzIEIsIGJhc2VkIG9uIHRoZSByZXF1ZXN0ZWRcbiAgICAvLyBmaXR0aW5nIG1vZGUuXG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlU2l6ZXNPbkF4aXNCKGxpbmVzLCBzaXplc0FsbExpbmVzKSB7XG4gICAgICAgIGNvbnN0IGxhcmdlc3RFbGVtZW50c0ZvckVhY2hMaW5lID0gW107XG4gICAgICAgIGNvbnN0IGxhcmdlc3RTaXplc0ZvckVhY2hMaW5lID0gW107XG5cbiAgICAgICAgLy8gRmluZCB0aGUgbGFyZ2VzdCBlbGVtZW50IG9uIGVhY2ggbGluZS5cbiAgICAgICAgZm9yIChsZXQgbGluZUluZGV4ID0gMDsgbGluZUluZGV4IDwgbGluZXMubGVuZ3RoOyArK2xpbmVJbmRleCkge1xuICAgICAgICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2xpbmVJbmRleF07XG4gICAgICAgICAgICBsaW5lLmxhcmdlc3RFbGVtZW50ID0gbnVsbDtcbiAgICAgICAgICAgIGxpbmUubGFyZ2VzdFNpemUgPSB7IHdpZHRoOiBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFksIGhlaWdodDogTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZIH07XG5cbiAgICAgICAgICAgIC8vIEZpbmQgdGhlIGxhcmdlc3QgZWxlbWVudCBvbiB0aGlzIGxpbmUuXG4gICAgICAgICAgICBmb3IgKGxldCBlbGVtZW50SW5kZXggPSAwOyBlbGVtZW50SW5kZXggPCBsaW5lLmxlbmd0aDsgKytlbGVtZW50SW5kZXgpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzaXplc1RoaXNFbGVtZW50ID0gc2l6ZXNBbGxMaW5lc1tsaW5lSW5kZXhdW2VsZW1lbnRJbmRleF07XG5cbiAgICAgICAgICAgICAgICBpZiAoc2l6ZXNUaGlzRWxlbWVudFtiLnNpemVdID4gbGluZS5sYXJnZXN0U2l6ZVtiLnNpemVdKSB7XG4gICAgICAgICAgICAgICAgICAgIGxpbmUubGFyZ2VzdEVsZW1lbnQgPSBsaW5lW2VsZW1lbnRJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGxpbmUubGFyZ2VzdFNpemUgPSBzaXplc1RoaXNFbGVtZW50O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGFyZ2VzdEVsZW1lbnRzRm9yRWFjaExpbmUucHVzaChsaW5lLmxhcmdlc3RFbGVtZW50KTtcbiAgICAgICAgICAgIGxhcmdlc3RTaXplc0ZvckVhY2hMaW5lLnB1c2gobGluZS5sYXJnZXN0U2l6ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxjdWxhdGUgbGluZSBoZWlnaHRzIHVzaW5nIHRoZSBsYXJnZXN0IGVsZW1lbnQgb24gZWFjaCBsaW5lLlxuICAgICAgICBjb25zdCBpZGVhbFJlcXVpcmVkU3BhY2UgPSBjYWxjdWxhdGVUb3RhbFNwYWNlKGxhcmdlc3RTaXplc0ZvckVhY2hMaW5lLCBiKTtcbiAgICAgICAgY29uc3QgZml0dGluZ0FjdGlvbiA9IGRldGVybWluZUZpdHRpbmdBY3Rpb24ob3B0aW9uc1tiLmZpdHRpbmddLCBpZGVhbFJlcXVpcmVkU3BhY2UsIGF2YWlsYWJsZVNwYWNlW2IuYXhpc10pO1xuXG4gICAgICAgIGlmIChmaXR0aW5nQWN0aW9uID09PSBGSVRUSU5HX0FDVElPTi5BUFBMWV9TVFJFVENISU5HKSB7XG4gICAgICAgICAgICBzdHJldGNoU2l6ZXNUb0ZpdENvbnRhaW5lcihsYXJnZXN0U2l6ZXNGb3JFYWNoTGluZSwgaWRlYWxSZXF1aXJlZFNwYWNlLCBiKTtcbiAgICAgICAgfSBlbHNlIGlmIChmaXR0aW5nQWN0aW9uID09PSBGSVRUSU5HX0FDVElPTi5BUFBMWV9TSFJJTktJTkcpIHtcbiAgICAgICAgICAgIHNocmlua1NpemVzVG9GaXRDb250YWluZXIobGFyZ2VzdFNpemVzRm9yRWFjaExpbmUsIGlkZWFsUmVxdWlyZWRTcGFjZSwgYik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxjdWxhdGUgc2l6ZXMgZm9yIG90aGVyIGVsZW1lbnRzIGJhc2VkIG9uIHRoZSBoZWlnaHQgb2YgdGhlIGxpbmUgdGhleSdyZSBvbi5cbiAgICAgICAgZm9yIChsZXQgbGluZUluZGV4ID0gMDsgbGluZUluZGV4IDwgbGluZXMubGVuZ3RoOyArK2xpbmVJbmRleCkge1xuICAgICAgICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2xpbmVJbmRleF07XG5cbiAgICAgICAgICAgIGZvciAobGV0IGVsZW1lbnRJbmRleCA9IDA7IGVsZW1lbnRJbmRleCA8IGxpbmUubGVuZ3RoOyArK2VsZW1lbnRJbmRleCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpemVzRm9yVGhpc0VsZW1lbnQgPSBzaXplc0FsbExpbmVzW2xpbmVJbmRleF1bZWxlbWVudEluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50U2l6ZSA9IHNpemVzRm9yVGhpc0VsZW1lbnRbYi5zaXplXTtcbiAgICAgICAgICAgICAgICBjb25zdCBhdmFpbGFibGVTaXplID0gbGluZXMubGVuZ3RoID09PSAxID8gYXZhaWxhYmxlU3BhY2VbYi5heGlzXSA6IGxpbmUubGFyZ2VzdFNpemVbYi5zaXplXTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50Rml0dGluZ0FjdGlvbiA9IGRldGVybWluZUZpdHRpbmdBY3Rpb24ob3B0aW9uc1tiLmZpdHRpbmddLCBjdXJyZW50U2l6ZSwgYXZhaWxhYmxlU2l6ZSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudEZpdHRpbmdBY3Rpb24gPT09IEZJVFRJTkdfQUNUSU9OLkFQUExZX1NUUkVUQ0hJTkcpIHtcbiAgICAgICAgICAgICAgICAgICAgc2l6ZXNGb3JUaGlzRWxlbWVudFtiLnNpemVdID0gTWF0aC5taW4oYXZhaWxhYmxlU2l6ZSwgc2l6ZXNGb3JUaGlzRWxlbWVudFtiLm1heFNpemVdKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnRGaXR0aW5nQWN0aW9uID09PSBGSVRUSU5HX0FDVElPTi5BUFBMWV9TSFJJTktJTkcpIHtcbiAgICAgICAgICAgICAgICAgICAgc2l6ZXNGb3JUaGlzRWxlbWVudFtiLnNpemVdID0gTWF0aC5tYXgoYXZhaWxhYmxlU2l6ZSwgc2l6ZXNGb3JUaGlzRWxlbWVudFtiLm1pblNpemVdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2l6ZXNBbGxMaW5lcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkZXRlcm1pbmVGaXR0aW5nQWN0aW9uKGZpdHRpbmdNb2RlLCBjdXJyZW50U2l6ZSwgYXZhaWxhYmxlU2l6ZSkge1xuICAgICAgICBzd2l0Y2ggKGZpdHRpbmdNb2RlKSB7XG4gICAgICAgICAgICBjYXNlIEZJVFRJTkdfTk9ORTpcbiAgICAgICAgICAgICAgICByZXR1cm4gRklUVElOR19BQ1RJT04uTk9ORTtcblxuICAgICAgICAgICAgY2FzZSBGSVRUSU5HX1NUUkVUQ0g6XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRTaXplIDwgYXZhaWxhYmxlU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gRklUVElOR19BQ1RJT04uQVBQTFlfU1RSRVRDSElORztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gRklUVElOR19BQ1RJT04uTk9ORTtcblxuICAgICAgICAgICAgY2FzZSBGSVRUSU5HX1NIUklOSzpcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFNpemUgPj0gYXZhaWxhYmxlU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gRklUVElOR19BQ1RJT04uQVBQTFlfU0hSSU5LSU5HO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBGSVRUSU5HX0FDVElPTi5OT05FO1xuXG4gICAgICAgICAgICBjYXNlIEZJVFRJTkdfQk9USDpcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFNpemUgPCBhdmFpbGFibGVTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBGSVRUSU5HX0FDVElPTi5BUFBMWV9TVFJFVENISU5HO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBGSVRUSU5HX0FDVElPTi5BUFBMWV9TSFJJTktJTkc7XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnJlY29nbml6ZWQgZml0dGluZyBtb2RlOiAke2ZpdHRpbmdNb2RlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlVG90YWxTcGFjZShzaXplcywgYXhpcykge1xuICAgICAgICBjb25zdCB0b3RhbFNpemVzID0gc3VtVmFsdWVzKHNpemVzLCBheGlzLnNpemUpO1xuICAgICAgICBjb25zdCB0b3RhbFNwYWNpbmcgPSAoc2l6ZXMubGVuZ3RoIC0gMSkgKiBvcHRpb25zLnNwYWNpbmdbYXhpcy5heGlzXTtcblxuICAgICAgICByZXR1cm4gdG90YWxTaXplcyArIHRvdGFsU3BhY2luZztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdHJldGNoU2l6ZXNUb0ZpdENvbnRhaW5lcihzaXplc1RoaXNMaW5lLCBpZGVhbFJlcXVpcmVkU3BhY2UsIGF4aXMpIHtcbiAgICAgICAgY29uc3QgYXNjZW5kaW5nTWF4U2l6ZU9yZGVyID0gZ2V0VHJhdmVyc2FsT3JkZXIoc2l6ZXNUaGlzTGluZSwgYXhpcy5tYXhTaXplKTtcbiAgICAgICAgY29uc3QgZml0dGluZ1Byb3BvcnRpb25zID0gZ2V0Tm9ybWFsaXplZFZhbHVlcyhzaXplc1RoaXNMaW5lLCBheGlzLmZpdHRpbmdQcm9wb3J0aW9uKTtcbiAgICAgICAgY29uc3QgZml0dGluZ1Byb3BvcnRpb25TdW1zID0gY3JlYXRlU3VtQXJyYXkoZml0dGluZ1Byb3BvcnRpb25zLCBhc2NlbmRpbmdNYXhTaXplT3JkZXIpO1xuXG4gICAgICAgIC8vIFN0YXJ0IGJ5IHdvcmtpbmcgb3V0IGhvdyBtdWNoIHdlIGhhdmUgdG8gc3RyZXRjaCB0aGUgY2hpbGQgZWxlbWVudHMgYnlcbiAgICAgICAgLy8gaW4gdG90YWwgaW4gb3JkZXIgdG8gZmlsbCB0aGUgYXZhaWxhYmxlIHNwYWNlIGluIHRoZSBjb250YWluZXJcbiAgICAgICAgbGV0IHJlbWFpbmluZ1VuZGVyc2hvb3QgPSBhdmFpbGFibGVTcGFjZVtheGlzLmF4aXNdIC0gaWRlYWxSZXF1aXJlZFNwYWNlO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2l6ZXNUaGlzTGluZS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgLy8gQXMgc29tZSBlbGVtZW50cyBtYXkgaGF2ZSBhIG1heGltdW0gc2l6ZSBkZWZpbmVkLCB3ZSBtaWdodCBub3QgYmVcbiAgICAgICAgICAgIC8vIGFibGUgdG8gc2NhbGUgYWxsIGVsZW1lbnRzIGJ5IHRoZSBpZGVhbCBhbW91bnQgbmVjZXNzYXJ5IGluIG9yZGVyXG4gICAgICAgICAgICAvLyB0byBmaWxsIHRoZSBhdmFpbGFibGUgc3BhY2UuIFRvIGFjY291bnQgZm9yIHRoaXMsIHdlIHJ1biB0aHJvdWdoXG4gICAgICAgICAgICAvLyB0aGUgZWxlbWVudHMgaW4gYXNjZW5kaW5nIG9yZGVyIG9mIHRoZWlyIG1heGltdW0gc2l6ZSwgcmVkaXN0cmlidXRpbmdcbiAgICAgICAgICAgIC8vIGFueSByZW1haW5pbmcgc3BhY2UgdG8gdGhlIG90aGVyIGVsZW1lbnRzIHRoYXQgYXJlIG1vcmUgYWJsZSB0b1xuICAgICAgICAgICAgLy8gbWFrZSB1c2Ugb2YgaXQuXG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IGFzY2VuZGluZ01heFNpemVPcmRlcltpXTtcblxuICAgICAgICAgICAgLy8gV29yayBvdXQgaG93IG11Y2ggd2UgaWRlYWxseSB3YW50IHRvIHN0cmV0Y2ggdGhpcyBlbGVtZW50IGJ5LCBiYXNlZFxuICAgICAgICAgICAgLy8gb24gdGhlIGFtb3VudCBvZiBzcGFjZSByZW1haW5pbmcgYW5kIHRoZSBmaXR0aW5nIHByb3BvcnRpb24gdmFsdWUgdGhhdFxuICAgICAgICAgICAgLy8gd2FzIHNwZWNpZmllZC5cbiAgICAgICAgICAgIGNvbnN0IHRhcmdldEluY3JlYXNlID0gY2FsY3VsYXRlQWRqdXN0bWVudChpbmRleCwgcmVtYWluaW5nVW5kZXJzaG9vdCwgZml0dGluZ1Byb3BvcnRpb25zLCBmaXR0aW5nUHJvcG9ydGlvblN1bXMpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0U2l6ZSA9IHNpemVzVGhpc0xpbmVbaW5kZXhdW2F4aXMuc2l6ZV0gKyB0YXJnZXRJbmNyZWFzZTtcblxuICAgICAgICAgICAgLy8gV29yayBvdXQgaG93IG11Y2ggd2UncmUgYWN0dWFsbHkgYWJsZSB0byBzdHJldGNoIHRoaXMgZWxlbWVudCBieSxcbiAgICAgICAgICAgIC8vIGJhc2VkIG9uIGl0cyBtYXhpbXVtIHNpemUsIGFuZCBhcHBseSB0aGUgcmVzdWx0LlxuICAgICAgICAgICAgY29uc3QgbWF4U2l6ZSA9IHNpemVzVGhpc0xpbmVbaW5kZXhdW2F4aXMubWF4U2l6ZV07XG4gICAgICAgICAgICBjb25zdCBhY3R1YWxTaXplID0gTWF0aC5taW4odGFyZ2V0U2l6ZSwgbWF4U2l6ZSk7XG5cbiAgICAgICAgICAgIHNpemVzVGhpc0xpbmVbaW5kZXhdW2F4aXMuc2l6ZV0gPSBhY3R1YWxTaXplO1xuXG4gICAgICAgICAgICAvLyBXb3JrIG91dCBob3cgbXVjaCBvZiB0aGUgdG90YWwgdW5kZXJzaG9vdCB2YWx1ZSB3ZSd2ZSBqdXN0IHVzZWQsXG4gICAgICAgICAgICAvLyBhbmQgZGVjcmVtZW50IHRoZSByZW1haW5pbmcgdmFsdWUgYnkgdGhpcyBtdWNoLlxuICAgICAgICAgICAgY29uc3QgYWN0dWFsSW5jcmVhc2UgPSBNYXRoLm1heCh0YXJnZXRTaXplIC0gYWN0dWFsU2l6ZSwgMCk7XG4gICAgICAgICAgICBjb25zdCBhcHBsaWVkSW5jcmVhc2UgPSB0YXJnZXRJbmNyZWFzZSAtIGFjdHVhbEluY3JlYXNlO1xuXG4gICAgICAgICAgICByZW1haW5pbmdVbmRlcnNob290IC09IGFwcGxpZWRJbmNyZWFzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFRoaXMgbG9vcCBpcyB2ZXJ5IHNpbWlsYXIgdG8gdGhlIG9uZSBpbiBzdHJldGNoU2l6ZXNUb0ZpdENvbnRhaW5lcigpIGFib3ZlLFxuICAgIC8vIGJ1dCB3aXRoIHNvbWUgYXdrd2FyZCBpbnZlcnNpb25zIGFuZCB1c2Ugb2YgbWluIGFzIG9wcG9zZWQgdG8gbWF4IGV0YyB0aGF0XG4gICAgLy8gbWVhbiBhIG1vcmUgZ2VuZXJhbGl6ZWQgdmVyc2lvbiB3b3VsZCBwcm9iYWJseSBiZSBoYXJkZXIgdG8gcmVhZC9kZWJ1ZyB0aGFuXG4gICAgLy8ganVzdCBoYXZpbmcgYSBzbWFsbCBhbW91bnQgb2YgZHVwbGljYXRpb24uXG4gICAgZnVuY3Rpb24gc2hyaW5rU2l6ZXNUb0ZpdENvbnRhaW5lcihzaXplc1RoaXNMaW5lLCBpZGVhbFJlcXVpcmVkU3BhY2UsIGF4aXMpIHtcbiAgICAgICAgY29uc3QgZGVzY2VuZGluZ01pblNpemVPcmRlciA9IGdldFRyYXZlcnNhbE9yZGVyKHNpemVzVGhpc0xpbmUsIGF4aXMubWluU2l6ZSwgdHJ1ZSk7XG4gICAgICAgIGNvbnN0IGZpdHRpbmdQcm9wb3J0aW9ucyA9IGdldE5vcm1hbGl6ZWRWYWx1ZXMoc2l6ZXNUaGlzTGluZSwgYXhpcy5maXR0aW5nUHJvcG9ydGlvbik7XG4gICAgICAgIGNvbnN0IGludmVyc2VGaXR0aW5nUHJvcG9ydGlvbnMgPSBpbnZlcnROb3JtYWxpemVkVmFsdWVzKGZpdHRpbmdQcm9wb3J0aW9ucyk7XG4gICAgICAgIGNvbnN0IGludmVyc2VGaXR0aW5nUHJvcG9ydGlvblN1bXMgPSBjcmVhdGVTdW1BcnJheShpbnZlcnNlRml0dGluZ1Byb3BvcnRpb25zLCBkZXNjZW5kaW5nTWluU2l6ZU9yZGVyKTtcblxuICAgICAgICBsZXQgcmVtYWluaW5nT3ZlcnNob290ID0gaWRlYWxSZXF1aXJlZFNwYWNlIC0gYXZhaWxhYmxlU3BhY2VbYXhpcy5heGlzXTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNpemVzVGhpc0xpbmUubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gZGVzY2VuZGluZ01pblNpemVPcmRlcltpXTtcblxuICAgICAgICAgICAgLy8gU2ltaWxhciB0byB0aGUgc3RyZXRjaCBjYWxjdWxhdGlvbiBhYm92ZSwgd2UgY2FsY3VsYXRlIHRoZSBpZGVhbFxuICAgICAgICAgICAgLy8gc2l6ZSByZWR1Y3Rpb24gdmFsdWUgZm9yIHRoaXMgZWxlbWVudCBiYXNlZCBvbiBpdHMgZml0dGluZyBwcm9wb3J0aW9uLlxuICAgICAgICAgICAgLy8gSG93ZXZlciwgbm90ZSB0aGF0IHdlJ3JlIHVzaW5nIHRoZSBpbnZlcnNlIG9mIHRoZSBmaXR0aW5nIHZhbHVlLCBhc1xuICAgICAgICAgICAgLy8gdXNpbmcgdGhlIHJlZ3VsYXIgdmFsdWUgd291bGQgbWVhbiB0aGF0IGFuIGVsZW1lbnQgd2l0aCBhIGZpdHRpbmdcbiAgICAgICAgICAgIC8vIHZhbHVlIG9mLCBzYXksIDAuNCwgZW5kcyB1cCByZW5kZXJpbmcgdmVyeSBzbWFsbCB3aGVuIHNocmlua2luZyBpc1xuICAgICAgICAgICAgLy8gYmVpbmcgYXBwbGllZC4gVXNpbmcgdGhlIGludmVyc2UgbWVhbnMgdGhhdCB0aGUgYmFsYW5jZSBvZiBzaXplc1xuICAgICAgICAgICAgLy8gYmV0d2VlbiBlbGVtZW50cyBpcyBzaW1pbGFyIGZvciBib3RoIHRoZSBTdHJldGNoIGFuZCBTaHJpbmsgbW9kZXMuXG4gICAgICAgICAgICBjb25zdCB0YXJnZXRSZWR1Y3Rpb24gPSBjYWxjdWxhdGVBZGp1c3RtZW50KGluZGV4LCByZW1haW5pbmdPdmVyc2hvb3QsIGludmVyc2VGaXR0aW5nUHJvcG9ydGlvbnMsIGludmVyc2VGaXR0aW5nUHJvcG9ydGlvblN1bXMpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0U2l6ZSA9IHNpemVzVGhpc0xpbmVbaW5kZXhdW2F4aXMuc2l6ZV0gLSB0YXJnZXRSZWR1Y3Rpb247XG5cbiAgICAgICAgICAgIGNvbnN0IG1pblNpemUgPSBzaXplc1RoaXNMaW5lW2luZGV4XVtheGlzLm1pblNpemVdO1xuICAgICAgICAgICAgY29uc3QgYWN0dWFsU2l6ZSA9IE1hdGgubWF4KHRhcmdldFNpemUsIG1pblNpemUpO1xuXG4gICAgICAgICAgICBzaXplc1RoaXNMaW5lW2luZGV4XVtheGlzLnNpemVdID0gYWN0dWFsU2l6ZTtcblxuICAgICAgICAgICAgY29uc3QgYWN0dWFsUmVkdWN0aW9uID0gTWF0aC5tYXgoYWN0dWFsU2l6ZSAtIHRhcmdldFNpemUsIDApO1xuICAgICAgICAgICAgY29uc3QgYXBwbGllZFJlZHVjdGlvbiA9IHRhcmdldFJlZHVjdGlvbiAtIGFjdHVhbFJlZHVjdGlvbjtcblxuICAgICAgICAgICAgcmVtYWluaW5nT3ZlcnNob290IC09IGFwcGxpZWRSZWR1Y3Rpb247XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVBZGp1c3RtZW50KGluZGV4LCByZW1haW5pbmdBZGp1c3RtZW50LCBmaXR0aW5nUHJvcG9ydGlvbnMsIGZpdHRpbmdQcm9wb3J0aW9uU3Vtcykge1xuICAgICAgICBjb25zdCBwcm9wb3J0aW9uID0gZml0dGluZ1Byb3BvcnRpb25zW2luZGV4XTtcbiAgICAgICAgY29uc3Qgc3VtT2ZSZW1haW5pbmdQcm9wb3J0aW9ucyA9IGZpdHRpbmdQcm9wb3J0aW9uU3Vtc1tpbmRleF07XG5cbiAgICAgICAgaWYgKE1hdGguYWJzKHByb3BvcnRpb24pIDwgMWUtNSAmJiBNYXRoLmFicyhzdW1PZlJlbWFpbmluZ1Byb3BvcnRpb25zKSA8IDFlLTUpIHtcbiAgICAgICAgICAgIHJldHVybiByZW1haW5pbmdBZGp1c3RtZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlbWFpbmluZ0FkanVzdG1lbnQgKiBwcm9wb3J0aW9uIC8gc3VtT2ZSZW1haW5pbmdQcm9wb3J0aW9ucztcbiAgICB9XG5cbiAgICAvLyBDYWxjdWxhdGUgYmFzZSBwb3NpdGlvbnMgYmFzZWQgb24gdGhlIGVsZW1lbnQgc2l6ZXMgYW5kIHNwYWNpbmcuXG4gICAgZnVuY3Rpb24gY2FsY3VsYXRlQmFzZVBvc2l0aW9ucyhsaW5lcywgc2l6ZXMpIHtcbiAgICAgICAgY29uc3QgY3Vyc29yID0ge307XG4gICAgICAgIGN1cnNvclthLmF4aXNdID0gMDtcbiAgICAgICAgY3Vyc29yW2IuYXhpc10gPSAwO1xuXG4gICAgICAgIGxpbmVzW2Euc2l6ZV0gPSBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFk7XG5cbiAgICAgICAgY29uc3QgcG9zaXRpb25zQWxsTGluZXMgPSBbXTtcblxuICAgICAgICBmb3IgKGxldCBsaW5lSW5kZXggPSAwOyBsaW5lSW5kZXggPCBsaW5lcy5sZW5ndGg7ICsrbGluZUluZGV4KSB7XG4gICAgICAgICAgICBjb25zdCBsaW5lID0gbGluZXNbbGluZUluZGV4XTtcblxuICAgICAgICAgICAgaWYgKGxpbmUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcG9zaXRpb25zQWxsTGluZXMucHVzaChbXSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uc1RoaXNMaW5lID0gW107XG4gICAgICAgICAgICBjb25zdCBzaXplc1RoaXNMaW5lID0gc2l6ZXNbbGluZUluZGV4XTtcblxuICAgICAgICAgICAgLy8gRGlzdHJpYnV0ZSBlbGVtZW50cyBhbG9uZyB0aGUgbGluZVxuICAgICAgICAgICAgZm9yIChsZXQgZWxlbWVudEluZGV4ID0gMDsgZWxlbWVudEluZGV4IDwgbGluZS5sZW5ndGg7ICsrZWxlbWVudEluZGV4KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IGxpbmVbZWxlbWVudEluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBzaXplc1RoaXNFbGVtZW50ID0gc2l6ZXNUaGlzTGluZVtlbGVtZW50SW5kZXhdO1xuXG4gICAgICAgICAgICAgICAgY3Vyc29yW2IuYXhpc10gLT0gbWluRXh0ZW50QihlbGVtZW50LCBzaXplc1RoaXNFbGVtZW50KTtcbiAgICAgICAgICAgICAgICBjdXJzb3JbYS5heGlzXSAtPSBtaW5FeHRlbnRBKGVsZW1lbnQsIHNpemVzVGhpc0VsZW1lbnQpO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zVGhpc0xpbmVbZWxlbWVudEluZGV4XSA9IHt9O1xuICAgICAgICAgICAgICAgIHBvc2l0aW9uc1RoaXNMaW5lW2VsZW1lbnRJbmRleF1bYS5heGlzXSA9IGN1cnNvclthLmF4aXNdO1xuICAgICAgICAgICAgICAgIHBvc2l0aW9uc1RoaXNMaW5lW2VsZW1lbnRJbmRleF1bYi5heGlzXSA9IGN1cnNvcltiLmF4aXNdO1xuXG4gICAgICAgICAgICAgICAgY3Vyc29yW2IuYXhpc10gKz0gbWluRXh0ZW50QihlbGVtZW50LCBzaXplc1RoaXNFbGVtZW50KTtcbiAgICAgICAgICAgICAgICBjdXJzb3JbYS5heGlzXSArPSBtYXhFeHRlbnRBKGVsZW1lbnQsIHNpemVzVGhpc0VsZW1lbnQpICsgb3B0aW9ucy5zcGFjaW5nW2EuYXhpc107XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlY29yZCB0aGUgc2l6ZSBvZiB0aGUgb3ZlcmFsbCBsaW5lXG4gICAgICAgICAgICBsaW5lW2Euc2l6ZV0gPSBjdXJzb3JbYS5heGlzXSAtIG9wdGlvbnMuc3BhY2luZ1thLmF4aXNdO1xuICAgICAgICAgICAgbGluZVtiLnNpemVdID0gbGluZS5sYXJnZXN0U2l6ZVtiLnNpemVdO1xuXG4gICAgICAgICAgICAvLyBLZWVwIHRyYWNrIG9mIHRoZSBsb25nZXN0IGxpbmVcbiAgICAgICAgICAgIGxpbmVzW2Euc2l6ZV0gPSBNYXRoLm1heChsaW5lc1thLnNpemVdLCBsaW5lW2Euc2l6ZV0pO1xuXG4gICAgICAgICAgICAvLyBNb3ZlIHRoZSBjdXJzb3IgdG8gdGhlIG5leHQgbGluZVxuICAgICAgICAgICAgY3Vyc29yW2EuYXhpc10gPSAwO1xuICAgICAgICAgICAgY3Vyc29yW2IuYXhpc10gKz0gbGluZVtiLnNpemVdICsgb3B0aW9ucy5zcGFjaW5nW2IuYXhpc107XG5cbiAgICAgICAgICAgIHBvc2l0aW9uc0FsbExpbmVzLnB1c2gocG9zaXRpb25zVGhpc0xpbmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVjb3JkIHRoZSBzaXplIG9mIHRoZSBmdWxsIHNldCBvZiBsaW5lc1xuICAgICAgICBsaW5lc1tiLnNpemVdID0gY3Vyc29yW2IuYXhpc10gLSBvcHRpb25zLnNwYWNpbmdbYi5heGlzXTtcblxuICAgICAgICByZXR1cm4gcG9zaXRpb25zQWxsTGluZXM7XG4gICAgfVxuXG4gICAgLy8gQWRqdXN0IGJhc2UgcG9zaXRpb25zIHRvIGFjY291bnQgZm9yIHRoZSByZXF1ZXN0ZWQgYWxpZ25tZW50IGFuZCBwYWRkaW5nLlxuICAgIGZ1bmN0aW9uIGFwcGx5QWxpZ25tZW50QW5kUGFkZGluZyhsaW5lcywgc2l6ZXMsIHBvc2l0aW9ucykge1xuICAgICAgICBjb25zdCBhbGlnbm1lbnRBID0gb3B0aW9ucy5hbGlnbm1lbnRbYS5heGlzXTtcbiAgICAgICAgY29uc3QgYWxpZ25tZW50QiA9IG9wdGlvbnMuYWxpZ25tZW50W2IuYXhpc107XG5cbiAgICAgICAgY29uc3QgcGFkZGluZ0EgPSBvcHRpb25zLnBhZGRpbmdbYS5heGlzXTtcbiAgICAgICAgY29uc3QgcGFkZGluZ0IgPSBvcHRpb25zLnBhZGRpbmdbYi5heGlzXTtcblxuICAgICAgICBmb3IgKGxldCBsaW5lSW5kZXggPSAwOyBsaW5lSW5kZXggPCBsaW5lcy5sZW5ndGg7ICsrbGluZUluZGV4KSB7XG4gICAgICAgICAgICBjb25zdCBsaW5lID0gbGluZXNbbGluZUluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IHNpemVzVGhpc0xpbmUgPSBzaXplc1tsaW5lSW5kZXhdO1xuICAgICAgICAgICAgY29uc3QgcG9zaXRpb25zVGhpc0xpbmUgPSBwb3NpdGlvbnNbbGluZUluZGV4XTtcblxuICAgICAgICAgICAgY29uc3QgYXhpc0FPZmZzZXQgPSAoYXZhaWxhYmxlU3BhY2VbYS5heGlzXSAtIGxpbmVbYS5zaXplXSkgICogYWxpZ25tZW50QSArIHBhZGRpbmdBO1xuICAgICAgICAgICAgY29uc3QgYXhpc0JPZmZzZXQgPSAoYXZhaWxhYmxlU3BhY2VbYi5heGlzXSAtIGxpbmVzW2Iuc2l6ZV0pICogYWxpZ25tZW50QiArIHBhZGRpbmdCO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBlbGVtZW50SW5kZXggPSAwOyBlbGVtZW50SW5kZXggPCBsaW5lLmxlbmd0aDsgKytlbGVtZW50SW5kZXgpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB3aXRoaW5MaW5lQXhpc0JPZmZzZXQgPSAobGluZVtiLnNpemVdIC0gc2l6ZXNUaGlzTGluZVtlbGVtZW50SW5kZXhdW2Iuc2l6ZV0pICogb3B0aW9ucy5hbGlnbm1lbnRbYi5heGlzXTtcblxuICAgICAgICAgICAgICAgIHBvc2l0aW9uc1RoaXNMaW5lW2VsZW1lbnRJbmRleF1bYS5heGlzXSArPSBheGlzQU9mZnNldDtcbiAgICAgICAgICAgICAgICBwb3NpdGlvbnNUaGlzTGluZVtlbGVtZW50SW5kZXhdW2IuYXhpc10gKz0gYXhpc0JPZmZzZXQgKyB3aXRoaW5MaW5lQXhpc0JPZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBcHBsaWVzIHRoZSBmaW5hbCBjYWxjdWxhdGVkIHNpemVzIGFuZCBwb3NpdGlvbnMgYmFjayB0byBlbGVtZW50cyB0aGVtc2VsdmVzLlxuICAgIGZ1bmN0aW9uIGFwcGx5U2l6ZXNBbmRQb3NpdGlvbnMobGluZXMsIHNpemVzLCBwb3NpdGlvbnMpIHtcbiAgICAgICAgZm9yIChsZXQgbGluZUluZGV4ID0gMDsgbGluZUluZGV4IDwgbGluZXMubGVuZ3RoOyArK2xpbmVJbmRleCkge1xuICAgICAgICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2xpbmVJbmRleF07XG4gICAgICAgICAgICBjb25zdCBzaXplc1RoaXNMaW5lID0gc2l6ZXNbbGluZUluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uc1RoaXNMaW5lID0gcG9zaXRpb25zW2xpbmVJbmRleF07XG5cbiAgICAgICAgICAgIGZvciAobGV0IGVsZW1lbnRJbmRleCA9IDA7IGVsZW1lbnRJbmRleCA8IGxpbmUubGVuZ3RoOyArK2VsZW1lbnRJbmRleCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSBsaW5lW2VsZW1lbnRJbmRleF07XG5cbiAgICAgICAgICAgICAgICBlbGVtZW50W2EuY2FsY3VsYXRlZFNpemVdID0gc2l6ZXNUaGlzTGluZVtlbGVtZW50SW5kZXhdW2Euc2l6ZV07XG4gICAgICAgICAgICAgICAgZWxlbWVudFtiLmNhbGN1bGF0ZWRTaXplXSA9IHNpemVzVGhpc0xpbmVbZWxlbWVudEluZGV4XVtiLnNpemVdO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMub3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX0hPUklaT05UQUwpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uc1RoaXNMaW5lW2VsZW1lbnRJbmRleF1bYS5heGlzXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uc1RoaXNMaW5lW2VsZW1lbnRJbmRleF1bYi5heGlzXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKS56XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uc1RoaXNMaW5lW2VsZW1lbnRJbmRleF1bYi5heGlzXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uc1RoaXNMaW5lW2VsZW1lbnRJbmRleF1bYS5heGlzXSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKS56XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlTGF5b3V0SW5mbyhsaW5lcykge1xuICAgICAgICBjb25zdCBsYXlvdXRXaWR0aCA9IGxpbmVzLndpZHRoO1xuICAgICAgICBjb25zdCBsYXlvdXRIZWlnaHQgPSBsaW5lcy5oZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgeE9mZnNldCA9IChhdmFpbGFibGVTcGFjZS54IC0gbGF5b3V0V2lkdGgpICogb3B0aW9ucy5hbGlnbm1lbnQueCArIG9wdGlvbnMucGFkZGluZy54O1xuICAgICAgICBjb25zdCB5T2Zmc2V0ID0gKGF2YWlsYWJsZVNwYWNlLnkgLSBsYXlvdXRIZWlnaHQpICogb3B0aW9ucy5hbGlnbm1lbnQueSArIG9wdGlvbnMucGFkZGluZy55O1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBib3VuZHM6IG5ldyBWZWM0KFxuICAgICAgICAgICAgICAgIHhPZmZzZXQsXG4gICAgICAgICAgICAgICAgeU9mZnNldCxcbiAgICAgICAgICAgICAgICBsYXlvdXRXaWR0aCxcbiAgICAgICAgICAgICAgICBsYXlvdXRIZWlnaHRcbiAgICAgICAgICAgIClcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBSZWFkcyBhbGwgc2l6ZS1yZWxhdGVkIHByb3BlcnRpZXMgZm9yIGVhY2ggZWxlbWVudCBhbmQgYXBwbGllcyBzb21lIGJhc2ljXG4gICAgLy8gc2FuaXRpemF0aW9uIHRvIGVuc3VyZSB0aGF0IG1pbldpZHRoIGlzIGdyZWF0ZXIgdGhhbiAwLCBtYXhXaWR0aCBpcyBncmVhdGVyXG4gICAgLy8gdGhhbiBtaW5XaWR0aCwgZXRjLlxuICAgIGZ1bmN0aW9uIGdldEVsZW1lbnRTaXplUHJvcGVydGllcyhlbGVtZW50cykge1xuICAgICAgICBjb25zdCBzaXplUHJvcGVydGllcyA9IFtdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZWxlbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSBlbGVtZW50c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG1pbldpZHRoICA9IE1hdGgubWF4KGdldFByb3BlcnR5KGVsZW1lbnQsICdtaW5XaWR0aCcpLCAwKTtcbiAgICAgICAgICAgIGNvbnN0IG1pbkhlaWdodCA9IE1hdGgubWF4KGdldFByb3BlcnR5KGVsZW1lbnQsICdtaW5IZWlnaHQnKSwgMCk7XG4gICAgICAgICAgICBjb25zdCBtYXhXaWR0aCAgPSBNYXRoLm1heChnZXRQcm9wZXJ0eShlbGVtZW50LCAnbWF4V2lkdGgnKSwgbWluV2lkdGgpO1xuICAgICAgICAgICAgY29uc3QgbWF4SGVpZ2h0ID0gTWF0aC5tYXgoZ2V0UHJvcGVydHkoZWxlbWVudCwgJ21heEhlaWdodCcpLCBtaW5IZWlnaHQpO1xuICAgICAgICAgICAgY29uc3Qgd2lkdGggID0gY2xhbXAoZ2V0UHJvcGVydHkoZWxlbWVudCwgJ3dpZHRoJyksIG1pbldpZHRoLCBtYXhXaWR0aCk7XG4gICAgICAgICAgICBjb25zdCBoZWlnaHQgPSBjbGFtcChnZXRQcm9wZXJ0eShlbGVtZW50LCAnaGVpZ2h0JyksIG1pbkhlaWdodCwgbWF4SGVpZ2h0KTtcbiAgICAgICAgICAgIGNvbnN0IGZpdFdpZHRoUHJvcG9ydGlvbiAgPSBnZXRQcm9wZXJ0eShlbGVtZW50LCAnZml0V2lkdGhQcm9wb3J0aW9uJyk7XG4gICAgICAgICAgICBjb25zdCBmaXRIZWlnaHRQcm9wb3J0aW9uID0gZ2V0UHJvcGVydHkoZWxlbWVudCwgJ2ZpdEhlaWdodFByb3BvcnRpb24nKTtcblxuICAgICAgICAgICAgc2l6ZVByb3BlcnRpZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgbWluV2lkdGg6IG1pbldpZHRoLFxuICAgICAgICAgICAgICAgIG1pbkhlaWdodDogbWluSGVpZ2h0LFxuICAgICAgICAgICAgICAgIG1heFdpZHRoOiBtYXhXaWR0aCxcbiAgICAgICAgICAgICAgICBtYXhIZWlnaHQ6IG1heEhlaWdodCxcbiAgICAgICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgICAgICAgZml0V2lkdGhQcm9wb3J0aW9uOiBmaXRXaWR0aFByb3BvcnRpb24sXG4gICAgICAgICAgICAgICAgZml0SGVpZ2h0UHJvcG9ydGlvbjogZml0SGVpZ2h0UHJvcG9ydGlvblxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2l6ZVByb3BlcnRpZXM7XG4gICAgfVxuXG4gICAgLy8gV2hlbiByZWFkaW5nIGFuIGVsZW1lbnQncyB3aWR0aC9oZWlnaHQsIG1pbldpZHRoL21pbkhlaWdodCBldGMsIHdlIGhhdmUgdG8gbG9vayBpblxuICAgIC8vIGEgZmV3IGRpZmZlcmVudCBwbGFjZXMgaW4gb3JkZXIuIFRoaXMgaXMgYmVjYXVzZSB0aGUgcHJlc2VuY2Ugb2YgYSBMYXlvdXRDaGlsZENvbXBvbmVudFxuICAgIC8vIG9uIGVhY2ggZWxlbWVudCBpcyBvcHRpb25hbCwgYW5kIGVhY2ggcHJvcGVydHkgdmFsdWUgYWxzbyBoYXMgYSBzZXQgb2YgZmFsbGJhY2sgZGVmYXVsdHNcbiAgICAvLyB0byBiZSB1c2VkIGluIGNhc2VzIHdoZXJlIG5vIHZhbHVlIGlzIHNwZWNpZmllZC5cbiAgICBmdW5jdGlvbiBnZXRQcm9wZXJ0eShlbGVtZW50LCBwcm9wZXJ0eU5hbWUpIHtcbiAgICAgICAgY29uc3QgbGF5b3V0Q2hpbGRDb21wb25lbnQgPSBlbGVtZW50LmVudGl0eS5sYXlvdXRjaGlsZDtcblxuICAgICAgICAvLyBGaXJzdCBhdHRlbXB0IHRvIGdldCB0aGUgdmFsdWUgZnJvbSB0aGUgZWxlbWVudCdzIExheW91dENoaWxkQ29tcG9uZW50LCBpZiBwcmVzZW50LlxuICAgICAgICBpZiAobGF5b3V0Q2hpbGRDb21wb25lbnQgJiYgbGF5b3V0Q2hpbGRDb21wb25lbnQuZW5hYmxlZCAmJiBsYXlvdXRDaGlsZENvbXBvbmVudFtwcm9wZXJ0eU5hbWVdICE9PSB1bmRlZmluZWQgJiYgbGF5b3V0Q2hpbGRDb21wb25lbnRbcHJvcGVydHlOYW1lXSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIGxheW91dENoaWxkQ29tcG9uZW50W3Byb3BlcnR5TmFtZV07XG4gICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudFtwcm9wZXJ0eU5hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50W3Byb3BlcnR5TmFtZV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gUFJPUEVSVFlfREVGQVVMVFNbcHJvcGVydHlOYW1lXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjbGFtcCh2YWx1ZSwgbWluLCBtYXgpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWluKE1hdGgubWF4KHZhbHVlLCBtaW4pLCBtYXgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN1bVZhbHVlcyhpdGVtcywgcHJvcGVydHlOYW1lKSB7XG4gICAgICAgIHJldHVybiBpdGVtcy5yZWR1Y2UoZnVuY3Rpb24gKGFjY3VtdWxhdG9yLCBjdXJyZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gYWNjdW11bGF0b3IgKyBjdXJyZW50W3Byb3BlcnR5TmFtZV07XG4gICAgICAgIH0sIDApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldE5vcm1hbGl6ZWRWYWx1ZXMoaXRlbXMsIHByb3BlcnR5TmFtZSkge1xuICAgICAgICBjb25zdCBzdW0gPSBzdW1WYWx1ZXMoaXRlbXMsIHByb3BlcnR5TmFtZSk7XG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRWYWx1ZXMgPSBbXTtcbiAgICAgICAgY29uc3QgbnVtSXRlbXMgPSBpdGVtcy5sZW5ndGg7XG5cbiAgICAgICAgaWYgKHN1bSA9PT0gMCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1JdGVtczsgKytpKSB7XG4gICAgICAgICAgICAgICAgbm9ybWFsaXplZFZhbHVlcy5wdXNoKDEgLyBudW1JdGVtcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUl0ZW1zOyArK2kpIHtcbiAgICAgICAgICAgICAgICBub3JtYWxpemVkVmFsdWVzLnB1c2goaXRlbXNbaV1bcHJvcGVydHlOYW1lXSAvIHN1bSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbm9ybWFsaXplZFZhbHVlcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbnZlcnROb3JtYWxpemVkVmFsdWVzKHZhbHVlcykge1xuICAgICAgICAvLyBHdWFyZCBhZ2FpbnN0IGRpdmlkZSBieSB6ZXJvIGVycm9yIGluIHRoZSBpbnZlcnNpb24gY2FsY3VsYXRpb24gYmVsb3dcbiAgICAgICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIHJldHVybiBbMV07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbnZlcnRlZFZhbHVlcyA9IFtdO1xuICAgICAgICBjb25zdCBudW1WYWx1ZXMgPSB2YWx1ZXMubGVuZ3RoO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVmFsdWVzOyArK2kpIHtcbiAgICAgICAgICAgIGludmVydGVkVmFsdWVzLnB1c2goKDEgLSB2YWx1ZXNbaV0pIC8gKG51bVZhbHVlcyAtIDEpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpbnZlcnRlZFZhbHVlcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRUcmF2ZXJzYWxPcmRlcihpdGVtcywgb3JkZXJCeSwgZGVzY2VuZGluZykge1xuICAgICAgICBpdGVtcy5mb3JFYWNoKGFzc2lnbkluZGV4KTtcblxuICAgICAgICByZXR1cm4gaXRlbXNcbiAgICAgICAgICAgIC5zbGljZSgpXG4gICAgICAgICAgICAuc29ydChmdW5jdGlvbiAoaXRlbUEsIGl0ZW1CKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRlc2NlbmRpbmcgPyBpdGVtQltvcmRlckJ5XSAtIGl0ZW1BW29yZGVyQnldIDogaXRlbUFbb3JkZXJCeV0gLSBpdGVtQltvcmRlckJ5XTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAubWFwKGdldEluZGV4KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBhc3NpZ25JbmRleChpdGVtLCBpbmRleCkge1xuICAgICAgICBpdGVtLmluZGV4ID0gaW5kZXg7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0SW5kZXgoaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbS5pbmRleDtcbiAgICB9XG5cbiAgICAvLyBSZXR1cm5zIGEgbmV3IGFycmF5IGNvbnRhaW5pbmcgdGhlIHN1bXMgb2YgdGhlIHZhbHVlcyBpbiB0aGUgb3JpZ2luYWwgYXJyYXksXG4gICAgLy8gcnVubmluZyBmcm9tIHJpZ2h0IHRvIGxlZnQuXG4gICAgLy8gRm9yIGV4YW1wbGUsIGdpdmVuOiBbMC4yLCAwLjIsIDAuMywgMC4xLCAwLjJdXG4gICAgLy8gV2lsbCByZXR1cm46ICAgICAgICBbMS4wLCAwLjgsIDAuNiwgMC4zLCAwLjJdXG4gICAgZnVuY3Rpb24gY3JlYXRlU3VtQXJyYXkodmFsdWVzLCBvcmRlcikge1xuICAgICAgICBjb25zdCBzdW1BcnJheSA9IFtdO1xuICAgICAgICBzdW1BcnJheVtvcmRlclt2YWx1ZXMubGVuZ3RoIC0gMV1dID0gdmFsdWVzW29yZGVyW3ZhbHVlcy5sZW5ndGggLSAxXV07XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IHZhbHVlcy5sZW5ndGggLSAyOyBpID49IDA7IC0taSkge1xuICAgICAgICAgICAgc3VtQXJyYXlbb3JkZXJbaV1dID0gc3VtQXJyYXlbb3JkZXJbaSArIDFdXSArIHZhbHVlc1tvcmRlcltpXV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3VtQXJyYXk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNhbGN1bGF0ZUFsbDtcbn1cblxuY29uc3QgQ0FMQ1VMQVRFX0ZOUyA9IHt9O1xuQ0FMQ1VMQVRFX0ZOU1tPUklFTlRBVElPTl9IT1JJWk9OVEFMXSA9IGNyZWF0ZUNhbGN1bGF0b3IoT1JJRU5UQVRJT05fSE9SSVpPTlRBTCk7XG5DQUxDVUxBVEVfRk5TW09SSUVOVEFUSU9OX1ZFUlRJQ0FMXSA9IGNyZWF0ZUNhbGN1bGF0b3IoT1JJRU5UQVRJT05fVkVSVElDQUwpO1xuXG4vKipcbiAqIFVzZWQgdG8gbWFuYWdlIGxheW91dCBjYWxjdWxhdGlvbnMgZm9yIHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudH1zLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgTGF5b3V0Q2FsY3VsYXRvciB7XG4gICAgY2FsY3VsYXRlTGF5b3V0KGVsZW1lbnRzLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGNhbGN1bGF0ZUZuID0gQ0FMQ1VMQVRFX0ZOU1tvcHRpb25zLm9yaWVudGF0aW9uXTtcblxuICAgICAgICBpZiAoIWNhbGN1bGF0ZUZuKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VucmVjb2duaXplZCBvcmllbnRhdGlvbiB2YWx1ZTogJyArIG9wdGlvbnMub3JpZW50YXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGN1bGF0ZUZuKGVsZW1lbnRzLCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgTGF5b3V0Q2FsY3VsYXRvciB9O1xuIl0sIm5hbWVzIjpbIkFYSVNfTUFQUElOR1MiLCJPUklFTlRBVElPTl9IT1JJWk9OVEFMIiwiYXhpcyIsInNpemUiLCJjYWxjdWxhdGVkU2l6ZSIsIm1pblNpemUiLCJtYXhTaXplIiwiZml0dGluZyIsImZpdHRpbmdQcm9wb3J0aW9uIiwiT1JJRU5UQVRJT05fVkVSVElDQUwiLCJPUFBPU0lURV9PUklFTlRBVElPTiIsIlBST1BFUlRZX0RFRkFVTFRTIiwibWluV2lkdGgiLCJtaW5IZWlnaHQiLCJtYXhXaWR0aCIsIk51bWJlciIsIlBPU0lUSVZFX0lORklOSVRZIiwibWF4SGVpZ2h0Iiwid2lkdGgiLCJoZWlnaHQiLCJmaXRXaWR0aFByb3BvcnRpb24iLCJmaXRIZWlnaHRQcm9wb3J0aW9uIiwiRklUVElOR19BQ1RJT04iLCJOT05FIiwiQVBQTFlfU1RSRVRDSElORyIsIkFQUExZX1NIUklOS0lORyIsImF2YWlsYWJsZVNwYWNlIiwiVmVjMiIsImNyZWF0ZUNhbGN1bGF0b3IiLCJvcmllbnRhdGlvbiIsIm9wdGlvbnMiLCJhIiwiYiIsIm1pbkV4dGVudEEiLCJlbGVtZW50IiwicGl2b3QiLCJtaW5FeHRlbnRCIiwibWF4RXh0ZW50QSIsImNhbGN1bGF0ZUFsbCIsImFsbEVsZW1lbnRzIiwibGF5b3V0T3B0aW9ucyIsImZpbHRlciIsInNob3VsZEluY2x1ZGVJbkxheW91dCIsIngiLCJjb250YWluZXJTaXplIiwicGFkZGluZyIsInoiLCJ5IiwidyIsInJlc2V0QW5jaG9ycyIsImxpbmVzIiwicmV2ZXJzZUxpbmVzSWZSZXF1aXJlZCIsInNwbGl0TGluZXMiLCJzaXplcyIsImNhbGN1bGF0ZVNpemVzT25BeGlzQiIsImNhbGN1bGF0ZVNpemVzT25BeGlzQSIsInBvc2l0aW9ucyIsImNhbGN1bGF0ZUJhc2VQb3NpdGlvbnMiLCJhcHBseUFsaWdubWVudEFuZFBhZGRpbmciLCJhcHBseVNpemVzQW5kUG9zaXRpb25zIiwiY3JlYXRlTGF5b3V0SW5mbyIsImxheW91dENoaWxkQ29tcG9uZW50IiwiZW50aXR5IiwibGF5b3V0Y2hpbGQiLCJlbmFibGVkIiwiZXhjbHVkZUZyb21MYXlvdXQiLCJpIiwibGVuZ3RoIiwiYW5jaG9yIiwiVmVjNCIsIlpFUk8iLCJ3cmFwIiwiZ2V0RWxlbWVudFNpemVQcm9wZXJ0aWVzIiwicnVubmluZ1NpemUiLCJhbGxvd092ZXJydW4iLCJGSVRUSU5HX1NIUklOSyIsInNwYWNpbmciLCJpZGVhbEVsZW1lbnRTaXplIiwicHVzaCIsInJldmVyc2VBeGlzQSIsInJldmVyc2VYIiwicmV2ZXJzZVkiLCJyZXZlcnNlQXhpc0IiLCJsaW5lSW5kZXgiLCJyZXZlcnNlIiwic2l6ZXNBbGxMaW5lcyIsImxpbmUiLCJzaXplc1RoaXNMaW5lIiwiaWRlYWxSZXF1aXJlZFNwYWNlIiwiY2FsY3VsYXRlVG90YWxTcGFjZSIsImZpdHRpbmdBY3Rpb24iLCJkZXRlcm1pbmVGaXR0aW5nQWN0aW9uIiwic3RyZXRjaFNpemVzVG9GaXRDb250YWluZXIiLCJzaHJpbmtTaXplc1RvRml0Q29udGFpbmVyIiwibGFyZ2VzdEVsZW1lbnRzRm9yRWFjaExpbmUiLCJsYXJnZXN0U2l6ZXNGb3JFYWNoTGluZSIsImxhcmdlc3RFbGVtZW50IiwibGFyZ2VzdFNpemUiLCJORUdBVElWRV9JTkZJTklUWSIsImVsZW1lbnRJbmRleCIsInNpemVzVGhpc0VsZW1lbnQiLCJzaXplc0ZvclRoaXNFbGVtZW50IiwiY3VycmVudFNpemUiLCJhdmFpbGFibGVTaXplIiwiZWxlbWVudEZpdHRpbmdBY3Rpb24iLCJNYXRoIiwibWluIiwibWF4IiwiZml0dGluZ01vZGUiLCJGSVRUSU5HX05PTkUiLCJGSVRUSU5HX1NUUkVUQ0giLCJGSVRUSU5HX0JPVEgiLCJFcnJvciIsInRvdGFsU2l6ZXMiLCJzdW1WYWx1ZXMiLCJ0b3RhbFNwYWNpbmciLCJhc2NlbmRpbmdNYXhTaXplT3JkZXIiLCJnZXRUcmF2ZXJzYWxPcmRlciIsImZpdHRpbmdQcm9wb3J0aW9ucyIsImdldE5vcm1hbGl6ZWRWYWx1ZXMiLCJmaXR0aW5nUHJvcG9ydGlvblN1bXMiLCJjcmVhdGVTdW1BcnJheSIsInJlbWFpbmluZ1VuZGVyc2hvb3QiLCJpbmRleCIsInRhcmdldEluY3JlYXNlIiwiY2FsY3VsYXRlQWRqdXN0bWVudCIsInRhcmdldFNpemUiLCJhY3R1YWxTaXplIiwiYWN0dWFsSW5jcmVhc2UiLCJhcHBsaWVkSW5jcmVhc2UiLCJkZXNjZW5kaW5nTWluU2l6ZU9yZGVyIiwiaW52ZXJzZUZpdHRpbmdQcm9wb3J0aW9ucyIsImludmVydE5vcm1hbGl6ZWRWYWx1ZXMiLCJpbnZlcnNlRml0dGluZ1Byb3BvcnRpb25TdW1zIiwicmVtYWluaW5nT3ZlcnNob290IiwidGFyZ2V0UmVkdWN0aW9uIiwiYWN0dWFsUmVkdWN0aW9uIiwiYXBwbGllZFJlZHVjdGlvbiIsInJlbWFpbmluZ0FkanVzdG1lbnQiLCJwcm9wb3J0aW9uIiwic3VtT2ZSZW1haW5pbmdQcm9wb3J0aW9ucyIsImFicyIsImN1cnNvciIsInBvc2l0aW9uc0FsbExpbmVzIiwicG9zaXRpb25zVGhpc0xpbmUiLCJhbGlnbm1lbnRBIiwiYWxpZ25tZW50IiwiYWxpZ25tZW50QiIsInBhZGRpbmdBIiwicGFkZGluZ0IiLCJheGlzQU9mZnNldCIsImF4aXNCT2Zmc2V0Iiwid2l0aGluTGluZUF4aXNCT2Zmc2V0Iiwic2V0TG9jYWxQb3NpdGlvbiIsImdldExvY2FsUG9zaXRpb24iLCJsYXlvdXRXaWR0aCIsImxheW91dEhlaWdodCIsInhPZmZzZXQiLCJ5T2Zmc2V0IiwiYm91bmRzIiwiZWxlbWVudHMiLCJzaXplUHJvcGVydGllcyIsImdldFByb3BlcnR5IiwiY2xhbXAiLCJwcm9wZXJ0eU5hbWUiLCJ1bmRlZmluZWQiLCJ2YWx1ZSIsIml0ZW1zIiwicmVkdWNlIiwiYWNjdW11bGF0b3IiLCJjdXJyZW50Iiwic3VtIiwibm9ybWFsaXplZFZhbHVlcyIsIm51bUl0ZW1zIiwidmFsdWVzIiwiaW52ZXJ0ZWRWYWx1ZXMiLCJudW1WYWx1ZXMiLCJvcmRlckJ5IiwiZGVzY2VuZGluZyIsImZvckVhY2giLCJhc3NpZ25JbmRleCIsInNsaWNlIiwic29ydCIsIml0ZW1BIiwiaXRlbUIiLCJtYXAiLCJnZXRJbmRleCIsIml0ZW0iLCJvcmRlciIsInN1bUFycmF5IiwiQ0FMQ1VMQVRFX0ZOUyIsIkxheW91dENhbGN1bGF0b3IiLCJjYWxjdWxhdGVMYXlvdXQiLCJjYWxjdWxhdGVGbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQU9BLE1BQU1BLGFBQWEsR0FBRyxFQUFFLENBQUE7QUFFeEJBLGFBQWEsQ0FBQ0Msc0JBQXNCLENBQUMsR0FBRztBQUNwQ0MsRUFBQUEsSUFBSSxFQUFFLEdBQUc7QUFDVEMsRUFBQUEsSUFBSSxFQUFFLE9BQU87QUFDYkMsRUFBQUEsY0FBYyxFQUFFLGlCQUFpQjtBQUNqQ0MsRUFBQUEsT0FBTyxFQUFFLFVBQVU7QUFDbkJDLEVBQUFBLE9BQU8sRUFBRSxVQUFVO0FBQ25CQyxFQUFBQSxPQUFPLEVBQUUsY0FBYztBQUN2QkMsRUFBQUEsaUJBQWlCLEVBQUUsb0JBQUE7QUFDdkIsQ0FBQyxDQUFBO0FBRURSLGFBQWEsQ0FBQ1Msb0JBQW9CLENBQUMsR0FBRztBQUNsQ1AsRUFBQUEsSUFBSSxFQUFFLEdBQUc7QUFDVEMsRUFBQUEsSUFBSSxFQUFFLFFBQVE7QUFDZEMsRUFBQUEsY0FBYyxFQUFFLGtCQUFrQjtBQUNsQ0MsRUFBQUEsT0FBTyxFQUFFLFdBQVc7QUFDcEJDLEVBQUFBLE9BQU8sRUFBRSxXQUFXO0FBQ3BCQyxFQUFBQSxPQUFPLEVBQUUsZUFBZTtBQUN4QkMsRUFBQUEsaUJBQWlCLEVBQUUscUJBQUE7QUFDdkIsQ0FBQyxDQUFBO0FBRUQsTUFBTUUsb0JBQW9CLEdBQUcsRUFBRSxDQUFBO0FBQy9CQSxvQkFBb0IsQ0FBQ1Qsc0JBQXNCLENBQUMsR0FBR1Esb0JBQW9CLENB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
