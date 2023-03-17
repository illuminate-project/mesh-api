# Mesh API for Illuminate

API for interacting with the Illuminate's Mesh Generation. Takes an image and depth map and generates an exportable OBJ that can be rendered within a three_dart scene within the app.

## Usage

1. cd into the mesh_api directory

2. Install dependencies
    ```
    npm install
    ```
3. Start the server
    ```
    node app.js
    ```
r. Send a POST request with the image and depth map where 'image_50.jpg' and 'depth_50.png' are the image and depth map files respectively.
    ```
    curl -X POST -F image=@image_50.jpg -F depth=@depth_50.png http://localhost:3000/api/mesh -o test.obj
    ```