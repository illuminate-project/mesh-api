import express from 'express';
import multer from 'multer';
import { createCanvas, ImageData } from 'canvas';
import * as THREE from 'three';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import decode from 'image-decode';

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

        var far = 20;
        var near = 5;

        var width = decode(req.files.depth[0].buffer).width;
        var height = decode(req.files.depth[0].buffer).height;
        var decodedData1 = new Uint8ClampedArray(decode(req.files.depth[0].buffer).data);
        var decodedData2 = new Uint8ClampedArray(decode(req.files.image[0].buffer).data);

        // change this manually to change scale
        var downsample = 6;
        var w = Math.round( width / downsample );
        var h = Math.round( height / downsample );

        // depth canvas
        var canvas = createCanvas( width, height );
        var ctx = canvas.getContext( '2d' );
        //ctx.drawImage(depthImage, 0, 0);
        //var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var imageData = new ImageData(decodedData1, width, height);
        console.log("please work");
        console.log(imageData.data);
        var p = 0;

        // color canvas
        var colorCanvas = createCanvas( width, height );
        var colorCtx = colorCanvas.getContext( '2d' );
        //colorCtx.drawImage(colorImage, 0, 0);
        //var colorImageData = colorCtx.getImageData(0, 0, colorCanvas.width, colorCanvas.height);
        var colorImageData = new ImageData(decodedData2, width, height);
        var colorP = 0;

        // plane geometry (missing image data)
        var geometry = new THREE.BufferGeometry();
        console.log("GEOMETRY IS ")
        console.log(geometry)
        var size = w * h;

        console.log("w and h are " + w + " " + h + "")
        console.log("SIZE IS " + size + "")

        // geometry.addAttribute( 'position', Float32Array, size, 3 ); // item size is 3
        // geometry.addAttribute( 'customColor', Float32Array, size, 3 );

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(size * 3), 3));
        geometry.setAttribute('customColor', new THREE.BufferAttribute(new Float32Array(size * 3), 3));

        console.log("buffer geometry")
        console.log(geometry)
        console.log(geometry.attributes.position.array)
        console.log(geometry.attributes.position.array.length)
        console.log("size")
        console.log(size)
    
        var positions = geometry.attributes.position.array;
        var customColors = geometry.attributes.customColor.array;

        var adjustment = 10 * 960 / width; 
        var ar = height / width;
        var scale = new THREE.Vector3( 1, 1, 1 );
        var v = new THREE.Vector3();
        var ptr = 0;
        var minZ = 100000000000, maxZ = -100000000000;

        // computes points for the mesh
        for( var y = 0; y < h; y++ ) {
            for( var x = 0; x < w; x++ ) {
                v.x = ( x - .5 * w ) / w;
                v.y = ( y - .5 * h ) / h;
                p = Math.round( ( ( -v.y + .5 ) ) * ( height - 1 ) ) * width * 4 + Math.round( ( ( v.x + .5 ) ) * ( width - 1 ) ) * 4;
                //console.log("y = ",y,"x = ",x,
                //                        "imageData = ",imageData.data[ p ],
                //                        "colorImageData = ",colorImageData.data[ p + 0 ],colorImageData.data[ p + 1 ],colorImageData.data[ p + 2 ]);
                var dn = imageData.data[ p ] / 255;
                //var rd = ( far * near ) / ( far - dn * ( far - near ) ); // RangeInverse
                var rd = ( 1 - dn ) * ( far - near ) + near; // RangeLinear
                v.z = -rd ;
                v.x *= rd * 1;
                v.y *= rd * ar;
                v.multiply( scale );

                positions[ ptr + 0 ] = v.x;
                positions[ ptr + 1 ] = v.y;
                positions[ ptr + 2 ] = v.z;

                customColors[ ptr + 0 ] = colorImageData.data[ p + 0 ] / 255;
                customColors[ ptr + 1 ] = colorImageData.data[ p + 1 ] / 255;
                customColors[ ptr + 2 ] = colorImageData.data[ p + 2 ] / 255;
                
                ptr += 3;

                if( v.z < minZ ) minZ = v.z;
                if( v.z > maxZ ) maxZ = v.z;

            }
        }

        var offset = ( maxZ - minZ ) / 2;
     
        
        // CREATING PLANE GEOMETRY FOR MESH

        var planeGeometryOld = new THREE.PlaneGeometry( 1, 1, Math.round( w ), Math.round( h ) );
        console.log("PLANE GEOMETRY OLD")
        console.log(planeGeometryOld)
        console.log(planeGeometryOld.attributes.position.array) // THIS IS VERTICES

        var planeGeometry = new THREE.BufferGeometry();
        //var vertices = new Float32Array(size * 3); // x, y, z per point, num points = size
        var vertices = new Array(size);
        // add attribute array of size w * h, each index is a vector p

        ptr = 0;
        var vx, vy, vz;

        var vertex = new THREE.Vector3();

        // this loops works !!!
        for( var j = 0; j < planeGeometryOld.attributes.position.array.length; j += 3 ){
            vx = planeGeometryOld.attributes.position.array[ j ];
            vy = planeGeometryOld.attributes.position.array[ j + 1 ];
            vz = planeGeometryOld.attributes.position.array[ j + 2 ];

            // returb
            p = Math.round( ( ( -vy + .5 ) ) * ( height - 1 ) ) * width * 4 + Math.round( ( ( vx + .5 ) ) * ( width - 1 ) ) * 4;

            var dn = imageData.data[ p ] / 255;
            var rd = ( 1 - dn ) * ( far - near ) + near; // RangeLinear

            vz = -rd;
            vx *= rd * 1;
            vy *= rd * ar;
            vz += offset;

            planeGeometryOld.attributes.position.array[ j ] = vx; // changes horizontal squish
            planeGeometryOld.attributes.position.array[ j + 1 ] = vy; // changes vertical squish
            planeGeometryOld.attributes.position.array[ j + 2 ] = vz * 0.50; // changes depth
            vertices[j] = vx;
            vertices[j+1] = vy;
            vertices[j+2] = vz;
        }


        console.log("THIS IS THE OLD PLANE GEOMETRY after loop")
        console.log(planeGeometryOld)
        console.log(planeGeometryOld.attributes.position.array)

        // planeGeometry.computeFaceNormals();
        planeGeometryOld.computeVertexNormals();

        // create mesh with texture and plane geometry
        var mesh = new THREE.Mesh( planeGeometryOld, new THREE.MeshBasicMaterial( { /*map: tex,*/ wireframe: false, side: THREE.DoubleSide }) );
        console.log("COMPARING MESH TO DP")
        console.log(mesh)
        mesh.scale.set( adjustment, adjustment, adjustment );


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