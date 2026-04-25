import bpy
import sys
import os
import math

argv = sys.argv
argv = argv[argv.index("--") + 1 :]

if len(argv) < 4:
    print(
        "Usage: blender --python generate_glasses.py -- <glassesWidth> <bridgeWidth> <outputPath>"
    )
    sys.exit(1)

glasses_width = float(argv[0])
bridge_width = float(argv[1])
output_path = argv[2]

bpy.ops.wm.read_factory_settings(use_empty=True)

frame_width = glasses_width
frame_height = frame_width * 0.4
lens_width = (frame_width - bridge_width) / 2
lens_height = frame_height * 0.85
temple_length = frame_width * 0.9
temple_width = 0.08
temple_thickness = 0.05
frame_thickness = 0.08
bridge_height = frame_height * 0.15

bpy.ops.mesh.primitive_cube_add(size=1)
frame = bpy.context.object
frame.name = "Frame"
frame.scale = (frame_width, frame_height, frame_thickness)
frame.location = (0, 0, 0)

bpy.ops.mesh.primitive_cube_add(size=1)
lens_l = bpy.context.object
lens_l.name = "Lens_L"
lens_l.scale = (lens_width, lens_height, frame_thickness * 0.3)
lens_l.location = (-(bridge_width / 2 + lens_width / 2), 0, 0)
lens_l.select_set(True)
frame.select_set(True)
bpy.context.view_layer.objects.active = frame
bpy.ops.object.join()

bpy.ops.mesh.primitive_cube_add(size=1)
lens_r = bpy.context.object
lens_r.name = "Lens_R"
lens_r.scale = (lens_width, lens_height, frame_thickness * 0.3)
lens_r.location = ((bridge_width / 2 + lens_width / 2), 0, 0)
lens_r.select_set(True)
frame.select_set(True)
bpy.context.view_layer.objects.active = frame
bpy.ops.object.join()

bpy.ops.mesh.primitive_cube_add(size=1)
bridge = bpy.context.object
bridge.name = "Bridge"
bridge.scale = (bridge_width, bridge_height, frame_thickness)
bridge.location = (0, frame_height * 0.3, 0)
bridge.select_set(True)
frame.select_set(True)
bpy.context.view_layer.objects.active = frame
bpy.ops.object.join()

frame.location = (0, 0, 0)

bpy.ops.mesh.primitive_cube_add(size=1)
temple_l = bpy.context.object
temple_l.name = "Temple_L"
temple_l.scale = (temple_length, temple_width, temple_thickness)
temple_l.location = (-(frame_width / 2 + temple_length / 2), -frame_height * 0.1, 0)
temple_l.rotation_euler = (0, 0, math.radians(-5))

bpy.ops.mesh.primitive_cube_add(size=1)
temple_r = bpy.context.object
temple_r.name = "Temple_R"
temple_r.scale = (temple_length, temple_width, temple_thickness)
temple_r.location = (frame_width / 2 + temple_length / 2, -frame_height * 0.1, 0)
temple_r.rotation_euler = (0, 0, math.radians(5))

mat_frame = bpy.data.materials.new(name="FrameMaterial")
mat_frame.use_nodes = True
bsdf = mat_frame.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.1, 0.1, 0.1, 1)
bsdf.inputs["Metallic"].default_value = 0.8
bsdf.inputs["Roughness"].default_value = 0.2

frame.data.materials.append(mat_frame)
temple_l.data.materials.append(mat_frame)
temple_r.data.materials.append(mat_frame)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=output_path, export_format="GLB", use_selection=True)

print(f"Glasses exported to: {output_path}")
print(f"Frame width: {frame_width}, Bridge width: {bridge_width}")
