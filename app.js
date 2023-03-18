const express = require('express');
const multer = require('multer');
const Jimp = require('jimp');
const { createCanvas } = require('canvas');
const sharp = require('sharp');
const THREE = require('three');
const { OBJExporter } = require('three-obj-exporter');

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.post('/api/mesh', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'depth', maxCount: 1 }]), async (req, res) => {
  try {
    const image = await Jimp.read(req.files['image'][0].buffer);
    const depthBuffer = req.files['depth'][0].buffer;
    const { width, height } = image.bitmap;

    // Decode the depth map from grayscale to RGB format
    const depthImage = await sharp(depthBuffer)
      .resize(width, height)
      .toFormat('png')
      .raw()
      .toBuffer({ resolveWithObject: true });

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    // Set the RGB values of the image data from the depth map
    for (let i = 0; i < depthImage.data.length; i += 3) {
      const depth = depthImage.data[i];
      imageData.data[i] = depth;
      imageData.data[i + 1] = depth;
      imageData.data[i + 2] = depth;
      imageData.data[i + 3] = 255;
    }

    // Draw the image data onto the canvas
    ctx.putImageData(imageData, 0, 0);

    // Use Three.js to create a mesh from the canvas
    const geometry = new THREE.PlaneGeometry(image.bitmap.width, image.bitmap.height, image.bitmap.width - 1, image.bitmap.height - 1);
    if (!geometry.attributes.position) {
      throw new Error('Failed to create geometry attributes');
    }
    const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    if (!mesh.geometry) {
      throw new Error('Failed to create mesh geometry');
    }

    console.log('mesh.geometry:', mesh.geometry);
    console.log('mesh.geometry.attributes.position:', mesh.geometry.attributes.position);

    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      const { x, y } = mesh.geometry.attributes.position.getItem(i);
      const { data } = ctx.getImageData(x, y, 1, 1);
    
      // Set the height of the vertex based on the grayscale value of the corresponding pixel in the depth map
      mesh.geometry.attributes.position.setZ(i, (data[0] + data[1] + data[2]) / 3 / 255);
    }

    // Export the mesh as an OBJ file
    const exporter = new OBJExporter();
    if (!(exporter instanceof OBJExporter)) {
      throw new Error('Failed to create OBJExporter instance');
    }
    const obj = exporter.parse(mesh);
    if (!obj) {
      throw new Error('Failed to parse mesh as OBJ file');
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename=model.obj');
    res.send(obj);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});