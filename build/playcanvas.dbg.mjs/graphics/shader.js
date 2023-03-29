/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { TRACEID_SHADER_ALLOC } from '../core/constants.js';
import { Debug } from '../core/debug.js';
import { Preprocessor } from '../core/preprocessor.js';

let id = 0;

class Shader {
  constructor(graphicsDevice, definition) {
    this.meshUniformBufferFormat = void 0;
    this.meshBindGroupFormat = void 0;
    this.id = id++;
    this.device = graphicsDevice;
    this.definition = definition;
    this.name = definition.name || 'Untitled';
    Debug.assert(definition.vshader, 'No vertex shader has been specified when creating a shader.');
    Debug.assert(definition.fshader, 'No fragment shader has been specified when creating a shader.');
    definition.vshader = Preprocessor.run(definition.vshader);
    definition.fshader = Preprocessor.run(definition.fshader);
    this.init();
    this.impl = graphicsDevice.createShaderImpl(this);
    Debug.trace(TRACEID_SHADER_ALLOC, `Alloc: Id ${this.id} ${this.name}`, {
      instance: this
    });
  }

  init() {
    this.ready = false;
    this.failed = false;
  }

  destroy() {
    Debug.trace(TRACEID_SHADER_ALLOC, `DeAlloc: Id ${this.id} ${this.name}`);
    this.impl.destroy(this);
  }

  loseContext() {
    this.init();
    this.impl.loseContext();
  }

  restoreContext() {
    this.impl.restoreContext(this.device, this);
  }

}

