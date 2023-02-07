/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { LayoutChildComponent } from './component.js';
import { LayoutChildComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * Manages creation of {@link LayoutChildComponent}s.
 *
 * @augments ComponentSystem
 */
class LayoutChildComponentSystem extends ComponentSystem {
  /**
   * Create a new LayoutChildComponentSystem instance.
   *
   * @param {import('../../app-base.js').AppBase} app - The application.
   * @hideconstructor
   */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbGF5b3V0LWNoaWxkL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgQ29tcG9uZW50U3lzdGVtIH0gZnJvbSAnLi4vc3lzdGVtLmpzJztcblxuaW1wb3J0IHsgTGF5b3V0Q2hpbGRDb21wb25lbnQgfSBmcm9tICcuL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBMYXlvdXRDaGlsZENvbXBvbmVudERhdGEgfSBmcm9tICcuL2RhdGEuanMnO1xuXG5jb25zdCBfc2NoZW1hID0gWydlbmFibGVkJ107XG5cbi8qKlxuICogTWFuYWdlcyBjcmVhdGlvbiBvZiB7QGxpbmsgTGF5b3V0Q2hpbGRDb21wb25lbnR9cy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50U3lzdGVtXG4gKi9cbmNsYXNzIExheW91dENoaWxkQ29tcG9uZW50U3lzdGVtIGV4dGVuZHMgQ29tcG9uZW50U3lzdGVtIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgTGF5b3V0Q2hpbGRDb21wb25lbnRTeXN0ZW0gaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgYXBwbGljYXRpb24uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICBzdXBlcihhcHApO1xuXG4gICAgICAgIHRoaXMuaWQgPSAnbGF5b3V0Y2hpbGQnO1xuXG4gICAgICAgIHRoaXMuQ29tcG9uZW50VHlwZSA9IExheW91dENoaWxkQ29tcG9uZW50O1xuICAgICAgICB0aGlzLkRhdGFUeXBlID0gTGF5b3V0Q2hpbGRDb21wb25lbnREYXRhO1xuXG4gICAgICAgIHRoaXMuc2NoZW1hID0gX3NjaGVtYTtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpIHtcbiAgICAgICAgaWYgKGRhdGEuZW5hYmxlZCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuZW5hYmxlZCA9IGRhdGEuZW5hYmxlZDtcbiAgICAgICAgaWYgKGRhdGEubWluV2lkdGggIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm1pbldpZHRoID0gZGF0YS5taW5XaWR0aDtcbiAgICAgICAgaWYgKGRhdGEubWluSGVpZ2h0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5taW5IZWlnaHQgPSBkYXRhLm1pbkhlaWdodDtcbiAgICAgICAgaWYgKGRhdGEubWF4V2lkdGggIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm1heFdpZHRoID0gZGF0YS5tYXhXaWR0aDtcbiAgICAgICAgaWYgKGRhdGEubWF4SGVpZ2h0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5tYXhIZWlnaHQgPSBkYXRhLm1heEhlaWdodDtcbiAgICAgICAgaWYgKGRhdGEuZml0V2lkdGhQcm9wb3J0aW9uICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5maXRXaWR0aFByb3BvcnRpb24gPSBkYXRhLmZpdFdpZHRoUHJvcG9ydGlvbjtcbiAgICAgICAgaWYgKGRhdGEuZml0SGVpZ2h0UHJvcG9ydGlvbiAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuZml0SGVpZ2h0UHJvcG9ydGlvbiA9IGRhdGEuZml0SGVpZ2h0UHJvcG9ydGlvbjtcbiAgICAgICAgaWYgKGRhdGEuZXhjbHVkZUZyb21MYXlvdXQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LmV4Y2x1ZGVGcm9tTGF5b3V0ID0gZGF0YS5leGNsdWRlRnJvbUxheW91dDtcblxuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgY29uc3QgbGF5b3V0Q2hpbGQgPSBlbnRpdHkubGF5b3V0Y2hpbGQ7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuYWRkQ29tcG9uZW50KGNsb25lLCB7XG4gICAgICAgICAgICBlbmFibGVkOiBsYXlvdXRDaGlsZC5lbmFibGVkLFxuICAgICAgICAgICAgbWluV2lkdGg6IGxheW91dENoaWxkLm1pbldpZHRoLFxuICAgICAgICAgICAgbWluSGVpZ2h0OiBsYXlvdXRDaGlsZC5taW5IZWlnaHQsXG4gICAgICAgICAgICBtYXhXaWR0aDogbGF5b3V0Q2hpbGQubWF4V2lkdGgsXG4gICAgICAgICAgICBtYXhIZWlnaHQ6IGxheW91dENoaWxkLm1heEhlaWdodCxcbiAgICAgICAgICAgIGZpdFdpZHRoUHJvcG9ydGlvbjogbGF5b3V0Q2hpbGQuZml0V2lkdGhQcm9wb3J0aW9uLFxuICAgICAgICAgICAgZml0SGVpZ2h0UHJvcG9ydGlvbjogbGF5b3V0Q2hpbGQuZml0SGVpZ2h0UHJvcG9ydGlvbixcbiAgICAgICAgICAgIGV4Y2x1ZGVGcm9tTGF5b3V0OiBsYXlvdXRDaGlsZC5leGNsdWRlRnJvbUxheW91dFxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbkNvbXBvbmVudC5fYnVpbGRBY2Nlc3NvcnMoTGF5b3V0Q2hpbGRDb21wb25lbnQucHJvdG90eXBlLCBfc2NoZW1hKTtcblxuZXhwb3J0IHsgTGF5b3V0Q2hpbGRDb21wb25lbnRTeXN0ZW0gfTtcbiJdLCJuYW1lcyI6WyJfc2NoZW1hIiwiTGF5b3V0Q2hpbGRDb21wb25lbnRTeXN0ZW0iLCJDb21wb25lbnRTeXN0ZW0iLCJjb25zdHJ1Y3RvciIsImFwcCIsImlkIiwiQ29tcG9uZW50VHlwZSIsIkxheW91dENoaWxkQ29tcG9uZW50IiwiRGF0YVR5cGUiLCJMYXlvdXRDaGlsZENvbXBvbmVudERhdGEiLCJzY2hlbWEiLCJpbml0aWFsaXplQ29tcG9uZW50RGF0YSIsImNvbXBvbmVudCIsImRhdGEiLCJwcm9wZXJ0aWVzIiwiZW5hYmxlZCIsInVuZGVmaW5lZCIsIm1pbldpZHRoIiwibWluSGVpZ2h0IiwibWF4V2lkdGgiLCJtYXhIZWlnaHQiLCJmaXRXaWR0aFByb3BvcnRpb24iLCJmaXRIZWlnaHRQcm9wb3J0aW9uIiwiZXhjbHVkZUZyb21MYXlvdXQiLCJjbG9uZUNvbXBvbmVudCIsImVudGl0eSIsImNsb25lIiwibGF5b3V0Q2hpbGQiLCJsYXlvdXRjaGlsZCIsImFkZENvbXBvbmVudCIsIkNvbXBvbmVudCIsIl9idWlsZEFjY2Vzc29ycyIsInByb3RvdHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQU1BLE1BQU1BLE9BQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFBOztBQUUzQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsMEJBQTBCLFNBQVNDLGVBQWUsQ0FBQztBQUNyRDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBVyxDQUFDQyxHQUFHLEVBQUU7SUFDYixLQUFLLENBQUNBLEdBQUcsQ0FBQyxDQUFBO0lBRVYsSUFBSSxDQUFDQyxFQUFFLEdBQUcsYUFBYSxDQUFBO0lBRXZCLElBQUksQ0FBQ0MsYUFBYSxHQUFHQyxvQkFBb0IsQ0FBQTtJQUN6QyxJQUFJLENBQUNDLFFBQVEsR0FBR0Msd0JBQXdCLENBQUE7SUFFeEMsSUFBSSxDQUFDQyxNQUFNLEdBQUdWLE9BQU8sQ0FBQTtBQUN6QixHQUFBO0FBRUFXLEVBQUFBLHVCQUF1QixDQUFDQyxTQUFTLEVBQUVDLElBQUksRUFBRUMsVUFBVSxFQUFFO0FBQ2pELElBQUEsSUFBSUQsSUFBSSxDQUFDRSxPQUFPLEtBQUtDLFNBQVMsRUFBRUosU0FBUyxDQUFDRyxPQUFPLEdBQUdGLElBQUksQ0FBQ0UsT0FBTyxDQUFBO0FBQ2hFLElBQUEsSUFBSUYsSUFBSSxDQUFDSSxRQUFRLEtBQUtELFNBQVMsRUFBRUosU0FBUyxDQUFDSyxRQUFRLEdBQUdKLElBQUksQ0FBQ0ksUUFBUSxDQUFBO0FBQ25FLElBQUEsSUFBSUosSUFBSSxDQUFDSyxTQUFTLEtBQUtGLFNBQVMsRUFBRUosU0FBUyxDQUFDTSxTQUFTLEdBQUdMLElBQUksQ0FBQ0ssU0FBUyxDQUFBO0FBQ3RFLElBQUEsSUFBSUwsSUFBSSxDQUFDTSxRQUFRLEtBQUtILFNBQVMsRUFBRUosU0FBUyxDQUFDTyxRQUFRLEdBQUdOLElBQUksQ0FBQ00sUUFBUSxDQUFBO0FBQ25FLElBQUEsSUFBSU4sSUFBSSxDQUFDTyxTQUFTLEtBQUtKLFNBQVMsRUFBRUosU0FBUyxDQUFDUSxTQUFTLEdBQUdQLElBQUksQ0FBQ08sU0FBUyxDQUFBO0FBQ3RFLElBQUEsSUFBSVAsSUFBSSxDQUFDUSxrQkFBa0IsS0FBS0wsU0FBUyxFQUFFSixTQUFTLENBQUNTLGtCQUFrQixHQUFHUixJQUFJLENBQUNRLGtCQUFrQixDQUFBO0FBQ2pHLElBQUEsSUFBSVIsSUFBSSxDQUFDUyxtQkFBbUIsS0FBS04sU0FBUyxFQUFFSixTQUFTLENBQUNVLG1CQUFtQixHQUFHVCxJQUFJLENBQUNTLG1CQUFtQixDQUFBO0FBQ3BHLElBQUEsSUFBSVQsSUFBSSxDQUFDVSxpQkFBaUIsS0FBS1AsU0FBUyxFQUFFSixTQUFTLENBQUNXLGlCQUFpQixHQUFHVixJQUFJLENBQUNVLGlCQUFpQixDQUFBO0lBRTlGLEtBQUssQ0FBQ1osdUJBQXVCLENBQUNDLFNBQVMsRUFBRUMsSUFBSSxFQUFFQyxVQUFVLENBQUMsQ0FBQTtBQUM5RCxHQUFBO0FBRUFVLEVBQUFBLGNBQWMsQ0FBQ0MsTUFBTSxFQUFFQyxLQUFLLEVBQUU7QUFDMUIsSUFBQSxNQUFNQyxXQUFXLEdBQUdGLE1BQU0sQ0FBQ0csV0FBVyxDQUFBO0FBRXRDLElBQUEsT0FBTyxJQUFJLENBQUNDLFlBQVksQ0FBQ0gsS0FBSyxFQUFFO01BQzVCWCxPQUFPLEVBQUVZLFdBQVcsQ0FBQ1osT0FBTztNQUM1QkUsUUFBUSxFQUFFVSxXQUFXLENBQUNWLFFBQVE7TUFDOUJDLFNBQVMsRUFBRVMsV0FBVyxDQUFDVCxTQUFTO01BQ2hDQyxRQUFRLEVBQUVRLFdBQVcsQ0FBQ1IsUUFBUTtNQUM5QkMsU0FBUyxFQUFFTyxXQUFXLENBQUNQLFNBQVM7TUFDaENDLGtCQUFrQixFQUFFTSxXQUFXLENBQUNOLGtCQUFrQjtNQUNsREMsbUJBQW1CLEVBQUVLLFdBQVcsQ0FBQ0wsbUJBQW1CO01BQ3BEQyxpQkFBaUIsRUFBRUksV0FBVyxDQUFDSixpQkFBQUE7QUFDbkMsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBO0FBQ0osQ0FBQTtBQUVBTyxTQUFTLENBQUNDLGVBQWUsQ0FBQ3hCLG9CQUFvQixDQUFDeUIsU0FBUyxFQUFFaEMsT0FBTyxDQUFDOzs7OyJ9
