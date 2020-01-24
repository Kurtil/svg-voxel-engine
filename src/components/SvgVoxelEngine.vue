<template>
  <div class="svgVoxelEngine">
    <svg :width="width" :height="height" :viewBox="viewBox">
      <rect width="100%" height="100%" fill="gray" />
      <g v-for="voxel of sortedVoxels" :key="voxel.id" v-html="voxel.svgPath" />
    </svg>
  </div>
</template>

<script>
export default {
  name: "SvgVoxelEngine",
  data() {
    return {
      voxels: []
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
      default: 20
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
      this.addFullSlab(0, "#21C786");
    }
    this.addVoxel({ x: 2, y: 2, z: 1 });
    this.addVoxel({ x: 2, y: 3, z: 1 }, "#FF0000");
    this.addVoxel({ x: 3, y: 2, z: 1 }, "#0000FF");
    this.addVoxel({ x: 3, y: 3, z: 1 }, "#FFFF00");
    this.addVoxel({ x: 2, y: 2, z: 2 }, "#FFA500");
    this.addVoxel({ x: 2, y: 2, z: 3 });
    this.addVoxel({ x: 2, y: 2, z: 5 });
    this.addVoxel({ x: 2, y: 2, z: 7 });

    this.makeBox({ x: 10, y: 10, z: 1 }, "#EE82EE", {
      xSize: 5,
      ySize: 3,
      zSize: 10
    });
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
    addFullSlab(stage = 1, color = "#00FF00") {
      for (let x = 1; x <= this.size; x++) {
        for (let y = 1; y <= this.size; y++) {
          this.addVoxel({ x, y, z: stage }, color);
        }
      }
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
    makeBox(position, color, { xSize = 1, ySize = 1, zSize = 1 }) {
      const { x, y, z } = position;
      for (let dx = 0; dx < xSize; dx++) {
        for (let dy = 0; dy < ySize; dy++) {
          for (let dz = 0; dz < zSize; dz++) {
            this.addVoxel({ x: x + dx, y: y + dy, z: z + dz }, color);
          }
        }
      }
    },
    addVoxel(position, color = "#FF0000", cfg) {
      this.voxels.push(this.makeFullVoxel(position, color, cfg));
    },
    makeFullVoxel(position, color, cfg) {
      return {
        id: `voxel-x${position.x}-y${position.y}-z${position.z}`,
        svgPath: this.makeVoxelSvgPath(position, color, cfg),
        zIndex: this.getZIndex(position)
      };
    },
    getZIndex(position) {
      const { x, y, z } = position;
      const maxPerStage = z * (this.size * 2 - 1);
      return maxPerStage - (this.size - x) - (y - 1);
    },
    makeVoxelSvgPath(
      position,
      color,
      { rightFace = true, leftFace = true, upFace = true } = {}
    ) {
      const [p1, , p3, p4, p5, p6, p7, p8] = this.getVoxelCoordinates(position);
      const upFaceSvgPath = upFace
        ? this.makeSvgPath(
            this.makeFacePath([p5, p6, p7, p8]),
            this.lightenColor(color, 10)
          )
        : "";
      const rightFaceSvgPath = rightFace
        ? this.makeSvgPath(this.makeFacePath([p1, p5, p8, p4]), color)
        : "";
      const leftFaceSvgPath = leftFace
        ? this.makeSvgPath(
            this.makeFacePath([p8, p7, p3, p4]),
            this.darkenColor(color, 40)
          )
        : "";
      return `<g>${upFaceSvgPath}${rightFaceSvgPath}${leftFaceSvgPath}</g>`;
    },
    makeSvgPath(path, color) {
      return `<path d="${path}" fill="${color}" />`;
    },
    darkenColor(color, amount) {
      return this.lightenColor(color, -amount);
    },
    /**
     * From https://gist.github.com/renancouto/4675192
     */
    lightenColor(color, percent) {
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
