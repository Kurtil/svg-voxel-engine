/**
 * SVG Voxel Engine Factory.
 * @param width - Width of the svg.
 * @param height - Height of the svg.
 * @param size - Size of the grid in voxel.
 * @param depthRatio - The display ration x / y.
 * @param lightCfg - Configuration of light.
 * @param voxelOffset - Offset of voxel on the svg-x axis.
 */
export default ({
  domId,
  width = 500,
  height = 500,
  size = 16,
  depthRatio = 0.5,
  lightCfg = {},
  voxelOffset = 1
} = {}) => ({
  width,
  height,
  size,
  /**
   * A map of all added voxels.
   * The map ensure id unicity.
   */
  voxels: new Map(),
  /**
   * The path to display.
   */
  paths: [],
  viewBox: `${0} ${0} ${width} ${height}`,
  /**
   * The svg-x size of a Voxel.
   */
  voxelXSize: width / (voxelOffset * 2 + size),
  /**
   * Returns the svg-y size of a Voxel.
   */
  voxelYSize: depthRatio * (width / (voxelOffset * 2 + size)), // depthRatio * voxelXSize
  offset: (width / size) * voxelOffset,
  lightCfg,
  _maxZ: null,
  getMaxZ() {
    if (!this._maxZ) {
      this._maxZ = [...this.voxels.values()].reduce(
        (acc, voxel) => (voxel.position.z > acc ? voxel.position.z : acc),
        0
      );
    }
    return this._maxZ;
  },
  /**
   * the offset lenght on svg-x axis
   */
  chunkAndMergePaths() {
    const colorPaths = new Map();
    // regroup by color
    this.paths.forEach(path => {
      if (colorPaths.has(path.color)) {
        colorPaths.get(path.color).push(path);
      } else {
        colorPaths.set(path.color, [path]);
      }
      // add path top face x and y coordinate and global grid index
      const { x: px, y: py, z: pz } = path.voxel.position;

      const zDiff = this.getMaxZ() - pz;

      const x = this.getShellTopFaceXCoordinate(
        px,
        py,
        path.orientation,
        path.faceIndex,
        zDiff
      );
      const y = this.getShellTopFaceYCoordinate(
        px,
        py,
        path.orientation,
        path.faceIndex,
        zDiff
      );
      path.topFaceX = x + this.getMaxZ();
      path.topFaceY = y;
      path.globalGridIndex =
        (this.size + this.getMaxZ()) * 2 * (x + this.getMaxZ() - 1) + y;
    });
    const globalGrid = new Map();
    this.paths.forEach(path => globalGrid.set(path.globalGridIndex, path));
    // chunk paths with direct neigbhors
    const colorChunks = new Map();
    [...colorPaths.entries()].forEach(([color, paths]) => {
      if (!paths.length) return;
      const globalGridColor = new Map();
      paths.forEach(path => globalGridColor.set(path.globalGridIndex, path));

      let groupId = 1;
      for (let path of globalGridColor.values()) {
        globalGridColor.delete(path.globalGridIndex);
        const pathsToChunk = [];
        pathsToChunk.push(path);
        let pathToChunk = null;
        while ((pathToChunk = pathsToChunk.pop())) {
          if (colorChunks.has(groupId + color)) {
            colorChunks.get(groupId + color).push(pathToChunk);
          } else {
            colorChunks.set(groupId + color, [pathToChunk]);
          }

          const neighbors = this.getGlobalGridNeighbor(
            globalGridColor,
            pathToChunk.globalGridIndex
          );

          neighbors.forEach(neighbor => {
            globalGridColor.delete(neighbor.globalGridIndex);
          });

          pathsToChunk.push(...neighbors.filter(Boolean));
        }
        groupId++;
      }
    });
    this.paths = [];
    [...colorChunks.entries()].forEach(([id, chunk]) => {
      this.mergePaths(chunk, id);
    });
    this.paths.sort((path1, path2) =>
      path1.length > path2.length ? -1 : path1.length < path2.length ? 1 : 0
    );
  },
  mergePaths(paths, id) {
    const color = paths[0].color;
    const edges = paths.flatMap(path => this.getEdgesFromPathPoints(path));

    // Duplicated edges are chunk inner edges and are not relevant to the shell path
    const shellPathEdges = new Map();
    edges.forEach(edge => {
      const {
        vertice1: { x: x1, y: y1 },
        vertice2: { x: x2, y: y2 }
      } = edge;
      if (
        shellPathEdges.has(`x1${x1}y1${y1}x2${x2}y2${y2}`) ||
        shellPathEdges.has(`x1${x2}y1${y2}x2${x1}y2${y1}`)
      ) {
        shellPathEdges.delete(`x1${x1}y1${y1}x2${x2}y2${y2}`);
        shellPathEdges.delete(`x1${x2}y1${y2}x2${x1}y2${y1}`);
      } else {
        shellPathEdges.set(`x1${x1}y1${y1}x2${x2}y2${y2}`, edge);
      }
    });

    let shellEdges = [...shellPathEdges.values()];
    // get top edge (with the smallest path gIndex)
    const firstEdge = shellEdges.reduce((acc, cur) =>
      acc.path.globalGridIndex > cur.path.globalGridIndex ? acc : cur
    );
    shellEdges = shellEdges.filter(shellEdge => shellEdge !== firstEdge);

    // Check if firstEdge is in the good direction
    if (
      firstEdge.vertice1.x + firstEdge.vertice1.y >
      firstEdge.vertice2.x + firstEdge.vertice2.y
    ) {
      const vertice1 = firstEdge.vertice1;
      firstEdge.vertice1 = firstEdge.vertice2;
      firstEdge.vertice2 = vertice1;
    }

    const pathPoints = [firstEdge.vertice1];

    let lastEdge = firstEdge;
    const firstDirection = this.getEdgeDirection(lastEdge);
    let lastDirection = firstDirection;
    while (shellEdges.length) {
      const lastPoint = lastEdge.vertice2;
      const nextEdge = shellEdges.filter(
        shellEdge =>
          (shellEdge.vertice1.x === lastPoint.x &&
            shellEdge.vertice1.y === lastPoint.y) ||
          (shellEdge.vertice2.x === lastPoint.x &&
            shellEdge.vertice2.y === lastPoint.y)
      )[0]; // TODO handle multi points
      if (!nextEdge) {
        // TODO no next edge, we should be in a hole
        // SVG Specification : in the same path, the path clockwise is drawn, another anti-clockwise will be a hole
        break;
      }
      if (
        nextEdge.vertice2.x === lastPoint.x &&
        nextEdge.vertice2.y === lastPoint.y
      ) {
        const vertice1 = nextEdge.vertice1;
        nextEdge.vertice1 = nextEdge.vertice2;
        nextEdge.vertice2 = vertice1;
      }
      const direction = this.getEdgeDirection(nextEdge);
      if (direction !== lastDirection) {
        pathPoints.push(nextEdge.vertice1);
      }
      lastDirection = direction;
      lastEdge = nextEdge;
      shellEdges = shellEdges.filter(shellEdge => shellEdge !== nextEdge);
    }

    // The first point may not be relevant
    if (firstDirection === lastDirection) {
      pathPoints.shift();
    }

    this.paths.push({
      length: shellEdges.length,
      id,
      color,
      points: pathPoints.map(pathPoint => pathPoint.p)
    });
  },
  /**
   * Returns the direction of the edge.
   * There is only three directions possible :
   * -1, 0 or 1
   */
  getEdgeDirection(edge) {
    const {
      vertice1: { x: x1, y: y1 },
      vertice2: { x: x2, y: y2 }
    } = edge;
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return dx - dy;
  },
  /**
   * Returns edges from path. Edges are in top face coordinate.
   */
  getEdgesFromPathPoints(path) {
    const {
      topFaceX: x,
      topFaceY: y,
      points: [p1, p2, p3]
    } = path;
    if (path.globalGridIndex % 2) {
      // TODO may only work on even size
      const edge1 = {
        path,
        vertice1: {
          x: x - 1,
          y: Math.floor(y / 2),
          p: p1
        },
        vertice2: {
          x: x,
          y: Math.floor(y / 2),
          p: p2
        }
      };
      const edge2 = {
        path,
        vertice1: {
          x: x,
          y: Math.floor(y / 2),
          p: p2
        },
        vertice2: {
          x: x - 1,
          y: Math.floor(y / 2) + 1,
          p: p3
        }
      };
      const edge3 = {
        path,
        vertice1: {
          x: x - 1,
          y: Math.floor(y / 2) + 1,
          p: p3
        },
        vertice2: {
          x: x - 1,
          y: Math.floor(y / 2),
          p: p1
        }
      };
      return [edge1, edge2, edge3];
    } else {
      const edge1 = {
        path,
        vertice1: {
          x: x,
          y: Math.floor(y / 2) - 1,
          p: p1
        },
        vertice2: {
          x: x,
          y: Math.floor(y / 2),
          p: p2
        }
      };
      const edge2 = {
        path,
        vertice1: {
          x: x,
          y: Math.floor(y / 2),
          p: p2
        },
        vertice2: {
          x: x - 1,
          y: Math.floor(y / 2),
          p: p3
        }
      };
      const edge3 = {
        path,
        vertice1: {
          x: x - 1,
          y: Math.floor(y / 2),
          p: p3
        },
        vertice2: {
          x: x,
          y: Math.floor(y / 2) - 1,
          p: p1
        }
      };
      return [edge1, edge2, edge3];
    }
  },
  getGlobalGridNeighbor(globalGrid, index) {
    const neighbors = [];
    this.getGlobalGridIndexes(index).forEach((globalGridIndex, i) => {
      const path = globalGrid.get(globalGridIndex);
      if (path) {
        neighbors[i] = path;
      }
    });
    return neighbors;
  },
  getGlobalGridIndexes(index) {
    const offset = (this.size + this.getMaxZ()) * 2 - 1;
    if (index % 2) {
      // odd
      return [index - 1, index + 1, index - offset];
    } else {
      return [index + offset, index + 1, index - 1];
    }
  },
  eraseUndershell() {
    const shell = new Map();
    this.paths.forEach(path => {
      const shellPath = shell.get(path.shellKey);
      if (!shellPath || shellPath.voxel.zIndex < path.voxel.zIndex) {
        shell.set(path.shellKey, path);
      }
    });
    this.paths = [...shell.values()];
  },
  deleteVoxel(position) {
    this.voxels.delete(this.generateId(position));
  },
  addFullSlab(stage = 1, color = "#00FF00", offset = 0) {
    return this.addBox({ x: 1 + offset, y: 1 + offset, z: stage }, color, {
      xSize: this.size - 2 * offset,
      ySize: this.size - 2 * offset,
      zSize: 1
    });
  },
  deleteBox(position, sizes) {
    this.getBoxCoordinates(position, sizes).forEach(point =>
      this.deleteVoxel(point)
    );
  },
  addBox(position, color, sizes) {
    const box = {
      voxels: []
    };
    this.getBoxCoordinates(position, sizes).forEach(point =>
      box.voxels.push(this.addVoxel(point, color))
    );
    return box;
  },
  addVoxel(position, color = "#FF0000") {
    const voxel = this.makeVoxel(position, color);
    this.voxels.set(voxel.id, voxel);
    return voxel;
  },
  /*******************************/
  /********** RENDERING **********/
  /*******************************/
  render() {
    this.renderVoxels(this.addTriFacePathFromVoxel.bind(this));

    this.eraseUndershell();

    this.chunkAndMergePaths();

    let targetElement = document.getElementById(domId);
    if (!targetElement) {
      targetElement = document.createElement("div");
      document.body.appendChild(targetElement);
    }

    const xmlns = "http://www.w3.org/2000/svg";
    const svgElement = document.createElementNS(xmlns, "svg");
    svgElement.setAttributeNS(null, "width", width);
    svgElement.setAttributeNS(null, "height", height);
    svgElement.setAttributeNS(null, "viewBox", this.viewBox);

    const backgroundRectange = document.createElementNS(xmlns, "rect");
    backgroundRectange.setAttributeNS(null, "width", "100%");
    backgroundRectange.setAttributeNS(null, "height", "100%");
    backgroundRectange.setAttributeNS(null, "fill", "gray");

    svgElement.appendChild(backgroundRectange);

    this.paths.forEach(path => {
      const pathElement = document.createElementNS(xmlns, "path");
      pathElement.setAttributeNS(
        null,
        "d",
        this.makeSvgPathFromPoints(path.points)
      );
      pathElement.setAttributeNS(null, "fill", path.color);

      svgElement.appendChild(pathElement);
    });

    targetElement.appendChild(svgElement);
  },
  /**
   * Fill paths from voxels.
   * A displayed path is an object with p1, p2, p3 and color properties.
   */
  renderVoxels(voxelRenderFunction) {
    [...this.voxels.values()]
      .sort(this.voxelCompareFunction)
      .forEach(voxelRenderFunction);
  },
  addTriFacePathFromVoxel(voxel, voxelIndex) {
    Object.entries(voxel.faces).forEach(([orientation, paths]) => {
      const firstPath = {
        id: `i${voxelIndex}f${orientation}s1`,
        points: paths[0],
        color: this.makeFaceColor(orientation, voxel.color),
        voxel,
        orientation,
        shellKey: this.getShellKey(voxel, orientation, 1),
        faceIndex: 1
      };
      const secondPath = {
        id: `i${voxelIndex}f${orientation}s2`,
        points: paths[1],
        color: this.makeFaceColor(orientation, voxel.color),
        voxel,
        orientation,
        shellKey: this.getShellKey(voxel, orientation, 2),
        faceIndex: 2
      };
      // // TODO - To debug top, right and left face coordinates
      // const getFaceColor = face => {
      //   if (face.match(/f-t/)) {
      //     return "#FF0000";
      //   } else if (face.match(/f-l/)) {
      //     return "#00FF00";
      //   } else if (face.match(/f-r/)) {
      //     return "#0000FF";
      //   }
      // };
      // firstPath.color = getFaceColor(firstPath.shellKey) || firstPath.color;
      // secondPath.color =
      //   getFaceColor(secondPath.shellKey) || secondPath.color;

      this.paths.push(firstPath, secondPath);
    });
  },
  getShellKey(voxel, orientation, faceIndex) {
    const { x: px, y: py, z: pz } = voxel.position;
    let face = null;
    let x = null;
    let y = null;

    const zDiff = this.getMaxZ() - pz;
    const orientationYOffset =
      orientation === "top" || (orientation === "right" && faceIndex === 1)
        ? 0
        : 1;
    const orientationY2Offset =
      orientation === "left" || (orientation === "top" && faceIndex === 1)
        ? 0
        : 1;
    const orientationXOffset =
      orientation === "top" || (orientation === "left" && faceIndex === 1)
        ? 0
        : 1;
    const orientationX2Offset =
      orientation === "right" || (orientation === "top" && faceIndex === 2)
        ? 0
        : 1;
    if (
      this.size - px - orientationXOffset < zDiff &&
      py > this.size - px + orientationX2Offset
    ) {
      face = "r";
      x = this.getShellRightFaceXCoordinate(px, py, orientation, faceIndex);
      y = this.getShellRightFaceYCoordinate(
        px,
        py,
        orientation,
        faceIndex,
        zDiff
      );
    } else if (
      py - 1 - orientationYOffset < zDiff && // after the && is not mandatory because it is handled by the first if... not deleted to show the algo
      this.size - px + 1 > py - 1 + orientationY2Offset
    ) {
      face = "l";
      x = this.getShellLeftFaceXCoordinate(px, py, orientation, faceIndex);
      y = this.getShellLeftFaceYCoordinate(
        px,
        py,
        orientation,
        faceIndex,
        zDiff
      );
    } else {
      face = "t";
      x = this.getShellTopFaceXCoordinate(
        px,
        py,
        orientation,
        faceIndex,
        zDiff
      );
      y = this.getShellTopFaceYCoordinate(
        px,
        py,
        orientation,
        faceIndex,
        zDiff
      );
    }

    return `f${face}x${x}y${y}`;
  },
  getShellTopFaceXCoordinate(px, py, orientation, faceIndex, zDiff) {
    let offset =
      orientation === "left" || (orientation === "right" && faceIndex === 2)
        ? -1
        : 0;
    return offset - zDiff + py;
  },
  getShellTopFaceYCoordinate(px, py, orientation, faceIndex, zDiff) {
    let offset = 0;
    if (orientation === "top") {
      if (faceIndex === 1) {
        offset = -1;
      } else {
        offset = 0;
      }
    } else if (orientation === "left") {
      if (faceIndex === 1) {
        offset = 0;
      } else {
        offset = 1;
      }
    } else if (orientation === "right") {
      if (faceIndex === 1) {
        offset = 1;
      } else {
        offset = 2;
      }
    }
    return offset + (px + zDiff) * 2;
  },
  getShellRightFaceXCoordinate(px, py, orientation, faceIndex) {
    let offset =
      orientation === "left" || (orientation === "top" && faceIndex === 1)
        ? -1
        : 0;
    return offset + px + py - this.size;
  },
  getShellRightFaceYCoordinate(px, py, orientation, faceIndex, zDiff) {
    let offset = 0;
    if (orientation === "top") {
      if (faceIndex === 1) {
        offset = -1;
      } else {
        offset = 0;
      }
    } else if (orientation === "left") {
      if (faceIndex === 1) {
        offset = 0;
      } else {
        offset = 1;
      }
    } else if (orientation === "right") {
      if (faceIndex === 1) {
        offset = 1;
      } else {
        offset = 2;
      }
    }
    return offset + (zDiff - (this.size - px)) * 2;
  },
  getShellLeftFaceYCoordinate(px, py, orientation, faceIndex, zDiff) {
    let offset = 0;
    if (orientation === "top") {
      if (faceIndex === 1) {
        offset = 0;
      } else {
        offset = -1;
      }
    } else if (orientation === "left") {
      if (faceIndex === 1) {
        offset = 1;
      } else {
        offset = 2;
      }
    } else if (orientation === "right") {
      if (faceIndex === 1) {
        offset = 0;
      } else {
        offset = 1;
      }
    }
    return offset + (zDiff - py + 1) * 2;
  },
  getShellLeftFaceXCoordinate(px, py, orientation, faceIndex) {
    const offset =
      orientation === "left" || (orientation === "top" && faceIndex === 1)
        ? -1
        : 0;
    return offset + px + py;
  },
  makeSvgPathFromPoints(points) {
    return points.reduce((acc, p, i, arr) => {
      return acc + `${p.x} ${p.y}${i === arr.length - 1 ? "Z" : "L"}`;
    }, "M");
  },
  /*************************************/
  /********** VOXEL FACTORIES **********/
  /*************************************/
  makeVoxel(position, color) {
    return {
      id: this.generateId(position),
      position,
      color,
      zIndex: this.getZIndex(position),
      faces: this.makeVoxelFaces(position)
    };
  },
  /**
   * Returns the voxel faces.
   * A face is an array of two paths.
   * A path is an array of three points.
   */
  makeVoxelFaces(position) {
    const [p1, , p3, p4, p5, p6, p7, p8] = this.getVoxelCoordinates(position);
    return {
      top: [
        [p5, p6, p8],
        [p6, p7, p8]
      ],
      right: [
        [p8, p7, p3],
        [p8, p3, p4]
      ],
      left: [
        [p5, p8, p1],
        [p1, p8, p4]
      ]
    };
  },
  /***************************/
  /********** UTILS **********/
  /***************************/
  generateId(position) {
    return `voxel-x${position.x}-y${position.y}-z${position.z}`;
  },
  /**
   * Used to sort voxel by zIndex
   */
  voxelCompareFunction(a, b) {
    if (a.zIndex > b.zIndex) {
      return 1;
    } else if (a.zIndex < b.zIndex) {
      return -1;
    } else {
      return 0;
    }
  },
  /*******************************/
  /********** POSITIONS **********/
  /*******************************/
  getVoxelAt(position) {
    return this.voxels.get(this.generateId(position));
  },
  getZIndex(position) {
    const { x, y, z } = position;
    const maxPerStage = z * (this.size * 2 - 1);
    return maxPerStage - (this.size - x) - (y - 1);
  },
  /****************************/
  /********** COLORS **********/
  /****************************/
  faceColors: new Map(),
  /**
   * Lighten or darken face sepending on light configuration
   */
  makeFaceColor(face, color) {
    let colorToReturn = this.faceColors.get(face + color);
    if (colorToReturn) {
      return colorToReturn;
    } else {
      const {
        light = 10,
        lightFace = "top",
        lightHue = 5,
        shadow = 30,
        shadowFace = "right",
        shadowHue = 20
      } = this.lightCfg;
      let c = null;
      if (face === lightFace) {
        c = this.lightenColor(hueShift(color, lightHue), light);
      } else if (face === shadowFace) {
        c = this.darkenColor(hueShift(color, shadowHue), shadow);
      } else {
        c = color;
      }
      this.faceColors.set(face + color, c);
      return c;
    }
  },
  darkenColor(color, amount) {
    return lightenColor(color, -amount);
  },
  lightenColor(color, amount) {
    return lightenColor(color, amount);
  },
  /*********************************/
  /********** COORDINATES **********/
  /*********************************/
  /**
   * Returns the coordinates of the voxel.
   * @return coordinates - an array of 8 value representing the 0 - 0 point, the 0 - 1 point ...
   * The 4 first values are the bottom points, the 4 last are the top ones
   */
  getVoxelCoordinates(position) {
    const origin = this.getVoxelOrigin(position);
    const bottomFaceCoordinates = this.getHorizontalFaceCoordinates(origin);
    return [
      ...bottomFaceCoordinates,
      ...bottomFaceCoordinates.map(({ x, y }) => ({
        x,
        y: y - this.voxelYSize
      }))
    ];
  },
  getBoxCoordinates(position, { xSize = 1, ySize = 1, zSize = 1 }) {
    const { x, y, z } = position;
    const boxCoordinates = [];
    for (let dx = 0; dx < xSize; dx++) {
      for (let dy = 0; dy < ySize; dy++) {
        for (let dz = 0; dz < zSize; dz++) {
          boxCoordinates.push({ x: x + dx, y: y + dy, z: z + dz });
        }
      }
    }
    return boxCoordinates;
  },
  /**
   * Return 4 points (top face) from an origin point (voxel x0 y0)
   */
  getHorizontalFaceCoordinates(origin) {
    const { x, y } = origin;
    return [
      { x, y },
      {
        x: x + (1 / 2) * this.voxelXSize,
        y: y - (1 / 2) * this.voxelYSize
      },
      { x: x + this.voxelXSize, y },
      {
        x: x + (1 / 2) * this.voxelXSize,
        y: y + (1 / 2) * this.voxelYSize
      }
    ];
  },
  /**
   * Return the svg coordinates of the voxel x 0, y 0, z 0 point.
   */
  getVoxelOrigin(position) {
    const { x, y, z } = position;
    return {
      x:
        this.offset +
        (1 / 2) * this.voxelXSize * (x - 1) +
        (1 / 2) * this.voxelXSize * (y - 1),
      y:
        this.getStageY(z) +
        (1 / 2) * this.voxelYSize * (x - 1) -
        (1 / 2) * this.voxelYSize * (y - 1)
    };
  },
  /**
   * Return the svg y coodrinate of the nth stage.
   */
  getStageY(stage) {
    return (
      this.height -
      ((this.size / 2) * this.voxelYSize +
        this.offset +
        (stage - 1) * this.voxelYSize)
    );
  }
});

