<template>
  <div class="svgVoxelEngine">
    <svg :width="width" :height="height" :viewBox="viewBox" fill="transparent">
      <rect width="100%" height="100%" fill="gray" />
      <g
        v-for="voxel of sortedVoxels"
        :key="voxel.id"
        @click.meta="deleteVoxel(voxel)"
        @click.alt="clear(voxel)"
        @click.exact="addCloneVoxel($event, voxel)"
        @mouseover="hoverVoxel($event, voxel)"
      >
        <path
          v-for="voxelPath of voxel.voxelPaths"
          :key="voxelPath.path"
          :d="voxelPath.path"
          :fill="voxelPath.color"
        />
      </g>
      <!-- <g
        v-for="voxel of miscVoxels"
        :key="voxel.id"
        style="pointer-events: none;"
      >
        <path
          v-for="voxelPath of voxel.voxelPaths"
          :key="voxelPath.path"
          :d="voxelPath.path"
          :fill="voxelPath.color"
        />
      </g> -->
    </svg>
  </div>
</template>

<script>
import { lightenColor, hueShift } from "../utils/colors.js";

export default {
  name: "SvgVoxelEngine",
  data() {
    return {
      voxels: [],
      miscVoxels: [],
      objects: []
    };
  },
  props: {
    width: {
      type: Number,
      default: 500
    },
    height: {
      // TODO will the area be a square ???
      type: Number,
      default: 500
    },
    size: {
      type: Number,
      default: 32
    },
    rise: {
      type: Number,
      default: 20
    },
    depthRatio: {
      type: Number,
      default: 0.5
    },
    grid: {
      type: Boolean,
      default: true
    },
    gridColor: {
      type: String,
      default: "#777777"
    },
    lightCfg: {
      type: Object,
      default: () => ({})
    },
    /**
     * Offset of voxel on the svg-x axis
     */
    voxelOffset: {
      type: Number,
      default: 1
    }
  },
  created() {
    window.engine = this; // TODO for development only

    if (this.grid) {
      this.addGrid();
    }

    this.makeFullSlabObject(1, "#35EF7E");
    this.makeFullSlabObject(2, "#35EF7E");
    this.makeFullSlabObject(3, "#94979A", { offset: 5 });
    this.makeFullSlabObject(4, "#94979A", { offset: 5 });

    // this.makeBoxObject({ x: 2, y: 2, z: 2 }, "#94979A", {
    //   xSize: this.size - 2,
    //   ySize: 7,
    //   zSize: 8
    // });

    this.addVoxel({ x: 10, y: 10, z: 6 }, "#FF0000");
    // this.addVoxel({ x: 2, y: 3, z: 1 }, "#FF0000");
    // this.addVoxel({ x: 3, y: 2, z: 1 }, "#0000FF");
    // this.addVoxel({ x: 3, y: 3, z: 1 }, "#FFFF00");
    // this.addVoxel({ x: 2, y: 2, z: 2 }, "#FFA500");
    // this.addVoxel({ x: 2, y: 2, z: 3 });
    // this.addVoxel({ x: 2, y: 2, z: 5 });
    // this.addVoxel({ x: 2, y: 2, z: 7 });

    // this.deleteBox(
    //   { x: 9, y: 8, z: 1 },
    //   {
    //     xSize: 6,
    //     ySize: 8,
    //     zSize: 7
    //   }
    // );

    // this.deleteBox(
    //   { x: 8, y: 9, z: 1 },
    //   {
    //     xSize: 8,
    //     ySize: 5,
    //     zSize: 7
    //   }
    // );

    // this.makeBoxObject({ x: 10, y: 10, z: 1 }, "#EE82EE", {
    //   xSize: 5,
    //   ySize: 3,
    //   zSize: 10
    // });

    // this.mergeObjects();
    // this.mergeColors();
    this.newMergeColors();
    this.removeDusplicatedVoxelIds();
  },
  computed: {
    sortedVoxels() {
      return Array.from(this.voxels).sort((a, b) => {
        if (a.zIndex > b.zIndex) {
          return 1;
        } else if (a.zIndex < b.zIndex) {
          return -1;
        } else {
          return 0;
        }
      });
    },
    viewBox() {
      return `
      ${0}
      ${0}
      ${this.width}
      ${this.height}`;
    },
    /**
     * Returns the svg-x size of a Voxel.
     */
    voxelXSize() {
      return this.width / (this.voxelOffset * 2 + this.size);
    },
    /**
     * Returns the svg-y size of a Voxel.
     */
    voxelYSize() {
      return this.voxelXSize * this.depthRatio;
    },
    /**
     * the offset lenght on svg-x axis
     */
    offset() {
      return (this.width / this.size) * this.voxelOffset;
    }
  },
  methods: {
    newMergeColors() {
      const colors = new Map();
      const voxelPaths = this.voxels.flatMap(voxel => voxel.voxelPaths);
      voxelPaths.forEach(voxelPath => {
        if (colors.has(voxelPath.color)) {
          colors.get(voxelPath.color).push(voxelPath.path);
        } else {
          colors.set(voxelPath.color, [voxelPath.path]);
        }
      });
      this.voxels = []; // TODO - it will delete grid too
      let index = 0;
      colors.forEach((paths, color) => {
        const path = paths.reduce((acc, cur) => acc + cur, "");
        this.voxels.push({
          id: `color-object-${color}`,
          svgPath: `<path d="${path}" fill="${color}"/>`,
          voxelPaths: [{ path, color }],
          zIndex: index++
        });
      });
    },
    mergeColors() {
      const colors = new Map();
      this.voxels.forEach(voxel => {
        if (colors.has(voxel.color)) {
          colors.get(voxel.color).push(...voxel.paths);
        } else {
          colors.set(voxel.color, [...voxel.paths]);
        }
      });
      this.voxels = []; // TODO - it will delete grid too
      colors.forEach((paths, color) => {
        const path = paths.reduce((acc, cur) => acc + cur, "");
        this.voxels.push({
          id: `color-object-${color}`,
          svgPath: `<path d="${path}" fill="${color}"/>`,
          zIndex: 0
        });
      });
    },
    mergeObjects() {
      this.objects.forEach((object, index) => {
        const voxels = object.voxels;
        this.deleteVoxels(voxels);
        const path = voxels
          .flatMap(voxel => voxel.paths.flatMap(path => path))
          .reduce((acc, cur) => acc + cur, "");
        this.voxels.push({
          id: `object-${index}`,
          voxelPath: `<path d="${path}" fill="${voxels[0].color}"/>`,
          zIndex: index
        });
      });
    },
    hoverVoxel(event, voxel) {
      let position = null;
      if (event.metaKey) {
        position = voxel.position;
      } else {
        const face = event.target.getAttribute("face");
        if (!face || !["up", "right", "left"].includes(face)) return;
        position = this.getFaceNeighbourPoition(voxel.position, face);
      }
      const hvoxel = this.makeFullVoxel(position, "#FFFFFF", {
        stroke: true
      });
      hvoxel.id = "X" + hvoxel.id;
      this.miscVoxels = [hvoxel];
    },
    getFaceNeighbourPoition(position, face) {
      const { x, y, z } = position;
      return {
        x: x + (face === "right" ? 1 : 0),
        y: y - (face === "left" ? 1 : 0),
        z: z + (face === "up" ? 1 : 0)
      };
    },
    addCloneVoxel(clickEvent, voxel) {
      const face = clickEvent.target.getAttribute("face");
      if (!face || !["up", "right", "left"].includes(face)) return;

      this.addVoxel(
        this.getFaceNeighbourPoition(voxel.position, face),
        voxel.color
      );
    },
    addGrid() {
      this.addFullSlab(0, this.gridColor, {
        stroke: true,
        leftFace: false,
        rightFace: false
      });
    },
    removeDusplicatedVoxelIds() {
      const uniqueIds = new Map();
      this.sortedVoxels.forEach(voxel => uniqueIds.set(voxel.id, voxel));
      this.voxels = [...uniqueIds.values()];
    },
    /**
     * Remove the voxel and all its siblings if it belongs to an object
     */
    clear(voxel = {}) {
      const voxelsToRemove = voxel.parent ? voxel.parent.voxels : [voxel];
      this.deleteVoxels(voxelsToRemove);
    },
    deleteVoxel(voxel) {
      this.deleteVoxels([voxel]);
    },
    deleteVoxels(voxelsToRemove) {
      if (!voxelsToRemove || !voxelsToRemove.length) return false;
      this.voxels = this.voxels.filter(
        voxel => !voxelsToRemove.includes(voxel)
      );
      return true;
    },
    makeFullSlabObject(stage = 1, color = "#00FF00", cfg) {
      this.objects.push(this.addFullSlab(stage, color, cfg));
    },
    addFullSlab(stage = 1, color = "#00FF00", cfg = {}) {
      const { offset = 0 } = cfg;
      return this.makeBox(
        { x: 1 + offset, y: 1 + offset, z: stage },
        color,
        {
          xSize: this.size - 2 * offset,
          ySize: this.size - 2 * offset,
          zSize: 1
        },
        cfg
      );
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
    },
    getVoxelAt(position) {
      return this.voxels.find(voxel => voxel.id === this.generateId(position));
    },
    makeBoxObject(position, color, sizes) {
      this.objects.push(this.makeBox(position, color, sizes));
    },
    deleteBox(position, sizes) {
      this.getBoxCoordinates(position, sizes).forEach(point =>
        this.deleteVoxel(this.getVoxelAt(point))
      );
    },
    makeBox(position, color, sizes, cfg) {
      const box = {
        voxels: []
      };
      this.getBoxCoordinates(position, sizes).forEach(point =>
        box.voxels.push(this.addVoxel(point, color, cfg, box))
      );
      return box;
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
    addVoxel(position, color = "#FF0000", cfg, parent) {
      const voxel = this.makeFullVoxel(position, color, cfg, parent);
      this.voxels.push(voxel);
      return voxel;
    },
    makeFullVoxel(position, color, cfg, parent = null) {
      const paths = [];
      return {
        id: this.generateId(position),
        position,
        color,
        svgPath: this.makeVoxelSvgPath(position, color, cfg, paths),
        voxelPaths: this.makeVoxelPaths(position, color, cfg, paths),
        zIndex: this.getZIndex(position),
        parent,
        paths
      };
    },
    generateId(position) {
      return `voxel-x${position.x}-y${position.y}-z${position.z}`;
    },
    getZIndex(position) {
      const { x, y, z } = position;
      const maxPerStage = z * (this.size * 2 - 1);
      return maxPerStage - (this.size - x) - (y - 1);
    },
    makeVoxelPaths(
      position,
      color
      // { rightFace = true, leftFace = true, upFace = true, stroke = false } = {}
    ) {
      const [p1, , p3, p4, p5, p6, p7, p8] = this.getVoxelCoordinates(position);
      const paths = [];
      // TODO we loose face information
      paths.push(
        {
          path: this.makeFacePath([p5, p6, p7, p8]),
          color: this.makeFaceColor("up", color)
        },
        {
          path: this.makeFacePath([p8, p7, p3, p4]),
          color: this.makeFaceColor("right", color)
        },
        {
          path: this.makeFacePath([p1, p5, p8, p4]),
          color: this.makeFaceColor("left", color)
        }
      );
      return paths;
    },
    makeVoxelSvgPath(
      position,
      color,
      { rightFace = true, leftFace = true, upFace = true, stroke = false } = {},
      paths = []
    ) {
      const [p1, , p3, p4, p5, p6, p7, p8] = this.getVoxelCoordinates(position);
      paths.push(
        this.makeFacePath([p5, p6, p7, p8]),
        this.makeFacePath([p8, p7, p3, p4]),
        this.makeFacePath([p1, p5, p8, p4])
      );
      const upFaceSvgPath = upFace
        ? this.makeSvgPath(
            paths[0],
            this.makeFaceColor("up", color),
            stroke,
            'face="up"'
          )
        : "";
      const rightFaceSvgPath = rightFace
        ? this.makeSvgPath(
            paths[1],
            this.makeFaceColor("right", color),
            stroke,
            'face="right"'
          )
        : "";
      const leftFaceSvgPath = leftFace
        ? this.makeSvgPath(
            paths[2],
            this.makeFaceColor("left", color),
            stroke,
            'face="left"'
          )
        : "";
      return `<g>${upFaceSvgPath}${rightFaceSvgPath}${leftFaceSvgPath}</g>`;
    },
    /**
     * Lighten or darken face sepending on light configuration
     */
    makeFaceColor(face, color) {
      const {
        light = 10,
        lightFace = "up",
        lightHue = 5,
        shadow = 30,
        shadowFace = "right",
        shadowHue = 20
      } = this.lightCfg;
      if (face === lightFace) {
        return lightenColor(hueShift(color, lightHue), light);
      } else if (face === shadowFace) {
        return this.darkenColor(hueShift(color, shadowHue), shadow);
      } else {
        return color;
      }
    },
    makeSvgPath(path, color, stroke, args = "") {
      return `<path d="${path}" ${
        stroke ? "stroke" : "fill"
      }="${color}" ${args}/>`;
    },
    darkenColor(color, amount) {
      return lightenColor(color, -amount);
    },
    makeFacePath(points) {
      const [p1, p2, p3, p4] = points;
      return `M${p1.x} ${p1.y}L${p2.x} ${p2.y}L${p3.x} ${p3.y}L${p4.x} ${p4.y}Z`;
    },
    /**
     * Returns the coordinates of the voxel.
     * @return coordinates - an array of 8 value representing the 0 - 0 point, the 0 - 1 point ...
     * The 4 first values are the bottom points, the 4 last are the top ones
     */
    getVoxelCoordinates(position) {
      const origin = this.getVoxelOrigin(position);
      const bottomFaceCoordinates = this.makeHorizontalFaceCoordinates(origin);
      return [
        ...bottomFaceCoordinates,
        ...bottomFaceCoordinates.map(({ x, y }) => ({
          x,
          y: y - this.voxelYSize
        }))
      ];
    },
    /**
     * Return 4 points (up face) from an origin point (voxel x0 y0)
     */
    makeHorizontalFaceCoordinates(origin) {
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
    }
  }
};
</script>

<style scoped lang="scss"></style>
