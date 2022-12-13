/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class PartitionedVertex {
  constructor() {
    this.index = 0;
    this.boneIndices = [0, 0, 0, 0];
  }
}
class SkinPartition {
  constructor() {
    this.partition = 0;
    this.vertexStart = 0;
    this.vertexCount = 0;
    this.indexStart = 0;
    this.indexCount = 0;

    this.boneIndices = [];

    this.vertices = [];
    this.indices = [];
    this.indexMap = {};
    this.originalMesh = null;
  }
  addVertex(vertex, idx, vertexArray) {
    let remappedIndex = -1;
    if (this.indexMap[idx] !== undefined) {
      remappedIndex = this.indexMap[idx];
      this.indices.push(remappedIndex);
    } else {
      for (let influence = 0; influence < 4; influence++) {
        if (vertexArray.blendWeight.data[idx * 4 + influence] === 0) continue;
        const originalBoneIndex = vertexArray.blendIndices.data[vertex.index * 4 + influence];
        vertex.boneIndices[influence] = this.getBoneRemap(originalBoneIndex);
      }
      remappedIndex = this.vertices.length;
      this.indices.push(remappedIndex);
      this.vertices.push(vertex);
      this.indexMap[idx] = remappedIndex;
    }
  }
  addPrimitive(vertices, vertexIndices, vertexArray, boneLimit) {
    const bonesToAdd = [];
    let bonesToAddCount = 0;
    const vertexCount = vertices.length;
    for (let i = 0; i < vertexCount; i++) {
      const vertex = vertices[i];
      const idx = vertex.index;
      for (let influence = 0; influence < 4; influence++) {
        if (vertexArray.blendWeight.data[idx * 4 + influence] > 0) {
          const boneIndex = vertexArray.blendIndices.data[idx * 4 + influence];
          let needToAdd = true;
          for (let j = 0; j < bonesToAddCount; j++) {
            if (bonesToAdd[j] === boneIndex) {
              needToAdd = false;
              break;
            }
          }
          if (needToAdd) {
            bonesToAdd[bonesToAddCount] = boneIndex;
            const boneRemap = this.getBoneRemap(boneIndex);
            bonesToAddCount += boneRemap === -1 ? 1 : 0;
          }
        }
      }
    }

    if (this.boneIndices.length + bonesToAddCount > boneLimit) {
      return false;
    }

    for (let i = 0; i < bonesToAddCount; i++) {
      this.boneIndices.push(bonesToAdd[i]);
    }

    for (let i = 0; i < vertexCount; i++) {
      this.addVertex(vertices[i], vertexIndices[i], vertexArray);
    }
    return true;
  }
  getBoneRemap(boneIndex) {
    for (let i = 0; i < this.boneIndices.length; i++) {
      if (this.boneIndices[i] === boneIndex) {
        return i;
      }
    }
    return -1;
  }
}
function indicesToReferences(model) {
  const vertices = model.vertices;
  const skins = model.skins;
  const meshes = model.meshes;
  const meshInstances = model.meshInstances;
  for (let i = 0; i < meshes.length; i++) {
    meshes[i].vertices = vertices[meshes[i].vertices];
    if (meshes[i].skin !== undefined) {
      meshes[i].skin = skins[meshes[i].skin];
    }
  }
  for (let i = 0; i < meshInstances.length; i++) {
    meshInstances[i].mesh = meshes[meshInstances[i].mesh];
  }
}
function referencesToIndices(model) {
  const vertices = model.vertices;
  const skins = model.skins;
  const meshes = model.meshes;
  const meshInstances = model.meshInstances;
  for (let i = 0; i < meshes.length; i++) {
    meshes[i].vertices = vertices.indexOf(meshes[i].vertices);
    if (meshes[i].skin !== undefined) {
      meshes[i].skin = skins.indexOf(meshes[i].skin);
    }
  }
  for (let i = 0; i < meshInstances.length; i++) {
    meshInstances[i].mesh = meshes.indexOf(meshInstances[i].mesh);
  }
}
function partitionSkin(model, materialMappings, boneLimit) {
  let i, j, k, index;

  indicesToReferences(model);
  const vertexArrays = model.vertices;
  const skins = model.skins;
  let mesh;
  const meshes = model.meshes;
  const meshInstances = model.meshInstances;
  const getVertex = function getVertex(idx) {
    const vert = new PartitionedVertex();
    vert.index = idx;
    return vert;
  };
  for (i = skins.length - 1; i >= 0; i--) {
    if (skins[i].boneNames.length > boneLimit) {
      const skin = skins.splice(i, 1)[0];

      const meshesToSplit = [];
      for (j = 0; j < meshes.length; j++) {
        if (meshes[j].skin === skin) {
          meshesToSplit.push(meshes[j]);
        }
      }
      for (j = 0; j < meshesToSplit.length; j++) {
        index = meshes.indexOf(meshesToSplit[j]);
        if (index !== -1) {
          meshes.splice(index, 1);
        }
      }

      if (meshesToSplit.length === 0) {
        throw new Error('partitionSkin: There should be at least one mesh that references a skin');
      }
      const vertexArray = meshesToSplit[0].vertices;
      for (j = 1; j < meshesToSplit.length; j++) {
        if (meshesToSplit[j].vertices !== vertexArray) {
          throw new Error('partitionSkin: All meshes that share a skin should also share the same vertex buffer');
        }
      }
      let partition;
      const partitions = [];

      const primitiveVertices = [];
      const primitiveIndices = [];
      let basePartition = 0;
      for (j = 0; j < meshesToSplit.length; j++) {
        mesh = meshesToSplit[j];
        const indices = mesh.indices;
        for (let iIndex = mesh.base; iIndex < mesh.base + mesh.count;) {
          index = indices[iIndex++];
          primitiveVertices[0] = getVertex(index);
          primitiveIndices[0] = index;
          index = indices[iIndex++];
          primitiveVertices[1] = getVertex(index);
          primitiveIndices[1] = index;
          index = indices[iIndex++];
          primitiveVertices[2] = getVertex(index);
          primitiveIndices[2] = index;

          let added = false;
          for (let iBonePartition = basePartition; iBonePartition < partitions.length; iBonePartition++) {
            partition = partitions[iBonePartition];
            if (partition.addPrimitive(primitiveVertices, primitiveIndices, vertexArray, boneLimit)) {
              added = true;
              break;
            }
          }

          if (!added) {
            partition = new SkinPartition();
            partition.originalMesh = mesh;
            partition.addPrimitive(primitiveVertices, primitiveIndices, vertexArray, boneLimit);
            partitions.push(partition);
          }
        }
        basePartition = partitions.length;
      }

      const partitionedVertices = [];
      const partitionedIndices = [];
      for (j = 0; j < partitions.length; j++) {
        partition = partitions[j];
        if (partition.vertices.length && partition.indices.length) {

          const vertexStart = partitionedVertices.length;
          const vertexCount = partition.vertices.length;
          const indexStart = partitionedIndices.length;
          const indexCount = partition.indices.length;

          partition.partition = j;
          partition.vertexStart = vertexStart;
          partition.vertexCount = vertexCount;
          partition.indexStart = indexStart;
          partition.indexCount = indexCount;

          let iSour;
          let iDest;

          iSour = 0;
          iDest = vertexStart;
          while (iSour < vertexCount) {
            partitionedVertices[iDest++] = partition.vertices[iSour++];
          }

          iSour = 0;
          iDest = indexStart;
          while (iSour < indexCount) {
            partitionedIndices[iDest++] = partition.indices[iSour++] + vertexStart;
          }
        }
      }

      const splitSkins = [];
      for (j = 0; j < partitions.length; j++) {
        partition = partitions[j];
        const ibp = [];
        const boneNames = [];
        for (k = 0; k < partition.boneIndices.length; k++) {
          ibp.push(skin.inverseBindMatrices[partition.boneIndices[k]]);
          boneNames.push(skin.boneNames[partition.boneIndices[k]]);
        }
        const splitSkin = {
          inverseBindMatrices: ibp,
          boneNames: boneNames
        };
        splitSkins.push(splitSkin);
        skins.push(splitSkin);
      }

      let attrib, attribName, data, components;
      const splitVertexArray = {};

      for (attribName in vertexArray) {
        splitVertexArray[attribName] = {
          components: vertexArray[attribName].components,
          data: [],
          type: vertexArray[attribName].type
        };
      }

      for (attribName in vertexArray) {
        if (attribName === 'blendIndices') {
          const dstBoneIndices = splitVertexArray[attribName].data;
          for (j = 0; j < partitionedVertices.length; j++) {
            const srcBoneIndices = partitionedVertices[j].boneIndices;
            dstBoneIndices.push(srcBoneIndices[0], srcBoneIndices[1], srcBoneIndices[2], srcBoneIndices[3]);
          }
        } else {
          attrib = vertexArray[attribName];
          data = attrib.data;
          components = attrib.components;
          for (j = 0; j < partitionedVertices.length; j++) {
            index = partitionedVertices[j].index;
            for (k = 0; k < components; k++) {
              splitVertexArray[attribName].data.push(data[index * components + k]);
            }
          }
        }
      }

      vertexArrays[vertexArrays.indexOf(vertexArray)] = splitVertexArray;

      for (j = 0; j < partitions.length; j++) {
        partition = partitions[j];
        mesh = {
          aabb: {
            min: [0, 0, 0],
            max: [0, 0, 0]
          },
          vertices: splitVertexArray,
          skin: splitSkins[j],
          indices: partitionedIndices.splice(0, partition.indexCount),
          type: 'triangles',
          base: 0,
          count: partition.indexCount
        };
        meshes.push(mesh);

        for (k = meshInstances.length - 1; k >= 0; k--) {
          if (meshInstances[k].mesh === partition.originalMesh) {
            meshInstances.push({
              mesh: mesh,
              node: meshInstances[k].node
            });
            if (materialMappings) {
              materialMappings.push({
                material: materialMappings[k].material,
                path: materialMappings[k].path
              });
            }
          }
        }
      }
      for (j = 0; j < partitions.length; j++) {
        partition = partitions[j];

        for (k = meshInstances.length - 1; k >= 0; k--) {
          if (meshInstances[k].mesh === partition.originalMesh) {
            meshInstances.splice(k, 1);
            if (materialMappings) {
              materialMappings.splice(k, 1);
            }
          }
        }
      }
    }
  }

  referencesToIndices(model);
}

