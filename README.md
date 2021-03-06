# svg-voxel-engine

A SVG voxel engine to display isometric art.

Simple to use (see index.html):

```javascript
    import svgVoxelEngineFactory from './svgVoxelEngineFactory.js';

    const svgVoxelEngine = svgVoxelEngineFactory();

    svgVoxelEngine.addFullSlab(1, "#21C786");

    svgVoxelEngine.addVoxel({ x: 5, y: 1, z: 3 }, "#FFFF00");
    svgVoxelEngine.addVoxel({ x: 7, y: 1, z: 3 }, "#FF00FF");
    svgVoxelEngine.addVoxel({ x: 9, y: 1, z: 3 }, "#00FFFF");

    svgVoxelEngine.deleteVoxel({ x: 2, y: 2, z: 1 });

    svgVoxelEngine.addBox({ x: 1, y: 11, z: 2 }, "#0000FF", {
      xSize: 6,
      ySize: 6,
      zSize: 4
    });
    svgVoxelEngine.deleteBox({ x: 4, y: 11, z: 2 }, {
      xSize: 3,
      ySize: 3,
      zSize: 2
    });

    svgVoxelEngine.addFullSlab(2, "#94979A", 5);

    svgVoxelEngine.render();
```

![simple example screenshot](example.png)