export { Shader };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZ3JhcGhpY3Mvc2hhZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRSQUNFSURfU0hBREVSX0FMTE9DIH0gZnJvbSAnLi4vY29yZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFByZXByb2Nlc3NvciB9IGZyb20gJy4uL2NvcmUvcHJlcHJvY2Vzc29yLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IEdyYXBoaWNzRGV2aWNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vYmluZC1ncm91cC1mb3JtYXQuanMnKS5CaW5kR3JvdXBGb3JtYXR9IEJpbmRHcm91cEZvcm1hdCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3VuaWZvcm0tYnVmZmVyLWZvcm1hdC5qcycpLlVuaWZvcm1CdWZmZXJGb3JtYXR9IFVuaWZvcm1CdWZmZXJGb3JtYXQgKi9cblxubGV0IGlkID0gMDtcblxuLyoqXG4gKiBBIHNoYWRlciBpcyBhIHByb2dyYW0gdGhhdCBpcyByZXNwb25zaWJsZSBmb3IgcmVuZGVyaW5nIGdyYXBoaWNhbCBwcmltaXRpdmVzIG9uIGEgZGV2aWNlJ3NcbiAqIGdyYXBoaWNzIHByb2Nlc3Nvci4gVGhlIHNoYWRlciBpcyBnZW5lcmF0ZWQgZnJvbSBhIHNoYWRlciBkZWZpbml0aW9uLiBUaGlzIHNoYWRlciBkZWZpbml0aW9uXG4gKiBzcGVjaWZpZXMgdGhlIGNvZGUgZm9yIHByb2Nlc3NpbmcgdmVydGljZXMgYW5kIGZyYWdtZW50cyBwcm9jZXNzZWQgYnkgdGhlIEdQVS4gVGhlIGxhbmd1YWdlIG9mXG4gKiB0aGUgY29kZSBpcyBHTFNMIChvciBtb3JlIHNwZWNpZmljYWxseSBFU1NMLCB0aGUgT3BlbkdMIEVTIFNoYWRpbmcgTGFuZ3VhZ2UpLiBUaGUgc2hhZGVyXG4gKiBkZWZpbml0aW9uIGFsc28gZGVzY3JpYmVzIGhvdyB0aGUgUGxheUNhbnZhcyBlbmdpbmUgc2hvdWxkIG1hcCB2ZXJ0ZXggYnVmZmVyIGVsZW1lbnRzIG9udG8gdGhlXG4gKiBhdHRyaWJ1dGVzIHNwZWNpZmllZCBpbiB0aGUgdmVydGV4IHNoYWRlciBjb2RlLlxuICovXG5jbGFzcyBTaGFkZXIge1xuICAgIC8qKlxuICAgICAqIEZvcm1hdCBvZiB0aGUgdW5pZm9ybSBidWZmZXIgZm9yIG1lc2ggYmluZCBncm91bnAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VW5pZm9ybUJ1ZmZlckZvcm1hdH1cbiAgICAgKi9cbiAgICBtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDtcblxuICAgIC8qKlxuICAgICAqIEZvcm1hdCBvZiB0aGUgYmluZCBncm91cCBmb3IgdGhlIG1lc2ggYmluZCBncm91cC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtCaW5kR3JvdXBGb3JtYXR9XG4gICAgICovXG4gICAgbWVzaEJpbmRHcm91cEZvcm1hdDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgU2hhZGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoaXMgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkZWZpbml0aW9uIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uIGZyb20gd2hpY2ggdG8gYnVpbGQgdGhlIHNoYWRlci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2RlZmluaXRpb24ubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn0gZGVmaW5pdGlvbi5hdHRyaWJ1dGVzIC0gT2JqZWN0IGRldGFpbGluZyB0aGUgbWFwcGluZyBvZlxuICAgICAqIHZlcnRleCBzaGFkZXIgYXR0cmlidXRlIG5hbWVzIHRvIHNlbWFudGljcyBTRU1BTlRJQ18qLiBUaGlzIGVuYWJsZXMgdGhlIGVuZ2luZSB0byBtYXRjaFxuICAgICAqIHZlcnRleCBidWZmZXIgZGF0YSBhcyBpbnB1dHMgdG8gdGhlIHNoYWRlci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZGVmaW5pdGlvbi52c2hhZGVyIC0gVmVydGV4IHNoYWRlciBzb3VyY2UgKEdMU0wgY29kZSkuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGRlZmluaXRpb24uZnNoYWRlciAtIEZyYWdtZW50IHNoYWRlciBzb3VyY2UgKEdMU0wgY29kZSkuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVmaW5pdGlvbi51c2VUcmFuc2Zvcm1GZWVkYmFja10gLSBTcGVjaWZpZXMgdGhhdCB0aGlzIHNoYWRlciBvdXRwdXRzXG4gICAgICogcG9zdC1WUyBkYXRhIHRvIGEgYnVmZmVyLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgc2hhZGVyIHRoYXQgcmVuZGVycyBwcmltaXRpdmVzIHdpdGggYSBzb2xpZCByZWQgY29sb3JcbiAgICAgKiB2YXIgc2hhZGVyRGVmaW5pdGlvbiA9IHtcbiAgICAgKiAgICAgYXR0cmlidXRlczoge1xuICAgICAqICAgICAgICAgYVBvc2l0aW9uOiBwYy5TRU1BTlRJQ19QT1NJVElPTlxuICAgICAqICAgICB9LFxuICAgICAqICAgICB2c2hhZGVyOiBbXG4gICAgICogICAgICAgICBcImF0dHJpYnV0ZSB2ZWMzIGFQb3NpdGlvbjtcIixcbiAgICAgKiAgICAgICAgIFwiXCIsXG4gICAgICogICAgICAgICBcInZvaWQgbWFpbih2b2lkKVwiLFxuICAgICAqICAgICAgICAgXCJ7XCIsXG4gICAgICogICAgICAgICBcIiAgICBnbF9Qb3NpdGlvbiA9IHZlYzQoYVBvc2l0aW9uLCAxLjApO1wiLFxuICAgICAqICAgICAgICAgXCJ9XCJcbiAgICAgKiAgICAgXS5qb2luKFwiXFxuXCIpLFxuICAgICAqICAgICBmc2hhZGVyOiBbXG4gICAgICogICAgICAgICBcInByZWNpc2lvbiBcIiArIGdyYXBoaWNzRGV2aWNlLnByZWNpc2lvbiArIFwiIGZsb2F0O1wiLFxuICAgICAqICAgICAgICAgXCJcIixcbiAgICAgKiAgICAgICAgIFwidm9pZCBtYWluKHZvaWQpXCIsXG4gICAgICogICAgICAgICBcIntcIixcbiAgICAgKiAgICAgICAgIFwiICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMS4wLCAwLjAsIDAuMCwgMS4wKTtcIixcbiAgICAgKiAgICAgICAgIFwifVwiXG4gICAgICogICAgIF0uam9pbihcIlxcblwiKVxuICAgICAqIH07XG4gICAgICpcbiAgICAgKiB2YXIgc2hhZGVyID0gbmV3IHBjLlNoYWRlcihncmFwaGljc0RldmljZSwgc2hhZGVyRGVmaW5pdGlvbik7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UsIGRlZmluaXRpb24pIHtcbiAgICAgICAgdGhpcy5pZCA9IGlkKys7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIHRoaXMuZGVmaW5pdGlvbiA9IGRlZmluaXRpb247XG4gICAgICAgIHRoaXMubmFtZSA9IGRlZmluaXRpb24ubmFtZSB8fCAnVW50aXRsZWQnO1xuXG4gICAgICAgIERlYnVnLmFzc2VydChkZWZpbml0aW9uLnZzaGFkZXIsICdObyB2ZXJ0ZXggc2hhZGVyIGhhcyBiZWVuIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIGEgc2hhZGVyLicpO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoZGVmaW5pdGlvbi5mc2hhZGVyLCAnTm8gZnJhZ21lbnQgc2hhZGVyIGhhcyBiZWVuIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIGEgc2hhZGVyLicpO1xuXG4gICAgICAgIC8vIHByZS1wcm9jZXNzIHNoYWRlciBzb3VyY2VzXG4gICAgICAgIGRlZmluaXRpb24udnNoYWRlciA9IFByZXByb2Nlc3Nvci5ydW4oZGVmaW5pdGlvbi52c2hhZGVyKTtcbiAgICAgICAgZGVmaW5pdGlvbi5mc2hhZGVyID0gUHJlcHJvY2Vzc29yLnJ1bihkZWZpbml0aW9uLmZzaGFkZXIpO1xuXG4gICAgICAgIHRoaXMuaW5pdCgpO1xuXG4gICAgICAgIHRoaXMuaW1wbCA9IGdyYXBoaWNzRGV2aWNlLmNyZWF0ZVNoYWRlckltcGwodGhpcyk7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9TSEFERVJfQUxMT0MsIGBBbGxvYzogSWQgJHt0aGlzLmlkfSAke3RoaXMubmFtZX1gLCB7XG4gICAgICAgICAgICBpbnN0YW5jZTogdGhpc1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIGEgc2hhZGVyIGJhY2sgdG8gaXRzIGRlZmF1bHQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGluaXQoKSB7XG4gICAgICAgIHRoaXMucmVhZHkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5mYWlsZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgc2hhZGVyLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfU0hBREVSX0FMTE9DLCBgRGVBbGxvYzogSWQgJHt0aGlzLmlkfSAke3RoaXMubmFtZX1gKTtcbiAgICAgICAgdGhpcy5pbXBsLmRlc3Ryb3kodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgd2FzIGxvc3QuIEl0IHJlbGVhc2VzIGFsbCBjb250ZXh0IHJlbGF0ZWQgcmVzb3VyY2VzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmluaXQoKTtcbiAgICAgICAgdGhpcy5pbXBsLmxvc2VDb250ZXh0KCk7XG4gICAgfVxuXG4gICAgcmVzdG9yZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW1wbC5yZXN0b3JlQ29udGV4dCh0aGlzLmRldmljZSwgdGhpcyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTaGFkZXIgfTtcbiJdLCJuYW1lcyI6WyJpZCIsIlNoYWRlciIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJkZWZpbml0aW9uIiwibWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQiLCJtZXNoQmluZEdyb3VwRm9ybWF0IiwiZGV2aWNlIiwibmFtZSIsIkRlYnVnIiwiYXNzZXJ0IiwidnNoYWRlciIsImZzaGFkZXIiLCJQcmVwcm9jZXNzb3IiLCJydW4iLCJpbml0IiwiaW1wbCIsImNyZWF0ZVNoYWRlckltcGwiLCJ0cmFjZSIsIlRSQUNFSURfU0hBREVSX0FMTE9DIiwiaW5zdGFuY2UiLCJyZWFkeSIsImZhaWxlZCIsImRlc3Ryb3kiLCJsb3NlQ29udGV4dCIsInJlc3RvcmVDb250ZXh0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFRQSxJQUFJQSxFQUFFLEdBQUcsQ0FBVCxDQUFBOztBQVVBLE1BQU1DLE1BQU4sQ0FBYTtBQXNEVEMsRUFBQUEsV0FBVyxDQUFDQyxjQUFELEVBQWlCQyxVQUFqQixFQUE2QjtBQUFBLElBQUEsSUFBQSxDQWhEeENDLHVCQWdEd0MsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQXpDeENDLG1CQXlDd0MsR0FBQSxLQUFBLENBQUEsQ0FBQTtJQUNwQyxJQUFLTixDQUFBQSxFQUFMLEdBQVVBLEVBQUUsRUFBWixDQUFBO0lBQ0EsSUFBS08sQ0FBQUEsTUFBTCxHQUFjSixjQUFkLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxVQUFMLEdBQWtCQSxVQUFsQixDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtJLElBQUwsR0FBWUosVUFBVSxDQUFDSSxJQUFYLElBQW1CLFVBQS9CLENBQUE7QUFFQUMsSUFBQUEsS0FBSyxDQUFDQyxNQUFOLENBQWFOLFVBQVUsQ0FBQ08sT0FBeEIsRUFBaUMsNkRBQWpDLENBQUEsQ0FBQTtBQUNBRixJQUFBQSxLQUFLLENBQUNDLE1BQU4sQ0FBYU4sVUFBVSxDQUFDUSxPQUF4QixFQUFpQywrREFBakMsQ0FBQSxDQUFBO0lBR0FSLFVBQVUsQ0FBQ08sT0FBWCxHQUFxQkUsWUFBWSxDQUFDQyxHQUFiLENBQWlCVixVQUFVLENBQUNPLE9BQTVCLENBQXJCLENBQUE7SUFDQVAsVUFBVSxDQUFDUSxPQUFYLEdBQXFCQyxZQUFZLENBQUNDLEdBQWIsQ0FBaUJWLFVBQVUsQ0FBQ1EsT0FBNUIsQ0FBckIsQ0FBQTtBQUVBLElBQUEsSUFBQSxDQUFLRyxJQUFMLEVBQUEsQ0FBQTtBQUVBLElBQUEsSUFBQSxDQUFLQyxJQUFMLEdBQVliLGNBQWMsQ0FBQ2MsZ0JBQWYsQ0FBZ0MsSUFBaEMsQ0FBWixDQUFBO0FBRUFSLElBQUFBLEtBQUssQ0FBQ1MsS0FBTixDQUFZQyxvQkFBWixFQUFtQyxDQUFBLFVBQUEsRUFBWSxJQUFLbkIsQ0FBQUEsRUFBRyxDQUFHLENBQUEsRUFBQSxJQUFBLENBQUtRLElBQUssQ0FBQSxDQUFwRSxFQUF1RTtBQUNuRVksTUFBQUEsUUFBUSxFQUFFLElBQUE7S0FEZCxDQUFBLENBQUE7QUFHSCxHQUFBOztBQU9ETCxFQUFBQSxJQUFJLEdBQUc7SUFDSCxJQUFLTSxDQUFBQSxLQUFMLEdBQWEsS0FBYixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsTUFBTCxHQUFjLEtBQWQsQ0FBQTtBQUNILEdBQUE7O0FBS0RDLEVBQUFBLE9BQU8sR0FBRztJQUNOZCxLQUFLLENBQUNTLEtBQU4sQ0FBWUMsb0JBQVosRUFBbUMsQ0FBYyxZQUFBLEVBQUEsSUFBQSxDQUFLbkIsRUFBRyxDQUFBLENBQUEsRUFBRyxJQUFLUSxDQUFBQSxJQUFLLENBQXRFLENBQUEsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtRLElBQUwsQ0FBVU8sT0FBVixDQUFrQixJQUFsQixDQUFBLENBQUE7QUFDSCxHQUFBOztBQU9EQyxFQUFBQSxXQUFXLEdBQUc7QUFDVixJQUFBLElBQUEsQ0FBS1QsSUFBTCxFQUFBLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxJQUFMLENBQVVRLFdBQVYsRUFBQSxDQUFBO0FBQ0gsR0FBQTs7QUFFREMsRUFBQUEsY0FBYyxHQUFHO0FBQ2IsSUFBQSxJQUFBLENBQUtULElBQUwsQ0FBVVMsY0FBVixDQUF5QixJQUFLbEIsQ0FBQUEsTUFBOUIsRUFBc0MsSUFBdEMsQ0FBQSxDQUFBO0FBQ0gsR0FBQTs7QUExR1E7Ozs7In0=