export { partitionSkin };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbi1wYXJ0aXRpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9za2luLXBhcnRpdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjbGFzcyBQYXJ0aXRpb25lZFZlcnRleCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuaW5kZXggPSAwO1xuICAgICAgICB0aGlzLmJvbmVJbmRpY2VzID0gWzAsIDAsIDAsIDBdO1xuICAgIH1cbn1cblxuY2xhc3MgU2tpblBhcnRpdGlvbiB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMucGFydGl0aW9uID0gMDtcbiAgICAgICAgdGhpcy52ZXJ0ZXhTdGFydCA9IDA7XG4gICAgICAgIHRoaXMudmVydGV4Q291bnQgPSAwO1xuICAgICAgICB0aGlzLmluZGV4U3RhcnQgPSAwO1xuICAgICAgICB0aGlzLmluZGV4Q291bnQgPSAwO1xuXG4gICAgICAgIC8vIEluZGljZXMgb2YgYm9uZXMgaW4gdGhpcyBwYXJ0aXRpb24uIHNraW4gbWF0cmljZXMgd2lsbCBiZSB1cGxvYWRlZCB0byB0aGUgdmVydGV4IHNoYWRlciBpbiB0aGlzIG9yZGVyLlxuICAgICAgICB0aGlzLmJvbmVJbmRpY2VzID0gW107XG5cbiAgICAgICAgLy8gUGFydGl0aW9uZWQgdmVydGV4IGF0dHJpYnV0ZXNcbiAgICAgICAgdGhpcy52ZXJ0aWNlcyA9IFtdO1xuICAgICAgICAvLyBQYXJ0aXRpb25lZCB2ZXJ0ZXggaW5kaWNlc1xuICAgICAgICB0aGlzLmluZGljZXMgPSBbXTtcbiAgICAgICAgLy8gTWFwcyB0aGUgaW5kZXggb2YgYW4gdW4tcGFydGl0aW9uZWQgdmVydGV4IHRvIHRoYXQgc2FtZSB2ZXJ0ZXggaWYgaXQgaGFzIGJlZW4gYWRkZWRcbiAgICAgICAgLy8gdG8gdGhpcyBwYXJ0aWN1bGFyIHBhcnRpdGlvbi4gc3BlZWRzIHVwIGNoZWNraW5nIGZvciBkdXBsaWNhdGUgdmVydGljZXMgc28gd2UgZG9uJ3RcbiAgICAgICAgLy8gYWRkIHRoZSBzYW1lIHZlcnRleCBtb3JlIHRoYW4gb25jZS5cbiAgICAgICAgdGhpcy5pbmRleE1hcCA9IHt9O1xuXG4gICAgICAgIHRoaXMub3JpZ2luYWxNZXNoID0gbnVsbDtcbiAgICB9XG5cbiAgICBhZGRWZXJ0ZXgodmVydGV4LCBpZHgsIHZlcnRleEFycmF5KSB7XG4gICAgICAgIGxldCByZW1hcHBlZEluZGV4ID0gLTE7XG4gICAgICAgIGlmICh0aGlzLmluZGV4TWFwW2lkeF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmVtYXBwZWRJbmRleCA9IHRoaXMuaW5kZXhNYXBbaWR4XTtcbiAgICAgICAgICAgIHRoaXMuaW5kaWNlcy5wdXNoKHJlbWFwcGVkSW5kZXgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIG5ldyBwYXJ0aXRpb25lZCB2ZXJ0ZXhcbiAgICAgICAgICAgIGZvciAobGV0IGluZmx1ZW5jZSA9IDA7IGluZmx1ZW5jZSA8IDQ7IGluZmx1ZW5jZSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZlcnRleEFycmF5LmJsZW5kV2VpZ2h0LmRhdGFbaWR4ICogNCArIGluZmx1ZW5jZV0gPT09IDApXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxCb25lSW5kZXggPSB2ZXJ0ZXhBcnJheS5ibGVuZEluZGljZXMuZGF0YVt2ZXJ0ZXguaW5kZXggKiA0ICsgaW5mbHVlbmNlXTtcbiAgICAgICAgICAgICAgICB2ZXJ0ZXguYm9uZUluZGljZXNbaW5mbHVlbmNlXSA9IHRoaXMuZ2V0Qm9uZVJlbWFwKG9yaWdpbmFsQm9uZUluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlbWFwcGVkSW5kZXggPSB0aGlzLnZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMuaW5kaWNlcy5wdXNoKHJlbWFwcGVkSW5kZXgpO1xuICAgICAgICAgICAgdGhpcy52ZXJ0aWNlcy5wdXNoKHZlcnRleCk7XG4gICAgICAgICAgICB0aGlzLmluZGV4TWFwW2lkeF0gPSByZW1hcHBlZEluZGV4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkUHJpbWl0aXZlKHZlcnRpY2VzLCB2ZXJ0ZXhJbmRpY2VzLCB2ZXJ0ZXhBcnJheSwgYm9uZUxpbWl0KSB7XG4gICAgICAgIC8vIEJ1aWxkIGEgbGlzdCBvZiBhbGwgdGhlIGJvbmVzIHVzZWQgYnkgdGhlIHZlcnRleCB0aGF0IGFyZW4ndCBjdXJyZW50bHkgaW4gdGhpcyBwYXJ0aXRpb25cbiAgICAgICAgY29uc3QgYm9uZXNUb0FkZCA9IFtdO1xuICAgICAgICBsZXQgYm9uZXNUb0FkZENvdW50ID0gMDtcbiAgICAgICAgY29uc3QgdmVydGV4Q291bnQgPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgdmVydGV4ID0gdmVydGljZXNbaV07XG4gICAgICAgICAgICBjb25zdCBpZHggPSB2ZXJ0ZXguaW5kZXg7XG4gICAgICAgICAgICBmb3IgKGxldCBpbmZsdWVuY2UgPSAwOyBpbmZsdWVuY2UgPCA0OyBpbmZsdWVuY2UrKykge1xuICAgICAgICAgICAgICAgIGlmICh2ZXJ0ZXhBcnJheS5ibGVuZFdlaWdodC5kYXRhW2lkeCAqIDQgKyBpbmZsdWVuY2VdID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib25lSW5kZXggPSB2ZXJ0ZXhBcnJheS5ibGVuZEluZGljZXMuZGF0YVtpZHggKiA0ICsgaW5mbHVlbmNlXTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IG5lZWRUb0FkZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYm9uZXNUb0FkZENvdW50OyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChib25lc1RvQWRkW2pdID09PSBib25lSW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZWVkVG9BZGQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobmVlZFRvQWRkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBib25lc1RvQWRkW2JvbmVzVG9BZGRDb3VudF0gPSBib25lSW5kZXg7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBib25lUmVtYXAgPSB0aGlzLmdldEJvbmVSZW1hcChib25lSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYm9uZXNUb0FkZENvdW50ICs9IChib25lUmVtYXAgPT09IC0xID8gMSA6IDApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2hlY2sgdGhhdCB3ZSBjYW4gZml0IG1vcmUgYm9uZXMgaW4gdGhpcyBwYXJ0aXRpb24uXG4gICAgICAgIGlmICgodGhpcy5ib25lSW5kaWNlcy5sZW5ndGggKyBib25lc1RvQWRkQ291bnQpID4gYm9uZUxpbWl0KSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgYm9uZXNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBib25lc1RvQWRkQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5ib25lSW5kaWNlcy5wdXNoKGJvbmVzVG9BZGRbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIHZlcnRpY2VzIGFuZCBpbmRpY2VzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5hZGRWZXJ0ZXgodmVydGljZXNbaV0sIHZlcnRleEluZGljZXNbaV0sIHZlcnRleEFycmF5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGdldEJvbmVSZW1hcChib25lSW5kZXgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmJvbmVJbmRpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5ib25lSW5kaWNlc1tpXSA9PT0gYm9uZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaW5kaWNlc1RvUmVmZXJlbmNlcyhtb2RlbCkge1xuICAgIGNvbnN0IHZlcnRpY2VzID0gbW9kZWwudmVydGljZXM7XG4gICAgY29uc3Qgc2tpbnMgPSBtb2RlbC5za2lucztcbiAgICBjb25zdCBtZXNoZXMgPSBtb2RlbC5tZXNoZXM7XG4gICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG1vZGVsLm1lc2hJbnN0YW5jZXM7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBtZXNoZXNbaV0udmVydGljZXMgPSB2ZXJ0aWNlc1ttZXNoZXNbaV0udmVydGljZXNdO1xuICAgICAgICBpZiAobWVzaGVzW2ldLnNraW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbWVzaGVzW2ldLnNraW4gPSBza2luc1ttZXNoZXNbaV0uc2tpbl07XG4gICAgICAgIH1cbiAgICB9XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ubWVzaCA9IG1lc2hlc1ttZXNoSW5zdGFuY2VzW2ldLm1lc2hdO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVmZXJlbmNlc1RvSW5kaWNlcyhtb2RlbCkge1xuICAgIGNvbnN0IHZlcnRpY2VzID0gbW9kZWwudmVydGljZXM7XG4gICAgY29uc3Qgc2tpbnMgPSBtb2RlbC5za2lucztcbiAgICBjb25zdCBtZXNoZXMgPSBtb2RlbC5tZXNoZXM7XG4gICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG1vZGVsLm1lc2hJbnN0YW5jZXM7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBtZXNoZXNbaV0udmVydGljZXMgPSB2ZXJ0aWNlcy5pbmRleE9mKG1lc2hlc1tpXS52ZXJ0aWNlcyk7XG4gICAgICAgIGlmIChtZXNoZXNbaV0uc2tpbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBtZXNoZXNbaV0uc2tpbiA9IHNraW5zLmluZGV4T2YobWVzaGVzW2ldLnNraW4pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLm1lc2ggPSBtZXNoZXMuaW5kZXhPZihtZXNoSW5zdGFuY2VzW2ldLm1lc2gpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcGFydGl0aW9uU2tpbihtb2RlbCwgbWF0ZXJpYWxNYXBwaW5ncywgYm9uZUxpbWl0KSB7XG4gICAgbGV0IGksIGosIGssIGluZGV4O1xuXG4gICAgLy8gUmVwbGFjZSBvYmplY3QgaW5kaWNlcyB3aXRoIGFjdHVhbCBvYmplY3QgcmVmZXJlbmNlc1xuICAgIC8vIFRoaXMgc2ltcGxpZmllcyBpbnNlcnRpb24vcmVtb3ZhbCBvZiBhcnJheSBpdGVtc1xuICAgIGluZGljZXNUb1JlZmVyZW5jZXMobW9kZWwpO1xuXG4gICAgY29uc3QgdmVydGV4QXJyYXlzID0gbW9kZWwudmVydGljZXM7XG4gICAgY29uc3Qgc2tpbnMgPSBtb2RlbC5za2lucztcbiAgICBsZXQgbWVzaDtcbiAgICBjb25zdCBtZXNoZXMgPSBtb2RlbC5tZXNoZXM7XG4gICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG1vZGVsLm1lc2hJbnN0YW5jZXM7XG5cbiAgICBjb25zdCBnZXRWZXJ0ZXggPSBmdW5jdGlvbiAoaWR4KSB7XG4gICAgICAgIGNvbnN0IHZlcnQgPSBuZXcgUGFydGl0aW9uZWRWZXJ0ZXgoKTtcbiAgICAgICAgdmVydC5pbmRleCA9IGlkeDtcbiAgICAgICAgcmV0dXJuIHZlcnQ7XG4gICAgfTtcblxuICAgIGZvciAoaSA9IHNraW5zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIC8vIFRoaXMgc2tpbiBleGNlZWRzIHRoZSBib25lIGxpbWl0LiBTcGxpdCBpdCFcbiAgICAgICAgaWYgKHNraW5zW2ldLmJvbmVOYW1lcy5sZW5ndGggPiBib25lTGltaXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHNraW4gPSBza2lucy5zcGxpY2UoaSwgMSlbMF07XG5cbiAgICAgICAgICAgIC8vIEJ1aWxkIGEgbGlzdCBvZiBtZXNoZXMgdGhhdCB1c2UgdGhpcyBza2luXG4gICAgICAgICAgICBjb25zdCBtZXNoZXNUb1NwbGl0ID0gW107XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgbWVzaGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1lc2hlc1tqXS5za2luID09PSBza2luKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hlc1RvU3BsaXQucHVzaChtZXNoZXNbal0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFJlbW92ZSBtZXNoZXMgZnJvbSBzb3VyY2UgYXJyYXlcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBtZXNoZXNUb1NwbGl0Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgaW5kZXggPSBtZXNoZXMuaW5kZXhPZihtZXNoZXNUb1NwbGl0W2pdKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRXJyb3IgaGFuZGxpbmdcbiAgICAgICAgICAgIGlmIChtZXNoZXNUb1NwbGl0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncGFydGl0aW9uU2tpbjogVGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IG9uZSBtZXNoIHRoYXQgcmVmZXJlbmNlcyBhIHNraW4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdmVydGV4QXJyYXkgPSBtZXNoZXNUb1NwbGl0WzBdLnZlcnRpY2VzO1xuICAgICAgICAgICAgZm9yIChqID0gMTsgaiA8IG1lc2hlc1RvU3BsaXQubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBpZiAobWVzaGVzVG9TcGxpdFtqXS52ZXJ0aWNlcyAhPT0gdmVydGV4QXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwYXJ0aXRpb25Ta2luOiBBbGwgbWVzaGVzIHRoYXQgc2hhcmUgYSBza2luIHNob3VsZCBhbHNvIHNoYXJlIHRoZSBzYW1lIHZlcnRleCBidWZmZXInKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBwYXJ0aXRpb247XG4gICAgICAgICAgICBjb25zdCBwYXJ0aXRpb25zID0gW107XG5cbiAgICAgICAgICAgIC8vIFBoYXNlIDE6XG4gICAgICAgICAgICAvLyBCdWlsZCB0aGUgc2tpbiBwYXJ0aXRpb25zXG4gICAgICAgICAgICAvLyBHbyB0aHJvdWdoIGluZGV4IGxpc3QgYW5kIGV4dHJhY3QgcHJpbWl0aXZlcyBhbmQgYWRkIHRoZW0gdG8gYm9uZSBwYXJ0aXRpb25zXG4gICAgICAgICAgICAvLyBTaW5jZSB3ZSBhcmUgd29ya2luZyB3aXRoIGEgc2luZ2xlIHRyaWFuZ2xlIGxpc3QsIGV2ZXJ5dGhpbmcgaXMgYSB0cmlhbmdsZVxuICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlVmVydGljZXMgPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHByaW1pdGl2ZUluZGljZXMgPSBbXTtcbiAgICAgICAgICAgIGxldCBiYXNlUGFydGl0aW9uID0gMDtcblxuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IG1lc2hlc1RvU3BsaXQubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBtZXNoID0gbWVzaGVzVG9TcGxpdFtqXTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmRpY2VzID0gbWVzaC5pbmRpY2VzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGlJbmRleCA9IG1lc2guYmFzZTsgaUluZGV4IDwgbWVzaC5iYXNlICsgbWVzaC5jb3VudDspIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBwcmltaXRpdmVcbiAgICAgICAgICAgICAgICAgICAgLy8gQ29udmVydCB2ZXJ0aWNlc1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGVyZSBpcyBhIGxpdHRsZSBiaXQgb2Ygd2FzdGVkIHRpbWUgaGVyZSBpZiB0aGUgdmVydGV4IHdhcyBhbHJlYWR5IGFkZGVkIHByZXZpb3VzbHlcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpbmRpY2VzW2lJbmRleCsrXTtcbiAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVmVydGljZXNbMF0gPSBnZXRWZXJ0ZXgoaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBwcmltaXRpdmVJbmRpY2VzWzBdID0gaW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpbmRpY2VzW2lJbmRleCsrXTtcbiAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVmVydGljZXNbMV0gPSBnZXRWZXJ0ZXgoaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBwcmltaXRpdmVJbmRpY2VzWzFdID0gaW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpbmRpY2VzW2lJbmRleCsrXTtcbiAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVmVydGljZXNbMl0gPSBnZXRWZXJ0ZXgoaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBwcmltaXRpdmVJbmRpY2VzWzJdID0gaW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQXR0ZW1wdCB0byBhZGQgdGhlIHByaW1pdGl2ZSB0byBhbiBleGlzdGluZyBib25lIHBhcnRpdGlvblxuICAgICAgICAgICAgICAgICAgICBsZXQgYWRkZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaUJvbmVQYXJ0aXRpb24gPSBiYXNlUGFydGl0aW9uOyBpQm9uZVBhcnRpdGlvbiA8IHBhcnRpdGlvbnMubGVuZ3RoOyBpQm9uZVBhcnRpdGlvbisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aXRpb24gPSBwYXJ0aXRpb25zW2lCb25lUGFydGl0aW9uXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJ0aXRpb24uYWRkUHJpbWl0aXZlKHByaW1pdGl2ZVZlcnRpY2VzLCBwcmltaXRpdmVJbmRpY2VzLCB2ZXJ0ZXhBcnJheSwgYm9uZUxpbWl0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSBwcmltaXRpdmUgd2FzIG5vdCBhZGRlZCB0byBhbiBleGlzdGluZyBib25lIHBhcnRpdGlvbiwgd2UgbmVlZCB0byBtYWtlIGEgbmV3IGJvbmUgcGFydGl0aW9uIGFuZCBhZGQgdGhlIHByaW1pdGl2ZSB0byBpdFxuICAgICAgICAgICAgICAgICAgICBpZiAoIWFkZGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aXRpb24gPSBuZXcgU2tpblBhcnRpdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGl0aW9uLm9yaWdpbmFsTWVzaCA9IG1lc2g7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aXRpb24uYWRkUHJpbWl0aXZlKHByaW1pdGl2ZVZlcnRpY2VzLCBwcmltaXRpdmVJbmRpY2VzLCB2ZXJ0ZXhBcnJheSwgYm9uZUxpbWl0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpdGlvbnMucHVzaChwYXJ0aXRpb24pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYmFzZVBhcnRpdGlvbiA9IHBhcnRpdGlvbnMubGVuZ3RoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBQaGFzZSAyOlxuICAgICAgICAgICAgLy8gR2F0aGVyIHZlcnRleCBhbmQgaW5kZXggbGlzdHMgZnJvbSBhbGwgdGhlIHBhcnRpdGlvbnMsIHRoZW4gdXBsb2FkIHRvIEdQVVxuICAgICAgICAgICAgY29uc3QgcGFydGl0aW9uZWRWZXJ0aWNlcyA9IFtdO1xuICAgICAgICAgICAgY29uc3QgcGFydGl0aW9uZWRJbmRpY2VzID0gW107XG5cbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBwYXJ0aXRpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgcGFydGl0aW9uID0gcGFydGl0aW9uc1tqXTtcblxuICAgICAgICAgICAgICAgIGlmIChwYXJ0aXRpb24udmVydGljZXMubGVuZ3RoICYmIHBhcnRpdGlvbi5pbmRpY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAvLyB0aGlzIGJvbmUgcGFydGl0aW9uIGNvbnRhaW5zIHZlcnRpY2VzIGFuZCBpbmRpY2VzXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRmluZCBvZmZzZXRzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleFN0YXJ0ID0gcGFydGl0aW9uZWRWZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleENvdW50ID0gcGFydGl0aW9uLnZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXhTdGFydCA9IHBhcnRpdGlvbmVkSW5kaWNlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4Q291bnQgPSBwYXJ0aXRpb24uaW5kaWNlcy5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTWFrZSBhIG5ldyBzdWIgc2V0XG4gICAgICAgICAgICAgICAgICAgIHBhcnRpdGlvbi5wYXJ0aXRpb24gPSBqO1xuICAgICAgICAgICAgICAgICAgICBwYXJ0aXRpb24udmVydGV4U3RhcnQgPSB2ZXJ0ZXhTdGFydDtcbiAgICAgICAgICAgICAgICAgICAgcGFydGl0aW9uLnZlcnRleENvdW50ID0gdmVydGV4Q291bnQ7XG4gICAgICAgICAgICAgICAgICAgIHBhcnRpdGlvbi5pbmRleFN0YXJ0ID0gaW5kZXhTdGFydDtcbiAgICAgICAgICAgICAgICAgICAgcGFydGl0aW9uLmluZGV4Q291bnQgPSBpbmRleENvdW50O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIENvcHkgYnVmZmVyc1xuICAgICAgICAgICAgICAgICAgICBsZXQgaVNvdXI7XG4gICAgICAgICAgICAgICAgICAgIGxldCBpRGVzdDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBDb3B5IHZlcnRpY2VzIHRvIGZpbmFsIGxpc3RcbiAgICAgICAgICAgICAgICAgICAgaVNvdXIgPSAwO1xuICAgICAgICAgICAgICAgICAgICBpRGVzdCA9IHZlcnRleFN0YXJ0O1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaVNvdXIgPCB2ZXJ0ZXhDb3VudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGl0aW9uZWRWZXJ0aWNlc1tpRGVzdCsrXSA9IHBhcnRpdGlvbi52ZXJ0aWNlc1tpU291cisrXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIENvcHkgaW5kaWNlcyB0byBmaW5hbCBsaXN0XG4gICAgICAgICAgICAgICAgICAgIGlTb3VyID0gMDtcbiAgICAgICAgICAgICAgICAgICAgaURlc3QgPSBpbmRleFN0YXJ0O1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaVNvdXIgPCBpbmRleENvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aXRpb25lZEluZGljZXNbaURlc3QrK10gPSBwYXJ0aXRpb24uaW5kaWNlc1tpU291cisrXSArIHZlcnRleFN0YXJ0OyAgICAvLyBhZGp1c3Qgc28gdGhleSByZWZlcmVuY2UgaW50byBmbGF0IHZlcnRleCBsaXN0XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBoYXNlIDM6XG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIHNwbGl0IHNraW5zXG4gICAgICAgICAgICBjb25zdCBzcGxpdFNraW5zID0gW107XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcGFydGl0aW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIHBhcnRpdGlvbiA9IHBhcnRpdGlvbnNbal07XG5cbiAgICAgICAgICAgICAgICBjb25zdCBpYnAgPSBbXTtcbiAgICAgICAgICAgICAgICBjb25zdCBib25lTmFtZXMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGsgPSAwOyBrIDwgcGFydGl0aW9uLmJvbmVJbmRpY2VzLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlicC5wdXNoKHNraW4uaW52ZXJzZUJpbmRNYXRyaWNlc1twYXJ0aXRpb24uYm9uZUluZGljZXNba11dKTtcbiAgICAgICAgICAgICAgICAgICAgYm9uZU5hbWVzLnB1c2goc2tpbi5ib25lTmFtZXNbcGFydGl0aW9uLmJvbmVJbmRpY2VzW2tdXSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3Qgc3BsaXRTa2luID0ge1xuICAgICAgICAgICAgICAgICAgICBpbnZlcnNlQmluZE1hdHJpY2VzOiBpYnAsXG4gICAgICAgICAgICAgICAgICAgIGJvbmVOYW1lczogYm9uZU5hbWVzXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBzcGxpdFNraW5zLnB1c2goc3BsaXRTa2luKTtcbiAgICAgICAgICAgICAgICBza2lucy5wdXNoKHNwbGl0U2tpbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBoYXNlIDRcblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgcGFydGl0aW9uZWQgdmVydGV4IGFycmF5XG4gICAgICAgICAgICBsZXQgYXR0cmliLCBhdHRyaWJOYW1lLCBkYXRhLCBjb21wb25lbnRzO1xuICAgICAgICAgICAgY29uc3Qgc3BsaXRWZXJ0ZXhBcnJheSA9IHt9O1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSB2ZXJ0ZXggYXJyYXkgb2YgdGhlIHNhbWUgZm9ybWF0IGFzIHRoZSBpbnB1dCB0byB0YWtlIHBhcnRpdGlvbmVkIHZlcnRleCBkYXRhXG4gICAgICAgICAgICBmb3IgKGF0dHJpYk5hbWUgaW4gdmVydGV4QXJyYXkpIHtcbiAgICAgICAgICAgICAgICBzcGxpdFZlcnRleEFycmF5W2F0dHJpYk5hbWVdID0ge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiB2ZXJ0ZXhBcnJheVthdHRyaWJOYW1lXS5jb21wb25lbnRzLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogdmVydGV4QXJyYXlbYXR0cmliTmFtZV0udHlwZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENvcHkgYWNyb3NzIHRoZSB2ZXJ0ZXggZGF0YS4gRXZlcnl0aGluZyBpcyB0aGUgc2FtZSBhcyB0aGUgc291cmNlIGRhdGEgZXhjZXB0IHRoZSByZW1hcHBlZFxuICAgICAgICAgICAgLy8gYm9uZSBpbmRpY2VzXG4gICAgICAgICAgICBmb3IgKGF0dHJpYk5hbWUgaW4gdmVydGV4QXJyYXkpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXR0cmliTmFtZSA9PT0gJ2JsZW5kSW5kaWNlcycpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHN0Qm9uZUluZGljZXMgPSBzcGxpdFZlcnRleEFycmF5W2F0dHJpYk5hbWVdLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBwYXJ0aXRpb25lZFZlcnRpY2VzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzcmNCb25lSW5kaWNlcyA9IHBhcnRpdGlvbmVkVmVydGljZXNbal0uYm9uZUluZGljZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBkc3RCb25lSW5kaWNlcy5wdXNoKHNyY0JvbmVJbmRpY2VzWzBdLCBzcmNCb25lSW5kaWNlc1sxXSwgc3JjQm9uZUluZGljZXNbMl0sIHNyY0JvbmVJbmRpY2VzWzNdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYiA9IHZlcnRleEFycmF5W2F0dHJpYk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhID0gYXR0cmliLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMgPSBhdHRyaWIuY29tcG9uZW50cztcbiAgICAgICAgICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHBhcnRpdGlvbmVkVmVydGljZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4ID0gcGFydGl0aW9uZWRWZXJ0aWNlc1tqXS5pbmRleDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoayA9IDA7IGsgPCBjb21wb25lbnRzOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpdFZlcnRleEFycmF5W2F0dHJpYk5hbWVdLmRhdGEucHVzaChkYXRhW2luZGV4ICogY29tcG9uZW50cyArIGtdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVwbGFjZSBvcmlnaW5hbCB2ZXJ0ZXggYXJyYXkgd2l0aCBzcGxpdCBvbmVcbiAgICAgICAgICAgIHZlcnRleEFycmF5c1t2ZXJ0ZXhBcnJheXMuaW5kZXhPZih2ZXJ0ZXhBcnJheSldID0gc3BsaXRWZXJ0ZXhBcnJheTtcblxuICAgICAgICAgICAgLy8gUGhhc2UgNVxuXG4gICAgICAgICAgICAvLyBCdWlsZCBuZXcgbWVzaCBhcnJheVxuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHBhcnRpdGlvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBwYXJ0aXRpb24gPSBwYXJ0aXRpb25zW2pdO1xuXG4gICAgICAgICAgICAgICAgbWVzaCA9IHtcbiAgICAgICAgICAgICAgICAgICAgYWFiYjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWluOiBbMCwgMCwgMF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXg6IFswLCAwLCAwXVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB2ZXJ0aWNlczogc3BsaXRWZXJ0ZXhBcnJheSxcbiAgICAgICAgICAgICAgICAgICAgc2tpbjogc3BsaXRTa2luc1tqXSxcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlczogcGFydGl0aW9uZWRJbmRpY2VzLnNwbGljZSgwLCBwYXJ0aXRpb24uaW5kZXhDb3VudCksXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICd0cmlhbmdsZXMnLFxuICAgICAgICAgICAgICAgICAgICBiYXNlOiAwLFxuICAgICAgICAgICAgICAgICAgICBjb3VudDogcGFydGl0aW9uLmluZGV4Q291bnRcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgbWVzaGVzLnB1c2gobWVzaCk7XG5cbiAgICAgICAgICAgICAgICAvLyBGaW5kIGFsbCB0aGUgb3JpZ2luYWwgbWVzaCBpbnN0YW5jZXMgdGhhdCByZWZlcnJlZCB0byB0aGUgcHJlLXNwbGl0IG1lc2hcbiAgICAgICAgICAgICAgICBmb3IgKGsgPSBtZXNoSW5zdGFuY2VzLmxlbmd0aCAtIDE7IGsgPj0gMDsgay0tKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2VzW2tdLm1lc2ggPT09IHBhcnRpdGlvbi5vcmlnaW5hbE1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzaDogbWVzaCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlOiBtZXNoSW5zdGFuY2VzW2tdLm5vZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsTWFwcGluZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbE1hcHBpbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbDogbWF0ZXJpYWxNYXBwaW5nc1trXS5tYXRlcmlhbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogbWF0ZXJpYWxNYXBwaW5nc1trXS5wYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBwYXJ0aXRpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgcGFydGl0aW9uID0gcGFydGl0aW9uc1tqXTtcblxuICAgICAgICAgICAgICAgIC8vIEZpbmQgYWxsIHRoZSBvcmlnaW5hbCBtZXNoIGluc3RhbmNlcyB0aGF0IHJlZmVycmVkIHRvIHRoZSBwcmUtc3BsaXQgbWVzaFxuICAgICAgICAgICAgICAgIGZvciAoayA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoIC0gMTsgayA+PSAwOyBrLS0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXNba10ubWVzaCA9PT0gcGFydGl0aW9uLm9yaWdpbmFsTWVzaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlcy5zcGxpY2UoaywgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWxNYXBwaW5ncykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsTWFwcGluZ3Muc3BsaWNlKGssIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29udmVydCByZWZlcmVuY2VzIGJhY2sgdG8gaW5kaWNlc1xuICAgIHJlZmVyZW5jZXNUb0luZGljZXMobW9kZWwpO1xufVxuXG5leHBvcnQgeyBwYXJ0aXRpb25Ta2luIH07XG4iXSwibmFtZXMiOlsiUGFydGl0aW9uZWRWZXJ0ZXgiLCJjb25zdHJ1Y3RvciIsImluZGV4IiwiYm9uZUluZGljZXMiLCJTa2luUGFydGl0aW9uIiwicGFydGl0aW9uIiwidmVydGV4U3RhcnQiLCJ2ZXJ0ZXhDb3VudCIsImluZGV4U3RhcnQiLCJpbmRleENvdW50IiwidmVydGljZXMiLCJpbmRpY2VzIiwiaW5kZXhNYXAiLCJvcmlnaW5hbE1lc2giLCJhZGRWZXJ0ZXgiLCJ2ZXJ0ZXgiLCJpZHgiLCJ2ZXJ0ZXhBcnJheSIsInJlbWFwcGVkSW5kZXgiLCJ1bmRlZmluZWQiLCJwdXNoIiwiaW5mbHVlbmNlIiwiYmxlbmRXZWlnaHQiLCJkYXRhIiwib3JpZ2luYWxCb25lSW5kZXgiLCJibGVuZEluZGljZXMiLCJnZXRCb25lUmVtYXAiLCJsZW5ndGgiLCJhZGRQcmltaXRpdmUiLCJ2ZXJ0ZXhJbmRpY2VzIiwiYm9uZUxpbWl0IiwiYm9uZXNUb0FkZCIsImJvbmVzVG9BZGRDb3VudCIsImkiLCJib25lSW5kZXgiLCJuZWVkVG9BZGQiLCJqIiwiYm9uZVJlbWFwIiwiaW5kaWNlc1RvUmVmZXJlbmNlcyIsIm1vZGVsIiwic2tpbnMiLCJtZXNoZXMiLCJtZXNoSW5zdGFuY2VzIiwic2tpbiIsIm1lc2giLCJyZWZlcmVuY2VzVG9JbmRpY2VzIiwiaW5kZXhPZiIsInBhcnRpdGlvblNraW4iLCJtYXRlcmlhbE1hcHBpbmdzIiwiayIsInZlcnRleEFycmF5cyIsImdldFZlcnRleCIsInZlcnQiLCJib25lTmFtZXMiLCJzcGxpY2UiLCJtZXNoZXNUb1NwbGl0IiwiRXJyb3IiLCJwYXJ0aXRpb25zIiwicHJpbWl0aXZlVmVydGljZXMiLCJwcmltaXRpdmVJbmRpY2VzIiwiYmFzZVBhcnRpdGlvbiIsImlJbmRleCIsImJhc2UiLCJjb3VudCIsImFkZGVkIiwiaUJvbmVQYXJ0aXRpb24iLCJwYXJ0aXRpb25lZFZlcnRpY2VzIiwicGFydGl0aW9uZWRJbmRpY2VzIiwiaVNvdXIiLCJpRGVzdCIsInNwbGl0U2tpbnMiLCJpYnAiLCJpbnZlcnNlQmluZE1hdHJpY2VzIiwic3BsaXRTa2luIiwiYXR0cmliIiwiYXR0cmliTmFtZSIsImNvbXBvbmVudHMiLCJzcGxpdFZlcnRleEFycmF5IiwidHlwZSIsImRzdEJvbmVJbmRpY2VzIiwi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
