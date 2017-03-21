
function Cozmo3d() {

  var that = this;

  var modelsMap = {
    'CRATE': CozmoBlockly.Crate,
    'ZOMBIE': CozmoBlockly.Zombie,
    'SPIDERMAN': CozmoBlockly.Spiderman,
    'WALL_BRICK': CozmoBlockly.WallBrick,
    'WALL_WOOD': CozmoBlockly.WallWood
  };

  this._initialized = false;
  this._animationId = null;
  this._dirty = false;
  this._scene = null;
  this._camera = null;
  this._cameraOrthographic = null;
  this._controls = null;
  this._floor = null;
  this._cozmo = null;
  this._cubes = [];
  this._statics = [];
  this._anaglyph = false;
  this._gridOn = false;
  this._perspective = true;
  this._grid = null;
  this._gridNumbers = [];
  this._models = {
    'cubes': ['CRATE', 'CRATE', 'CRATE'],
    'statics': []
  };
  this._lastCameraPos = [-500,450,500];

  this.init = function() {
    if (that._initialized) {
      return;
    }

    that._scene = new THREE.Scene();
    var canvas = document.getElementById("canvas_3d");
    var width = $(canvas).width();
    var height = $(canvas).height();
    that._camera = new THREE.PerspectiveCamera( 45, width/height, 0.1, 4000 );
    that._cameraOrthographic = new THREE.OrthographicCamera( width / -2, width / 2, height / 2, height / -2, 0.1, 4000 );

    var pos = this._lastCameraPos;
    that._camera.position.set(pos[0], pos[1], pos[2]);
    that._cameraOrthographic.position.set(pos[0], pos[1], pos[2]);
    // that._camera.focalLength = 3;
    that._camera.lookAt(that._scene.position);
    that._cameraOrthographic.lookAt(that._scene.position);
    that._scene.add(that._camera);
    that._scene.add(that._cameraOrthographic);

    that._renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
    that._renderer.setSize(width, height);
    that._renderer.setPixelRatio( window.devicePixelRatio );

    var light = new THREE.PointLight(0xffffff);
    light.position.set(-100,400,100);
    that._scene.add(light);

    // FLOOR
    var floorTexture = CozmoBlockly.loadTexture( 'img/3d/grasslight-thin.jpg' );
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping; 
    floorTexture.repeat.set( 1, 10 );
    var floorMaterial = new THREE.MeshBasicMaterial( { map: floorTexture, side: THREE.BackSide } );
    var floorGeometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
    that._floor = new THREE.Mesh(floorGeometry, floorMaterial);
    // floor.position.y = -0.5;
    that._floor.rotation.x = Math.PI / 2;
    that._scene.add(that._floor);

    // SKYBOX
    var skyBoxGeometry = new THREE.BoxGeometry( 3000, 3000, 3000 );
    var skyBoxMaterial = new THREE.MeshBasicMaterial( { color: 0x9999ff, side: THREE.BackSide } );
    var skyBox = new THREE.Mesh( skyBoxGeometry, skyBoxMaterial );
    that._scene.add(skyBox);

    // COZMO
    that._cozmo = new CozmoBlockly.Cozmo(that._scene);
    that._cozmo.addToScene();

    // CUBES
    for (var i = 0; i < that._models.cubes.length; i++) {
      var model = that._models.cubes[i];
      var clazz = modelsMap[model];
      var instance = new clazz(that._scene);
      instance.addToScene();
      that._cubes.push(instance);
    }

    // STATICS
    for (var i = 0; i < that._models.statics.length; i++) {
      var obj = that._models.statics[i];
      var clazz = modelsMap[obj.model];
      var instance = new clazz(that._scene, obj.x1, obj.y1, obj.x2, obj.y2, obj.depth, obj.height);
      instance.addToScene();
      that._statics.push(instance);
    }

    that._effect = new THREE.AnaglyphEffect( that._renderer, width || 2, height || 2 );

    CozmoBlockly.loadingManager.onLoad = function() {
      that._renderOnce();
    }

    that._setControls();

    that._initialized = true;
  };

  this.deinit = function() {
    if (!that._initialized) {
      return;
    }

    that._unsetControls();

    CozmoBlockly.loadingManager.onLoad = function() {};

    that._scene = null;
    var camera = that._perspective ? that._camera : that._cameraOrthographic;
    that._lastCameraPos = camera.position.toArray();
    that._camera = null;
    that._cameraOrthographic = null;

    that._renderer.dispose();
    that._renderer = null;

    that._floor = null;

    that._cozmo = null;
    that._cubes = [];
    that._statics = [];

    that._effect = null;

    for (var key in CozmoBlockly.textureMap) {
      if (CozmoBlockly.textureMap.hasOwnProperty(key)) {
        var texture = CozmoBlockly.textureMap[key];
        texture.dispose();
      }
    }
    CozmoBlockly.textureMap = {};

    that._initialized = false;
  };

  this._setControls = function() {
    var camera = that._perspective ? that._camera : that._cameraOrthographic;
    var canvas = document.getElementById("canvas_3d");
    that._controls = new THREE.OrbitControls( camera, canvas );
    that._controls.minDistance = 10;
    that._controls.maxDistance = 1200;
    that._controls.minZoom = 0.7;
    that._controls.maxZoom = 10;
    that._controls.customEventListener = function() {
      that._renderOnce();
    };
    that._controls.addEventListener('change', that._controls.customEventListener);
  };

  this._unsetControls = function() {
    that._controls.removeEventListener('change', that._controls.customEventListener);
    that._controls.dispose();
    that._controls = null;
  };

  this.start = function() {
    if (!that._initialized) {
      return;
    }
  
    // Mock locations first to see the scene whithout any program running.
    // var data = {
    //   "cozmo": {
    //     "x": 0,
    //     "y": 0,
    //     "z": 0,
    //     "rot": [1, 0, 0, 0]
    //   },
    //   "cubes": [{
    //       "x": 200,
    //       "y": 20,
    //       "z": 50,
    //       "rot": [0.537, 0, 0, 0.843],
    //       "seen": true,
    //       "visible": true
    //     }, {
    //       "x": 200,
    //       "y": -20,
    //       "z": 5,
    //       "rot": [0.643, 0, 0, 0.766],
    //       "seen": true,
    //       "visible": true
    //     }, {
    //       "x": 195,
    //       "y": 40,
    //       "z": 5,
    //       "rot": [0.643, 0, 0, 0.766],
    //       "seen": true,
    //       "visible": true
    //     }
    //   ]
    // };

    // Override for testing
    var data = {
      "cozmo": {
        "x": 0,
        "y": 0,
        "z": 0,
        "rot": [1, 0, 0, 0],
        "seen": false
      },
      "cubes": [{
          "x": 200,
          "y": 20,
          "z": 50,
          "rot": [0.537, 0, 0, 0.843],
          "seen": false,
          "visible": false
        }, {
          "x": 200,
          "y": -20,
          "z": 5,
          "rot": [0.643, 0, 0, 0.766],
          "seen": false,
          "visible": false
        }, {
          "x": 195,
          "y": 40,
          "z": 5,
          "rot": [0.643, 0, 0, 0.766],
          "seen": false,
          "visible": false
        }
      ]
    };
    that._setGrid();
    that.onData(data);
    that._render();
  };
  
  this.stop = function() {
    if (!that._initialized) {
      return;
    }
    cancelAnimationFrame(that._animationId);
  };

  this._renderOnce = function () {
    if (!that._initialized) {
      return;
    }
    that._dirty = true;
  };

  this._render = function () {
    that._controls.update()

    if (that._dirty) {
      var camera = that._perspective ? that._camera : that._cameraOrthographic;

      for (var i = 0; i < that._gridNumbers.length; i++) {
        that._gridNumbers[i].lookAt(camera.position);
      }

      if (that._anaglyph) {
        that._effect.render(that._scene, camera);
      } else {
        that._renderer.render(that._scene, camera);
      }

      that._dirty = false;
    }

    that._animationId = requestAnimationFrame(that._render);
  };

  this.toggleAnaglyph = function() {
    if (!that._initialized) {
      return;
    }
    that._anaglyph = !that._anaglyph;
    that._renderOnce();
  };

  this.toggleGrid = function() {
    that._gridOn = !that._gridOn;
    that._setGrid();
    that._renderOnce();
  };

  this.togglePerspective = function() {
    if (!that._initialized) {
      return;
    }
    var camFrom;
    var camTo;
    if (that._perspective) {
      camFrom = that._camera;
      camTo = that._cameraOrthographic;
    } else {
      camFrom = that._cameraOrthographic;
      camTo = that._camera;
    }
    var pos = camFrom.position;
    camTo.position.set(pos.x, pos.y, pos.z);
    camTo.lookAt(that._scene.position);

    that._perspective = !that._perspective;
    that._unsetControls();
    that._setControls();
    that._renderOnce();
  };

  this.cameraTo = function(axis) {
    if (!that._initialized) {
      return;
    }
    var pos;
    if (axis === 'x') {
      pos = [1500, 0, 0];
    } else if (axis === 'y') {
      pos = [0, 0, 1500];
    } else {
      pos = [0, 1500, 0];
    }
    that._camera.position.set(pos[0], pos[1], pos[2]);
    that._camera.lookAt(that._scene.position);
    that._cameraOrthographic.position.set(pos[0], pos[1], pos[2]);
    that._cameraOrthographic.lookAt(that._scene.position);
    that._renderOnce();
  };

  this._setGrid = function() {
    if (!that._gridOn) {
      if (that._grid) {
        that._scene.remove(that._grid);
      }
      that._floor.visible = true;
    } else {
      that._floor.visible = false;
      if (!that._grid) {
        that._grid = new THREE.GridHelper( 1000, 20, 0xeeeeee, 0x44ee77 );
        that._grid.position.x = 1;
        var fontLoader = new THREE.FontLoader();
        var font = fontLoader.parse(font_gentilis_bold);
        var textMaterial = new THREE.MeshBasicMaterial( { color: 0x44ee77, side: THREE.FrontSide } );
        function makeAxis(text, x, z) {
          var mesh = makeText(text);
          mesh.position.x = x;
          mesh.position.y = 50;
          mesh.position.z = z;
          that._gridNumbers.push(mesh);
          that._grid.add(mesh);
        }
        function makeText(text) {
            var textGeometry = new THREE.TextGeometry(text, {
              font: font,
              size: 30,
              height: 1
            });
            textGeometry.computeBoundingBox();
            var box = textGeometry.boundingBox;
            var offset = (box.max.x - box.min.x) / 2.0;
            textGeometry.applyMatrix(new THREE.Matrix4().makeTranslation( -offset, 0, 0 ));
            return new THREE.Mesh(textGeometry, textMaterial);
        }
        function addNumbers(x, z) {
          for (var i = -400; i < 500; i += 100) {
            var mesh;
            if (x) {
              mesh = makeText("" + (-i / 10));
              mesh.position.x = x;
              mesh.position.z = i;
            } else {
              mesh = makeText("" + i / 10);
              mesh.position.x = i;
              mesh.position.z = z;
            }
            mesh.position.y = 50;
            that._gridNumbers.push(mesh);
            that._grid.add(mesh);
          }
        }
        addNumbers(null, -500);
        addNumbers(500, null);
        makeAxis("X", -500, -500);
        makeAxis("Y", 500, 500);
      }
      that._scene.add(that._grid);
    }
  };

  this.onData = function(data) {
    if (!that._initialized) {
      return;
    }
    if (data.cozmo || data.cubes) {
      that._cozmo.update(data.cozmo);
      for (var i = 0; i < that._cubes.length; i++) {
        that._cubes[i].update(data.cubes[i]);
      }
    } else if (data.addStaticObject) {
      var static = data.addStaticObject;
      that.addStaticModel(static.model, static.x1, static.y1, static.x2, static.y2, static.depth, static.height);
    } else if (data.setCubeModel) {
      var mod = data.setCubeModel;
      that.setCubeModel(mod.model, mod.cubeNum);
    } else if (data.aruco && data.aruco.length > 0) {
      for (var i = 0; i < data.aruco.length; i++) {
        var id = data.aruco[i].id;
        if (id == 5 || id == 10) {
          var cube;
          var r0 = data.aruco[i].rot;
          var pos = CozmoBlockly.aruco2threejs.position(data.aruco[i].pos);
          var rot = CozmoBlockly.aruco2threejs.rotation(data.aruco[i].rot);
          if (id == 5) {
            cube = that._cubes[1];
            tick(r0[0], r0[1], r0[2], r0[3]);
          } else if (id == 10) {
            cube = that._cubes[2];
          }

          var quat = new THREE.Quaternion(rot[0], rot[1], rot[2], rot[3])
          cube.mesh.setRotationFromQuaternion(quat);
          cube.mesh.position.x = pos[0];
          cube.mesh.position.y = pos[1];
          cube.mesh.position.z = pos[2];

          cube.setOpacity(1);
        }
      }
    }
    that._renderOnce();
  };

  this.setCubeModel = function(model, num) {
    console.log('Changing model for cube', model, num);
    that._models.cubes[num-1] = model;
    if (!that._initialized) {
      return;
    }
    var oldCube = that._cubes[num-1];
    var clazz = modelsMap[model];
    var instance = new clazz(that._scene);
    oldCube.copyPoseTo(instance);
    oldCube.removeFromScene(that._scene);
    instance.addToScene();
    that._cubes[num-1] = instance;
  };

  this.addStaticModel = function(model, x1, y1, x2, y2, depth, height) {
    // console.log("adding static model", model, x1, y1, x2, y2, depth, height);
    var obj = {
      "model": model,
      "x1": x1 * 10,
      "y1": y1 * 10,
      "x2": x2 * 10,
      "y2": y2 * 10,
      "depth": depth * 10,
      "height": height * 10
    };
    that._models.statics.push(obj);
    if (!that._initialized) {
      return;
    }
    var clazz = modelsMap[model];
    var instance = new clazz(that._scene, obj.x1, obj.y1, obj.x2, obj.y2, obj.depth, obj.height);
    instance.addToScene();
    that._statics.push(instance);
  };

  this.clearStatics = function() {
    for (var i = 0; i < that._statics.length; i++) {
      var instance = that._statics[i];
      instance.removeFromScene();
    }
    that._models.statics = []
    that._statics = [];
  };
}
