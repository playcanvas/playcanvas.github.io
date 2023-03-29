/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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

    // Indices of bones in this partition. skin matrices will be uploaded to the vertex shader in this order.
    this.boneIndices = [];

    // Partitioned vertex attributes
    this.vertices = [];
    // Partitioned vertex indices
    this.indices = [];
    // Maps the index of an un-partitioned vertex to that same vertex if it has been added
    // to this particular partition. speeds up checking for duplicate vertices so we don't
    // add the same vertex more than once.
    this.indexMap = {};
    this.originalMesh = null;
  }
  addVertex(vertex, idx, vertexArray) {
    let remappedIndex = -1;
    if (this.indexMap[idx] !== undefined) {
      remappedIndex = this.indexMap[idx];
      this.indices.push(remappedIndex);
    } else {
      // Create new partitioned vertex
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
    // Build a list of all the bones used by the vertex that aren't currently in this partition
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

    // Check that we can fit more bones in this partition.
    if (this.boneIndices.length + bonesToAddCount > boneLimit) {
      return false;
    }

    // Add bones
    for (let i = 0; i < bonesToAddCount; i++) {
      this.boneIndices.push(bonesToAdd[i]);
    }

    // Add vertices and indices
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

  // Replace object indices with actual object references
  // This simplifies insertion/removal of array items
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
    // This skin exceeds the bone limit. Split it!
    if (skins[i].boneNames.length > boneLimit) {
      const skin = skins.splice(i, 1)[0];

      // Build a list of meshes that use this skin
      const meshesToSplit = [];
      for (j = 0; j < meshes.length; j++) {
        if (meshes[j].skin === skin) {
          meshesToSplit.push(meshes[j]);
        }
      }
      // Remove meshes from source array
      for (j = 0; j < meshesToSplit.length; j++) {
        index = meshes.indexOf(meshesToSplit[j]);
        if (index !== -1) {
          meshes.splice(index, 1);
        }
      }

      // Error handling
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

      // Phase 1:
      // Build the skin partitions
      // Go through index list and extract primitives and add them to bone partitions
      // Since we are working with a single triangle list, everything is a triangle
      const primitiveVertices = [];
      const primitiveIndices = [];
      let basePartition = 0;
      for (j = 0; j < meshesToSplit.length; j++) {
        mesh = meshesToSplit[j];
        const indices = mesh.indices;
        for (let iIndex = mesh.base; iIndex < mesh.base + mesh.count;) {
          // Extract primitive
          // Convert vertices
          // There is a little bit of wasted time here if the vertex was already added previously
          index = indices[iIndex++];
          primitiveVertices[0] = getVertex(index);
          primitiveIndices[0] = index;
          index = indices[iIndex++];
          primitiveVertices[1] = getVertex(index);
          primitiveIndices[1] = index;
          index = indices[iIndex++];
          primitiveVertices[2] = getVertex(index);
          primitiveIndices[2] = index;

          // Attempt to add the primitive to an existing bone partition
          let added = false;
          for (let iBonePartition = basePartition; iBonePartition < partitions.length; iBonePartition++) {
            partition = partitions[iBonePartition];
            if (partition.addPrimitive(primitiveVertices, primitiveIndices, vertexArray, boneLimit)) {
              added = true;
              break;
            }
          }

          // If the primitive was not added to an existing bone partition, we need to make a new bone partition and add the primitive to it
          if (!added) {
            partition = new SkinPartition();
            partition.originalMesh = mesh;
            partition.addPrimitive(primitiveVertices, primitiveIndices, vertexArray, boneLimit);
            partitions.push(partition);
          }
        }
        basePartition = partitions.length;
      }

      // Phase 2:
      // Gather vertex and index lists from all the partitions, then upload to GPU
      const partitionedVertices = [];
      const partitionedIndices = [];
      for (j = 0; j < partitions.length; j++) {
        partition = partitions[j];
        if (partition.vertices.length && partition.indices.length) {
          // this bone partition contains vertices and indices

          // Find offsets
          const vertexStart = partitionedVertices.length;
          const vertexCount = partition.vertices.length;
          const indexStart = partitionedIndices.length;
          const indexCount = partition.indices.length;

          // Make a new sub set
          partition.partition = j;
          partition.vertexStart = vertexStart;
          partition.vertexCount = vertexCount;
          partition.indexStart = indexStart;
          partition.indexCount = indexCount;

          // Copy buffers
          let iSour;
          let iDest;

          // Copy vertices to final list
          iSour = 0;
          iDest = vertexStart;
          while (iSour < vertexCount) {
            partitionedVertices[iDest++] = partition.vertices[iSour++];
          }

          // Copy indices to final list
          iSour = 0;
          iDest = indexStart;
          while (iSour < indexCount) {
            partitionedIndices[iDest++] = partition.indices[iSour++] + vertexStart; // adjust so they reference into flat vertex list
          }
        }
      }

      // Phase 3:
      // Create the split skins
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

      // Phase 4

      // Create a partitioned vertex array
      let attrib, attribName, data, components;
      const splitVertexArray = {};

      // Create a vertex array of the same format as the input to take partitioned vertex data
      for (attribName in vertexArray) {
        splitVertexArray[attribName] = {
          components: vertexArray[attribName].components,
          data: [],
          type: vertexArray[attribName].type
        };
      }

      // Copy across the vertex data. Everything is the same as the source data except the remapped
      // bone indices
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

      // Replace original vertex array with split one
      vertexArrays[vertexArrays.indexOf(vertexArray)] = splitVertexArray;

      // Phase 5

      // Build new mesh array
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

        // Find all the original mesh instances that referred to the pre-split mesh
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

        // Find all the original mesh instances that referred to the pre-split mesh
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

  // Convert references back to indices
  referencesToIndices(model);
}

export { partitionSkin };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2tpbi1wYXJ0aXRpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9za2luLXBhcnRpdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjbGFzcyBQYXJ0aXRpb25lZFZlcnRleCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuaW5kZXggPSAwO1xuICAgICAgICB0aGlzLmJvbmVJbmRpY2VzID0gWzAsIDAsIDAsIDBdO1xuICAgIH1cbn1cblxuY2xhc3MgU2tpblBhcnRpdGlvbiB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMucGFydGl0aW9uID0gMDtcbiAgICAgICAgdGhpcy52ZXJ0ZXhTdGFydCA9IDA7XG4gICAgICAgIHRoaXMudmVydGV4Q291bnQgPSAwO1xuICAgICAgICB0aGlzLmluZGV4U3RhcnQgPSAwO1xuICAgICAgICB0aGlzLmluZGV4Q291bnQgPSAwO1xuXG4gICAgICAgIC8vIEluZGljZXMgb2YgYm9uZXMgaW4gdGhpcyBwYXJ0aXRpb24uIHNraW4gbWF0cmljZXMgd2lsbCBiZSB1cGxvYWRlZCB0byB0aGUgdmVydGV4IHNoYWRlciBpbiB0aGlzIG9yZGVyLlxuICAgICAgICB0aGlzLmJvbmVJbmRpY2VzID0gW107XG5cbiAgICAgICAgLy8gUGFydGl0aW9uZWQgdmVydGV4IGF0dHJpYnV0ZXNcbiAgICAgICAgdGhpcy52ZXJ0aWNlcyA9IFtdO1xuICAgICAgICAvLyBQYXJ0aXRpb25lZCB2ZXJ0ZXggaW5kaWNlc1xuICAgICAgICB0aGlzLmluZGljZXMgPSBbXTtcbiAgICAgICAgLy8gTWFwcyB0aGUgaW5kZXggb2YgYW4gdW4tcGFydGl0aW9uZWQgdmVydGV4IHRvIHRoYXQgc2FtZSB2ZXJ0ZXggaWYgaXQgaGFzIGJlZW4gYWRkZWRcbiAgICAgICAgLy8gdG8gdGhpcyBwYXJ0aWN1bGFyIHBhcnRpdGlvbi4gc3BlZWRzIHVwIGNoZWNraW5nIGZvciBkdXBsaWNhdGUgdmVydGljZXMgc28gd2UgZG9uJ3RcbiAgICAgICAgLy8gYWRkIHRoZSBzYW1lIHZlcnRleCBtb3JlIHRoYW4gb25jZS5cbiAgICAgICAgdGhpcy5pbmRleE1hcCA9IHt9O1xuXG4gICAgICAgIHRoaXMub3JpZ2luYWxNZXNoID0gbnVsbDtcbiAgICB9XG5cbiAgICBhZGRWZXJ0ZXgodmVydGV4LCBpZHgsIHZlcnRleEFycmF5KSB7XG4gICAgICAgIGxldCByZW1hcHBlZEluZGV4ID0gLTE7XG4gICAgICAgIGlmICh0aGlzLmluZGV4TWFwW2lkeF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmVtYXBwZWRJbmRleCA9IHRoaXMuaW5kZXhNYXBbaWR4XTtcbiAgICAgICAgICAgIHRoaXMuaW5kaWNlcy5wdXNoKHJlbWFwcGVkSW5kZXgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIG5ldyBwYXJ0aXRpb25lZCB2ZXJ0ZXhcbiAgICAgICAgICAgIGZvciAobGV0IGluZmx1ZW5jZSA9IDA7IGluZmx1ZW5jZSA8IDQ7IGluZmx1ZW5jZSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZlcnRleEFycmF5LmJsZW5kV2VpZ2h0LmRhdGFbaWR4ICogNCArIGluZmx1ZW5jZV0gPT09IDApXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxCb25lSW5kZXggPSB2ZXJ0ZXhBcnJheS5ibGVuZEluZGljZXMuZGF0YVt2ZXJ0ZXguaW5kZXggKiA0ICsgaW5mbHVlbmNlXTtcbiAgICAgICAgICAgICAgICB2ZXJ0ZXguYm9uZUluZGljZXNbaW5mbHVlbmNlXSA9IHRoaXMuZ2V0Qm9uZVJlbWFwKG9yaWdpbmFsQm9uZUluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlbWFwcGVkSW5kZXggPSB0aGlzLnZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMuaW5kaWNlcy5wdXNoKHJlbWFwcGVkSW5kZXgpO1xuICAgICAgICAgICAgdGhpcy52ZXJ0aWNlcy5wdXNoKHZlcnRleCk7XG4gICAgICAgICAgICB0aGlzLmluZGV4TWFwW2lkeF0gPSByZW1hcHBlZEluZGV4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkUHJpbWl0aXZlKHZlcnRpY2VzLCB2ZXJ0ZXhJbmRpY2VzLCB2ZXJ0ZXhBcnJheSwgYm9uZUxpbWl0KSB7XG4gICAgICAgIC8vIEJ1aWxkIGEgbGlzdCBvZiBhbGwgdGhlIGJvbmVzIHVzZWQgYnkgdGhlIHZlcnRleCB0aGF0IGFyZW4ndCBjdXJyZW50bHkgaW4gdGhpcyBwYXJ0aXRpb25cbiAgICAgICAgY29uc3QgYm9uZXNUb0FkZCA9IFtdO1xuICAgICAgICBsZXQgYm9uZXNUb0FkZENvdW50ID0gMDtcbiAgICAgICAgY29uc3QgdmVydGV4Q291bnQgPSB2ZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgdmVydGV4ID0gdmVydGljZXNbaV07XG4gICAgICAgICAgICBjb25zdCBpZHggPSB2ZXJ0ZXguaW5kZXg7XG4gICAgICAgICAgICBmb3IgKGxldCBpbmZsdWVuY2UgPSAwOyBpbmZsdWVuY2UgPCA0OyBpbmZsdWVuY2UrKykge1xuICAgICAgICAgICAgICAgIGlmICh2ZXJ0ZXhBcnJheS5ibGVuZFdlaWdodC5kYXRhW2lkeCAqIDQgKyBpbmZsdWVuY2VdID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBib25lSW5kZXggPSB2ZXJ0ZXhBcnJheS5ibGVuZEluZGljZXMuZGF0YVtpZHggKiA0ICsgaW5mbHVlbmNlXTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IG5lZWRUb0FkZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYm9uZXNUb0FkZENvdW50OyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChib25lc1RvQWRkW2pdID09PSBib25lSW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZWVkVG9BZGQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobmVlZFRvQWRkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBib25lc1RvQWRkW2JvbmVzVG9BZGRDb3VudF0gPSBib25lSW5kZXg7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBib25lUmVtYXAgPSB0aGlzLmdldEJvbmVSZW1hcChib25lSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYm9uZXNUb0FkZENvdW50ICs9IChib25lUmVtYXAgPT09IC0xID8gMSA6IDApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2hlY2sgdGhhdCB3ZSBjYW4gZml0IG1vcmUgYm9uZXMgaW4gdGhpcyBwYXJ0aXRpb24uXG4gICAgICAgIGlmICgodGhpcy5ib25lSW5kaWNlcy5sZW5ndGggKyBib25lc1RvQWRkQ291bnQpID4gYm9uZUxpbWl0KSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgYm9uZXNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBib25lc1RvQWRkQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5ib25lSW5kaWNlcy5wdXNoKGJvbmVzVG9BZGRbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIHZlcnRpY2VzIGFuZCBpbmRpY2VzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5hZGRWZXJ0ZXgodmVydGljZXNbaV0sIHZlcnRleEluZGljZXNbaV0sIHZlcnRleEFycmF5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGdldEJvbmVSZW1hcChib25lSW5kZXgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmJvbmVJbmRpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5ib25lSW5kaWNlc1tpXSA9PT0gYm9uZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaW5kaWNlc1RvUmVmZXJlbmNlcyhtb2RlbCkge1xuICAgIGNvbnN0IHZlcnRpY2VzID0gbW9kZWwudmVydGljZXM7XG4gICAgY29uc3Qgc2tpbnMgPSBtb2RlbC5za2lucztcbiAgICBjb25zdCBtZXNoZXMgPSBtb2RlbC5tZXNoZXM7XG4gICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG1vZGVsLm1lc2hJbnN0YW5jZXM7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBtZXNoZXNbaV0udmVydGljZXMgPSB2ZXJ0aWNlc1ttZXNoZXNbaV0udmVydGljZXNdO1xuICAgICAgICBpZiAobWVzaGVzW2ldLnNraW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgbWVzaGVzW2ldLnNraW4gPSBza2luc1ttZXNoZXNbaV0uc2tpbl07XG4gICAgICAgIH1cbiAgICB9XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ubWVzaCA9IG1lc2hlc1ttZXNoSW5zdGFuY2VzW2ldLm1lc2hdO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVmZXJlbmNlc1RvSW5kaWNlcyhtb2RlbCkge1xuICAgIGNvbnN0IHZlcnRpY2VzID0gbW9kZWwudmVydGljZXM7XG4gICAgY29uc3Qgc2tpbnMgPSBtb2RlbC5za2lucztcbiAgICBjb25zdCBtZXNoZXMgPSBtb2RlbC5tZXNoZXM7XG4gICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG1vZGVsLm1lc2hJbnN0YW5jZXM7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBtZXNoZXNbaV0udmVydGljZXMgPSB2ZXJ0aWNlcy5pbmRleE9mKG1lc2hlc1tpXS52ZXJ0aWNlcyk7XG4gICAgICAgIGlmIChtZXNoZXNbaV0uc2tpbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBtZXNoZXNbaV0uc2tpbiA9IHNraW5zLmluZGV4T2YobWVzaGVzW2ldLnNraW4pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLm1lc2ggPSBtZXNoZXMuaW5kZXhPZihtZXNoSW5zdGFuY2VzW2ldLm1lc2gpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcGFydGl0aW9uU2tpbihtb2RlbCwgbWF0ZXJpYWxNYXBwaW5ncywgYm9uZUxpbWl0KSB7XG4gICAgbGV0IGksIGosIGssIGluZGV4O1xuXG4gICAgLy8gUmVwbGFjZSBvYmplY3QgaW5kaWNlcyB3aXRoIGFjdHVhbCBvYmplY3QgcmVmZXJlbmNlc1xuICAgIC8vIFRoaXMgc2ltcGxpZmllcyBpbnNlcnRpb24vcmVtb3ZhbCBvZiBhcnJheSBpdGVtc1xuICAgIGluZGljZXNUb1JlZmVyZW5jZXMobW9kZWwpO1xuXG4gICAgY29uc3QgdmVydGV4QXJyYXlzID0gbW9kZWwudmVydGljZXM7XG4gICAgY29uc3Qgc2tpbnMgPSBtb2RlbC5za2lucztcbiAgICBsZXQgbWVzaDtcbiAgICBjb25zdCBtZXNoZXMgPSBtb2RlbC5tZXNoZXM7XG4gICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IG1vZGVsLm1lc2hJbnN0YW5jZXM7XG5cbiAgICBjb25zdCBnZXRWZXJ0ZXggPSBmdW5jdGlvbiAoaWR4KSB7XG4gICAgICAgIGNvbnN0IHZlcnQgPSBuZXcgUGFydGl0aW9uZWRWZXJ0ZXgoKTtcbiAgICAgICAgdmVydC5pbmRleCA9IGlkeDtcbiAgICAgICAgcmV0dXJuIHZlcnQ7XG4gICAgfTtcblxuICAgIGZvciAoaSA9IHNraW5zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIC8vIFRoaXMgc2tpbiBleGNlZWRzIHRoZSBib25lIGxpbWl0LiBTcGxpdCBpdCFcbiAgICAgICAgaWYgKHNraW5zW2ldLmJvbmVOYW1lcy5sZW5ndGggPiBib25lTGltaXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHNraW4gPSBza2lucy5zcGxpY2UoaSwgMSlbMF07XG5cbiAgICAgICAgICAgIC8vIEJ1aWxkIGEgbGlzdCBvZiBtZXNoZXMgdGhhdCB1c2UgdGhpcyBza2luXG4gICAgICAgICAgICBjb25zdCBtZXNoZXNUb1NwbGl0ID0gW107XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgbWVzaGVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1lc2hlc1tqXS5za2luID09PSBza2luKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hlc1RvU3BsaXQucHVzaChtZXNoZXNbal0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFJlbW92ZSBtZXNoZXMgZnJvbSBzb3VyY2UgYXJyYXlcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBtZXNoZXNUb1NwbGl0Lmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgaW5kZXggPSBtZXNoZXMuaW5kZXhPZihtZXNoZXNUb1NwbGl0W2pdKTtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRXJyb3IgaGFuZGxpbmdcbiAgICAgICAgICAgIGlmIChtZXNoZXNUb1NwbGl0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncGFydGl0aW9uU2tpbjogVGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IG9uZSBtZXNoIHRoYXQgcmVmZXJlbmNlcyBhIHNraW4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdmVydGV4QXJyYXkgPSBtZXNoZXNUb1NwbGl0WzBdLnZlcnRpY2VzO1xuICAgICAgICAgICAgZm9yIChqID0gMTsgaiA8IG1lc2hlc1RvU3BsaXQubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBpZiAobWVzaGVzVG9TcGxpdFtqXS52ZXJ0aWNlcyAhPT0gdmVydGV4QXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwYXJ0aXRpb25Ta2luOiBBbGwgbWVzaGVzIHRoYXQgc2hhcmUgYSBza2luIHNob3VsZCBhbHNvIHNoYXJlIHRoZSBzYW1lIHZlcnRleCBidWZmZXInKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCBwYXJ0aXRpb247XG4gICAgICAgICAgICBjb25zdCBwYXJ0aXRpb25zID0gW107XG5cbiAgICAgICAgICAgIC8vIFBoYXNlIDE6XG4gICAgICAgICAgICAvLyBCdWlsZCB0aGUgc2tpbiBwYXJ0aXRpb25zXG4gICAgICAgICAgICAvLyBHbyB0aHJvdWdoIGluZGV4IGxpc3QgYW5kIGV4dHJhY3QgcHJpbWl0aXZlcyBhbmQgYWRkIHRoZW0gdG8gYm9uZSBwYXJ0aXRpb25zXG4gICAgICAgICAgICAvLyBTaW5jZSB3ZSBhcmUgd29ya2luZyB3aXRoIGEgc2luZ2xlIHRyaWFuZ2xlIGxpc3QsIGV2ZXJ5dGhpbmcgaXMgYSB0cmlhbmdsZVxuICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlVmVydGljZXMgPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHByaW1pdGl2ZUluZGljZXMgPSBbXTtcbiAgICAgICAgICAgIGxldCBiYXNlUGFydGl0aW9uID0gMDtcblxuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IG1lc2hlc1RvU3BsaXQubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBtZXNoID0gbWVzaGVzVG9TcGxpdFtqXTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmRpY2VzID0gbWVzaC5pbmRpY2VzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGlJbmRleCA9IG1lc2guYmFzZTsgaUluZGV4IDwgbWVzaC5iYXNlICsgbWVzaC5jb3VudDspIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBwcmltaXRpdmVcbiAgICAgICAgICAgICAgICAgICAgLy8gQ29udmVydCB2ZXJ0aWNlc1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGVyZSBpcyBhIGxpdHRsZSBiaXQgb2Ygd2FzdGVkIHRpbWUgaGVyZSBpZiB0aGUgdmVydGV4IHdhcyBhbHJlYWR5IGFkZGVkIHByZXZpb3VzbHlcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpbmRpY2VzW2lJbmRleCsrXTtcbiAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVmVydGljZXNbMF0gPSBnZXRWZXJ0ZXgoaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBwcmltaXRpdmVJbmRpY2VzWzBdID0gaW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpbmRpY2VzW2lJbmRleCsrXTtcbiAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVmVydGljZXNbMV0gPSBnZXRWZXJ0ZXgoaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBwcmltaXRpdmVJbmRpY2VzWzFdID0gaW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpbmRpY2VzW2lJbmRleCsrXTtcbiAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVmVydGljZXNbMl0gPSBnZXRWZXJ0ZXgoaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBwcmltaXRpdmVJbmRpY2VzWzJdID0gaW5kZXg7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQXR0ZW1wdCB0byBhZGQgdGhlIHByaW1pdGl2ZSB0byBhbiBleGlzdGluZyBib25lIHBhcnRpdGlvblxuICAgICAgICAgICAgICAgICAgICBsZXQgYWRkZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaUJvbmVQYXJ0aXRpb24gPSBiYXNlUGFydGl0aW9uOyBpQm9uZVBhcnRpdGlvbiA8IHBhcnRpdGlvbnMubGVuZ3RoOyBpQm9uZVBhcnRpdGlvbisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aXRpb24gPSBwYXJ0aXRpb25zW2lCb25lUGFydGl0aW9uXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXJ0aXRpb24uYWRkUHJpbWl0aXZlKHByaW1pdGl2ZVZlcnRpY2VzLCBwcmltaXRpdmVJbmRpY2VzLCB2ZXJ0ZXhBcnJheSwgYm9uZUxpbWl0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSBwcmltaXRpdmUgd2FzIG5vdCBhZGRlZCB0byBhbiBleGlzdGluZyBib25lIHBhcnRpdGlvbiwgd2UgbmVlZCB0byBtYWtlIGEgbmV3IGJvbmUgcGFydGl0aW9uIGFuZCBhZGQgdGhlIHByaW1pdGl2ZSB0byBpdFxuICAgICAgICAgICAgICAgICAgICBpZiAoIWFkZGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aXRpb24gPSBuZXcgU2tpblBhcnRpdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGl0aW9uLm9yaWdpbmFsTWVzaCA9IG1lc2g7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aXRpb24uYWRkUHJpbWl0aXZlKHByaW1pdGl2ZVZlcnRpY2VzLCBwcmltaXRpdmVJbmRpY2VzLCB2ZXJ0ZXhBcnJheSwgYm9uZUxpbWl0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpdGlvbnMucHVzaChwYXJ0aXRpb24pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYmFzZVBhcnRpdGlvbiA9IHBhcnRpdGlvbnMubGVuZ3RoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBQaGFzZSAyOlxuICAgICAgICAgICAgLy8gR2F0aGVyIHZlcnRleCBhbmQgaW5kZXggbGlzdHMgZnJvbSBhbGwgdGhlIHBhcnRpdGlvbnMsIHRoZW4gdXBsb2FkIHRvIEdQVVxuICAgICAgICAgICAgY29uc3QgcGFydGl0aW9uZWRWZXJ0aWNlcyA9IFtdO1xuICAgICAgICAgICAgY29uc3QgcGFydGl0aW9uZWRJbmRpY2VzID0gW107XG5cbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBwYXJ0aXRpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgcGFydGl0aW9uID0gcGFydGl0aW9uc1tqXTtcblxuICAgICAgICAgICAgICAgIGlmIChwYXJ0aXRpb24udmVydGljZXMubGVuZ3RoICYmIHBhcnRpdGlvbi5pbmRpY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAvLyB0aGlzIGJvbmUgcGFydGl0aW9uIGNvbnRhaW5zIHZlcnRpY2VzIGFuZCBpbmRpY2VzXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRmluZCBvZmZzZXRzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleFN0YXJ0ID0gcGFydGl0aW9uZWRWZXJ0aWNlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleENvdW50ID0gcGFydGl0aW9uLnZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXhTdGFydCA9IHBhcnRpdGlvbmVkSW5kaWNlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4Q291bnQgPSBwYXJ0aXRpb24uaW5kaWNlcy5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTWFrZSBhIG5ldyBzdWIgc2V0XG4gICAgICAgICAgICAgICAgICAgIHBhcnRpdGlvbi5wYXJ0aXRpb24gPSBqO1xuICAgICAgICAgICAgICAgICAgICBwYXJ0aXRpb24udmVydGV4U3RhcnQgPSB2ZXJ0ZXhTdGFydDtcbiAgICAgICAgICAgICAgICAgICAgcGFydGl0aW9uLnZlcnRleENvdW50ID0gdmVydGV4Q291bnQ7XG4gICAgICAgICAgICAgICAgICAgIHBhcnRpdGlvbi5pbmRleFN0YXJ0ID0gaW5kZXhTdGFydDtcbiAgICAgICAgICAgICAgICAgICAgcGFydGl0aW9uLmluZGV4Q291bnQgPSBpbmRleENvdW50O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIENvcHkgYnVmZmVyc1xuICAgICAgICAgICAgICAgICAgICBsZXQgaVNvdXI7XG4gICAgICAgICAgICAgICAgICAgIGxldCBpRGVzdDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBDb3B5IHZlcnRpY2VzIHRvIGZpbmFsIGxpc3RcbiAgICAgICAgICAgICAgICAgICAgaVNvdXIgPSAwO1xuICAgICAgICAgICAgICAgICAgICBpRGVzdCA9IHZlcnRleFN0YXJ0O1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaVNvdXIgPCB2ZXJ0ZXhDb3VudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGl0aW9uZWRWZXJ0aWNlc1tpRGVzdCsrXSA9IHBhcnRpdGlvbi52ZXJ0aWNlc1tpU291cisrXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIENvcHkgaW5kaWNlcyB0byBmaW5hbCBsaXN0XG4gICAgICAgICAgICAgICAgICAgIGlTb3VyID0gMDtcbiAgICAgICAgICAgICAgICAgICAgaURlc3QgPSBpbmRleFN0YXJ0O1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaVNvdXIgPCBpbmRleENvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aXRpb25lZEluZGljZXNbaURlc3QrK10gPSBwYXJ0aXRpb24uaW5kaWNlc1tpU291cisrXSArIHZlcnRleFN0YXJ0OyAgICAvLyBhZGp1c3Qgc28gdGhleSByZWZlcmVuY2UgaW50byBmbGF0IHZlcnRleCBsaXN0XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBoYXNlIDM6XG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIHNwbGl0IHNraW5zXG4gICAgICAgICAgICBjb25zdCBzcGxpdFNraW5zID0gW107XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgcGFydGl0aW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIHBhcnRpdGlvbiA9IHBhcnRpdGlvbnNbal07XG5cbiAgICAgICAgICAgICAgICBjb25zdCBpYnAgPSBbXTtcbiAgICAgICAgICAgICAgICBjb25zdCBib25lTmFtZXMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGsgPSAwOyBrIDwgcGFydGl0aW9uLmJvbmVJbmRpY2VzLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlicC5wdXNoKHNraW4uaW52ZXJzZUJpbmRNYXRyaWNlc1twYXJ0aXRpb24uYm9uZUluZGljZXNba11dKTtcbiAgICAgICAgICAgICAgICAgICAgYm9uZU5hbWVzLnB1c2goc2tpbi5ib25lTmFtZXNbcGFydGl0aW9uLmJvbmVJbmRpY2VzW2tdXSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3Qgc3BsaXRTa2luID0ge1xuICAgICAgICAgICAgICAgICAgICBpbnZlcnNlQmluZE1hdHJpY2VzOiBpYnAsXG4gICAgICAgICAgICAgICAgICAgIGJvbmVOYW1lczogYm9uZU5hbWVzXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBzcGxpdFNraW5zLnB1c2goc3BsaXRTa2luKTtcbiAgICAgICAgICAgICAgICBza2lucy5wdXNoKHNwbGl0U2tpbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBoYXNlIDRcblxuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgcGFydGl0aW9uZWQgdmVydGV4IGFycmF5XG4gICAgICAgICAgICBsZXQgYXR0cmliLCBhdHRyaWJOYW1lLCBkYXRhLCBjb21wb25lbnRzO1xuICAgICAgICAgICAgY29uc3Qgc3BsaXRWZXJ0ZXhBcnJheSA9IHt9O1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSB2ZXJ0ZXggYXJyYXkgb2YgdGhlIHNhbWUgZm9ybWF0IGFzIHRoZSBpbnB1dCB0byB0YWtlIHBhcnRpdGlvbmVkIHZlcnRleCBkYXRhXG4gICAgICAgICAgICBmb3IgKGF0dHJpYk5hbWUgaW4gdmVydGV4QXJyYXkpIHtcbiAgICAgICAgICAgICAgICBzcGxpdFZlcnRleEFycmF5W2F0dHJpYk5hbWVdID0ge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzOiB2ZXJ0ZXhBcnJheVthdHRyaWJOYW1lXS5jb21wb25lbnRzLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogdmVydGV4QXJyYXlbYXR0cmliTmFtZV0udHlwZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENvcHkgYWNyb3NzIHRoZSB2ZXJ0ZXggZGF0YS4gRXZlcnl0aGluZyBpcyB0aGUgc2FtZSBhcyB0aGUgc291cmNlIGRhdGEgZXhjZXB0IHRoZSByZW1hcHBlZFxuICAgICAgICAgICAgLy8gYm9uZSBpbmRpY2VzXG4gICAgICAgICAgICBmb3IgKGF0dHJpYk5hbWUgaW4gdmVydGV4QXJyYXkpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXR0cmliTmFtZSA9PT0gJ2JsZW5kSW5kaWNlcycpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHN0Qm9uZUluZGljZXMgPSBzcGxpdFZlcnRleEFycmF5W2F0dHJpYk5hbWVdLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBwYXJ0aXRpb25lZFZlcnRpY2VzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzcmNCb25lSW5kaWNlcyA9IHBhcnRpdGlvbmVkVmVydGljZXNbal0uYm9uZUluZGljZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBkc3RCb25lSW5kaWNlcy5wdXNoKHNyY0JvbmVJbmRpY2VzWzBdLCBzcmNCb25lSW5kaWNlc1sxXSwgc3JjQm9uZUluZGljZXNbMl0sIHNyY0JvbmVJbmRpY2VzWzNdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGF0dHJpYiA9IHZlcnRleEFycmF5W2F0dHJpYk5hbWVdO1xuICAgICAgICAgICAgICAgICAgICBkYXRhID0gYXR0cmliLmRhdGE7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMgPSBhdHRyaWIuY29tcG9uZW50cztcbiAgICAgICAgICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHBhcnRpdGlvbmVkVmVydGljZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4ID0gcGFydGl0aW9uZWRWZXJ0aWNlc1tqXS5pbmRleDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoayA9IDA7IGsgPCBjb21wb25lbnRzOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcGxpdFZlcnRleEFycmF5W2F0dHJpYk5hbWVdLmRhdGEucHVzaChkYXRhW2luZGV4ICogY29tcG9uZW50cyArIGtdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVwbGFjZSBvcmlnaW5hbCB2ZXJ0ZXggYXJyYXkgd2l0aCBzcGxpdCBvbmVcbiAgICAgICAgICAgIHZlcnRleEFycmF5c1t2ZXJ0ZXhBcnJheXMuaW5kZXhPZih2ZXJ0ZXhBcnJheSldID0gc3BsaXRWZXJ0ZXhBcnJheTtcblxuICAgICAgICAgICAgLy8gUGhhc2UgNVxuXG4gICAgICAgICAgICAvLyBCdWlsZCBuZXcgbWVzaCBhcnJheVxuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHBhcnRpdGlvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBwYXJ0aXRpb24gPSBwYXJ0aXRpb25zW2pdO1xuXG4gICAgICAgICAgICAgICAgbWVzaCA9IHtcbiAgICAgICAgICAgICAgICAgICAgYWFiYjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWluOiBbMCwgMCwgMF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXg6IFswLCAwLCAwXVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB2ZXJ0aWNlczogc3BsaXRWZXJ0ZXhBcnJheSxcbiAgICAgICAgICAgICAgICAgICAgc2tpbjogc3BsaXRTa2luc1tqXSxcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlczogcGFydGl0aW9uZWRJbmRpY2VzLnNwbGljZSgwLCBwYXJ0aXRpb24uaW5kZXhDb3VudCksXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICd0cmlhbmdsZXMnLFxuICAgICAgICAgICAgICAgICAgICBiYXNlOiAwLFxuICAgICAgICAgICAgICAgICAgICBjb3VudDogcGFydGl0aW9uLmluZGV4Q291bnRcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgbWVzaGVzLnB1c2gobWVzaCk7XG5cbiAgICAgICAgICAgICAgICAvLyBGaW5kIGFsbCB0aGUgb3JpZ2luYWwgbWVzaCBpbnN0YW5jZXMgdGhhdCByZWZlcnJlZCB0byB0aGUgcHJlLXNwbGl0IG1lc2hcbiAgICAgICAgICAgICAgICBmb3IgKGsgPSBtZXNoSW5zdGFuY2VzLmxlbmd0aCAtIDE7IGsgPj0gMDsgay0tKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2VzW2tdLm1lc2ggPT09IHBhcnRpdGlvbi5vcmlnaW5hbE1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzaDogbWVzaCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlOiBtZXNoSW5zdGFuY2VzW2tdLm5vZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsTWFwcGluZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbE1hcHBpbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbDogbWF0ZXJpYWxNYXBwaW5nc1trXS5tYXRlcmlhbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogbWF0ZXJpYWxNYXBwaW5nc1trXS5wYXRoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBwYXJ0aXRpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgcGFydGl0aW9uID0gcGFydGl0aW9uc1tqXTtcblxuICAgICAgICAgICAgICAgIC8vIEZpbmQgYWxsIHRoZSBvcmlnaW5hbCBtZXNoIGluc3RhbmNlcyB0aGF0IHJlZmVycmVkIHRvIHRoZSBwcmUtc3BsaXQgbWVzaFxuICAgICAgICAgICAgICAgIGZvciAoayA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoIC0gMTsgayA+PSAwOyBrLS0pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXNba10ubWVzaCA9PT0gcGFydGl0aW9uLm9yaWdpbmFsTWVzaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlcy5zcGxpY2UoaywgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWxNYXBwaW5ncykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsTWFwcGluZ3Muc3BsaWNlKGssIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29udmVydCByZWZlcmVuY2VzIGJhY2sgdG8gaW5kaWNlc1xuICAgIHJlZmVyZW5jZXNUb0luZGljZXMobW9kZWwpO1xufVxuXG5leHBvcnQgeyBwYXJ0aXRpb25Ta2luIH07XG4iXSwibmFtZXMiOlsiUGFydGl0aW9uZWRWZXJ0ZXgiLCJjb25zdHJ1Y3RvciIsImluZGV4IiwiYm9uZUluZGljZXMiLCJTa2luUGFydGl0aW9uIiwicGFydGl0aW9uIiwidmVydGV4U3RhcnQiLCJ2ZXJ0ZXhDb3VudCIsImluZGV4U3RhcnQiLCJpbmRleENvdW50IiwidmVydGljZXMiLCJpbmRpY2VzIiwiaW5kZXhNYXAiLCJvcmlnaW5hbE1lc2giLCJhZGRWZXJ0ZXgiLCJ2ZXJ0ZXgiLCJpZHgiLCJ2ZXJ0ZXhBcnJheSIsInJlbWFwcGVkSW5kZXgiLCJ1bmRlZmluZWQiLCJwdXNoIiwiaW5mbHVlbmNlIiwiYmxlbmRXZWlnaHQiLCJkYXRhIiwib3JpZ2luYWxCb25lSW5kZXgiLCJibGVuZEluZGljZXMiLCJnZXRCb25lUmVtYXAiLCJsZW5ndGgiLCJhZGRQcmltaXRpdmUiLCJ2ZXJ0ZXhJbmRpY2VzIiwiYm9uZUxpbWl0IiwiYm9uZXNUb0FkZCIsImJvbmVzVG9BZGRDb3VudCIsImkiLCJib25lSW5kZXgiLCJuZWVkVG9BZGQiLCJqIiwiYm9uZVJlbWFwIiwiaW5kaWNlc1RvUmVmZXJlbmNlcyIsIm1vZGVsIiwic2tpbnMiLCJtZXNoZXMiLCJtZXNoSW5zdGFuY2VzIiwic2tpbiIsIm1lc2giLCJyZWZlcmVuY2VzVG9JbmRpY2VzIiwiaW5kZXhPZiIsInBhcnRpdGlvblNraW4iLCJtYXRlcmlhbE1hcHBpbmdzIiwiayIsInZlcnRleEFycmF5cyIsImdldFZlcnRleCIsInZlcnQiLCJib25lTmFtZXMiLCJzcGxpY2UiLCJtZXNoZXNUb1NwbGl0IiwiRXJyb3IiLCJwYXJ0aXRpb25zIiwicHJpbWl0aXZlVmVydGljZXMiLCJwcmltaXRpdmVJbmRpY2VzIiwiYmFzZVBhcnRpdGlvbiIsImlJbmRleCIsImJhc2UiLCJjb3VudCIsImFkZGVkIiwiaUJvbmVQYXJ0aXRpb24iLCJwYXJ0aXRpb25lZFZlcnRpY2VzIiwicGFydGl0aW9uZWRJbmRpY2VzIiwiaVNvdXIiLCJpRGVzdCIsInNwbGl0U2tpbnMiLCJpYnAiLCJpbnZlcnNlQmluZE1hdHJpY2VzIiwic3BsaXRTa2luIiwiYXR0cmliIiwiYXR0cmliTmFtZSIsImNvbXBvbmVudHMiLCJzcGxpdFZlcnRleEFycmF5IiwidHlwZSIsImRzdEJvbmVJbmRpY2VzIiwi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
