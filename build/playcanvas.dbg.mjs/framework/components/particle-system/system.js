/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Curve } from '../../../core/math/curve.js';
import { CurveSet } from '../../../core/math/curve-set.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { LIGHTTYPE_DIRECTIONAL } from '../../../scene/constants.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { ParticleSystemComponent } from './component.js';
import { ParticleSystemComponentData } from './data.js';

const _schema = ['enabled', 'autoPlay', 'numParticles', 'lifetime', 'rate', 'rate2', 'startAngle', 'startAngle2', 'loop', 'preWarm', 'lighting', 'halfLambert', 'intensity', 'depthWrite', 'noFog', 'depthSoftening', 'sort', 'blendType', 'stretch', 'alignToMotion', 'emitterShape', 'emitterExtents', 'emitterExtentsInner', 'emitterRadius', 'emitterRadiusInner', 'initialVelocity', 'wrap', 'wrapBounds', 'localSpace', 'screenSpace', 'colorMapAsset', 'normalMapAsset', 'mesh', 'meshAsset', 'renderAsset', 'orientation', 'particleNormal', 'localVelocityGraph', 'localVelocityGraph2', 'velocityGraph', 'velocityGraph2', 'rotationSpeedGraph', 'rotationSpeedGraph2', 'radialSpeedGraph', 'radialSpeedGraph2', 'scaleGraph', 'scaleGraph2', 'colorGraph', 'colorGraph2', 'alphaGraph', 'alphaGraph2', 'colorMap', 'normalMap', 'animTilesX', 'animTilesY', 'animStartFrame', 'animNumFrames', 'animNumAnimations', 'animIndex', 'randomizeAnimIndex', 'animSpeed', 'animLoop', 'layers'];

