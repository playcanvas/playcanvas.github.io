/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { LayoutChildComponent } from './component.js';
import { LayoutChildComponentData } from './data.js';

const _schema = ['enabled'];

class LayoutChildComponentSystem extends ComponentSystem {
  constructor(app) {
    super(app);
    this.id = 'layoutchild';
    this.ComponentType = LayoutChildComponent;
    this.DataType = LayoutChildComponentData;
    this.schema = _schema;
  }
  initializeComponentData(component, data, properties) {
    if (data.enabled !== undefined) component.enabled = data.enabled;
    if (data.minWidth !== undefined) component.minWidth = data.minWidth;
    if (data.minHeight !== undefined) component.minHeight = data.minHeight;
    if (data.maxWidth !== undefined) component.maxWidth = data.maxWidth;
    if (data.maxHeight !== undefined) component.maxHeight = data.maxHeight;
    if (data.fitWidthProportion !== undefined) component.fitWidthProportion = data.fitWidthProportion;
    if (data.fitHeightProportion !== undefined) component.fitHeightProportion = data.fitHeightProportion;
    if (data.excludeFromLayout !== undefined) component.excludeFromLayout = data.excludeFromLayout;
    super.initializeComponentData(component, data, properties);
  }
  cloneComponent(entity, clone) {
    const layoutChild = entity.layoutchild;
    return this.addComponent(clone, {
      enabled: layoutChild.enabled,
      minWidth: layoutChild.minWidth,
      minHeight: layoutChild.minHeight,
      maxWidth: layoutChild.maxWidth,
      maxHeight: layoutChild.maxHeight,
      fitWidthProportion: layoutChild.fitWidthProportion,
      fitHeightProportion: layoutChild.fitHeightProportion,
      excludeFromLayout: layoutChild.excludeFromLayout
    });
  }
}
Component._buildAccessors(LayoutChildComponent.prototype, _schema);

export { LayoutChildComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbGF5b3V0LWNoaWxkL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgQ29tcG9uZW50U3lzdGVtIH0gZnJvbSAnLi4vc3lzdGVtLmpzJztcblxuaW1wb3J0IHsgTGF5b3V0Q2hpbGRDb21wb25lbnQgfSBmcm9tICcuL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBMYXlvdXRDaGlsZENvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBBcHBCYXNlICovXG5cbmNvbnN0IF9zY2hlbWEgPSBbJ2VuYWJsZWQnXTtcblxuLyoqXG4gKiBNYW5hZ2VzIGNyZWF0aW9uIG9mIHtAbGluayBMYXlvdXRDaGlsZENvbXBvbmVudH1zLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRTeXN0ZW1cbiAqL1xuY2xhc3MgTGF5b3V0Q2hpbGRDb21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBMYXlvdXRDaGlsZENvbXBvbmVudFN5c3RlbSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXBwQmFzZX0gYXBwIC0gVGhlIGFwcGxpY2F0aW9uLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcblxuICAgICAgICB0aGlzLmlkID0gJ2xheW91dGNoaWxkJztcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBMYXlvdXRDaGlsZENvbXBvbmVudDtcbiAgICAgICAgdGhpcy5EYXRhVHlwZSA9IExheW91dENoaWxkQ29tcG9uZW50RGF0YTtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGlmIChkYXRhLmVuYWJsZWQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LmVuYWJsZWQgPSBkYXRhLmVuYWJsZWQ7XG4gICAgICAgIGlmIChkYXRhLm1pbldpZHRoICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5taW5XaWR0aCA9IGRhdGEubWluV2lkdGg7XG4gICAgICAgIGlmIChkYXRhLm1pbkhlaWdodCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQubWluSGVpZ2h0ID0gZGF0YS5taW5IZWlnaHQ7XG4gICAgICAgIGlmIChkYXRhLm1heFdpZHRoICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5tYXhXaWR0aCA9IGRhdGEubWF4V2lkdGg7XG4gICAgICAgIGlmIChkYXRhLm1heEhlaWdodCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQubWF4SGVpZ2h0ID0gZGF0YS5tYXhIZWlnaHQ7XG4gICAgICAgIGlmIChkYXRhLmZpdFdpZHRoUHJvcG9ydGlvbiAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuZml0V2lkdGhQcm9wb3J0aW9uID0gZGF0YS5maXRXaWR0aFByb3BvcnRpb247XG4gICAgICAgIGlmIChkYXRhLmZpdEhlaWdodFByb3BvcnRpb24gIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LmZpdEhlaWdodFByb3BvcnRpb24gPSBkYXRhLmZpdEhlaWdodFByb3BvcnRpb247XG4gICAgICAgIGlmIChkYXRhLmV4Y2x1ZGVGcm9tTGF5b3V0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5leGNsdWRlRnJvbUxheW91dCA9IGRhdGEuZXhjbHVkZUZyb21MYXlvdXQ7XG5cbiAgICAgICAgc3VwZXIuaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKTtcbiAgICB9XG5cbiAgICBjbG9uZUNvbXBvbmVudChlbnRpdHksIGNsb25lKSB7XG4gICAgICAgIGNvbnN0IGxheW91dENoaWxkID0gZW50aXR5LmxheW91dGNoaWxkO1xuXG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwge1xuICAgICAgICAgICAgZW5hYmxlZDogbGF5b3V0Q2hpbGQuZW5hYmxlZCxcbiAgICAgICAgICAgIG1pbldpZHRoOiBsYXlvdXRDaGlsZC5taW5XaWR0aCxcbiAgICAgICAgICAgIG1pbkhlaWdodDogbGF5b3V0Q2hpbGQubWluSGVpZ2h0LFxuICAgICAgICAgICAgbWF4V2lkdGg6IGxheW91dENoaWxkLm1heFdpZHRoLFxuICAgICAgICAgICAgbWF4SGVpZ2h0OiBsYXlvdXRDaGlsZC5tYXhIZWlnaHQsXG4gICAgICAgICAgICBmaXRXaWR0aFByb3BvcnRpb246IGxheW91dENoaWxkLmZpdFdpZHRoUHJvcG9ydGlvbixcbiAgICAgICAgICAgIGZpdEhlaWdodFByb3BvcnRpb246IGxheW91dENoaWxkLmZpdEhlaWdodFByb3BvcnRpb24sXG4gICAgICAgICAgICBleGNsdWRlRnJvbUxheW91dDogbGF5b3V0Q2hpbGQuZXhjbHVkZUZyb21MYXlvdXRcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5Db21wb25lbnQuX2J1aWxkQWNjZXNzb3JzKExheW91dENoaWxkQ29tcG9uZW50LnByb3RvdHlwZSwgX3NjaGVtYSk7XG5cbmV4cG9ydCB7IExheW91dENoaWxkQ29tcG9uZW50U3lzdGVtIH07XG4iXSwibmFtZXMiOlsiX3NjaGVtYSIsIkxheW91dENoaWxkQ29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50U3lzdGVtIiwiY29uc3RydWN0b3IiLCJhcHAiLCJpZCIsIkNvbXBvbmVudFR5cGUiLCJMYXlvdXRDaGlsZENvbXBvbmVudCIsIkRhdGFUeXBlIiwiTGF5b3V0Q2hpbGRDb21wb25lbnREYXRhIiwic2NoZW1hIiwiaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEiLCJjb21wb25lbnQiLCJkYXRhIiwicHJvcGVydGllcyIsImVuYWJsZWQiLCJ1bmRlZmluZWQiLCJtaW5XaWR0aCIsIm1pbkhlaWdodCIsIm1heFdpZHRoIiwibWF4SGVpZ2h0IiwiZml0V2lkdGhQcm9wb3J0aW9uIiwiZml0SGVpZ2h0UHJvcG9ydGlvbiIsImV4Y2x1ZGVGcm9tTGF5b3V0IiwiY2xvbmVDb21wb25lbnQiLCJlbnRpdHkiLCJjbG9uZSIsImxheW91dENoaWxkIiwibGF5b3V0Y2hpbGQiLCJhZGRDb21wb25lbnQiLCJDb21wb25lbnQiLCJfYnVpbGRBY2Nlc3NvcnMiLCJwcm90b3R5cGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFRQSxNQUFNQSxPQUFPLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQTs7QUFPM0IsTUFBTUMsMEJBQTBCLFNBQVNDLGVBQWUsQ0FBQztFQU9yREMsV0FBVyxDQUFDQyxHQUFHLEVBQUU7SUFDYixLQUFLLENBQUNBLEdBQUcsQ0FBQyxDQUFBO0lBRVYsSUFBSSxDQUFDQyxFQUFFLEdBQUcsYUFBYSxDQUFBO0lBRXZCLElBQUksQ0FBQ0MsYUFBYSxHQUFHQyxvQkFBb0IsQ0FBQTtJQUN6QyxJQUFJLENBQUNDLFFBQVEsR0FBR0Msd0JBQXdCLENBQUE7SUFFeEMsSUFBSSxDQUFDQyxNQUFNLEdBQUdWLE9BQU8sQ0FBQTtBQUN6QixHQUFBO0FBRUFXLEVBQUFBLHVCQUF1QixDQUFDQyxTQUFTLEVBQUVDLElBQUksRUFBRUMsVUFBVSxFQUFFO0FBQ2pELElBQUEsSUFBSUQsSUFBSSxDQUFDRSxPQUFPLEtBQUtDLFNBQVMsRUFBRUosU0FBUyxDQUFDRyxPQUFPLEdBQUdGLElBQUksQ0FBQ0UsT0FBTyxDQUFBO0FBQ2hFLElBQUEsSUFBSUYsSUFBSSxDQUFDSSxRQUFRLEtBQUtELFNBQVMsRUFBRUosU0FBUyxDQUFDSyxRQUFRLEdBQUdKLElBQUksQ0FBQ0ksUUFBUSxDQUFBO0FBQ25FLElBQUEsSUFBSUosSUFBSSxDQUFDSyxTQUFTLEtBQUtGLFNBQVMsRUFBRUosU0FBUyxDQUFDTSxTQUFTLEdBQUdMLElBQUksQ0FBQ0ssU0FBUyxDQUFBO0FBQ3RFLElBQUEsSUFBSUwsSUFBSSxDQUFDTSxRQUFRLEtBQUtILFNBQVMsRUFBRUosU0FBUyxDQUFDTyxRQUFRLEdBQUdOLElBQUksQ0FBQ00sUUFBUSxDQUFBO0FBQ25FLElBQUEsSUFBSU4sSUFBSSxDQUFDTyxTQUFTLEtBQUtKLFNBQVMsRUFBRUosU0FBUyxDQUFDUSxTQUFTLEdBQUdQLElBQUksQ0FBQ08sU0FBUyxDQUFBO0FBQ3RFLElBQUEsSUFBSVAsSUFBSSxDQUFDUSxrQkFBa0IsS0FBS0wsU0FBUyxFQUFFSixTQUFTLENBQUNTLGtCQUFrQixHQUFHUixJQUFJLENBQUNRLGtCQUFrQixDQUFBO0FBQ2pHLElBQUEsSUFBSVIsSUFBSSxDQUFDUyxtQkFBbUIsS0FBS04sU0FBUyxFQUFFSixTQUFTLENBQUNVLG1CQUFtQixHQUFHVCxJQUFJLENBQUNTLG1CQUFtQixDQUFBO0FBQ3BHLElBQUEsSUFBSVQsSUFBSSxDQUFDVSxpQkFBaUIsS0FBS1AsU0FBUyxFQUFFSixTQUFTLENBQUNXLGlCQUFpQixHQUFHVixJQUFJLENBQUNVLGlCQUFpQixDQUFBO0lBRTlGLEtBQUssQ0FBQ1osdUJBQXVCLENBQUNDLFNBQVMsRUFBRUMsSUFBSSxFQUFFQyxVQUFVLENBQUMsQ0FBQTtBQUM5RCxHQUFBO0FBRUFVLEVBQUFBLGNBQWMsQ0FBQ0MsTUFBTSxFQUFFQyxLQUFLLEVBQUU7QUFDMUIsSUFBQSxNQUFNQyxXQUFXLEdBQUdGLE1BQU0sQ0FBQ0csV0FBVyxDQUFBO0FBRXRDLElBQUEsT0FBTyxJQUFJLENBQUNDLFlBQVksQ0FBQ0gsS0FBSyxFQUFFO01BQzVCWCxPQUFPLEVBQUVZLFdBQVcsQ0FBQ1osT0FBTztNQUM1QkUsUUFBUSxFQUFFVSxXQUFXLENBQUNWLFFBQVE7TUFDOUJDLFNBQVMsRUFBRVMsV0FBVyxDQUFDVCxTQUFTO01BQ2hDQyxRQUFRLEVBQUVRLFdBQVcsQ0FBQ1IsUUFBUTtNQUM5QkMsU0FBUyxFQUFFTyxXQUFXLENBQUNQLFNBQVM7TUFDaENDLGtCQUFrQixFQUFFTSxXQUFXLENBQUNOLGtCQUFrQjtNQUNsREMsbUJBQW1CLEVBQUVLLFdBQVcsQ0FBQ0wsbUJBQW1CO01BQ3BEQyxpQkFBaUIsRUFBRUksV0FBVyxDQUFDSixpQkFBQUE7QUFDbkMsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBO0FBQ0osQ0FBQTtBQUVBTyxTQUFTLENBQUNDLGVBQWUsQ0FBQ3hCLG9CQUFvQixDQUFDeUIsU0FBUyxFQUFFaEMsT0FBTyxDQUFDOzs7OyJ9