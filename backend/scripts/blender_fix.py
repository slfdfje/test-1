import bpy
import sys
import os

# Get job ID from command line
argv = sys.argv
argv = argv[argv.index("--") + 1:]
job_id = argv[0]

base_path = os.getcwd()
input_obj = f"{base_path}/temp/{job_id}/meshroom_output/texturedMesh.obj"
output_glb = f"{base_path}/output/{job_id}.glb"

print(f"Processing: {input_obj}")
print(f"Output: {output_glb}")

# Check if input file exists
if not os.path.exists(input_obj):
    print(f"ERROR: Input file not found: {input_obj}")
    sys.exit(1)

# Reset Blender
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import OBJ
try:
    bpy.ops.import_scene.obj(filepath=input_obj)
    print("OBJ imported successfully")
except Exception as e:
    print(f"ERROR importing OBJ: {e}")
    sys.exit(1)

# Get the imported object
if len(bpy.context.selected_objects) == 0:
    print("ERROR: No objects imported")
    sys.exit(1)

obj = bpy.context.selected_objects[0]
print(f"Processing object: {obj.name}")

# Center and scale
obj.location = (0, 0, 0)
obj.scale = (0.01, 0.01, 0.01)

# Apply transforms
bpy.ops.object.transform_apply(location=True, scale=True, rotation=True)

# Rotate for proper alignment (glasses facing forward)
obj.rotation_euler[0] = 1.5708  # 90 degrees in radians

# Clean up mesh
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles()
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')

# Export as GLB
try:
    bpy.ops.export_scene.gltf(
        filepath=output_glb,
        export_format='GLB',
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT'
    )
    print(f"GLB exported successfully: {output_glb}")
except Exception as e:
    print(f"ERROR exporting GLB: {e}")
    sys.exit(1)

print("Processing complete!")