/**************************************/
/************ COLORS UTILS ************/
/**************************************/

/**
 * From https://gist.github.com/renancouto/4675192
 */
function lightenColor(color, percent) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const B = ((num >> 8) & 0x00ff) + amt;
  const G = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (B < 255 ? (B < 1 ? 0 : B) : 255) * 0x100 +
      (G < 255 ? (G < 1 ? 0 : G) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

/**
 * From https://stackoverflow.com/questions/17433015/change-the-hue-of-a-rgb-color-in-javascript
 * Changes the RGB/HEX temporarily to a HSL-Value, modifies that value
 * and changes it back to RGB/HEX.
 */

function hueShift(color, degree) {
  let hsl = rgbToHSL(color);
  hsl.h += degree;
  if (hsl.h > 360) {
    hsl.h -= 360;
  } else if (hsl.h < 0) {
    hsl.h += 360;
  }
  return hslToRGB(hsl);
}

// exepcts a string and returns an object
function rgbToHSL(rgb) {
  // strip the leading # if it's there
  rgb = rgb.replace(/^\s*#|\s*$/g, "");

  // convert 3 char codes --> 6, e.g. `E0F` --> `EE00FF`
  if (rgb.length == 3) {
    rgb = rgb.replace(/(.)/g, "$1$1");
  }

  let r = parseInt(rgb.substr(0, 2), 16) / 255,
    g = parseInt(rgb.substr(2, 2), 16) / 255,
    b = parseInt(rgb.substr(4, 2), 16) / 255,
    cMax = Math.max(r, g, b),
    cMin = Math.min(r, g, b),
    delta = cMax - cMin,
    l = (cMax + cMin) / 2,
    h = 0,
    s = 0;

  if (delta == 0) {
    h = 0;
  } else if (cMax == r) {
    h = 60 * (((g - b) / delta) % 6);
  } else if (cMax == g) {
    h = 60 * ((b - r) / delta + 2);
  } else {
    h = 60 * ((r - g) / delta + 4);
  }

  if (delta == 0) {
    s = 0;
  } else {
    s = delta / (1 - Math.abs(2 * l - 1));
  }

  return { h, s, l };
}

// expects an object and returns a string
function hslToRGB(hsl) {
  let h = hsl.h,
    s = hsl.s,
    l = hsl.l,
    c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2,
    r,
    g,
    b;

  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  r = normalize_rgb_value(r, m);
  g = normalize_rgb_value(g, m);
  b = normalize_rgb_value(b, m);

  return rgbToHex(r, g, b);
}

function normalize_rgb_value(color, m) {
  color = Math.floor((color + m) * 255);
  if (color < 0) {
    color = 0;
  }
  return color;
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