class ParticleSystemComponentSystem extends ComponentSystem {
  constructor(app) {
    super(app);
    this.id = 'particlesystem';
    this.ComponentType = ParticleSystemComponent;
    this.DataType = ParticleSystemComponentData;
    this.schema = _schema;
    this.propertyTypes = {
      emitterExtents: 'vec3',
      emitterExtentsInner: 'vec3',
      particleNormal: 'vec3',
      wrapBounds: 'vec3',
      localVelocityGraph: 'curveset',
      localVelocityGraph2: 'curveset',
      velocityGraph: 'curveset',
      velocityGraph2: 'curveset',
      colorGraph: 'curveset',
      colorGraph2: 'curveset',
      alphaGraph: 'curve',
      alphaGraph2: 'curve',
      rotationSpeedGraph: 'curve',
      rotationSpeedGraph2: 'curve',
      radialSpeedGraph: 'curve',
      radialSpeedGraph2: 'curve',
      scaleGraph: 'curve',
      scaleGraph2: 'curve'
    };
    this.on('beforeremove', this.onBeforeRemove, this);
    this.app.systems.on('update', this.onUpdate, this);
  }
  initializeComponentData(component, _data, properties) {
    const data = {};
    properties = [];
    const types = this.propertyTypes;

    if (_data.mesh instanceof Asset || typeof _data.mesh === 'number') {
      _data.meshAsset = _data.mesh;
      delete _data.mesh;
    }
    for (const prop in _data) {
      if (_data.hasOwnProperty(prop)) {
        properties.push(prop);
        data[prop] = _data[prop];
      }
      if (types[prop] === 'vec3') {
        if (Array.isArray(data[prop])) {
          data[prop] = new Vec3(data[prop][0], data[prop][1], data[prop][2]);
        }
      } else if (types[prop] === 'curve') {
        if (!(data[prop] instanceof Curve)) {
          const t = data[prop].type;
          data[prop] = new Curve(data[prop].keys);
          data[prop].type = t;
        }
      } else if (types[prop] === 'curveset') {
        if (!(data[prop] instanceof CurveSet)) {
          const t = data[prop].type;
          data[prop] = new CurveSet(data[prop].keys);
          data[prop].type = t;
        }
      }

      if (data.layers && Array.isArray(data.layers)) {
        data.layers = data.layers.slice(0);
      }
    }
    super.initializeComponentData(component, data, properties);
  }
  cloneComponent(entity, clone) {
    const source = entity.particlesystem.data;
    const schema = this.schema;
    const data = {};
    for (let i = 0, len = schema.length; i < len; i++) {
      const prop = schema[i];
      let sourceProp = source[prop];
      if (sourceProp instanceof Vec3 || sourceProp instanceof Curve || sourceProp instanceof CurveSet) {
        sourceProp = sourceProp.clone();
        data[prop] = sourceProp;
      } else if (prop === 'layers') {
        data.layers = source.layers.slice(0);
      } else {
        if (sourceProp !== null && sourceProp !== undefined) {
          data[prop] = sourceProp;
        }
      }
    }
    return this.addComponent(clone, data);
  }
  onUpdate(dt) {
    const components = this.store;
    let numSteps;
    const stats = this.app.stats.particles;
    for (const id in components) {
      if (components.hasOwnProperty(id)) {
        const component = components[id];
        const entity = component.entity;
        const data = component.data;
        if (data.enabled && entity.enabled) {
          const emitter = entity.particlesystem.emitter;
          if (!emitter.meshInstance.visible) continue;

          if (emitter.lighting) {
            const layers = data.layers;
            let lightCube;
            for (let i = 0; i < layers.length; i++) {
              const layer = this.app.scene.layers.getLayerById(layers[i]);
              if (!layer) continue;
              if (!layer._lightCube) {
                layer._lightCube = new Float32Array(6 * 3);
              }
              lightCube = layer._lightCube;
              for (let j = 0; j < 6; j++) {
                lightCube[j * 3] = this.app.scene.ambientLight.r;
                lightCube[j * 3 + 1] = this.app.scene.ambientLight.g;
                lightCube[j * 3 + 2] = this.app.scene.ambientLight.b;
              }
              const dirs = layer._splitLights[LIGHTTYPE_DIRECTIONAL];
              for (let j = 0; j < dirs.length; j++) {
                for (let c = 0; c < 6; c++) {
                  const weight = Math.max(emitter.lightCubeDir[c].dot(dirs[j]._direction), 0) * dirs[j]._intensity;
                  lightCube[c * 3] += dirs[j]._color.r * weight;
                  lightCube[c * 3 + 1] += dirs[j]._color.g * weight;
                  lightCube[c * 3 + 2] += dirs[j]._color.b * weight;
                }
              }
            }
            emitter.constantLightCube.setValue(lightCube);
          }

          if (!data.paused) {
            emitter.simTime += dt;
            if (emitter.simTime > emitter.fixedTimeStep) {
              numSteps = Math.floor(emitter.simTime / emitter.fixedTimeStep);
              emitter.simTime -= numSteps * emitter.fixedTimeStep;
            }
            if (numSteps) {
              numSteps = Math.min(numSteps, emitter.maxSubSteps);
              for (let i = 0; i < numSteps; i++) {
                emitter.addTime(emitter.fixedTimeStep, false);
              }
              stats._updatesPerFrame += numSteps;
              stats._frameTime += emitter._addTimeTime;
              emitter._addTimeTime = 0;
            }
            emitter.finishFrame();
          }
        }
      }
    }
  }
  onBeforeRemove(entity, component) {
    component.onBeforeRemove();
  }
  destroy() {
    super.destroy();
    this.app.systems.off('update', this.onUpdate, this);
  }
}
Component._buildAccessors(ParticleSystemComponent.prototype, _schema);

export { ParticleSystemComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcGFydGljbGUtc3lzdGVtL3N5c3RlbS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDdXJ2ZSB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS5qcyc7XG5pbXBvcnQgeyBDdXJ2ZVNldCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9jdXJ2ZS1zZXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuaW1wb3J0IHsgTElHSFRUWVBFX0RJUkVDVElPTkFMIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9zeXN0ZW0uanMnO1xuXG5pbXBvcnQgeyBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IFBhcnRpY2xlU3lzdGVtQ29tcG9uZW50RGF0YSB9IGZyb20gJy4vZGF0YS5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IEFwcEJhc2UgKi9cblxuY29uc3QgX3NjaGVtYSA9IFtcbiAgICAnZW5hYmxlZCcsXG4gICAgJ2F1dG9QbGF5JyxcbiAgICAnbnVtUGFydGljbGVzJyxcbiAgICAnbGlmZXRpbWUnLFxuICAgICdyYXRlJyxcbiAgICAncmF0ZTInLFxuICAgICdzdGFydEFuZ2xlJyxcbiAgICAnc3RhcnRBbmdsZTInLFxuICAgICdsb29wJyxcbiAgICAncHJlV2FybScsXG4gICAgJ2xpZ2h0aW5nJyxcbiAgICAnaGFsZkxhbWJlcnQnLFxuICAgICdpbnRlbnNpdHknLFxuICAgICdkZXB0aFdyaXRlJyxcbiAgICAnbm9Gb2cnLFxuICAgICdkZXB0aFNvZnRlbmluZycsXG4gICAgJ3NvcnQnLFxuICAgICdibGVuZFR5cGUnLFxuICAgICdzdHJldGNoJyxcbiAgICAnYWxpZ25Ub01vdGlvbicsXG4gICAgJ2VtaXR0ZXJTaGFwZScsXG4gICAgJ2VtaXR0ZXJFeHRlbnRzJyxcbiAgICAnZW1pdHRlckV4dGVudHNJbm5lcicsXG4gICAgJ2VtaXR0ZXJSYWRpdXMnLFxuICAgICdlbWl0dGVyUmFkaXVzSW5uZXInLFxuICAgICdpbml0aWFsVmVsb2NpdHknLFxuICAgICd3cmFwJyxcbiAgICAnd3JhcEJvdW5kcycsXG4gICAgJ2xvY2FsU3BhY2UnLFxuICAgICdzY3JlZW5TcGFjZScsXG4gICAgJ2NvbG9yTWFwQXNzZXQnLFxuICAgICdub3JtYWxNYXBBc3NldCcsXG4gICAgJ21lc2gnLFxuICAgICdtZXNoQXNzZXQnLFxuICAgICdyZW5kZXJBc3NldCcsXG4gICAgJ29yaWVudGF0aW9uJyxcbiAgICAncGFydGljbGVOb3JtYWwnLFxuICAgICdsb2NhbFZlbG9jaXR5R3JhcGgnLFxuICAgICdsb2NhbFZlbG9jaXR5R3JhcGgyJyxcbiAgICAndmVsb2NpdHlHcmFwaCcsXG4gICAgJ3ZlbG9jaXR5R3JhcGgyJyxcbiAgICAncm90YXRpb25TcGVlZEdyYXBoJyxcbiAgICAncm90YXRpb25TcGVlZEdyYXBoMicsXG4gICAgJ3JhZGlhbFNwZWVkR3JhcGgnLFxuICAgICdyYWRpYWxTcGVlZEdyYXBoMicsXG4gICAgJ3NjYWxlR3JhcGgnLFxuICAgICdzY2FsZUdyYXBoMicsXG4gICAgJ2NvbG9yR3JhcGgnLFxuICAgICdjb2xvckdyYXBoMicsXG4gICAgJ2FscGhhR3JhcGgnLFxuICAgICdhbHBoYUdyYXBoMicsXG4gICAgJ2NvbG9yTWFwJyxcbiAgICAnbm9ybWFsTWFwJyxcbiAgICAnYW5pbVRpbGVzWCcsXG4gICAgJ2FuaW1UaWxlc1knLFxuICAgICdhbmltU3RhcnRGcmFtZScsXG4gICAgJ2FuaW1OdW1GcmFtZXMnLFxuICAgICdhbmltTnVtQW5pbWF0aW9ucycsXG4gICAgJ2FuaW1JbmRleCcsXG4gICAgJ3JhbmRvbWl6ZUFuaW1JbmRleCcsXG4gICAgJ2FuaW1TcGVlZCcsXG4gICAgJ2FuaW1Mb29wJyxcbiAgICAnbGF5ZXJzJ1xuXTtcblxuLyoqXG4gKiBBbGxvd3MgYW4gRW50aXR5IHRvIHJlbmRlciBhIHBhcnRpY2xlIHN5c3RlbS5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50U3lzdGVtXG4gKi9cbmNsYXNzIFBhcnRpY2xlU3lzdGVtQ29tcG9uZW50U3lzdGVtIGV4dGVuZHMgQ29tcG9uZW50U3lzdGVtIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUGFydGljbGVTeXN0ZW1Db21wb25lbnRTeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FwcEJhc2V9IGFwcCAtIFRoZSBBcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5pZCA9ICdwYXJ0aWNsZXN5c3RlbSc7XG5cbiAgICAgICAgdGhpcy5Db21wb25lbnRUeXBlID0gUGFydGljbGVTeXN0ZW1Db21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudERhdGE7XG5cbiAgICAgICAgdGhpcy5zY2hlbWEgPSBfc2NoZW1hO1xuXG4gICAgICAgIHRoaXMucHJvcGVydHlUeXBlcyA9IHtcbiAgICAgICAgICAgIGVtaXR0ZXJFeHRlbnRzOiAndmVjMycsXG4gICAgICAgICAgICBlbWl0dGVyRXh0ZW50c0lubmVyOiAndmVjMycsXG4gICAgICAgICAgICBwYXJ0aWNsZU5vcm1hbDogJ3ZlYzMnLFxuICAgICAgICAgICAgd3JhcEJvdW5kczogJ3ZlYzMnLFxuICAgICAgICAgICAgbG9jYWxWZWxvY2l0eUdyYXBoOiAnY3VydmVzZXQnLFxuICAgICAgICAgICAgbG9jYWxWZWxvY2l0eUdyYXBoMjogJ2N1cnZlc2V0JyxcbiAgICAgICAgICAgIHZlbG9jaXR5R3JhcGg6ICdjdXJ2ZXNldCcsXG4gICAgICAgICAgICB2ZWxvY2l0eUdyYXBoMjogJ2N1cnZlc2V0JyxcbiAgICAgICAgICAgIGNvbG9yR3JhcGg6ICdjdXJ2ZXNldCcsXG4gICAgICAgICAgICBjb2xvckdyYXBoMjogJ2N1cnZlc2V0JyxcbiAgICAgICAgICAgIGFscGhhR3JhcGg6ICdjdXJ2ZScsXG4gICAgICAgICAgICBhbHBoYUdyYXBoMjogJ2N1cnZlJyxcbiAgICAgICAgICAgIHJvdGF0aW9uU3BlZWRHcmFwaDogJ2N1cnZlJyxcbiAgICAgICAgICAgIHJvdGF0aW9uU3BlZWRHcmFwaDI6ICdjdXJ2ZScsXG4gICAgICAgICAgICByYWRpYWxTcGVlZEdyYXBoOiAnY3VydmUnLFxuICAgICAgICAgICAgcmFkaWFsU3BlZWRHcmFwaDI6ICdjdXJ2ZScsXG4gICAgICAgICAgICBzY2FsZUdyYXBoOiAnY3VydmUnLFxuICAgICAgICAgICAgc2NhbGVHcmFwaDI6ICdjdXJ2ZSdcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLm9uKCdiZWZvcmVyZW1vdmUnLCB0aGlzLm9uQmVmb3JlUmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAuc3lzdGVtcy5vbigndXBkYXRlJywgdGhpcy5vblVwZGF0ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBfZGF0YSwgcHJvcGVydGllcykge1xuICAgICAgICBjb25zdCBkYXRhID0ge307XG5cbiAgICAgICAgcHJvcGVydGllcyA9IFtdO1xuICAgICAgICBjb25zdCB0eXBlcyA9IHRoaXMucHJvcGVydHlUeXBlcztcblxuICAgICAgICAvLyB3ZSBzdG9yZSB0aGUgbWVzaCBhc3NldCBpZCBhcyBcIm1lc2hcIiAoaXQgc2hvdWxkIGJlIFwibWVzaEFzc2V0XCIpXG4gICAgICAgIC8vIHRoaXMgcmUtbWFwcyBcIm1lc2hcIiBpbnRvIFwibWVzaEFzc2V0XCIgaWYgaXQgaXMgYW4gYXNzZXQgb3IgYW4gYXNzZXQgaWRcbiAgICAgICAgaWYgKF9kYXRhLm1lc2ggaW5zdGFuY2VvZiBBc3NldCB8fCB0eXBlb2YgX2RhdGEubWVzaCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIC8vIG1pZ3JhdGUgaW50byBtZXNoQXNzZXQgcHJvcGVydHlcbiAgICAgICAgICAgIF9kYXRhLm1lc2hBc3NldCA9IF9kYXRhLm1lc2g7XG4gICAgICAgICAgICBkZWxldGUgX2RhdGEubWVzaDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgcHJvcCBpbiBfZGF0YSkge1xuICAgICAgICAgICAgaWYgKF9kYXRhLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllcy5wdXNoKHByb3ApO1xuICAgICAgICAgICAgICAgIC8vIGR1cGxpY2F0ZSBpbnB1dCBkYXRhIGFzIHdlIGFyZSBtb2RpZnlpbmcgaXRcbiAgICAgICAgICAgICAgICBkYXRhW3Byb3BdID0gX2RhdGFbcHJvcF07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0eXBlc1twcm9wXSA9PT0gJ3ZlYzMnKSB7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YVtwcm9wXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtwcm9wXSA9IG5ldyBWZWMzKGRhdGFbcHJvcF1bMF0sIGRhdGFbcHJvcF1bMV0sIGRhdGFbcHJvcF1bMl0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZXNbcHJvcF0gPT09ICdjdXJ2ZScpIHtcbiAgICAgICAgICAgICAgICBpZiAoIShkYXRhW3Byb3BdIGluc3RhbmNlb2YgQ3VydmUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHQgPSBkYXRhW3Byb3BdLnR5cGU7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbcHJvcF0gPSBuZXcgQ3VydmUoZGF0YVtwcm9wXS5rZXlzKTtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtwcm9wXS50eXBlID0gdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVzW3Byb3BdID09PSAnY3VydmVzZXQnKSB7XG4gICAgICAgICAgICAgICAgaWYgKCEoZGF0YVtwcm9wXSBpbnN0YW5jZW9mIEN1cnZlU2V0KSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0ID0gZGF0YVtwcm9wXS50eXBlO1xuICAgICAgICAgICAgICAgICAgICBkYXRhW3Byb3BdID0gbmV3IEN1cnZlU2V0KGRhdGFbcHJvcF0ua2V5cyk7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbcHJvcF0udHlwZSA9IHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkdXBsaWNhdGUgbGF5ZXIgbGlzdFxuICAgICAgICAgICAgaWYgKGRhdGEubGF5ZXJzICYmIEFycmF5LmlzQXJyYXkoZGF0YS5sYXllcnMpKSB7XG4gICAgICAgICAgICAgICAgZGF0YS5sYXllcnMgPSBkYXRhLmxheWVycy5zbGljZSgwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgcHJvcGVydGllcyk7XG4gICAgfVxuXG4gICAgY2xvbmVDb21wb25lbnQoZW50aXR5LCBjbG9uZSkge1xuICAgICAgICBjb25zdCBzb3VyY2UgPSBlbnRpdHkucGFydGljbGVzeXN0ZW0uZGF0YTtcbiAgICAgICAgY29uc3Qgc2NoZW1hID0gdGhpcy5zY2hlbWE7XG5cbiAgICAgICAgY29uc3QgZGF0YSA9IHt9O1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzY2hlbWEubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3AgPSBzY2hlbWFbaV07XG4gICAgICAgICAgICBsZXQgc291cmNlUHJvcCA9IHNvdXJjZVtwcm9wXTtcbiAgICAgICAgICAgIGlmIChzb3VyY2VQcm9wIGluc3RhbmNlb2YgVmVjMyB8fFxuICAgICAgICAgICAgICAgIHNvdXJjZVByb3AgaW5zdGFuY2VvZiBDdXJ2ZSB8fFxuICAgICAgICAgICAgICAgIHNvdXJjZVByb3AgaW5zdGFuY2VvZiBDdXJ2ZVNldCkge1xuXG4gICAgICAgICAgICAgICAgc291cmNlUHJvcCA9IHNvdXJjZVByb3AuY2xvbmUoKTtcbiAgICAgICAgICAgICAgICBkYXRhW3Byb3BdID0gc291cmNlUHJvcDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcCA9PT0gJ2xheWVycycpIHtcbiAgICAgICAgICAgICAgICBkYXRhLmxheWVycyA9IHNvdXJjZS5sYXllcnMuc2xpY2UoMCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChzb3VyY2VQcm9wICE9PSBudWxsICYmIHNvdXJjZVByb3AgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBkYXRhW3Byb3BdID0gc291cmNlUHJvcDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5hZGRDb21wb25lbnQoY2xvbmUsIGRhdGEpO1xuICAgIH1cblxuICAgIG9uVXBkYXRlKGR0KSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSB0aGlzLnN0b3JlO1xuICAgICAgICBsZXQgbnVtU3RlcHM7XG4gICAgICAgIGNvbnN0IHN0YXRzID0gdGhpcy5hcHAuc3RhdHMucGFydGljbGVzO1xuXG4gICAgICAgIGZvciAoY29uc3QgaWQgaW4gY29tcG9uZW50cykge1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudHMuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gY29tcG9uZW50c1tpZF07XG4gICAgICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gY29tcG9uZW50LmVudGl0eTtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gY29tcG9uZW50LmRhdGE7XG5cbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5lbmFibGVkICYmIGVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVtaXR0ZXIgPSBlbnRpdHkucGFydGljbGVzeXN0ZW0uZW1pdHRlcjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlbWl0dGVyLm1lc2hJbnN0YW5jZS52aXNpYmxlKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBCYWtlIGFtYmllbnQgYW5kIGRpcmVjdGlvbmFsIGxpZ2h0aW5nIGludG8gb25lIGFtYmllbnQgY3ViZVxuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBvbmx5IGRvIGlmIGxpZ2h0aW5nIGNoYW5nZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogZG9uJ3QgZG8gZm9yIGV2ZXJ5IGVtaXR0ZXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVtaXR0ZXIubGlnaHRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVycyA9IGRhdGEubGF5ZXJzO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGxpZ2h0Q3ViZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKGxheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWxheWVyLl9saWdodEN1YmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIuX2xpZ2h0Q3ViZSA9IG5ldyBGbG9hdDMyQXJyYXkoNiAqIDMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaWdodEN1YmUgPSBsYXllci5fbGlnaHRDdWJlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgNjsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0Q3ViZVtqICogM10gPSB0aGlzLmFwcC5zY2VuZS5hbWJpZW50TGlnaHQucjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRDdWJlW2ogKiAzICsgMV0gPSB0aGlzLmFwcC5zY2VuZS5hbWJpZW50TGlnaHQuZztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRDdWJlW2ogKiAzICsgMl0gPSB0aGlzLmFwcC5zY2VuZS5hbWJpZW50TGlnaHQuYjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlycyA9IGxheWVyLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfRElSRUNUSU9OQUxdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZGlycy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBjID0gMDsgYyA8IDY7IGMrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgd2VpZ2h0ID0gTWF0aC5tYXgoZW1pdHRlci5saWdodEN1YmVEaXJbY10uZG90KGRpcnNbal0uX2RpcmVjdGlvbiksIDApICogZGlyc1tqXS5faW50ZW5zaXR5O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRDdWJlW2MgKiAzXSArPSBkaXJzW2pdLl9jb2xvci5yICogd2VpZ2h0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRDdWJlW2MgKiAzICsgMV0gKz0gZGlyc1tqXS5fY29sb3IuZyAqIHdlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0Q3ViZVtjICogMyArIDJdICs9IGRpcnNbal0uX2NvbG9yLmIgKiB3ZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbWl0dGVyLmNvbnN0YW50TGlnaHRDdWJlLnNldFZhbHVlKGxpZ2h0Q3ViZSk7IC8vID9cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghZGF0YS5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtaXR0ZXIuc2ltVGltZSArPSBkdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlbWl0dGVyLnNpbVRpbWUgPiBlbWl0dGVyLmZpeGVkVGltZVN0ZXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1TdGVwcyA9IE1hdGguZmxvb3IoZW1pdHRlci5zaW1UaW1lIC8gZW1pdHRlci5maXhlZFRpbWVTdGVwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWl0dGVyLnNpbVRpbWUgLT0gbnVtU3RlcHMgKiBlbWl0dGVyLmZpeGVkVGltZVN0ZXA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobnVtU3RlcHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1TdGVwcyA9IE1hdGgubWluKG51bVN0ZXBzLCBlbWl0dGVyLm1heFN1YlN0ZXBzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVN0ZXBzOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1pdHRlci5hZGRUaW1lKGVtaXR0ZXIuZml4ZWRUaW1lU3RlcCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0cy5fdXBkYXRlc1BlckZyYW1lICs9IG51bVN0ZXBzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzLl9mcmFtZVRpbWUgKz0gZW1pdHRlci5fYWRkVGltZVRpbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1pdHRlci5fYWRkVGltZVRpbWUgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZW1pdHRlci5maW5pc2hGcmFtZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoZW50aXR5LCBjb21wb25lbnQpIHtcbiAgICAgICAgY29tcG9uZW50Lm9uQmVmb3JlUmVtb3ZlKCk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMuYXBwLnN5c3RlbXMub2ZmKCd1cGRhdGUnLCB0aGlzLm9uVXBkYXRlLCB0aGlzKTtcbiAgICB9XG59XG5cbkNvbXBvbmVudC5fYnVpbGRBY2Nlc3NvcnMoUGFydGljbGVTeXN0ZW1Db21wb25lbnQucHJvdG90eXBlLCBfc2NoZW1hKTtcblxuZXhwb3J0IHsgUGFydGljbGVTeXN0ZW1Db21wb25lbnRTeXN0ZW0gfTtcbiJdLCJuYW1lcyI6WyJfc2NoZW1hIiwiUGFydGljbGVTeXN0ZW1Db21wb25lbnRTeXN0ZW0iLCJDb21wb25lbnRTeXN0ZW0iLCJjb25zdHJ1Y3RvciIsImFwcCIsImlkIiwiQ29tcG9uZW50VHlwZSIsIlBhcnRpY2xlU3lzdGVtQ29tcG9uZW50IiwiRGF0YVR5cGUiLCJQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudERhdGEiLCJzY2hlbWEiLCJwcm9wZXJ0eVR5cGVzIiwiZW1pdHRlckV4dGVudHMiLCJlbWl0dGVyRXh0ZW50c0lubmVyIiwicGFydGljbGVOb3JtYWwiLCJ3cmFwQm91bmRzIiwibG9jYWxWZWxvY2l0eUdyYXBoIiwibG9jYWxWZWxvY2l0eUdyYXBoMiIsInZlbG9jaXR5R3JhcGgiLCJ2ZWxvY2l0eUdyYXBoMiIsImNvbG9yR3JhcGgiLCJjb2xvckdyYXBoMiIsImFscGhhR3JhcGgiLCJhbHBoYUdyYXBoMiIsInJvdGF0aW9uU3BlZWRHcmFwaCIsInJvdGF0aW9uU3BlZWRHcmFwaDIiLCJyYWRpYWxTcGVlZEdyYXBoIiwicmFkaWFsU3BlZWRHcmFwaDIiLCJzY2FsZUdyYXBoIiwic2NhbGVHcmFwaDIiLCJvbiIsIm9uQmVmb3JlUmVtb3ZlIiwic3lzdGVtcyIsIm9uVXBkYXRlIiwiaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEiLCJjb21wb25lbnQiLCJfZGF0YSIsInByb3BlcnRpZXMiLCJkYXRhIiwidHlwZXMiLCJtZXNoIiwiQXNzZXQiLCJtZXNoQXNzZXQiLCJwcm9wIiwiaGFzT3duUHJvcGVydHkiLCJwdXNoIiwiQXJyYXkiLCJpc0FycmF5IiwiVmVjMyIsIkN1cnZlIiwidCIsInR5cGUiLCJrZXlzIiwiQ3VydmVTZXQiLCJsYXllcnMiLCJzbGljZSIsImNsb25lQ29tcG9uZW50IiwiZW50aXR5IiwiY2xvbmUiLCJzb3VyY2UiLCJwYXJ0aWNsZXN5c3RlbSIsImkiLCJsZW4iLCJsZW5ndGgiLCJzb3VyY2VQcm9wIiwidW5kZWZpbmVkIiwiYWRkQ29tcG9uZW50IiwiZHQiLCJjb21wb25lbnRzIiwic3RvcmUiLCJudW1TdGVwcyIsInN0YXRzIiwicGFydGljbGVzIiwiZW5hYmxlZCIsImVtaXR0ZXIiLCJtZXNoSW5zdGFuY2UiLCJ2aXNpYmxlIiwibGlnaHRpbmciLCJsaWdodEN1YmUiLCJsYXllciIsInNjZW5lIiwiZ2V0TGF5ZXJCeUlkIiwiX2xpZ2h0Q3ViZSIsIkZsb2F0MzJBcnJheSIsImoiLCJhbWJpZW50TGlnaHQiLCJyIiwiZyIsImIiLCJkaXJzIiwiX3NwbGl0TGlnaHRzIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiYyIsIndlaWdodCIsIk1hdGgiLCJtYXgiLCJsaWdodEN1YmVEaXIiLCJkb3QiLCJfZGlyZWN0aW9uIiwiX2ludGVuc2l0eSIsIl9jb2xvciIsImNvbnN0YW50TGlnaHRDdWJlIiwic2V0VmFsdWUiLCJwYXVzZWQiLCJzaW1UaW1lIiwiZml4ZWRUaW1lU3RlcCIsImZsb29yIiwibWluIiwibWF4U3ViU3RlcHMiLCJhZGRUaW1lIiwiX3VwZGF0ZXNQZXJGcmFtZSIsIl9mcmFtZVRpbWUiLCJfYWRkVGltZVRpbWUiLCJmaW5pc2hGcmFtZSIsImRlc3Ryb3kiLCJvZmYiLCJDb21wb25lbnQiLCJfYnVpbGRBY2Nlc3NvcnMiLCJwcm90b3R5cGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQWdCQSxNQUFNQSxPQUFPLEdBQUcsQ0FDWixTQUFTLEVBQ1QsVUFBVSxFQUNWLGNBQWMsRUFDZCxVQUFVLEVBQ1YsTUFBTSxFQUNOLE9BQU8sRUFDUCxZQUFZLEVBQ1osYUFBYSxFQUNiLE1BQU0sRUFDTixTQUFTLEVBQ1QsVUFBVSxFQUNWLGFBQWEsRUFDYixXQUFXLEVBQ1gsWUFBWSxFQUNaLE9BQU8sRUFDUCxnQkFBZ0IsRUFDaEIsTUFBTSxFQUNOLFdBQVcsRUFDWCxTQUFTLEVBQ1QsZUFBZSxFQUNmLGNBQWMsRUFDZCxnQkFBZ0IsRUFDaEIscUJBQXFCLEVBQ3JCLGVBQWUsRUFDZixvQkFBb0IsRUFDcEIsaUJB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