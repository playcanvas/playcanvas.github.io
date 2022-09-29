/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Vec2 } from '../../../math/vec2.js';
import { Vec4 } from '../../../math/vec4.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5b3V0LWNhbGN1bGF0b3IuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvY29tcG9uZW50cy9sYXlvdXQtZ3JvdXAvbGF5b3V0LWNhbGN1bGF0b3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vLi4vbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHsgT1JJRU5UQVRJT05fSE9SSVpPTlRBTCwgT1JJRU5UQVRJT05fVkVSVElDQUwgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBGSVRUSU5HX0JPVEgsIEZJVFRJTkdfTk9ORSwgRklUVElOR19TSFJJTkssIEZJVFRJTkdfU1RSRVRDSCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuY29uc3QgQVhJU19NQVBQSU5HUyA9IHt9O1xuXG5BWElTX01BUFBJTkdTW09SSUVOVEFUSU9OX0hPUklaT05UQUxdID0ge1xuICAgIGF4aXM6ICd4JyxcbiAgICBzaXplOiAnd2lkdGgnLFxuICAgIGNhbGN1bGF0ZWRTaXplOiAnY2FsY3VsYXRlZFdpZHRoJyxcbiAgICBtaW5TaXplOiAnbWluV2lkdGgnLFxuICAgIG1heFNpemU6ICdtYXhXaWR0aCcsXG4gICAgZml0dGluZzogJ3dpZHRoRml0dGluZycsXG4gICAgZml0dGluZ1Byb3BvcnRpb246ICdmaXRXaWR0aFByb3BvcnRpb24nXG59O1xuXG5BWElTX01BUFBJTkdTW09SSUVOVEFUSU9OX1ZFUlRJQ0FMXSA9IHtcbiAgICBheGlzOiAneScsXG4gICAgc2l6ZTogJ2hlaWdodCcsXG4gICAgY2FsY3VsYXRlZFNpemU6ICdjYWxjdWxhdGVkSGVpZ2h0JyxcbiAgICBtaW5TaXplOiAnbWluSGVpZ2h0JyxcbiAgICBtYXhTaXplOiAnbWF4SGVpZ2h0JyxcbiAgICBmaXR0aW5nOiAnaGVpZ2h0Rml0dGluZycsXG4gICAgZml0dGluZ1Byb3BvcnRpb246ICdmaXRIZWlnaHRQcm9wb3J0aW9uJ1xufTtcblxuY29uc3QgT1BQT1NJVEVfT1JJRU5UQVRJT04gPSB7fTtcbk9QUE9TSVRFX09SSUVOVEFUSU9OW09SSUVOVEFUSU9OX0hPUklaT05UQUxdID0gT1JJRU5UQVRJT05fVkVSVElDQUw7XG5PUFBPU0lURV9PUklFTlRBVElPTltPUklFTlRBVElPTl9WRVJUSUNBTF0gPSBPUklFTlRBVElPTl9IT1JJWk9OVEFMO1xuXG5jb25zdCBQUk9QRVJUWV9ERUZBVUxUUyA9IHtcbiAgICBtaW5XaWR0aDogMCxcbiAgICBtaW5IZWlnaHQ6IDAsXG4gICAgbWF4V2lkdGg6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSxcbiAgICBtYXhIZWlnaHQ6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSxcbiAgICB3aWR0aDogbnVsbCxcbiAgICBoZWlnaHQ6IG51bGwsXG4gICAgZml0V2lkdGhQcm9wb3J0aW9uOiAwLFxuICAgIGZpdEhlaWdodFByb3BvcnRpb246IDBcbn07XG5cbmNvbnN0IEZJVFRJTkdfQUNUSU9OID0ge1xuICAgIE5PTkU6ICdOT05FJyxcbiAgICBBUFBMWV9TVFJFVENISU5HOiAnQVBQTFlfU1RSRVRDSElORycsXG4gICAgQVBQTFlfU0hSSU5LSU5HOiAnQVBQTFlfU0hSSU5LSU5HJ1xufTtcblxuY29uc3QgYXZhaWxhYmxlU3BhY2UgPSBuZXcgVmVjMigpO1xuXG4vLyBUaGUgbGF5b3V0IGxvZ2ljIGlzIGxhcmdlbHkgaWRlbnRpY2FsIGZvciB0aGUgaG9yaXpvbnRhbCBhbmQgdmVydGljYWwgb3JpZW50YXRpb25zLFxuLy8gd2l0aCB0aGUgZXhjZXB0aW9uIG9mIGEgZmV3IGJpdHMgb2Ygc3dpenpsaW5nIHJlIHRoZSBwcmltYXJ5IGFuZCBzZWNvbmRhcnkgYXhlcyB0b1xuLy8gdXNlIGV0Yy4gVGhpcyBmdW5jdGlvbiBnZW5lcmF0ZXMgYSBjYWxjdWxhdG9yIGZvciBhIGdpdmVuIG9yaWVudGF0aW9uLCB3aXRoIGVhY2ggb2Zcbi8vIHRoZSBzd2l6emxlZCBwcm9wZXJ0aWVzIGNvbnZlbmllbnRseSBwbGFjZWQgaW4gY2xvc3VyZSBzY29wZS5cbmZ1bmN0aW9uIGNyZWF0ZUNhbGN1bGF0b3Iob3JpZW50YXRpb24pIHtcbiAgICBsZXQgb3B0aW9ucztcblxuICAgIC8vIENob29zZSB3aGljaCBheGVzIHRvIG9wZXJhdGUgb24gYmFzZWQgb24gdGhlIG9yaWVudGF0aW9uIHRoYXQgd2UncmUgdXNpbmcuIEZvclxuICAgIC8vIGJyZXZpdHkgYXMgdGhleSBhcmUgdXNlZCBhIGxvdCwgdGhlc2UgYXJlIHNob3J0ZW5lZCB0byBqdXN0ICdhJyBhbmQgJ2InLCB3aGljaFxuICAgIC8vIHJlcHJlc2VudCB0aGUgcHJpbWFyeSBhbmQgc2Vjb25kYXJ5IGF4ZXMuXG4gICAgY29uc3QgYSA9IEFYSVNfTUFQUElOR1Nbb3JpZW50YXRpb25dO1xuICAgIGNvbnN0IGIgPSBBWElTX01BUFBJTkdTW09QUE9TSVRFX09SSUVOVEFUSU9OW29yaWVudGF0aW9uXV07XG5cbiAgICAvLyBDYWxjdWxhdGVzIHRoZSBsZWZ0L3RvcCBleHRlbnQgb2YgYW4gZWxlbWVudCBiYXNlZCBvbiBpdHMgcG9zaXRpb24gYW5kIHBpdm90IHZhbHVlXG4gICAgZnVuY3Rpb24gbWluRXh0ZW50QShlbGVtZW50LCBzaXplKSB7cmV0dXJuIC1zaXplW2Euc2l6ZV0gKiBlbGVtZW50LnBpdm90W2EuYXhpc107IH0gIC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICBmdW5jdGlvbiBtaW5FeHRlbnRCKGVsZW1lbnQsIHNpemUpIHsgcmV0dXJuIC1zaXplW2Iuc2l6ZV0gKiBlbGVtZW50LnBpdm90W2IuYXhpc107IH0gLy8gZXNsaW50LWRpc2FibGUtbGluZVxuXG4gICAgLy8gQ2FsY3VsYXRlcyB0aGUgcmlnaHQvYm90dG9tIGV4dGVudCBvZiBhbiBlbGVtZW50IGJhc2VkIG9uIGl0cyBwb3NpdGlvbiBhbmQgcGl2b3QgdmFsdWVcbiAgICBmdW5jdGlvbiBtYXhFeHRlbnRBKGVsZW1lbnQsIHNpemUpIHsgcmV0dXJuICBzaXplW2Euc2l6ZV0gKiAoMSAtIGVsZW1lbnQucGl2b3RbYS5heGlzXSk7IH0gLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgIGZ1bmN0aW9uIG1heEV4dGVudEIoZWxlbWVudCwgc2l6ZSkgeyByZXR1cm4gIHNpemVbYi5zaXplXSAqICgxIC0gZWxlbWVudC5waXZvdFtiLmF4aXNdKTsgfSAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG5cbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVBbGwoYWxsRWxlbWVudHMsIGxheW91dE9wdGlvbnMpIHtcbiAgICAgICAgYWxsRWxlbWVudHMgPSBhbGxFbGVtZW50cy5maWx0ZXIoc2hvdWxkSW5jbHVkZUluTGF5b3V0KTtcbiAgICAgICAgb3B0aW9ucyA9IGxheW91dE9wdGlvbnM7XG5cbiAgICAgICAgYXZhaWxhYmxlU3BhY2UueCA9IG9wdGlvbnMuY29udGFpbmVyU2l6ZS54IC0gb3B0aW9ucy5wYWRkaW5nLnggLSBvcHRpb25zLnBhZGRpbmcuejtcbiAgICAgICAgYXZhaWxhYmxlU3BhY2UueSA9IG9wdGlvbnMuY29udGFpbmVyU2l6ZS55IC0gb3B0aW9ucy5wYWRkaW5nLnkgLSBvcHRpb25zLnBhZGRpbmcudztcblxuICAgICAgICByZXNldEFuY2hvcnMoYWxsRWxlbWVudHMpO1xuXG4gICAgICAgIGNvbnN0IGxpbmVzID0gcmV2ZXJzZUxpbmVzSWZSZXF1aXJlZChzcGxpdExpbmVzKGFsbEVsZW1lbnRzKSk7XG4gICAgICAgIGNvbnN0IHNpemVzID0gY2FsY3VsYXRlU2l6ZXNPbkF4aXNCKGxpbmVzLCBjYWxjdWxhdGVTaXplc09uQXhpc0EobGluZXMpKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb25zID0gY2FsY3VsYXRlQmFzZVBvc2l0aW9ucyhsaW5lcywgc2l6ZXMpO1xuXG4gICAgICAgIGFwcGx5QWxpZ25tZW50QW5kUGFkZGluZyhsaW5lcywgc2l6ZXMsIHBvc2l0aW9ucyk7XG4gICAgICAgIGFwcGx5U2l6ZXNBbmRQb3NpdGlvbnMobGluZXMsIHNpemVzLCBwb3NpdGlvbnMpO1xuXG4gICAgICAgIHJldHVybiBjcmVhdGVMYXlvdXRJbmZvKGxpbmVzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzaG91bGRJbmNsdWRlSW5MYXlvdXQoZWxlbWVudCkge1xuICAgICAgICBjb25zdCBsYXlvdXRDaGlsZENvbXBvbmVudCA9IGVsZW1lbnQuZW50aXR5LmxheW91dGNoaWxkO1xuXG4gICAgICAgIHJldHVybiAhbGF5b3V0Q2hpbGRDb21wb25lbnQgfHwgIWxheW91dENoaWxkQ29tcG9uZW50LmVuYWJsZWQgfHwgIWxheW91dENoaWxkQ29tcG9uZW50LmV4Y2x1ZGVGcm9tTGF5b3V0O1xuICAgIH1cblxuICAgIC8vIFNldHRpbmcgdGhlIGFuY2hvcnMgb2YgY2hpbGQgZWxlbWVudHMgdG8gYW55dGhpbmcgb3RoZXIgdGhhbiAwLDAsMCwwIHJlc3VsdHNcbiAgICAvLyBpbiBwb3NpdGlvbmluZyB0aGF0IGlzIGhhcmQgdG8gcmVhc29uIGFib3V0IGZvciB0aGUgdXNlci4gRm9yY2luZyB0aGUgYW5jaG9yc1xuICAgIC8vIHRvIDAsMCwwLDAgZ2l2ZXMgdXMgbW9yZSBwcmVkaWN0YWJsZSBwb3NpdGlvbmluZywgYW5kIGFsc28gaGFzIHRoZSBiZW5lZml0IG9mXG4gICAgLy8gZW5zdXJpbmcgdGhhdCB0aGUgZWxlbWVudCBpcyBub3QgaW4gc3BsaXQgYW5jaG9ycyBtb2RlIG9uIGVpdGhlciBheGlzLlxuICAgIGZ1bmN0aW9uIHJlc2V0QW5jaG9ycyhhbGxFbGVtZW50cykge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbEVsZW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gYWxsRWxlbWVudHNbaV07XG4gICAgICAgICAgICBjb25zdCBhbmNob3IgPSBlbGVtZW50LmFuY2hvcjtcblxuICAgICAgICAgICAgaWYgKGFuY2hvci54ICE9PSAwIHx8IGFuY2hvci55ICE9PSAwIHx8IGFuY2hvci56ICE9PSAwIHx8IGFuY2hvci53ICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5hbmNob3IgPSBWZWM0LlpFUk87XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm5zIGEgMkQgYXJyYXkgb2YgZWxlbWVudHMgYnJva2VuIGRvd24gaW50byBsaW5lcywgYmFzZWQgb24gdGhlIHNpemUgb2ZcbiAgICAvLyBlYWNoIGVsZW1lbnQgYW5kIHdoZXRoZXIgdGhlIGB3cmFwYCBwcm9wZXJ0eSBpcyBzZXQuXG4gICAgZnVuY3Rpb24gc3BsaXRMaW5lcyhhbGxFbGVtZW50cykge1xuICAgICAgICBpZiAoIW9wdGlvbnMud3JhcCkge1xuICAgICAgICAgICAgLy8gSWYgd3JhcHBpbmcgaXMgZGlzYWJsZWQsIHdlIGp1c3QgcHV0IGFsbCBlbGVtZW50cyBpbnRvIGEgc2luZ2xlIGxpbmUuXG4gICAgICAgICAgICByZXR1cm4gW2FsbEVsZW1lbnRzXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxpbmVzID0gW1tdXTtcbiAgICAgICAgY29uc3Qgc2l6ZXMgPSBnZXRFbGVtZW50U2l6ZVByb3BlcnRpZXMoYWxsRWxlbWVudHMpO1xuICAgICAgICBsZXQgcnVubmluZ1NpemUgPSAwO1xuICAgICAgICBjb25zdCBhbGxvd092ZXJydW4gPSAob3B0aW9uc1thLmZpdHRpbmddID09PSBGSVRUSU5HX1NIUklOSyk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxFbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgaWYgKGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBydW5uaW5nU2l6ZSArPSBvcHRpb25zLnNwYWNpbmdbYS5heGlzXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaWRlYWxFbGVtZW50U2l6ZSA9IHNpemVzW2ldW2Euc2l6ZV07XG4gICAgICAgICAgICBydW5uaW5nU2l6ZSArPSBpZGVhbEVsZW1lbnRTaXplO1xuXG4gICAgICAgICAgICAvLyBGb3IgdGhlIE5vbmUsIFN0cmV0Y2ggYW5kIEJvdGggZml0dGluZyBtb2Rlcywgd2Ugc2hvdWxkIGJyZWFrIHRvIGEgbmV3XG4gICAgICAgICAgICAvLyBsaW5lIGJlZm9yZSB3ZSBvdmVycnVuIHRoZSBhdmFpbGFibGUgc3BhY2UgaW4gdGhlIGNvbnRhaW5lci5cbiAgICAgICAgICAgIGlmICghYWxsb3dPdmVycnVuICYmIHJ1bm5pbmdTaXplID4gYXZhaWxhYmxlU3BhY2VbYS5heGlzXSAmJiBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXS5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgICAgICBydW5uaW5nU2l6ZSA9IGlkZWFsRWxlbWVudFNpemU7XG4gICAgICAgICAgICAgICAgbGluZXMucHVzaChbXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdLnB1c2goYWxsRWxlbWVudHNbaV0pO1xuXG4gICAgICAgICAgICAvLyBGb3IgdGhlIFNocmluayBmaXR0aW5nIG1vZGUsIHdlIHNob3VsZCBicmVhayB0byBhIG5ldyBsaW5lIGltbWVkaWF0ZWx5XG4gICAgICAgICAgICAvLyBhZnRlciB3ZSd2ZSBvdmVycnVuIHRoZSBhdmFpbGFibGUgc3BhY2UgaW4gdGhlIGNvbnRhaW5lci5cbiAgICAgICAgICAgIGlmIChhbGxvd092ZXJydW4gJiYgcnVubmluZ1NpemUgPiBhdmFpbGFibGVTcGFjZVthLmF4aXNdICYmIGkgIT09IGFsbEVsZW1lbnRzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICBydW5uaW5nU2l6ZSA9IDA7XG4gICAgICAgICAgICAgICAgbGluZXMucHVzaChbXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbGluZXM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmV2ZXJzZUxpbmVzSWZSZXF1aXJlZChsaW5lcykge1xuICAgICAgICBjb25zdCByZXZlcnNlQXhpc0EgPSAob3B0aW9ucy5vcmllbnRhdGlvbiA9PT0gT1JJRU5UQVRJT05fSE9SSVpPTlRBTCAmJiBvcHRpb25zLnJldmVyc2VYKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAob3B0aW9ucy5vcmllbnRhdGlvbiA9PT0gT1JJRU5UQVRJT05fVkVSVElDQUwgICAmJiBvcHRpb25zLnJldmVyc2VZKTtcblxuICAgICAgICBjb25zdCByZXZlcnNlQXhpc0IgPSAob3B0aW9ucy5vcmllbnRhdGlvbiA9PT0gT1JJRU5UQVRJT05fSE9SSVpPTlRBTCAmJiBvcHRpb25zLnJldmVyc2VZKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAob3B0aW9ucy5vcmllbnRhdGlvbiA9PT0gT1JJRU5UQVRJT05fVkVSVElDQUwgICAmJiBvcHRpb25zLnJldmVyc2VYKTtcblxuICAgICAgICBpZiAocmV2ZXJzZUF4aXNBKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBsaW5lSW5kZXggPSAwOyBsaW5lSW5kZXggPCBsaW5lcy5sZW5ndGg7ICsrbGluZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgaWYgKHJldmVyc2VBeGlzQSkge1xuICAgICAgICAgICAgICAgICAgICBsaW5lc1tsaW5lSW5kZXhdLnJldmVyc2UoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmV2ZXJzZUF4aXNCKSB7XG4gICAgICAgICAgICBsaW5lcy5yZXZlcnNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbGluZXM7XG4gICAgfVxuXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSByZXF1aXJlZCBzaXplIGZvciBlYWNoIGVsZW1lbnQgYWxvbmcgYXhpcyBBLCBiYXNlZCBvbiB0aGUgcmVxdWVzdGVkXG4gICAgLy8gZml0dGluZyBtb2RlLlxuICAgIGZ1bmN0aW9uIGNhbGN1bGF0ZVNpemVzT25BeGlzQShsaW5lcykge1xuICAgICAgICBjb25zdCBzaXplc0FsbExpbmVzID0gW107XG5cbiAgICAgICAgZm9yIChsZXQgbGluZUluZGV4ID0gMDsgbGluZUluZGV4IDwgbGluZXMubGVuZ3RoOyArK2xpbmVJbmRleCkge1xuICAgICAgICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2xpbmVJbmRleF07XG4gICAgICAgICAgICBjb25zdCBzaXplc1RoaXNMaW5lID0gZ2V0RWxlbWVudFNpemVQcm9wZXJ0aWVzKGxpbmUpO1xuICAgICAgICAgICAgY29uc3QgaWRlYWxSZXF1aXJlZFNwYWNlID0gY2FsY3VsYXRlVG90YWxTcGFjZShzaXplc1RoaXNMaW5lLCBhKTtcbiAgICAgICAgICAgIGNvbnN0IGZpdHRpbmdBY3Rpb24gPSBkZXRlcm1pbmVGaXR0aW5nQWN0aW9uKG9wdGlvbnNbYS5maXR0aW5nXSwgaWRlYWxSZXF1aXJlZFNwYWNlLCBhdmFpbGFibGVTcGFjZVthLmF4aXNdKTtcblxuICAgICAgICAgICAgaWYgKGZpdHRpbmdBY3Rpb24gPT09IEZJVFRJTkdfQUNUSU9OLkFQUExZX1NUUkVUQ0hJTkcpIHtcbiAgICAgICAgICAgICAgICBzdHJldGNoU2l6ZXNUb0ZpdENvbnRhaW5lcihzaXplc1RoaXNMaW5lLCBpZGVhbFJlcXVpcmVkU3BhY2UsIGEpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChmaXR0aW5nQWN0aW9uID09PSBGSVRUSU5HX0FDVElPTi5BUFBMWV9TSFJJTktJTkcpIHtcbiAgICAgICAgICAgICAgICBzaHJpbmtTaXplc1RvRml0Q29udGFpbmVyKHNpemVzVGhpc0xpbmUsIGlkZWFsUmVxdWlyZWRTcGFjZSwgYSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNpemVzQWxsTGluZXMucHVzaChzaXplc1RoaXNMaW5lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzaXplc0FsbExpbmVzO1xuICAgIH1cblxuICAgIC8vIENhbGN1bGF0ZSB0aGUgcmVxdWlyZWQgc2l6ZSBmb3IgZWFjaCBlbGVtZW50IG9uIGF4aXMgQiwgYmFzZWQgb24gdGhlIHJlcXVlc3RlZFxuICAgIC8vIGZpdHRpbmcgbW9kZS5cbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVTaXplc09uQXhpc0IobGluZXMsIHNpemVzQWxsTGluZXMpIHtcbiAgICAgICAgY29uc3QgbGFyZ2VzdEVsZW1lbnRzRm9yRWFjaExpbmUgPSBbXTtcbiAgICAgICAgY29uc3QgbGFyZ2VzdFNpemVzRm9yRWFjaExpbmUgPSBbXTtcblxuICAgICAgICAvLyBGaW5kIHRoZSBsYXJnZXN0IGVsZW1lbnQgb24gZWFjaCBsaW5lLlxuICAgICAgICBmb3IgKGxldCBsaW5lSW5kZXggPSAwOyBsaW5lSW5kZXggPCBsaW5lcy5sZW5ndGg7ICsrbGluZUluZGV4KSB7XG4gICAgICAgICAgICBjb25zdCBsaW5lID0gbGluZXNbbGluZUluZGV4XTtcbiAgICAgICAgICAgIGxpbmUubGFyZ2VzdEVsZW1lbnQgPSBudWxsO1xuICAgICAgICAgICAgbGluZS5sYXJnZXN0U2l6ZSA9IHsgd2lkdGg6IE51bWJlci5ORUdBVElWRV9JTkZJTklUWSwgaGVpZ2h0OiBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFkgfTtcblxuICAgICAgICAgICAgLy8gRmluZCB0aGUgbGFyZ2VzdCBlbGVtZW50IG9uIHRoaXMgbGluZS5cbiAgICAgICAgICAgIGZvciAobGV0IGVsZW1lbnRJbmRleCA9IDA7IGVsZW1lbnRJbmRleCA8IGxpbmUubGVuZ3RoOyArK2VsZW1lbnRJbmRleCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpemVzVGhpc0VsZW1lbnQgPSBzaXplc0FsbExpbmVzW2xpbmVJbmRleF1bZWxlbWVudEluZGV4XTtcblxuICAgICAgICAgICAgICAgIGlmIChzaXplc1RoaXNFbGVtZW50W2Iuc2l6ZV0gPiBsaW5lLmxhcmdlc3RTaXplW2Iuc2l6ZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgbGluZS5sYXJnZXN0RWxlbWVudCA9IGxpbmVbZWxlbWVudEluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgbGluZS5sYXJnZXN0U2l6ZSA9IHNpemVzVGhpc0VsZW1lbnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsYXJnZXN0RWxlbWVudHNGb3JFYWNoTGluZS5wdXNoKGxpbmUubGFyZ2VzdEVsZW1lbnQpO1xuICAgICAgICAgICAgbGFyZ2VzdFNpemVzRm9yRWFjaExpbmUucHVzaChsaW5lLmxhcmdlc3RTaXplKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBsaW5lIGhlaWdodHMgdXNpbmcgdGhlIGxhcmdlc3QgZWxlbWVudCBvbiBlYWNoIGxpbmUuXG4gICAgICAgIGNvbnN0IGlkZWFsUmVxdWlyZWRTcGFjZSA9IGNhbGN1bGF0ZVRvdGFsU3BhY2UobGFyZ2VzdFNpemVzRm9yRWFjaExpbmUsIGIpO1xuICAgICAgICBjb25zdCBmaXR0aW5nQWN0aW9uID0gZGV0ZXJtaW5lRml0dGluZ0FjdGlvbihvcHRpb25zW2IuZml0dGluZ10sIGlkZWFsUmVxdWlyZWRTcGFjZSwgYXZhaWxhYmxlU3BhY2VbYi5heGlzXSk7XG5cbiAgICAgICAgaWYgKGZpdHRpbmdBY3Rpb24gPT09IEZJVFRJTkdfQUNUSU9OLkFQUExZX1NUUkVUQ0hJTkcpIHtcbiAgICAgICAgICAgIHN0cmV0Y2hTaXplc1RvRml0Q29udGFpbmVyKGxhcmdlc3RTaXplc0ZvckVhY2hMaW5lLCBpZGVhbFJlcXVpcmVkU3BhY2UsIGIpO1xuICAgICAgICB9IGVsc2UgaWYgKGZpdHRpbmdBY3Rpb24gPT09IEZJVFRJTkdfQUNUSU9OLkFQUExZX1NIUklOS0lORykge1xuICAgICAgICAgICAgc2hyaW5rU2l6ZXNUb0ZpdENvbnRhaW5lcihsYXJnZXN0U2l6ZXNGb3JFYWNoTGluZSwgaWRlYWxSZXF1aXJlZFNwYWNlLCBiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBzaXplcyBmb3Igb3RoZXIgZWxlbWVudHMgYmFzZWQgb24gdGhlIGhlaWdodCBvZiB0aGUgbGluZSB0aGV5J3JlIG9uLlxuICAgICAgICBmb3IgKGxldCBsaW5lSW5kZXggPSAwOyBsaW5lSW5kZXggPCBsaW5lcy5sZW5ndGg7ICsrbGluZUluZGV4KSB7XG4gICAgICAgICAgICBjb25zdCBsaW5lID0gbGluZXNbbGluZUluZGV4XTtcblxuICAgICAgICAgICAgZm9yIChsZXQgZWxlbWVudEluZGV4ID0gMDsgZWxlbWVudEluZGV4IDwgbGluZS5sZW5ndGg7ICsrZWxlbWVudEluZGV4KSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2l6ZXNGb3JUaGlzRWxlbWVudCA9IHNpemVzQWxsTGluZXNbbGluZUluZGV4XVtlbGVtZW50SW5kZXhdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRTaXplID0gc2l6ZXNGb3JUaGlzRWxlbWVudFtiLnNpemVdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGF2YWlsYWJsZVNpemUgPSBsaW5lcy5sZW5ndGggPT09IDEgPyBhdmFpbGFibGVTcGFjZVtiLmF4aXNdIDogbGluZS5sYXJnZXN0U2l6ZVtiLnNpemVdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRGaXR0aW5nQWN0aW9uID0gZGV0ZXJtaW5lRml0dGluZ0FjdGlvbihvcHRpb25zW2IuZml0dGluZ10sIGN1cnJlbnRTaXplLCBhdmFpbGFibGVTaXplKTtcblxuICAgICAgICAgICAgICAgIGlmIChlbGVtZW50Rml0dGluZ0FjdGlvbiA9PT0gRklUVElOR19BQ1RJT04uQVBQTFlfU1RSRVRDSElORykge1xuICAgICAgICAgICAgICAgICAgICBzaXplc0ZvclRoaXNFbGVtZW50W2Iuc2l6ZV0gPSBNYXRoLm1pbihhdmFpbGFibGVTaXplLCBzaXplc0ZvclRoaXNFbGVtZW50W2IubWF4U2l6ZV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudEZpdHRpbmdBY3Rpb24gPT09IEZJVFRJTkdfQUNUSU9OLkFQUExZX1NIUklOS0lORykge1xuICAgICAgICAgICAgICAgICAgICBzaXplc0ZvclRoaXNFbGVtZW50W2Iuc2l6ZV0gPSBNYXRoLm1heChhdmFpbGFibGVTaXplLCBzaXplc0ZvclRoaXNFbGVtZW50W2IubWluU2l6ZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzaXplc0FsbExpbmVzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRldGVybWluZUZpdHRpbmdBY3Rpb24oZml0dGluZ01vZGUsIGN1cnJlbnRTaXplLCBhdmFpbGFibGVTaXplKSB7XG4gICAgICAgIHN3aXRjaCAoZml0dGluZ01vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgRklUVElOR19OT05FOlxuICAgICAgICAgICAgICAgIHJldHVybiBGSVRUSU5HX0FDVElPTi5OT05FO1xuXG4gICAgICAgICAgICBjYXNlIEZJVFRJTkdfU1RSRVRDSDpcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFNpemUgPCBhdmFpbGFibGVTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBGSVRUSU5HX0FDVElPTi5BUFBMWV9TVFJFVENISU5HO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBGSVRUSU5HX0FDVElPTi5OT05FO1xuXG4gICAgICAgICAgICBjYXNlIEZJVFRJTkdfU0hSSU5LOlxuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50U2l6ZSA+PSBhdmFpbGFibGVTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBGSVRUSU5HX0FDVElPTi5BUFBMWV9TSFJJTktJTkc7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIEZJVFRJTkdfQUNUSU9OLk5PTkU7XG5cbiAgICAgICAgICAgIGNhc2UgRklUVElOR19CT1RIOlxuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50U2l6ZSA8IGF2YWlsYWJsZVNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEZJVFRJTkdfQUNUSU9OLkFQUExZX1NUUkVUQ0hJTkc7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIEZJVFRJTkdfQUNUSU9OLkFQUExZX1NIUklOS0lORztcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVjb2duaXplZCBmaXR0aW5nIG1vZGU6ICR7Zml0dGluZ01vZGV9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVUb3RhbFNwYWNlKHNpemVzLCBheGlzKSB7XG4gICAgICAgIGNvbnN0IHRvdGFsU2l6ZXMgPSBzdW1WYWx1ZXMoc2l6ZXMsIGF4aXMuc2l6ZSk7XG4gICAgICAgIGNvbnN0IHRvdGFsU3BhY2luZyA9IChzaXplcy5sZW5ndGggLSAxKSAqIG9wdGlvbnMuc3BhY2luZ1theGlzLmF4aXNdO1xuXG4gICAgICAgIHJldHVybiB0b3RhbFNpemVzICsgdG90YWxTcGFjaW5nO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0cmV0Y2hTaXplc1RvRml0Q29udGFpbmVyKHNpemVzVGhpc0xpbmUsIGlkZWFsUmVxdWlyZWRTcGFjZSwgYXhpcykge1xuICAgICAgICBjb25zdCBhc2NlbmRpbmdNYXhTaXplT3JkZXIgPSBnZXRUcmF2ZXJzYWxPcmRlcihzaXplc1RoaXNMaW5lLCBheGlzLm1heFNpemUpO1xuICAgICAgICBjb25zdCBmaXR0aW5nUHJvcG9ydGlvbnMgPSBnZXROb3JtYWxpemVkVmFsdWVzKHNpemVzVGhpc0xpbmUsIGF4aXMuZml0dGluZ1Byb3BvcnRpb24pO1xuICAgICAgICBjb25zdCBmaXR0aW5nUHJvcG9ydGlvblN1bXMgPSBjcmVhdGVTdW1BcnJheShmaXR0aW5nUHJvcG9ydGlvbnMsIGFzY2VuZGluZ01heFNpemVPcmRlcik7XG5cbiAgICAgICAgLy8gU3RhcnQgYnkgd29ya2luZyBvdXQgaG93IG11Y2ggd2UgaGF2ZSB0byBzdHJldGNoIHRoZSBjaGlsZCBlbGVtZW50cyBieVxuICAgICAgICAvLyBpbiB0b3RhbCBpbiBvcmRlciB0byBmaWxsIHRoZSBhdmFpbGFibGUgc3BhY2UgaW4gdGhlIGNvbnRhaW5lclxuICAgICAgICBsZXQgcmVtYWluaW5nVW5kZXJzaG9vdCA9IGF2YWlsYWJsZVNwYWNlW2F4aXMuYXhpc10gLSBpZGVhbFJlcXVpcmVkU3BhY2U7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzaXplc1RoaXNMaW5lLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAvLyBBcyBzb21lIGVsZW1lbnRzIG1heSBoYXZlIGEgbWF4aW11bSBzaXplIGRlZmluZWQsIHdlIG1pZ2h0IG5vdCBiZVxuICAgICAgICAgICAgLy8gYWJsZSB0byBzY2FsZSBhbGwgZWxlbWVudHMgYnkgdGhlIGlkZWFsIGFtb3VudCBuZWNlc3NhcnkgaW4gb3JkZXJcbiAgICAgICAgICAgIC8vIHRvIGZpbGwgdGhlIGF2YWlsYWJsZSBzcGFjZS4gVG8gYWNjb3VudCBmb3IgdGhpcywgd2UgcnVuIHRocm91Z2hcbiAgICAgICAgICAgIC8vIHRoZSBlbGVtZW50cyBpbiBhc2NlbmRpbmcgb3JkZXIgb2YgdGhlaXIgbWF4aW11bSBzaXplLCByZWRpc3RyaWJ1dGluZ1xuICAgICAgICAgICAgLy8gYW55IHJlbWFpbmluZyBzcGFjZSB0byB0aGUgb3RoZXIgZWxlbWVudHMgdGhhdCBhcmUgbW9yZSBhYmxlIHRvXG4gICAgICAgICAgICAvLyBtYWtlIHVzZSBvZiBpdC5cbiAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gYXNjZW5kaW5nTWF4U2l6ZU9yZGVyW2ldO1xuXG4gICAgICAgICAgICAvLyBXb3JrIG91dCBob3cgbXVjaCB3ZSBpZGVhbGx5IHdhbnQgdG8gc3RyZXRjaCB0aGlzIGVsZW1lbnQgYnksIGJhc2VkXG4gICAgICAgICAgICAvLyBvbiB0aGUgYW1vdW50IG9mIHNwYWNlIHJlbWFpbmluZyBhbmQgdGhlIGZpdHRpbmcgcHJvcG9ydGlvbiB2YWx1ZSB0aGF0XG4gICAgICAgICAgICAvLyB3YXMgc3BlY2lmaWVkLlxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0SW5jcmVhc2UgPSBjYWxjdWxhdGVBZGp1c3RtZW50KGluZGV4LCByZW1haW5pbmdVbmRlcnNob290LCBmaXR0aW5nUHJvcG9ydGlvbnMsIGZpdHRpbmdQcm9wb3J0aW9uU3Vtcyk7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRTaXplID0gc2l6ZXNUaGlzTGluZVtpbmRleF1bYXhpcy5zaXplXSArIHRhcmdldEluY3JlYXNlO1xuXG4gICAgICAgICAgICAvLyBXb3JrIG91dCBob3cgbXVjaCB3ZSdyZSBhY3R1YWxseSBhYmxlIHRvIHN0cmV0Y2ggdGhpcyBlbGVtZW50IGJ5LFxuICAgICAgICAgICAgLy8gYmFzZWQgb24gaXRzIG1heGltdW0gc2l6ZSwgYW5kIGFwcGx5IHRoZSByZXN1bHQuXG4gICAgICAgICAgICBjb25zdCBtYXhTaXplID0gc2l6ZXNUaGlzTGluZVtpbmRleF1bYXhpcy5tYXhTaXplXTtcbiAgICAgICAgICAgIGNvbnN0IGFjdHVhbFNpemUgPSBNYXRoLm1pbih0YXJnZXRTaXplLCBtYXhTaXplKTtcblxuICAgICAgICAgICAgc2l6ZXNUaGlzTGluZVtpbmRleF1bYXhpcy5zaXplXSA9IGFjdHVhbFNpemU7XG5cbiAgICAgICAgICAgIC8vIFdvcmsgb3V0IGhvdyBtdWNoIG9mIHRoZSB0b3RhbCB1bmRlcnNob290IHZhbHVlIHdlJ3ZlIGp1c3QgdXNlZCxcbiAgICAgICAgICAgIC8vIGFuZCBkZWNyZW1lbnQgdGhlIHJlbWFpbmluZyB2YWx1ZSBieSB0aGlzIG11Y2guXG4gICAgICAgICAgICBjb25zdCBhY3R1YWxJbmNyZWFzZSA9IE1hdGgubWF4KHRhcmdldFNpemUgLSBhY3R1YWxTaXplLCAwKTtcbiAgICAgICAgICAgIGNvbnN0IGFwcGxpZWRJbmNyZWFzZSA9IHRhcmdldEluY3JlYXNlIC0gYWN0dWFsSW5jcmVhc2U7XG5cbiAgICAgICAgICAgIHJlbWFpbmluZ1VuZGVyc2hvb3QgLT0gYXBwbGllZEluY3JlYXNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gVGhpcyBsb29wIGlzIHZlcnkgc2ltaWxhciB0byB0aGUgb25lIGluIHN0cmV0Y2hTaXplc1RvRml0Q29udGFpbmVyKCkgYWJvdmUsXG4gICAgLy8gYnV0IHdpdGggc29tZSBhd2t3YXJkIGludmVyc2lvbnMgYW5kIHVzZSBvZiBtaW4gYXMgb3Bwb3NlZCB0byBtYXggZXRjIHRoYXRcbiAgICAvLyBtZWFuIGEgbW9yZSBnZW5lcmFsaXplZCB2ZXJzaW9uIHdvdWxkIHByb2JhYmx5IGJlIGhhcmRlciB0byByZWFkL2RlYnVnIHRoYW5cbiAgICAvLyBqdXN0IGhhdmluZyBhIHNtYWxsIGFtb3VudCBvZiBkdXBsaWNhdGlvbi5cbiAgICBmdW5jdGlvbiBzaHJpbmtTaXplc1RvRml0Q29udGFpbmVyKHNpemVzVGhpc0xpbmUsIGlkZWFsUmVxdWlyZWRTcGFjZSwgYXhpcykge1xuICAgICAgICBjb25zdCBkZXNjZW5kaW5nTWluU2l6ZU9yZGVyID0gZ2V0VHJhdmVyc2FsT3JkZXIoc2l6ZXNUaGlzTGluZSwgYXhpcy5taW5TaXplLCB0cnVlKTtcbiAgICAgICAgY29uc3QgZml0dGluZ1Byb3BvcnRpb25zID0gZ2V0Tm9ybWFsaXplZFZhbHVlcyhzaXplc1RoaXNMaW5lLCBheGlzLmZpdHRpbmdQcm9wb3J0aW9uKTtcbiAgICAgICAgY29uc3QgaW52ZXJzZUZpdHRpbmdQcm9wb3J0aW9ucyA9IGludmVydE5vcm1hbGl6ZWRWYWx1ZXMoZml0dGluZ1Byb3BvcnRpb25zKTtcbiAgICAgICAgY29uc3QgaW52ZXJzZUZpdHRpbmdQcm9wb3J0aW9uU3VtcyA9IGNyZWF0ZVN1bUFycmF5KGludmVyc2VGaXR0aW5nUHJvcG9ydGlvbnMsIGRlc2NlbmRpbmdNaW5TaXplT3JkZXIpO1xuXG4gICAgICAgIGxldCByZW1haW5pbmdPdmVyc2hvb3QgPSBpZGVhbFJlcXVpcmVkU3BhY2UgLSBhdmFpbGFibGVTcGFjZVtheGlzLmF4aXNdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2l6ZXNUaGlzTGluZS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBkZXNjZW5kaW5nTWluU2l6ZU9yZGVyW2ldO1xuXG4gICAgICAgICAgICAvLyBTaW1pbGFyIHRvIHRoZSBzdHJldGNoIGNhbGN1bGF0aW9uIGFib3ZlLCB3ZSBjYWxjdWxhdGUgdGhlIGlkZWFsXG4gICAgICAgICAgICAvLyBzaXplIHJlZHVjdGlvbiB2YWx1ZSBmb3IgdGhpcyBlbGVtZW50IGJhc2VkIG9uIGl0cyBmaXR0aW5nIHByb3BvcnRpb24uXG4gICAgICAgICAgICAvLyBIb3dldmVyLCBub3RlIHRoYXQgd2UncmUgdXNpbmcgdGhlIGludmVyc2Ugb2YgdGhlIGZpdHRpbmcgdmFsdWUsIGFzXG4gICAgICAgICAgICAvLyB1c2luZyB0aGUgcmVndWxhciB2YWx1ZSB3b3VsZCBtZWFuIHRoYXQgYW4gZWxlbWVudCB3aXRoIGEgZml0dGluZ1xuICAgICAgICAgICAgLy8gdmFsdWUgb2YsIHNheSwgMC40LCBlbmRzIHVwIHJlbmRlcmluZyB2ZXJ5IHNtYWxsIHdoZW4gc2hyaW5raW5nIGlzXG4gICAgICAgICAgICAvLyBiZWluZyBhcHBsaWVkLiBVc2luZyB0aGUgaW52ZXJzZSBtZWFucyB0aGF0IHRoZSBiYWxhbmNlIG9mIHNpemVzXG4gICAgICAgICAgICAvLyBiZXR3ZWVuIGVsZW1lbnRzIGlzIHNpbWlsYXIgZm9yIGJvdGggdGhlIFN0cmV0Y2ggYW5kIFNocmluayBtb2Rlcy5cbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFJlZHVjdGlvbiA9IGNhbGN1bGF0ZUFkanVzdG1lbnQoaW5kZXgsIHJlbWFpbmluZ092ZXJzaG9vdCwgaW52ZXJzZUZpdHRpbmdQcm9wb3J0aW9ucywgaW52ZXJzZUZpdHRpbmdQcm9wb3J0aW9uU3Vtcyk7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRTaXplID0gc2l6ZXNUaGlzTGluZVtpbmRleF1bYXhpcy5zaXplXSAtIHRhcmdldFJlZHVjdGlvbjtcblxuICAgICAgICAgICAgY29uc3QgbWluU2l6ZSA9IHNpemVzVGhpc0xpbmVbaW5kZXhdW2F4aXMubWluU2l6ZV07XG4gICAgICAgICAgICBjb25zdCBhY3R1YWxTaXplID0gTWF0aC5tYXgodGFyZ2V0U2l6ZSwgbWluU2l6ZSk7XG5cbiAgICAgICAgICAgIHNpemVzVGhpc0xpbmVbaW5kZXhdW2F4aXMuc2l6ZV0gPSBhY3R1YWxTaXplO1xuXG4gICAgICAgICAgICBjb25zdCBhY3R1YWxSZWR1Y3Rpb24gPSBNYXRoLm1heChhY3R1YWxTaXplIC0gdGFyZ2V0U2l6ZSwgMCk7XG4gICAgICAgICAgICBjb25zdCBhcHBsaWVkUmVkdWN0aW9uID0gdGFyZ2V0UmVkdWN0aW9uIC0gYWN0dWFsUmVkdWN0aW9uO1xuXG4gICAgICAgICAgICByZW1haW5pbmdPdmVyc2hvb3QgLT0gYXBwbGllZFJlZHVjdGlvbjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhbGN1bGF0ZUFkanVzdG1lbnQoaW5kZXgsIHJlbWFpbmluZ0FkanVzdG1lbnQsIGZpdHRpbmdQcm9wb3J0aW9ucywgZml0dGluZ1Byb3BvcnRpb25TdW1zKSB7XG4gICAgICAgIGNvbnN0IHByb3BvcnRpb24gPSBmaXR0aW5nUHJvcG9ydGlvbnNbaW5kZXhdO1xuICAgICAgICBjb25zdCBzdW1PZlJlbWFpbmluZ1Byb3BvcnRpb25zID0gZml0dGluZ1Byb3BvcnRpb25TdW1zW2luZGV4XTtcblxuICAgICAgICBpZiAoTWF0aC5hYnMocHJvcG9ydGlvbikgPCAxZS01ICYmIE1hdGguYWJzKHN1bU9mUmVtYWluaW5nUHJvcG9ydGlvbnMpIDwgMWUtNSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlbWFpbmluZ0FkanVzdG1lbnQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVtYWluaW5nQWRqdXN0bWVudCAqIHByb3BvcnRpb24gLyBzdW1PZlJlbWFpbmluZ1Byb3BvcnRpb25zO1xuICAgIH1cblxuICAgIC8vIENhbGN1bGF0ZSBiYXNlIHBvc2l0aW9ucyBiYXNlZCBvbiB0aGUgZWxlbWVudCBzaXplcyBhbmQgc3BhY2luZy5cbiAgICBmdW5jdGlvbiBjYWxjdWxhdGVCYXNlUG9zaXRpb25zKGxpbmVzLCBzaXplcykge1xuICAgICAgICBjb25zdCBjdXJzb3IgPSB7fTtcbiAgICAgICAgY3Vyc29yW2EuYXhpc10gPSAwO1xuICAgICAgICBjdXJzb3JbYi5heGlzXSA9IDA7XG5cbiAgICAgICAgbGluZXNbYS5zaXplXSA9IE51bWJlci5ORUdBVElWRV9JTkZJTklUWTtcblxuICAgICAgICBjb25zdCBwb3NpdGlvbnNBbGxMaW5lcyA9IFtdO1xuXG4gICAgICAgIGZvciAobGV0IGxpbmVJbmRleCA9IDA7IGxpbmVJbmRleCA8IGxpbmVzLmxlbmd0aDsgKytsaW5lSW5kZXgpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tsaW5lSW5kZXhdO1xuXG4gICAgICAgICAgICBpZiAobGluZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICBwb3NpdGlvbnNBbGxMaW5lcy5wdXNoKFtdKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcG9zaXRpb25zVGhpc0xpbmUgPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHNpemVzVGhpc0xpbmUgPSBzaXplc1tsaW5lSW5kZXhdO1xuXG4gICAgICAgICAgICAvLyBEaXN0cmlidXRlIGVsZW1lbnRzIGFsb25nIHRoZSBsaW5lXG4gICAgICAgICAgICBmb3IgKGxldCBlbGVtZW50SW5kZXggPSAwOyBlbGVtZW50SW5kZXggPCBsaW5lLmxlbmd0aDsgKytlbGVtZW50SW5kZXgpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gbGluZVtlbGVtZW50SW5kZXhdO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNpemVzVGhpc0VsZW1lbnQgPSBzaXplc1RoaXNMaW5lW2VsZW1lbnRJbmRleF07XG5cbiAgICAgICAgICAgICAgICBjdXJzb3JbYi5heGlzXSAtPSBtaW5FeHRlbnRCKGVsZW1lbnQsIHNpemVzVGhpc0VsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGN1cnNvclthLmF4aXNdIC09IG1pbkV4dGVudEEoZWxlbWVudCwgc2l6ZXNUaGlzRWxlbWVudCk7XG5cbiAgICAgICAgICAgICAgICBwb3NpdGlvbnNUaGlzTGluZVtlbGVtZW50SW5kZXhdID0ge307XG4gICAgICAgICAgICAgICAgcG9zaXRpb25zVGhpc0xpbmVbZWxlbWVudEluZGV4XVthLmF4aXNdID0gY3Vyc29yW2EuYXhpc107XG4gICAgICAgICAgICAgICAgcG9zaXRpb25zVGhpc0xpbmVbZWxlbWVudEluZGV4XVtiLmF4aXNdID0gY3Vyc29yW2IuYXhpc107XG5cbiAgICAgICAgICAgICAgICBjdXJzb3JbYi5heGlzXSArPSBtaW5FeHRlbnRCKGVsZW1lbnQsIHNpemVzVGhpc0VsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGN1cnNvclthLmF4aXNdICs9IG1heEV4dGVudEEoZWxlbWVudCwgc2l6ZXNUaGlzRWxlbWVudCkgKyBvcHRpb25zLnNwYWNpbmdbYS5heGlzXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVjb3JkIHRoZSBzaXplIG9mIHRoZSBvdmVyYWxsIGxpbmVcbiAgICAgICAgICAgIGxpbmVbYS5zaXplXSA9IGN1cnNvclthLmF4aXNdIC0gb3B0aW9ucy5zcGFjaW5nW2EuYXhpc107XG4gICAgICAgICAgICBsaW5lW2Iuc2l6ZV0gPSBsaW5lLmxhcmdlc3RTaXplW2Iuc2l6ZV07XG5cbiAgICAgICAgICAgIC8vIEtlZXAgdHJhY2sgb2YgdGhlIGxvbmdlc3QgbGluZVxuICAgICAgICAgICAgbGluZXNbYS5zaXplXSA9IE1hdGgubWF4KGxpbmVzW2Euc2l6ZV0sIGxpbmVbYS5zaXplXSk7XG5cbiAgICAgICAgICAgIC8vIE1vdmUgdGhlIGN1cnNvciB0byB0aGUgbmV4dCBsaW5lXG4gICAgICAgICAgICBjdXJzb3JbYS5heGlzXSA9IDA7XG4gICAgICAgICAgICBjdXJzb3JbYi5heGlzXSArPSBsaW5lW2Iuc2l6ZV0gKyBvcHRpb25zLnNwYWNpbmdbYi5heGlzXTtcblxuICAgICAgICAgICAgcG9zaXRpb25zQWxsTGluZXMucHVzaChwb3NpdGlvbnNUaGlzTGluZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNvcmQgdGhlIHNpemUgb2YgdGhlIGZ1bGwgc2V0IG9mIGxpbmVzXG4gICAgICAgIGxpbmVzW2Iuc2l6ZV0gPSBjdXJzb3JbYi5heGlzXSAtIG9wdGlvbnMuc3BhY2luZ1tiLmF4aXNdO1xuXG4gICAgICAgIHJldHVybiBwb3NpdGlvbnNBbGxMaW5lcztcbiAgICB9XG5cbiAgICAvLyBBZGp1c3QgYmFzZSBwb3NpdGlvbnMgdG8gYWNjb3VudCBmb3IgdGhlIHJlcXVlc3RlZCBhbGlnbm1lbnQgYW5kIHBhZGRpbmcuXG4gICAgZnVuY3Rpb24gYXBwbHlBbGlnbm1lbnRBbmRQYWRkaW5nKGxpbmVzLCBzaXplcywgcG9zaXRpb25zKSB7XG4gICAgICAgIGNvbnN0IGFsaWdubWVudEEgPSBvcHRpb25zLmFsaWdubWVudFthLmF4aXNdO1xuICAgICAgICBjb25zdCBhbGlnbm1lbnRCID0gb3B0aW9ucy5hbGlnbm1lbnRbYi5heGlzXTtcblxuICAgICAgICBjb25zdCBwYWRkaW5nQSA9IG9wdGlvbnMucGFkZGluZ1thLmF4aXNdO1xuICAgICAgICBjb25zdCBwYWRkaW5nQiA9IG9wdGlvbnMucGFkZGluZ1tiLmF4aXNdO1xuXG4gICAgICAgIGZvciAobGV0IGxpbmVJbmRleCA9IDA7IGxpbmVJbmRleCA8IGxpbmVzLmxlbmd0aDsgKytsaW5lSW5kZXgpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tsaW5lSW5kZXhdO1xuICAgICAgICAgICAgY29uc3Qgc2l6ZXNUaGlzTGluZSA9IHNpemVzW2xpbmVJbmRleF07XG4gICAgICAgICAgICBjb25zdCBwb3NpdGlvbnNUaGlzTGluZSA9IHBvc2l0aW9uc1tsaW5lSW5kZXhdO1xuXG4gICAgICAgICAgICBjb25zdCBheGlzQU9mZnNldCA9IChhdmFpbGFibGVTcGFjZVthLmF4aXNdIC0gbGluZVthLnNpemVdKSAgKiBhbGlnbm1lbnRBICsgcGFkZGluZ0E7XG4gICAgICAgICAgICBjb25zdCBheGlzQk9mZnNldCA9IChhdmFpbGFibGVTcGFjZVtiLmF4aXNdIC0gbGluZXNbYi5zaXplXSkgKiBhbGlnbm1lbnRCICsgcGFkZGluZ0I7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGVsZW1lbnRJbmRleCA9IDA7IGVsZW1lbnRJbmRleCA8IGxpbmUubGVuZ3RoOyArK2VsZW1lbnRJbmRleCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHdpdGhpbkxpbmVBeGlzQk9mZnNldCA9IChsaW5lW2Iuc2l6ZV0gLSBzaXplc1RoaXNMaW5lW2VsZW1lbnRJbmRleF1bYi5zaXplXSkgKiBvcHRpb25zLmFsaWdubWVudFtiLmF4aXNdO1xuXG4gICAgICAgICAgICAgICAgcG9zaXRpb25zVGhpc0xpbmVbZWxlbWVudEluZGV4XVthLmF4aXNdICs9IGF4aXNBT2Zmc2V0O1xuICAgICAgICAgICAgICAgIHBvc2l0aW9uc1RoaXNMaW5lW2VsZW1lbnRJbmRleF1bYi5heGlzXSArPSBheGlzQk9mZnNldCArIHdpdGhpbkxpbmVBeGlzQk9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFwcGxpZXMgdGhlIGZpbmFsIGNhbGN1bGF0ZWQgc2l6ZXMgYW5kIHBvc2l0aW9ucyBiYWNrIHRvIGVsZW1lbnRzIHRoZW1zZWx2ZXMuXG4gICAgZnVuY3Rpb24gYXBwbHlTaXplc0FuZFBvc2l0aW9ucyhsaW5lcywgc2l6ZXMsIHBvc2l0aW9ucykge1xuICAgICAgICBmb3IgKGxldCBsaW5lSW5kZXggPSAwOyBsaW5lSW5kZXggPCBsaW5lcy5sZW5ndGg7ICsrbGluZUluZGV4KSB7XG4gICAgICAgICAgICBjb25zdCBsaW5lID0gbGluZXNbbGluZUluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IHNpemVzVGhpc0xpbmUgPSBzaXplc1tsaW5lSW5kZXhdO1xuICAgICAgICAgICAgY29uc3QgcG9zaXRpb25zVGhpc0xpbmUgPSBwb3NpdGlvbnNbbGluZUluZGV4XTtcblxuICAgICAgICAgICAgZm9yIChsZXQgZWxlbWVudEluZGV4ID0gMDsgZWxlbWVudEluZGV4IDwgbGluZS5sZW5ndGg7ICsrZWxlbWVudEluZGV4KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IGxpbmVbZWxlbWVudEluZGV4XTtcblxuICAgICAgICAgICAgICAgIGVsZW1lbnRbYS5jYWxjdWxhdGVkU2l6ZV0gPSBzaXplc1RoaXNMaW5lW2VsZW1lbnRJbmRleF1bYS5zaXplXTtcbiAgICAgICAgICAgICAgICBlbGVtZW50W2IuY2FsY3VsYXRlZFNpemVdID0gc2l6ZXNUaGlzTGluZVtlbGVtZW50SW5kZXhdW2Iuc2l6ZV07XG5cbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5vcmllbnRhdGlvbiA9PT0gT1JJRU5UQVRJT05fSE9SSVpPTlRBTCkge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25zVGhpc0xpbmVbZWxlbWVudEluZGV4XVthLmF4aXNdLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25zVGhpc0xpbmVbZWxlbWVudEluZGV4XVtiLmF4aXNdLFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpLnpcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25zVGhpc0xpbmVbZWxlbWVudEluZGV4XVtiLmF4aXNdLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25zVGhpc0xpbmVbZWxlbWVudEluZGV4XVthLmF4aXNdLFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpLnpcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVMYXlvdXRJbmZvKGxpbmVzKSB7XG4gICAgICAgIGNvbnN0IGxheW91dFdpZHRoID0gbGluZXMud2lkdGg7XG4gICAgICAgIGNvbnN0IGxheW91dEhlaWdodCA9IGxpbmVzLmhlaWdodDtcblxuICAgICAgICBjb25zdCB4T2Zmc2V0ID0gKGF2YWlsYWJsZVNwYWNlLnggLSBsYXlvdXRXaWR0aCkgKiBvcHRpb25zLmFsaWdubWVudC54ICsgb3B0aW9ucy5wYWRkaW5nLng7XG4gICAgICAgIGNvbnN0IHlPZmZzZXQgPSAoYXZhaWxhYmxlU3BhY2UueSAtIGxheW91dEhlaWdodCkgKiBvcHRpb25zLmFsaWdubWVudC55ICsgb3B0aW9ucy5wYWRkaW5nLnk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGJvdW5kczogbmV3IFZlYzQoXG4gICAgICAgICAgICAgICAgeE9mZnNldCxcbiAgICAgICAgICAgICAgICB5T2Zmc2V0LFxuICAgICAgICAgICAgICAgIGxheW91dFdpZHRoLFxuICAgICAgICAgICAgICAgIGxheW91dEhlaWdodFxuICAgICAgICAgICAgKVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIFJlYWRzIGFsbCBzaXplLXJlbGF0ZWQgcHJvcGVydGllcyBmb3IgZWFjaCBlbGVtZW50IGFuZCBhcHBsaWVzIHNvbWUgYmFzaWNcbiAgICAvLyBzYW5pdGl6YXRpb24gdG8gZW5zdXJlIHRoYXQgbWluV2lkdGggaXMgZ3JlYXRlciB0aGFuIDAsIG1heFdpZHRoIGlzIGdyZWF0ZXJcbiAgICAvLyB0aGFuIG1pbldpZHRoLCBldGMuXG4gICAgZnVuY3Rpb24gZ2V0RWxlbWVudFNpemVQcm9wZXJ0aWVzKGVsZW1lbnRzKSB7XG4gICAgICAgIGNvbnN0IHNpemVQcm9wZXJ0aWVzID0gW107XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IGVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWluV2lkdGggID0gTWF0aC5tYXgoZ2V0UHJvcGVydHkoZWxlbWVudCwgJ21pbldpZHRoJyksIDApO1xuICAgICAgICAgICAgY29uc3QgbWluSGVpZ2h0ID0gTWF0aC5tYXgoZ2V0UHJvcGVydHkoZWxlbWVudCwgJ21pbkhlaWdodCcpLCAwKTtcbiAgICAgICAgICAgIGNvbnN0IG1heFdpZHRoICA9IE1hdGgubWF4KGdldFByb3BlcnR5KGVsZW1lbnQsICdtYXhXaWR0aCcpLCBtaW5XaWR0aCk7XG4gICAgICAgICAgICBjb25zdCBtYXhIZWlnaHQgPSBNYXRoLm1heChnZXRQcm9wZXJ0eShlbGVtZW50LCAnbWF4SGVpZ2h0JyksIG1pbkhlaWdodCk7XG4gICAgICAgICAgICBjb25zdCB3aWR0aCAgPSBjbGFtcChnZXRQcm9wZXJ0eShlbGVtZW50LCAnd2lkdGgnKSwgbWluV2lkdGgsIG1heFdpZHRoKTtcbiAgICAgICAgICAgIGNvbnN0IGhlaWdodCA9IGNsYW1wKGdldFByb3BlcnR5KGVsZW1lbnQsICdoZWlnaHQnKSwgbWluSGVpZ2h0LCBtYXhIZWlnaHQpO1xuICAgICAgICAgICAgY29uc3QgZml0V2lkdGhQcm9wb3J0aW9uICA9IGdldFByb3BlcnR5KGVsZW1lbnQsICdmaXRXaWR0aFByb3BvcnRpb24nKTtcbiAgICAgICAgICAgIGNvbnN0IGZpdEhlaWdodFByb3BvcnRpb24gPSBnZXRQcm9wZXJ0eShlbGVtZW50LCAnZml0SGVpZ2h0UHJvcG9ydGlvbicpO1xuXG4gICAgICAgICAgICBzaXplUHJvcGVydGllcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBtaW5XaWR0aDogbWluV2lkdGgsXG4gICAgICAgICAgICAgICAgbWluSGVpZ2h0OiBtaW5IZWlnaHQsXG4gICAgICAgICAgICAgICAgbWF4V2lkdGg6IG1heFdpZHRoLFxuICAgICAgICAgICAgICAgIG1heEhlaWdodDogbWF4SGVpZ2h0LFxuICAgICAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgICAgICBmaXRXaWR0aFByb3BvcnRpb246IGZpdFdpZHRoUHJvcG9ydGlvbixcbiAgICAgICAgICAgICAgICBmaXRIZWlnaHRQcm9wb3J0aW9uOiBmaXRIZWlnaHRQcm9wb3J0aW9uXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzaXplUHJvcGVydGllcztcbiAgICB9XG5cbiAgICAvLyBXaGVuIHJlYWRpbmcgYW4gZWxlbWVudCdzIHdpZHRoL2hlaWdodCwgbWluV2lkdGgvbWluSGVpZ2h0IGV0Yywgd2UgaGF2ZSB0byBsb29rIGluXG4gICAgLy8gYSBmZXcgZGlmZmVyZW50IHBsYWNlcyBpbiBvcmRlci4gVGhpcyBpcyBiZWNhdXNlIHRoZSBwcmVzZW5jZSBvZiBhIExheW91dENoaWxkQ29tcG9uZW50XG4gICAgLy8gb24gZWFjaCBlbGVtZW50IGlzIG9wdGlvbmFsLCBhbmQgZWFjaCBwcm9wZXJ0eSB2YWx1ZSBhbHNvIGhhcyBhIHNldCBvZiBmYWxsYmFjayBkZWZhdWx0c1xuICAgIC8vIHRvIGJlIHVzZWQgaW4gY2FzZXMgd2hlcmUgbm8gdmFsdWUgaXMgc3BlY2lmaWVkLlxuICAgIGZ1bmN0aW9uIGdldFByb3BlcnR5KGVsZW1lbnQsIHByb3BlcnR5TmFtZSkge1xuICAgICAgICBjb25zdCBsYXlvdXRDaGlsZENvbXBvbmVudCA9IGVsZW1lbnQuZW50aXR5LmxheW91dGNoaWxkO1xuXG4gICAgICAgIC8vIEZpcnN0IGF0dGVtcHQgdG8gZ2V0IHRoZSB2YWx1ZSBmcm9tIHRoZSBlbGVtZW50J3MgTGF5b3V0Q2hpbGRDb21wb25lbnQsIGlmIHByZXNlbnQuXG4gICAgICAgIGlmIChsYXlvdXRDaGlsZENvbXBvbmVudCAmJiBsYXlvdXRDaGlsZENvbXBvbmVudC5lbmFibGVkICYmIGxheW91dENoaWxkQ29tcG9uZW50W3Byb3BlcnR5TmFtZV0gIT09IHVuZGVmaW5lZCAmJiBsYXlvdXRDaGlsZENvbXBvbmVudFtwcm9wZXJ0eU5hbWVdICE9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbGF5b3V0Q2hpbGRDb21wb25lbnRbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50W3Byb3BlcnR5TmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnRbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBQUk9QRVJUWV9ERUZBVUxUU1twcm9wZXJ0eU5hbWVdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNsYW1wKHZhbHVlLCBtaW4sIG1heCkge1xuICAgICAgICByZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgodmFsdWUsIG1pbiksIG1heCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc3VtVmFsdWVzKGl0ZW1zLCBwcm9wZXJ0eU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGl0ZW1zLnJlZHVjZShmdW5jdGlvbiAoYWNjdW11bGF0b3IsIGN1cnJlbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBhY2N1bXVsYXRvciArIGN1cnJlbnRbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgfSwgMCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0Tm9ybWFsaXplZFZhbHVlcyhpdGVtcywgcHJvcGVydHlOYW1lKSB7XG4gICAgICAgIGNvbnN0IHN1bSA9IHN1bVZhbHVlcyhpdGVtcywgcHJvcGVydHlOYW1lKTtcbiAgICAgICAgY29uc3Qgbm9ybWFsaXplZFZhbHVlcyA9IFtdO1xuICAgICAgICBjb25zdCBudW1JdGVtcyA9IGl0ZW1zLmxlbmd0aDtcblxuICAgICAgICBpZiAoc3VtID09PSAwKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUl0ZW1zOyArK2kpIHtcbiAgICAgICAgICAgICAgICBub3JtYWxpemVkVmFsdWVzLnB1c2goMSAvIG51bUl0ZW1zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtSXRlbXM7ICsraSkge1xuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZWRWYWx1ZXMucHVzaChpdGVtc1tpXVtwcm9wZXJ0eU5hbWVdIC8gc3VtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBub3JtYWxpemVkVmFsdWVzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGludmVydE5vcm1hbGl6ZWRWYWx1ZXModmFsdWVzKSB7XG4gICAgICAgIC8vIEd1YXJkIGFnYWluc3QgZGl2aWRlIGJ5IHplcm8gZXJyb3IgaW4gdGhlIGludmVyc2lvbiBjYWxjdWxhdGlvbiBiZWxvd1xuICAgICAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgcmV0dXJuIFsxXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGludmVydGVkVmFsdWVzID0gW107XG4gICAgICAgIGNvbnN0IG51bVZhbHVlcyA9IHZhbHVlcy5sZW5ndGg7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1WYWx1ZXM7ICsraSkge1xuICAgICAgICAgICAgaW52ZXJ0ZWRWYWx1ZXMucHVzaCgoMSAtIHZhbHVlc1tpXSkgLyAobnVtVmFsdWVzIC0gMSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGludmVydGVkVmFsdWVzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFRyYXZlcnNhbE9yZGVyKGl0ZW1zLCBvcmRlckJ5LCBkZXNjZW5kaW5nKSB7XG4gICAgICAgIGl0ZW1zLmZvckVhY2goYXNzaWduSW5kZXgpO1xuXG4gICAgICAgIHJldHVybiBpdGVtc1xuICAgICAgICAgICAgLnNsaWNlKClcbiAgICAgICAgICAgIC5zb3J0KGZ1bmN0aW9uIChpdGVtQSwgaXRlbUIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVzY2VuZGluZyA/IGl0ZW1CW29yZGVyQnldIC0gaXRlbUFbb3JkZXJCeV0gOiBpdGVtQVtvcmRlckJ5XSAtIGl0ZW1CW29yZGVyQnldO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5tYXAoZ2V0SW5kZXgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFzc2lnbkluZGV4KGl0ZW0sIGluZGV4KSB7XG4gICAgICAgIGl0ZW0uaW5kZXggPSBpbmRleDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRJbmRleChpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmluZGV4O1xuICAgIH1cblxuICAgIC8vIFJldHVybnMgYSBuZXcgYXJyYXkgY29udGFpbmluZyB0aGUgc3VtcyBvZiB0aGUgdmFsdWVzIGluIHRoZSBvcmlnaW5hbCBhcnJheSxcbiAgICAvLyBydW5uaW5nIGZyb20gcmlnaHQgdG8gbGVmdC5cbiAgICAvLyBGb3IgZXhhbXBsZSwgZ2l2ZW46IFswLjIsIDAuMiwgMC4zLCAwLjEsIDAuMl1cbiAgICAvLyBXaWxsIHJldHVybjogICAgICAgIFsxLjAsIDAuOCwgMC42LCAwLjMsIDAuMl1cbiAgICBmdW5jdGlvbiBjcmVhdGVTdW1BcnJheSh2YWx1ZXMsIG9yZGVyKSB7XG4gICAgICAgIGNvbnN0IHN1bUFycmF5ID0gW107XG4gICAgICAgIHN1bUFycmF5W29yZGVyW3ZhbHVlcy5sZW5ndGggLSAxXV0gPSB2YWx1ZXNbb3JkZXJbdmFsdWVzLmxlbmd0aCAtIDFdXTtcblxuICAgICAgICBmb3IgKGxldCBpID0gdmFsdWVzLmxlbmd0aCAtIDI7IGkgPj0gMDsgLS1pKSB7XG4gICAgICAgICAgICBzdW1BcnJheVtvcmRlcltpXV0gPSBzdW1BcnJheVtvcmRlcltpICsgMV1dICsgdmFsdWVzW29yZGVyW2ldXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdW1BcnJheTtcbiAgICB9XG5cbiAgICByZXR1cm4gY2FsY3VsYXRlQWxsO1xufVxuXG5jb25zdCBDQUxDVUxBVEVfRk5TID0ge307XG5DQUxDVUxBVEVfRk5TW09SSUVOVEFUSU9OX0hPUklaT05UQUxdID0gY3JlYXRlQ2FsY3VsYXRvcihPUklFTlRBVElPTl9IT1JJWk9OVEFMKTtcbkNBTENVTEFURV9GTlNbT1JJRU5UQVRJT05fVkVSVElDQUxdID0gY3JlYXRlQ2FsY3VsYXRvcihPUklFTlRBVElPTl9WRVJUSUNBTCk7XG5cbi8qKlxuICogVXNlZCB0byBtYW5hZ2UgbGF5b3V0IGNhbGN1bGF0aW9ucyBmb3Ige0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fXMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBMYXlvdXRDYWxjdWxhdG9yIHtcbiAgICBjYWxjdWxhdGVMYXlvdXQoZWxlbWVudHMsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgY2FsY3VsYXRlRm4gPSBDQUxDVUxBVEVfRk5TW29wdGlvbnMub3JpZW50YXRpb25dO1xuXG4gICAgICAgIGlmICghY2FsY3VsYXRlRm4pIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5yZWNvZ25pemVkIG9yaWVudGF0aW9uIHZhbHVlOiAnICsgb3B0aW9ucy5vcmllbnRhdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gY2FsY3VsYXRlRm4oZWxlbWVudHMsIG9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBMYXlvdXRDYWxjdWxhdG9yIH07XG4iXSwibmFtZXMiOlsiQVhJU19NQVBQSU5HUyIsIk9SSUVOVEFUSU9OX0hPUklaT05UQUwiLCJheGlzIiwic2l6ZSIsImNhbGN1bGF0ZWRTaXplIiwibWluU2l6ZSIsIm1heFNpemUiLCJmaXR0aW5nIiwiZml0dGluZ1Byb3BvcnRpb24iLCJPUklFTlRBVElPTl9WRVJUSUNBTCIsIk9QUE9TSVRFX09SSUVOVEFUSU9OIiwiUFJPUEVSVFlfREVGQVVMVFMiLCJtaW5XaWR0aCIsIm1pbkhlaWdodCIsIm1heFdpZHRoIiwiTnVtYmVyIiwiUE9TSVRJVkVfSU5GSU5JVFkiLCJtYXhIZWlnaHQiLCJ3aWR0aCIsImhlaWdodCIsImZpdFdpZHRoUHJvcG9ydGlvbiIsImZpdEhlaWdodFByb3BvcnRpb24iLCJGSVRUSU5HX0FDVElPTiIsIk5PTkUiLCJBUFBMWV9TVFJFVENISU5HIiwiQVBQTFlfU0hSSU5LSU5HIiwiYXZhaWxhYmxlU3BhY2UiLCJWZWMyIiwiY3JlYXRlQ2FsY3VsYXRvciIsIm9yaWVudGF0aW9uIiwib3B0aW9ucyIsImEiLCJiIiwibWluRXh0ZW50QSIsImVsZW1lbnQiLCJwaXZvdCIsIm1pbkV4dGVudEIiLCJtYXhFeHRlbnRBIiwiY2FsY3VsYXRlQWxsIiwiYWxsRWxlbWVudHMiLCJsYXlvdXRPcHRpb25zIiwiZmlsdGVyIiwic2hvdWxkSW5jbHVkZUluTGF5b3V0IiwieCIsImNvbnRhaW5lclNpemUiLCJwYWRkaW5nIiwieiIsInkiLCJ3IiwicmVzZXRBbmNob3JzIiwibGluZXMiLCJyZXZlcnNlTGluZXNJZlJlcXVpcmVkIiwic3BsaXRMaW5lcyIsInNpemVzIiwiY2FsY3VsYXRlU2l6ZXNPbkF4aXNCIiwiY2FsY3VsYXRlU2l6ZXNPbkF4aXNBIiwicG9zaXRpb25zIiwiY2FsY3VsYXRlQmFzZVBvc2l0aW9ucyIsImFwcGx5QWxpZ25tZW50QW5kUGFkZGluZyIsImFwcGx5U2l6ZXNBbmRQb3NpdGlvbnMiLCJjcmVhdGVMYXlvdXRJbmZvIiwibGF5b3V0Q2hpbGRDb21wb25lbnQiLCJlbnRpdHkiLCJsYXlvdXRjaGlsZCIsImVuYWJsZWQiLCJleGNsdWRlRnJvbUxheW91dCIsImkiLCJsZW5ndGgiLCJhbmNob3IiLCJWZWM0IiwiWkVSTyIsIndyYXAiLCJnZXRFbGVtZW50U2l6ZVByb3BlcnRpZXMiLCJydW5uaW5nU2l6ZSIsImFsbG93T3ZlcnJ1biIsIkZJVFRJTkdfU0hSSU5LIiwic3BhY2luZyIsImlkZWFsRWxlbWVudFNpemUiLCJwdXNoIiwicmV2ZXJzZUF4aXNBIiwicmV2ZXJzZVgiLCJyZXZlcnNlWSIsInJldmVyc2VBeGlzQiIsImxpbmVJbmRleCIsInJldmVyc2UiLCJzaXplc0FsbExpbmVzIiwibGluZSIsInNpemVzVGhpc0xpbmUiLCJpZGVhbFJlcXVpcmVkU3BhY2UiLCJjYWxjdWxhdGVUb3RhbFNwYWNlIiwiZml0dGluZ0FjdGlvbiIsImRldGVybWluZUZpdHRpbmdBY3Rpb24iLCJzdHJldGNoU2l6ZXNUb0ZpdENvbnRhaW5lciIsInNocmlua1NpemVzVG9GaXRDb250YWluZXIiLCJsYXJnZXN0RWxlbWVudHNGb3JFYWNoTGluZSIsImxhcmdlc3RTaXplc0ZvckVhY2hMaW5lIiwibGFyZ2VzdEVsZW1lbnQiLCJsYXJnZXN0U2l6ZSIsIk5FR0FUSVZFX0lORklOSVRZIiwiZWxlbWVudEluZGV4Iiwic2l6ZXNUaGlzRWxlbWVudCIsInNpemVzRm9yVGhpc0VsZW1lbnQiLCJjdXJyZW50U2l6ZSIsImF2YWlsYWJsZVNpemUiLCJlbGVtZW50Rml0dGluZ0FjdGlvbiIsIk1hdGgiLCJtaW4iLCJtYXgiLCJmaXR0aW5nTW9kZSIsIkZJVFRJTkdfTk9ORSIsIkZJVFRJTkdfU1RSRVRDSCIsIkZJVFRJTkdfQk9USCIsIkVycm9yIiwidG90YWxTaXplcyIsInN1bVZhbHVlcyIsInRvdGFsU3BhY2luZyIsImFzY2VuZGluZ01heFNpemVPcmRlciIsImdldFRyYXZlcnNhbE9yZGVyIiwiZml0dGluZ1Byb3BvcnRpb25zIiwiZ2V0Tm9ybWFsaXplZFZhbHVlcyIsImZpdHRpbmdQcm9wb3J0aW9uU3VtcyIsImNyZWF0ZVN1bUFycmF5IiwicmVtYWluaW5nVW5kZXJzaG9vdCIsImluZGV4IiwidGFyZ2V0SW5jcmVhc2UiLCJjYWxjdWxhdGVBZGp1c3RtZW50IiwidGFyZ2V0U2l6ZSIsImFjdHVhbFNpemUiLCJhY3R1YWxJbmNyZWFzZSIsImFwcGxpZWRJbmNyZWFzZSIsImRlc2NlbmRpbmdNaW5TaXplT3JkZXIiLCJpbnZlcnNlRml0dGluZ1Byb3BvcnRpb25zIiwiaW52ZXJ0Tm9ybWFsaXplZFZhbHVlcyIsImludmVyc2VGaXR0aW5nUHJvcG9ydGlvblN1bXMiLCJyZW1haW5pbmdPdmVyc2hvb3QiLCJ0YXJnZXRSZWR1Y3Rpb24iLCJhY3R1YWxSZWR1Y3Rpb24iLCJhcHBsaWVkUmVkdWN0aW9uIiwicmVtYWluaW5nQWRqdXN0bWVudCIsInByb3BvcnRpb24iLCJzdW1PZlJlbWFpbmluZ1Byb3BvcnRpb25zIiwiYWJzIiwiY3Vyc29yIiwicG9zaXRpb25zQWxsTGluZXMiLCJwb3NpdGlvbnNUaGlzTGluZSIsImFsaWdubWVudEEiLCJhbGlnbm1lbnQiLCJhbGlnbm1lbnRCIiwicGFkZGluZ0EiLCJwYWRkaW5nQiIsImF4aXNBT2Zmc2V0IiwiYXhpc0JPZmZzZXQiLCJ3aXRoaW5MaW5lQXhpc0JPZmZzZXQiLCJzZXRMb2NhbFBvc2l0aW9uIiwiZ2V0TG9jYWxQb3NpdGlvbiIsImxheW91dFdpZHRoIiwibGF5b3V0SGVpZ2h0IiwieE9mZnNldCIsInlPZmZzZXQiLCJib3VuZHMiLCJlbGVtZW50cyIsInNpemVQcm9wZXJ0aWVzIiwiZ2V0UHJvcGVydHkiLCJjbGFtcCIsInByb3BlcnR5TmFtZSIsInVuZGVmaW5lZCIsInZhbHVlIiwiaXRlbXMiLCJyZWR1Y2UiLCJhY2N1bXVsYXRvciIsImN1cnJlbnQiLCJzdW0iLCJub3JtYWxpemVkVmFsdWVzIiwibnVtSXRlbXMiLCJ2YWx1ZXMiLCJpbnZlcnRlZFZhbHVlcyIsIm51bVZhbHVlcyIsIm9yZGVyQnkiLCJkZXNjZW5kaW5nIiwiZm9yRWFjaCIsImFzc2lnbkluZGV4Iiwic2xpY2UiLCJzb3J0IiwiaXRlbUEiLCJpdGVtQiIsIm1hcCIsImdldEluZGV4IiwiaXRlbSIsIm9yZGVyIiwic3VtQXJyYXkiLCJDQUxDVUxBVEVfRk5TIiwiTGF5b3V0Q2FsY3VsYXRvciIsImNhbGN1bGF0ZUxheW91dCIsImNhbGN1bGF0ZUZuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBT0EsTUFBTUEsYUFBYSxHQUFHLEVBQXRCLENBQUE7QUFFQUEsYUFBYSxDQUFDQyxzQkFBRCxDQUFiLEdBQXdDO0FBQ3BDQyxFQUFBQSxJQUFJLEVBQUUsR0FEOEI7QUFFcENDLEVBQUFBLElBQUksRUFBRSxPQUY4QjtBQUdwQ0MsRUFBQUEsY0FBYyxFQUFFLGlCQUhvQjtBQUlwQ0MsRUFBQUEsT0FBTyxFQUFFLFVBSjJCO0FBS3BDQyxFQUFBQSxPQUFPLEVBQUUsVUFMMkI7QUFNcENDLEVBQUFBLE9BQU8sRUFBRSxjQU4yQjtBQU9wQ0MsRUFBQUEsaUJBQWlCLEVBQUUsb0JBQUE7QUFQaUIsQ0FBeEMsQ0FBQTtBQVVBUixhQUFhLENBQUNTLG9CQUFELENBQWIsR0FBc0M7QUFDbENQLEVBQUFBLElBQUksRUFBRSxHQUQ0QjtBQUVsQ0MsRUFBQUEsSUFBSSxFQUFFLFFBRjRCO0FBR2xDQyxFQUFBQSxjQUFjLEVBQUUsa0JBSGtCO0FBSWxDQyxFQUFBQSxPQUFPLEVBQUUsV0FKeUI7QUFLbENDLEVBQUFBLE9BQU8sRUFBRSxXQUx5QjtBQU1sQ0MsRUFBQUEsT0FBTyxFQUFFLGVBTnlCO0FBT2xDQyxFQUFBQSxpQkFBaUIsRUFBRSxxQkFBQTtBQVBlLENBQXRDLENBQUE7QUFVQSxNQUFNRSxvQkFBb0IsR0FBRyxFQUE3QixDQUFBO0FBQ0FBLG9CQUFvQixDQUFDVCxzQkFBRCxDQUFwQixHQUErQ1Esb0JB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
