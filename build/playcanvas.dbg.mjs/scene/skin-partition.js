/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
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
