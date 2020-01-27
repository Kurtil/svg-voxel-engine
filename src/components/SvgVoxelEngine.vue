<script>
import { lightenColor, hueShift } from "../utils/colors.js";

export default {
  name: "SvgVoxelEngine",
  data() {
    return {
      /**
       * A map of all added voxels.
       * The map ensure id unicity.
       */
      voxels: new Map(),
      /**
       * The path to display.
       */
      paths: []
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
    depthRatio: {
      type: Number,
      default: 0.5
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

    this.addFullSlab(1, "#21C786");
    this.addFullSlab(2, "#21C786");
    this.addFullSlab(3, "#6D6E71", 5);

    this.addVoxel({ x: 2, y: 2, z: 3 });
    this.addVoxel({ x: 4, y: 4, z: 3 }, "#FFFF00");
    this.addVoxel({ x: 6, y: 6, z: 3 }, "#0000FF");

    this.addVoxel({ x: this.size - 2, y: this.size - 2, z: 3 }, "#FF00FF");
    this.addVoxel({ x: this.size - 3, y: this.size - 3, z: 3 }, "#FFFF00");
    this.addVoxel({ x: this.size - 4, y: this.size - 4, z: 3 }, "#2bfafa");

    this.renderVoxels(this.addTriFacePathFromVoxel);
  },
  render(h) {
    return h("div", [
      h(
        "svg",
        {
          attrs: {
            width: this.width,
            height: this.height,
            viewBox: this.viewBox
          }
        },
        [
          h("rect", {
            attrs: {
              width: "100%",
              height: "100%",
              fill: "gray"
            }
          }),
          ...this.paths.map(path =>
            h("path", {
              key: path.id,
              attrs: {
                d: this.makeSvgPathFromPoints(path.points),
                fill: path.color
              },
              on: {
                // TODO for testing purpose
                click: () => {
                  this.paths = this.paths.filter(p => p !== path);
                }
              }
            })
          )
        ]
      )
    ]);
  },
  computed: {
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
    addFullSlab(stage = 1, color = "#00FF00", offset = 0) {
      return this.addBox({ x: 1 + offset, y: 1 + offset, z: stage }, color, {
        xSize: this.size - 2 * offset,
        ySize: this.size - 2 * offset,
        zSize: 1
      });
    },
    deleteBox(position, sizes) {
      this.getBoxCoordinates(position, sizes).forEach(point =>
        this.deleteVoxel(this.getVoxelAt(point))
      );
    },
    addBox(position, color, sizes, cfg) {
      const box = {
        voxels: []
      };
      this.getBoxCoordinates(position, sizes).forEach(point =>
        box.voxels.push(this.addVoxel(point, color, cfg, box))
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
    /**
     * Fill paths from voxels.
     * A displayed path is an object with p1, p2, p3 and color properties.
     */
    renderVoxels(voxelRenderFunction) {
      [...this.voxels.values()]
        .sort(this.voxelCompareFunction)
        .forEach(voxelRenderFunction);
    },
    addQuadFacePathFromVoxel(voxel, voxelIndex) {
      Object.entries(voxel.faces).forEach(([orientation, paths]) => {
        const p1 = paths[0][0];
        const p2 = paths[0][1];
        const p3 = orientation === "left" ? paths[1][2] : paths[1][1];
        const p4 = orientation === "left" ? paths[1][0] : paths[1][2];
        this.paths.push({
          id: `i${voxelIndex}f${orientation}`,
          points: [p1, p2, p3, p4],
          color: this.makeFaceColor(orientation, voxel.color)
        });
      });
    },
    addTriFacePathFromVoxel(voxel, voxelIndex) {
      Object.entries(voxel.faces).forEach(([orientation, paths]) => {
        this.paths.push(
          {
            id: `i${voxelIndex}f${orientation}s1`,
            points: paths[0],
            color: this.makeFaceColor(orientation, voxel.color)
          },
          {
            id: `i${voxelIndex}f${orientation}s2`,
            points: paths[1],
            color: this.makeFaceColor(orientation, voxel.color)
          }
        );
      });
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
      return this.voxels.find(voxel => voxel.id === this.generateId(position));
    },
    getZIndex(position) {
      const { x, y, z } = position;
      const maxPerStage = z * (this.size * 2 - 1);
      return maxPerStage - (this.size - x) - (y - 1);
    },
    /****************************/
    /********** COLORS **********/
    /****************************/
    /**
     * Lighten or darken face sepending on light configuration
     */
    makeFaceColor(face, color) {
      const {
        light = 10,
        lightFace = "top",
        lightHue = 5,
        shadow = 30,
        shadowFace = "right",
        shadowHue = 20
      } = this.lightCfg;
      if (face === lightFace) {
        return this.lightenColor(hueShift(color, lightHue), light);
      } else if (face === shadowFace) {
        return this.darkenColor(hueShift(color, shadowHue), shadow);
      } else {
        return color;
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
  }
};
</script>
